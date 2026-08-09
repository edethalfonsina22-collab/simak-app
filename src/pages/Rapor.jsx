import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import BulkImportModal from '../components/BulkImportModal'
import TeleponLink from '../components/TeleponLink'
import { Plus, UploadCloud, Pencil, Trash2, Search, X, Loader2, Download, FileSpreadsheet, Printer, ChevronDown, Camera, IdCard } from 'lucide-react'

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Lainnya']

const emptyForm = {
  nis: '',
  nisn: '',
  nik: '',
  nama_lengkap: '',
  jenis_kelamin: 'L',
  agama: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  alamat: '',
  alamat_tinggal: '',
  nama_orang_tua: '',
  nama_ayah: '',
  nama_ibu: '',
  no_hp_orang_tua: '',
  kelas_id: '',
  status: 'aktif',
  // TAMBAHAN: dipakai di Halaman Identitas Rapor (halaman sampul/identitas peserta didik)
  pendidikan_sebelumnya: '',
  pendidikan_ayah: '',
  pendidikan_ibu: '',
  pekerjaan_ayah: '',
  pekerjaan_ibu: '',
  ortu_kelurahan_desa: '',
  ortu_kecamatan: '',
  ortu_kabupaten_kota: '',
  ortu_provinsi: '',
  nama_wali: '',
  pekerjaan_wali: '',
  alamat_wali: '',
}

// Header ini HARUS sama persis dengan templateHeaders di BulkImportModal (Impor Massal)
// supaya file yang diunduh dari sini bisa langsung diupload ulang tanpa perlu diubah nama kolomnya.
const EXCEL_HEADERS = [
  'nama_lengkap', 'nis', 'nisn', 'nik', 'kelas', 'jenis_kelamin(L/P)', 'agama',
  'tempat_lahir', 'tanggal_lahir(YYYY-MM-DD)', 'nama_ayah', 'nama_ibu', 'nama_orang_tua',
  'no_hp_orang_tua', 'alamat', 'alamat_tinggal',
]

// Motif batik (kawung + parang) — sama persis dengan Profil Saya, Dasbor, Galeri & Dokumen,
// warna garis menyesuaikan latar (emas di atas navy).
function BatikOverlay({ patternId, strokeColor = '#d4af37', opacity = 1, size = 72 }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <g fill="none" stroke={strokeColor} strokeWidth="1.1" opacity={opacity}>
            <ellipse cx={size / 2} cy={size * 0.333} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size / 2} cy={size * 0.667} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size * 0.333} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <ellipse cx={size * 0.667} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <circle cx={size / 2} cy={size / 2} r={size * 0.042} opacity="0.7" />
          </g>
          <path
            d={`M0 ${size} L${size * 0.25} ${size * 0.75} L${size * 0.5} ${size} L${size * 0.75} ${size * 0.75} L${size} ${size}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.35}
          />
          <path
            d={`M0 0 L${size * 0.25} ${size * 0.25} L0 ${size * 0.5}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.3}
          />
          <circle cx={size * 0.11} cy={size * 0.11} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.89} cy={size * 0.22} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.22} cy={size * 0.89} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

function formatTanggalLahir(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

function tempatTanggalLahir(s) {
  const tempat = s.tempat_lahir?.trim()
  const tanggal = formatTanggalLahir(s.tanggal_lahir)
  if (tempat && tanggal) return `${tempat}, ${tanggal}`
  if (tempat) return tempat
  if (tanggal) return tanggal
  return '—'
}

export default function Siswa() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [profilLihat, setProfilLihat] = useState(null) // siswa yang sedang dilihat detail profilnya

  async function loadData() {
    setLoading(true)
    const [{ data: siswa }, { data: kelas }] = await Promise.all([
      supabase.from('siswa').select('*, kelas(nama_kelas)').order('nama_lengkap'),
      supabase.from('kelas').select('id, nama_kelas').order('nama_kelas'),
    ])
    setData(siswa || [])
    setKelasList(kelas || [])
    setLoading(false)
    // Jaga agar modal profil tetap sinkron kalau datanya baru saja diubah (misal setelah upload foto)
    if (profilLihat) {
      const updated = (siswa || []).find((s) => s.id === profilLihat.id)
      if (updated) setProfilLihat(updated)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tutup dropdown export saat klik di luar area tombolnya
  useEffect(() => {
    function handleClickOutside(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Foto profil: memakai bucket & kolom yang sama persis dengan fitur Cetak Kartu ---
  function fotoUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-siswa').getPublicUrl(path).data.publicUrl
  }

  async function handleFotoUpload(siswaId, file) {
    setUploadingId(siswaId)
    const ext = file.name.split('.').pop()
    const path = `${siswaId}/foto.${ext}`
    const { error: uploadError } = await supabase.storage.from('foto-siswa').upload(path, file, { upsert: true })
    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingId(null)
      return
    }
    await supabase.from('siswa').update({ foto_path: path }).eq('id', siswaId)
    await loadData()
    setUploadingId(null)
  }

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...emptyForm, ...row, kelas_id: row.kelas_id || '' })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, kelas_id: form.kelas_id || null }
    delete payload.kelas

    const { error } = editingId
      ? await supabase.from('siswa').update(payload).eq('id', editingId)
      : await supabase.from('siswa').insert(payload)

    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data siswa ini? Tindakan ini tidak bisa dibatalkan.')) return
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const filtered = data.filter((s) =>
    `${s.nama_lengkap} ${s.nis} ${s.nisn} ${s.nik}`.toLowerCase().includes(search.toLowerCase())
  )

  // --- Export: Excel (.xlsx) siap-edit & siap-impor-ulang ---
  // Kolomnya dibuat SAMA PERSIS dengan format Impor Massal, jadi guru/admin bisa:
  // unduh -> edit data massal di Excel -> upload lagi lewat "Impor Massal" tanpa perlu ubah header.
  function handleExportExcel() {
    setShowExportMenu(false)
    const rows = filtered.map((s) => ({
      nama_lengkap: s.nama_lengkap || '',
      nis: s.nis || '',
      nisn: s.nisn || '',
      nik: s.nik || '',
      kelas: s.kelas?.nama_kelas || '',
      'jenis_kelamin(L/P)': s.jenis_kelamin || '',
      agama: s.agama || '',
      tempat_lahir: s.tempat_lahir || '',
      'tanggal_lahir(YYYY-MM-DD)': s.tanggal_lahir || '',
      nama_ayah: s.nama_ayah || '',
      nama_ibu: s.nama_ibu || '',
      nama_orang_tua: s.nama_orang_tua || '',
      no_hp_orang_tua: s.no_hp_orang_tua || '',
      alamat: s.alamat || '',
      alamat_tinggal: s.alamat_tinggal || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS })
    ws['!cols'] = [
      { wch: 24 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 12 },
      { wch: 16 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 22 },
      { wch: 16 }, { wch: 30 }, { wch: 30 },
    ]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
    XLSX.writeFile(wb, `Data-Siswa-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // --- Export: Excel (CSV) ---
  function handleExportCSV() {
    setShowExportMenu(false)
    const headers = ['Nama Lengkap', 'NIS', 'NISN', 'NIK', 'Kelas', 'Jenis Kelamin', 'Agama', 'Status', 'Tempat Lahir', 'Tanggal Lahir', 'Nama Ayah', 'Nama Ibu', 'Nama Orang Tua/Wali', 'No. HP Orang Tua', 'Alamat', 'Alamat Tempat Tinggal']
    const rows = filtered.map((s) => [
      s.nama_lengkap || '',
      s.nis || '',
      s.nisn || '',
      s.nik || '',
      s.kelas?.nama_kelas || '',
      s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
      s.agama || '',
      s.status || '',
      s.tempat_lahir || '',
      s.tanggal_lahir || '',
      s.nama_ayah || '',
      s.nama_ibu || '',
      s.nama_orang_tua || '',
      s.no_hp_orang_tua || '',
      s.alamat || '',
      s.alamat_tinggal || '',
    ])

    const escapeCell = (val) => {
      const str = String(val).replace(/"/g, '""')
      return /[",\n]/.test(str) ? `"${str}"` : str
    }

    const csvContent = [headers, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Data-Siswa-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // --- Export: Cetak / Unduh PDF (lewat dialog cetak browser) ---
  function handlePrintPDF() {
    setShowExportMenu(false)
    const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

    const rowsHtml = filtered
      .map(
        (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${s.nama_lengkap || '-'}</td>
          <td>${s.nis || '-'}</td>
          <td>${s.nisn || '-'}</td>
          <td>${s.nik || '-'}</td>
          <td>${s.kelas?.nama_kelas || '-'}</td>
          <td>${s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
          <td>${s.agama || '-'}</td>
          <td>${s.status || '-'}</td>
        </tr>`
      )
      .join('')

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Data Siswa</title>
        <style>
          body { font-family: Arial, Helvetica, sans-serif; padding: 24px; color: #1a1a1a; }
          h1 { font-size: 18px; margin-bottom: 2px; }
          p.subtitle { font-size: 12px; color: #666; margin-top: 0; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; }
          th { background: #f2f2f2; }
          @media print {
            @page { size: landscape; margin: 16mm; }
          }
        </style>
      </head>
      <body>
        <h1>Data Siswa</h1>
        <p class="subtitle">Dicetak pada ${tanggal} · Total ${filtered.length} siswa</p>
        <table>
          <thead>
            <tr>
              <th>No</th>
              <th>Nama Lengkap</th>
              <th>NIS</th>
              <th>NISN</th>
              <th>NIK</th>
              <th>Kelas</th>
              <th>Jenis Kelamin</th>
              <th>Agama</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <script>
          window.onload = function () {
            window.print();
          };
        </script>
      </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <Layout
      title="Data Siswa"
      subtitle={`${data.length} siswa terdaftar`}
      actions={
        <>
          <div className="relative" ref={exportMenuRef}>
            <button className="btn-secondary" onClick={() => setShowExportMenu((v) => !v)}>
              <Download size={16} /> Unduh / Cetak <ChevronDown size={14} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-64 card p-1.5 z-20 shadow-lg">
                <button
                  onClick={handleExportExcel}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-900/[0.05] text-left"
                >
                  <FileSpreadsheet size={16} /> Unduh Excel (siap edit & impor ulang)
                </button>
                <button
                  onClick={handleExportCSV}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-900/[0.05] text-left"
                >
                  <FileSpreadsheet size={16} /> Unduh Excel (.csv)
                </button>
                <button
                  onClick={handlePrintPDF}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-700 hover:bg-ink-900/[0.05] text-left"
                >
                  <Printer size={16} /> Cetak / Unduh PDF
                </button>
              </div>
            )}
          </div>
          {isAdmin && (
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <UploadCloud size={16} /> Impor Massal
            </button>
          )}
          {isAdmin && (
            <button className="btn-primary" onClick={openAdd}>
              <Plus size={16} /> Tambah Siswa
            </button>
          )}
        </>
      }
    >
      {/* Kartu pencarian — background biru tua (navy), sama seperti kartu identitas di Profil Saya, dengan corak batik emas */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-4 flex items-center gap-4 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <BatikOverlay patternId="batikSiswaBanner" strokeColor="#d4af37" />

        <div className="relative w-10 h-10 rounded-full bg-white/10 ring-2 ring-white/20 text-white flex items-center justify-center shrink-0">
          <Search size={18} />
        </div>
        <div className="relative max-w-sm w-full">
          <input
            className="input-field w-full"
            placeholder="Cari nama, NIS, NISN, atau NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card relative overflow-hidden overflow-x-auto">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <table className="table-shell">
          <thead>
            <tr>
              <th>Foto</th>
              <th>Nama Lengkap</th>
              <th>NIS</th>
              <th>NISN</th>
              <th>NIK</th>
              <th>Tempat, Tanggal Lahir</th>
              <th>Kelas</th>
              <th>Jenis Kelamin</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={10} className="text-center py-8 text-ink-700/50">Belum ada data siswa.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>
                  <label className="relative block w-10 h-10 rounded-full overflow-hidden bg-ink-900/[0.06] cursor-pointer shrink-0 group">
                    {fotoUrl(s.foto_path) ? (
                      <img src={fotoUrl(s.foto_path)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-xs font-semibold text-ink-700/40">
                        {s.nama_lengkap?.[0]}
                      </span>
                    )}
                    <span className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/40 flex items-center justify-center transition-colors">
                      {uploadingId === s.id ? (
                        <Loader2 size={14} className="animate-spin text-white" />
                      ) : (
                        <Camera size={13} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingId === s.id}
                      onChange={(e) => e.target.files?.[0] && handleFotoUpload(s.id, e.target.files[0])}
                    />
                  </label>
                </td>
                <td className="font-medium">
                  <button
                    type="button"
                    onClick={() => setProfilLihat(s)}
                    className="hover:underline hover:text-blue-900 text-left"
                  >
                    {s.nama_lengkap}
                  </button>
                </td>
                <td className="font-mono text-xs">{s.nis}</td>
                <td className="font-mono text-xs">{s.nisn}</td>
                <td className="font-mono text-xs">{s.nik || '—'}</td>
                <td className="text-xs whitespace-nowrap">{tempatTanggalLahir(s)}</td>
                <td>{s.kelas?.nama_kelas || '—'}</td>
                <td>{s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                <td>
                  <span className={`badge ${s.status === 'aktif' ? 'bg-sage-500/15 text-sage-500' : 'bg-ink-900/10 text-ink-700'}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  {isAdmin && (
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(s)} className="p-2 hover:bg-ink-900/5 rounded-lg text-ink-700/60">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600/70">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900">
              <X size={20} />
            </button>
            <h2 className="font-display text-xl font-semibold mb-4">
              {editingId ? 'Ubah Data Siswa' : 'Tambah Siswa'}
            </h2>

            {editingId && (
              <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-ink-900/[0.03]">
                <label className="relative block w-16 h-16 rounded-full overflow-hidden bg-ink-900/[0.06] cursor-pointer shrink-0 group">
                  {fotoUrl(data.find((d) => d.id === editingId)?.foto_path) ? (
                    <img src={fotoUrl(data.find((d) => d.id === editingId)?.foto_path)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-lg font-semibold text-ink-700/40">
                      {form.nama_lengkap?.[0]}
                    </span>
                  )}
                  <span className="absolute inset-0 bg-ink-950/0 group-hover:bg-ink-950/40 flex items-center justify-center transition-colors">
                    {uploadingId === editingId ? (
                      <Loader2 size={16} className="animate-spin text-white" />
                    ) : (
                      <Camera size={15} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingId === editingId}
                    onChange={(e) => e.target.files?.[0] && handleFotoUpload(editingId, e.target.files[0])}
                  />
                </label>
                <p className="text-xs text-ink-700/50">Klik foto untuk mengganti. Foto ini juga dipakai untuk Cetak Kartu Pelajar/Perpustakaan.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Lengkap" full>
                <input required className="input-field" value={form.nama_lengkap}
                  onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} />
              </Field>
              <Field label="NIS">
                <input className="input-field" value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })} />
              </Field>
              <Field label="NISN">
                <input className="input-field" value={form.nisn}
                  onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
              </Field>
              <Field label="NIK" full>
                <input className="input-field" placeholder="16 digit NIK sesuai KK/KTP" value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })} />
              </Field>
              <Field label="Jenis Kelamin">
                <select className="input-field" value={form.jenis_kelamin}
                  onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Agama">
                <select className="input-field" value={form.agama}
                  onChange={(e) => setForm({ ...form, agama: e.target.value })}>
                  <option value="">— Pilih Agama —</option>
                  {AGAMA_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Kelas">
                <select className="input-field" value={form.kelas_id}
                  onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                  <option value="">— Belum ada kelas —</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </Field>
              <Field label="Tempat Lahir">
                <input className="input-field" value={form.tempat_lahir}
                  onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} />
              </Field>
              <Field label="Tanggal Lahir">
                <input type="date" className="input-field" value={form.tanggal_lahir || ''}
                  onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} />
              </Field>
              <Field label="Pendidikan Sebelumnya" full>
                <input className="input-field" placeholder="Contoh: TK Pertiwi Jerwatu"
                  value={form.pendidikan_sebelumnya}
                  onChange={(e) => setForm({ ...form, pendidikan_sebelumnya: e.target.value })} />
              </Field>
              <Field label="Nama Ayah">
                <input className="input-field" value={form.nama_ayah}
                  onChange={(e) => setForm({ ...form, nama_ayah: e.target.value })} />
              </Field>
              <Field label="Nama Ibu">
                <input className="input-field" value={form.nama_ibu}
                  onChange={(e) => setForm({ ...form, nama_ibu: e.target.value })} />
              </Field>
              <Field label="Pendidikan Ayah">
                <input className="input-field" value={form.pendidikan_ayah}
                  onChange={(e) => setForm({ ...form, pendidikan_ayah: e.target.value })} />
              </Field>
              <Field label="Pendidikan Ibu">
                <input className="input-field" value={form.pendidikan_ibu}
                  onChange={(e) => setForm({ ...form, pendidikan_ibu: e.target.value })} />
              </Field>
              <Field label="Pekerjaan Ayah">
                <input className="input-field" value={form.pekerjaan_ayah}
                  onChange={(e) => setForm({ ...form, pekerjaan_ayah: e.target.value })} />
              </Field>
              <Field label="Pekerjaan Ibu">
                <input className="input-field" value={form.pekerjaan_ibu}
                  onChange={(e) => setForm({ ...form, pekerjaan_ibu: e.target.value })} />
              </Field>
              <Field label="Nama Orang Tua/Wali" full>
                <input className="input-field" value={form.nama_orang_tua}
                  onChange={(e) => setForm({ ...form, nama_orang_tua: e.target.value })} />
              </Field>
              <Field label="No. HP Orang Tua">
                <input className="input-field" value={form.no_hp_orang_tua}
                  onChange={(e) => setForm({ ...form, no_hp_orang_tua: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="pindah">Pindah</option>
                </select>
              </Field>
              <Field label="Alamat (sesuai KTP/KK)" full>
                <textarea className="input-field" rows={2} value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
              </Field>
              <Field label="Alamat Tempat Tinggal (domisili saat ini)" full>
                <textarea className="input-field" rows={2} value={form.alamat_tinggal}
                  onChange={(e) => setForm({ ...form, alamat_tinggal: e.target.value })} />
              </Field>

              {/* TAMBAHAN: khusus untuk Halaman Identitas Rapor — alamat orang tua terpisah
                  (jalan dipakai dari field "Alamat" di atas) */}
              <div className="col-span-2 pt-2 mt-1 border-t border-ink-900/[0.08]">
                <p className="eyebrow mb-2">Alamat Orang Tua (untuk Halaman Identitas Rapor)</p>
              </div>
              <Field label="Kelurahan/Desa">
                <input className="input-field" value={form.ortu_kelurahan_desa}
                  onChange={(e) => setForm({ ...form, ortu_kelurahan_desa: e.target.value })} />
              </Field>
              <Field label="Kecamatan">
                <input className="input-field" value={form.ortu_kecamatan}
                  onChange={(e) => setForm({ ...form, ortu_kecamatan: e.target.value })} />
              </Field>
              <Field label="Kabupaten/Kota">
                <input className="input-field" value={form.ortu_kabupaten_kota}
                  onChange={(e) => setForm({ ...form, ortu_kabupaten_kota: e.target.value })} />
              </Field>
              <Field label="Provinsi">
                <input className="input-field" value={form.ortu_provinsi}
                  onChange={(e) => setForm({ ...form, ortu_provinsi: e.target.value })} />
              </Field>

              <div className="col-span-2 pt-2 mt-1 border-t border-ink-900/[0.08]">
                <p className="eyebrow mb-2">Wali Peserta Didik (isi jika ada, selain orang tua)</p>
              </div>
              <Field label="Nama Wali">
                <input className="input-field" value={form.nama_wali}
                  onChange={(e) => setForm({ ...form, nama_wali: e.target.value })} />
              </Field>
              <Field label="Pekerjaan Wali">
                <input className="input-field" value={form.pekerjaan_wali}
                  onChange={(e) => setForm({ ...form, pekerjaan_wali: e.target.value })} />
              </Field>
              <Field label="Alamat Wali" full>
                <textarea className="input-field" rows={2} value={form.alamat_wali}
                  onChange={(e) => setForm({ ...form, alamat_wali: e.target.value })} />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Lihat Profil — identitas lengkap + foto besar, dibuka dengan klik nama siswa */}
      {profilLihat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-0 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setProfilLihat(null)}
              className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-ink-950/20 rounded-full p-1"
            >
              <X size={18} />
            </button>

            <div className="relative overflow-hidden bg-gradient-to-br from-blue-900 to-blue-950 pt-8 pb-14 flex flex-col items-center">
              <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
              <BatikOverlay patternId="batikSiswaModal" strokeColor="#d4af37" />
              <div className="relative w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/20 bg-white/10 flex items-center justify-center shrink-0">
                {fotoUrl(profilLihat.foto_path) ? (
                  <img src={fotoUrl(profilLihat.foto_path)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-white/60">{profilLihat.nama_lengkap?.[0]}</span>
                )}
              </div>
              <p className="relative font-display font-semibold text-lg text-white mt-3 text-center px-6">{profilLihat.nama_lengkap}</p>
              <span className={`relative badge mt-1.5 ${profilLihat.status === 'aktif' ? 'bg-sage-500/20 text-sage-100' : 'bg-white/10 text-white/70'}`}>
                {profilLihat.status}
              </span>
            </div>

            <div className="px-6 -mt-8 pb-6">
              <div className="card p-4 space-y-3 bg-white shadow-md">
                <ProfilRow label="NIS" value={profilLihat.nis} />
                <ProfilRow label="NISN" value={profilLihat.nisn} />
                <ProfilRow label="NIK" value={profilLihat.nik} />
                <ProfilRow label="Kelas" value={profilLihat.kelas?.nama_kelas} />
                <ProfilRow label="Jenis Kelamin" value={profilLihat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                <ProfilRow label="Agama" value={profilLihat.agama} />
                <ProfilRow label="Tempat, Tanggal Lahir" value={tempatTanggalLahir(profilLihat)} />
                <ProfilRow label="Alamat" value={profilLihat.alamat} />
                <ProfilRow label="Alamat Tempat Tinggal" value={profilLihat.alamat_tinggal} />
                <ProfilRow label="Nama Ayah" value={profilLihat.nama_ayah} />
                <ProfilRow label="Nama Ibu" value={profilLihat.nama_ibu} />
                <ProfilRow label="Nama Orang Tua/Wali" value={profilLihat.nama_orang_tua} />
                <ProfilRow label="No. HP Orang Tua/Wali" value={profilLihat.no_hp_orang_tua} telepon />
              </div>

              <div className="flex gap-2 mt-4">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => { setProfilLihat(null); openEdit(profilLihat) }}
                    className="btn-secondary flex-1 justify-center"
                  >
                    <Pencil size={15} /> Ubah Data
                  </button>
                )}
                <a
                  href="/kartu"
                  className="btn-primary flex-1 justify-center"
                >
                  <IdCard size={15} /> Cetak Kartu
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkImportModal
        open={showImport}
        onClose={() => { setShowImport(false); loadData() }}
        title="Impor Data Siswa"
        templateHeaders={['nama_lengkap', 'nis', 'nisn', 'nik', 'kelas', 'jenis_kelamin(L/P)', 'agama', 'tempat_lahir', 'tanggal_lahir(YYYY-MM-DD)', 'nama_ayah', 'nama_ibu', 'nama_orang_tua', 'no_hp_orang_tua', 'alamat', 'alamat_tinggal']}
        mapRow={(row) => {
          if (!row.nama_lengkap) return null
          const namaKelas = String(row.kelas || '').trim()
          const matchedKelas = kelasList.find(
            (k) => k.nama_kelas.trim().toLowerCase() === namaKelas.toLowerCase()
          )
          return {
            nama_lengkap: String(row.nama_lengkap).trim(),
            nis: String(row.nis || '').trim(),
            nisn: String(row.nisn || '').trim(),
            nik: String(row.nik || '').trim(),
            kelas_id: matchedKelas ? matchedKelas.id : null,
            jenis_kelamin: String(row['jenis_kelamin(L/P)'] || row.jenis_kelamin || 'L').trim().toUpperCase(),
            agama: String(row.agama || '').trim(),
            tempat_lahir: String(row.tempat_lahir || '').trim(),
            tanggal_lahir: row['tanggal_lahir(YYYY-MM-DD)'] || row.tanggal_lahir || null,
            nama_ayah: String(row.nama_ayah || '').trim(),
            nama_ibu: String(row.nama_ibu || '').trim(),
            nama_orang_tua: String(row.nama_orang_tua || '').trim(),
            no_hp_orang_tua: String(row.no_hp_orang_tua || '').trim(),
            alamat: String(row.alamat || '').trim(),
            alamat_tinggal: String(row.alamat_tinggal || '').trim(),
            status: 'aktif',
          }
        }}
        onImport={async (rows) => {
          // Cocokkan tiap baris dengan siswa yang SUDAH ADA berdasarkan NIS atau NISN.
          // Kalau cocok -> UPDATE data siswa itu (tidak menambah baris baru / duplikat).
          // Kalau tidak cocok dengan siapa pun -> INSERT sebagai siswa baru.
          const toUpdate = []
          const toInsert = []

          rows.forEach((row) => {
            const match = data.find(
              (d) =>
                (row.nis && d.nis && String(d.nis).trim() === String(row.nis).trim()) ||
                (row.nisn && d.nisn && String(d.nisn).trim() === String(row.nisn).trim())
            )
            if (match) {
              toUpdate.push({ id: match.id, ...row })
            } else {
              toInsert.push(row)
            }
          })

          if (toInsert.length > 0) {
            const { error } = await supabase.from('siswa').insert(toInsert)
            if (error) throw error
          }

          for (const row of toUpdate) {
            const { id, ...payload } = row
            const { error } = await supabase.from('siswa').update(payload).eq('id', id)
            if (error) throw error
          }

          const tanpaKelas = rows.filter((r) => !r.kelas_id).length
          setTimeout(() => {
            let pesan = `Impor selesai: ${toInsert.length} siswa baru ditambahkan, ${toUpdate.length} siswa yang sudah ada di-update (dicocokkan lewat NIS/NISN).`
            if (tanpaKelas > 0) {
              pesan += `\n\nCatatan: ${tanpaKelas} baris tidak punya kelas yang cocok — pastikan nama kelas di file sama persis dengan yang ada di menu Kelas, lalu perbaiki manual lewat tombol edit.`
            }
            alert(pesan)
          }, 300)

          return { count: rows.length }
        }}
      />
    </Layout>
  )
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="eyebrow mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}

function ProfilRow({ label, value, telepon }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-ink-700/50 shrink-0">{label}</span>
      <span className="text-ink-950 font-medium text-right inline-flex items-center gap-1.5">
        {value || '—'}
        {telepon && <TeleponLink nomor={value} />}
      </span>
    </div>
  )
}
