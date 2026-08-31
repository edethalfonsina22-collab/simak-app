import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import BulkImportModal from '../components/BulkImportModal'
import DapodikImportModal from '../components/DapodikImportModal'
import TeleponLink from '../components/TeleponLink'
import { matchKelasByName } from '../lib/kelasMatch'
import { Plus, UploadCloud, Pencil, Trash2, Search, X, Loader2, Download, FileSpreadsheet, Printer, ChevronDown, Camera, IdCard } from 'lucide-react'

const AGAMA_OPTIONS = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Lainnya']

const emptyForm = {
  nis: '',
  nisn: '',
  nik: '',
  no_kk: '',
  // TAMBAHAN: nomor ujian, dipakai di Surat Keterangan Lulus (SKL) / Cetak SKL
  nomor_ujian: '',
  no_seri_ijazah: '',
  skhun: '',
  nama_lengkap: '',
  jenis_kelamin: 'L',
  agama: '',
  tempat_lahir: '',
  tanggal_lahir: '',
  tahun_lahir: '',
  alamat: '',
  alamat_tinggal: '',
  rt: '',
  rw: '',
  dusun: '',
  kelurahan: '',
  kecamatan: '',
  kode_pos: '',
  jenis_tinggal: '',
  alat_transportasi: '',
  jarak_rumah_ke_sekolah: '',
  lintang: '',
  bujur: '',
  telepon: '',
  hp: '',
  email: '',
  nama_orang_tua: '',
  nama_ayah: '',
  nama_ibu: '',
  nik_ayah: '',
  nik_ibu: '',
  tahun_lahir_ayah: '',
  tahun_lahir_ibu: '',
  penghasilan_ayah: '',
  penghasilan_ibu: '',
  no_hp_orang_tua: '',
  kelas_id: '',
  status: 'aktif',
  // TAMBAHAN: dipakai di Halaman Identitas Rapor (halaman sampul/identitas peserta didik)
  pendidikan_sebelumnya: '',
  sekolah_asal: '',
  pendidikan_ayah: '',
  pendidikan_ibu: '',
  pekerjaan_ayah: '',
  pekerjaan_ibu: '',
  ortu_kelurahan_desa: '',
  ortu_kecamatan: '',
  ortu_kabupaten_kota: '',
  ortu_provinsi: '',
  nama_wali: '',
  nik_wali: '',
  tahun_lahir_wali: '',
  pendidikan_wali: '',
  pekerjaan_wali: '',
  penghasilan_wali: '',
  alamat_wali: '',
  // TAMBAHAN: Program bantuan sosial (KPS/KIP/KKS/PIP)
  penerima_kps: '',
  no_kps: '',
  penerima_kip: '',
  nomor_kip: '',
  nama_di_kip: '',
  nomor_kks: '',
  layak_pip: '',
  alasan_layak_pip: '',
  no_registrasi_akta_lahir: '',
  // TAMBAHAN: Rekening siswa (pencairan bantuan)
  bank: '',
  no_rekening: '',
  rekening_atas_nama: '',
  // TAMBAHAN: Kesehatan, fisik & keluarga
  kebutuhan_khusus: '',
  berat_badan: '',
  tinggi_badan: '',
  lingkar_kepala: '',
  anak_ke: '',
  jumlah_saudara_kandung: '',
}

// Header ini HARUS sama persis dengan templateHeaders di BulkImportModal (Impor Massal)
// supaya file yang diunduh dari sini bisa langsung diupload ulang tanpa perlu diubah nama kolomnya.
const EXCEL_HEADERS = [
  'nama_lengkap', 'nis', 'nisn', 'nik', 'no_kk', 'nomor_ujian', 'no_seri_ijazah', 'skhun', 'kelas', 'jenis_kelamin(L/P)', 'agama',
  'tempat_lahir', 'tanggal_lahir(YYYY-MM-DD)', 'tahun_lahir',
  'nama_ayah', 'nik_ayah', 'tahun_lahir_ayah', 'pendidikan_ayah', 'pekerjaan_ayah', 'penghasilan_ayah',
  'nama_ibu', 'nik_ibu', 'tahun_lahir_ibu', 'pendidikan_ibu', 'pekerjaan_ibu', 'penghasilan_ibu',
  'nama_orang_tua', 'no_hp_orang_tua', 'alamat', 'alamat_tinggal',
  'rt', 'rw', 'dusun', 'kelurahan', 'kecamatan', 'kode_pos', 'jenis_tinggal', 'alat_transportasi',
  'telepon', 'hp', 'email',
  'penerima_kps(Ya/Tidak)', 'no_kps', 'penerima_kip(Ya/Tidak)', 'nomor_kip', 'nama_di_kip', 'nomor_kks',
  'layak_pip(Ya/Tidak)', 'alasan_layak_pip', 'no_registrasi_akta_lahir',
  'bank', 'no_rekening', 'rekening_atas_nama',
  'kebutuhan_khusus', 'berat_badan', 'tinggi_badan', 'lingkar_kepala', 'anak_ke', 'jumlah_saudara_kandung',
  'sekolah_asal',
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
  const [showImportDapodik, setShowImportDapodik] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const exportMenuRef = useRef(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [profilLihat, setProfilLihat] = useState(null) // siswa yang sedang dilihat detail profilnya
  const [selectedIds, setSelectedIds] = useState([]) // TAMBAHAN: untuk fitur Hapus Massal
  const [bulkDeleting, setBulkDeleting] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: siswa }, { data: kelas }] = await Promise.all([
      supabase.from('siswa').select('*, kelas(nama_kelas)').order('nama_lengkap'),
      supabase.from('kelas').select('id, nama_kelas, tingkat').order('nama_kelas'),
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
    const toNumOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    const payload = {
      ...form,
      kelas_id: form.kelas_id || null,
      tahun_lahir: toNumOrNull(form.tahun_lahir),
      tahun_lahir_ayah: toNumOrNull(form.tahun_lahir_ayah),
      tahun_lahir_ibu: toNumOrNull(form.tahun_lahir_ibu),
      tahun_lahir_wali: toNumOrNull(form.tahun_lahir_wali),
      anak_ke: toNumOrNull(form.anak_ke),
      jumlah_saudara_kandung: toNumOrNull(form.jumlah_saudara_kandung),
      berat_badan: toNumOrNull(form.berat_badan),
      tinggi_badan: toNumOrNull(form.tinggi_badan),
      lingkar_kepala: toNumOrNull(form.lingkar_kepala),
      jarak_rumah_ke_sekolah: toNumOrNull(form.jarak_rumah_ke_sekolah),
      lintang: toNumOrNull(form.lintang),
      bujur: toNumOrNull(form.bujur),
    }
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

  // TAMBAHAN: Hapus Massal — menghapus semua siswa yang dicentang sekaligus
  function toggleSelectOne(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function toggleSelectAll() {
    const idsDitampilkan = filtered.map((s) => s.id)
    const semuaTerpilih = idsDitampilkan.length > 0 && idsDitampilkan.every((id) => selectedIds.includes(id))
    if (semuaTerpilih) {
      setSelectedIds((prev) => prev.filter((id) => !idsDitampilkan.includes(id)))
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...idsDitampilkan])))
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return
    if (!confirm(`Hapus ${selectedIds.length} siswa terpilih? Tindakan ini tidak bisa dibatalkan.`)) return
    setBulkDeleting(true)
    const { error } = await supabase.from('siswa').delete().in('id', selectedIds)
    setBulkDeleting(false)
    if (!error) {
      setSelectedIds([])
      loadData()
    } else {
      alert('Gagal menghapus: ' + error.message)
    }
  }

  // --- Logika impor bersama, dipakai oleh "Impor Massal" (template biasa) DAN
  // "Impor dari Dapodik" (file unduhan Dapodik). Kedua modal itu berbeda hanya dalam
  // cara MEMBACA file & memetakan baris; setelah baris berhasil dipetakan ke bentuk
  // yang sama (object siap-simpan), proses insert/update-nya identik.
  async function importSiswaRows(rows) {
    // PERBAIKAN: ambil data siswa yang sudah ada LANGSUNG dari server saat proses
    // impor berjalan (bukan dari state `data` React yang sudah dimuat sebelumnya).
    // Ini menghindari kondisi balapan (race condition) — misalnya kalau modal impor
    // dibuka sebelum daftar siswa lama selesai dimuat — yang sebelumnya bisa membuat
    // SEMUA baris dianggap "siswa baru" dan menciptakan data duplikat.
    const { data: existing, error: fetchError } = await supabase
      .from('siswa')
      .select('id, nis, nisn')
    if (fetchError) throw fetchError

    // Cocokkan tiap baris dengan siswa yang SUDAH ADA berdasarkan NIS atau NISN.
    // Kalau cocok -> UPDATE data siswa itu (tidak menambah baris baru / duplikat).
    // Kalau tidak cocok dengan siapa pun -> INSERT sebagai siswa baru.
    const toUpdate = []
    const toInsert = []

    rows.forEach((row) => {
      const match = existing.find(
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
  }

  const filtered = data.filter((s) =>
    `${s.nama_lengkap} ${s.nis} ${s.nisn} ${s.nik} ${s.nomor_ujian}`.toLowerCase().includes(search.toLowerCase())
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
      no_kk: s.no_kk || '',
      nomor_ujian: s.nomor_ujian || '',
      no_seri_ijazah: s.no_seri_ijazah || '',
      skhun: s.skhun || '',
      kelas: s.kelas?.nama_kelas || '',
      'jenis_kelamin(L/P)': s.jenis_kelamin || '',
      agama: s.agama || '',
      tempat_lahir: s.tempat_lahir || '',
      'tanggal_lahir(YYYY-MM-DD)': s.tanggal_lahir || '',
      tahun_lahir: s.tahun_lahir || '',
      nama_ayah: s.nama_ayah || '',
      nik_ayah: s.nik_ayah || '',
      tahun_lahir_ayah: s.tahun_lahir_ayah || '',
      pendidikan_ayah: s.pendidikan_ayah || '',
      pekerjaan_ayah: s.pekerjaan_ayah || '',
      penghasilan_ayah: s.penghasilan_ayah || '',
      nama_ibu: s.nama_ibu || '',
      nik_ibu: s.nik_ibu || '',
      tahun_lahir_ibu: s.tahun_lahir_ibu || '',
      pendidikan_ibu: s.pendidikan_ibu || '',
      pekerjaan_ibu: s.pekerjaan_ibu || '',
      penghasilan_ibu: s.penghasilan_ibu || '',
      nama_orang_tua: s.nama_orang_tua || '',
      no_hp_orang_tua: s.no_hp_orang_tua || '',
      alamat: s.alamat || '',
      alamat_tinggal: s.alamat_tinggal || '',
      rt: s.rt || '',
      rw: s.rw || '',
      dusun: s.dusun || '',
      kelurahan: s.kelurahan || '',
      kecamatan: s.kecamatan || '',
      kode_pos: s.kode_pos || '',
      jenis_tinggal: s.jenis_tinggal || '',
      alat_transportasi: s.alat_transportasi || '',
      telepon: s.telepon || '',
      hp: s.hp || '',
      email: s.email || '',
      'penerima_kps(Ya/Tidak)': s.penerima_kps || '',
      no_kps: s.no_kps || '',
      'penerima_kip(Ya/Tidak)': s.penerima_kip || '',
      nomor_kip: s.nomor_kip || '',
      nama_di_kip: s.nama_di_kip || '',
      nomor_kks: s.nomor_kks || '',
      'layak_pip(Ya/Tidak)': s.layak_pip || '',
      alasan_layak_pip: s.alasan_layak_pip || '',
      no_registrasi_akta_lahir: s.no_registrasi_akta_lahir || '',
      bank: s.bank || '',
      no_rekening: s.no_rekening || '',
      rekening_atas_nama: s.rekening_atas_nama || '',
      kebutuhan_khusus: s.kebutuhan_khusus || '',
      berat_badan: s.berat_badan || '',
      tinggi_badan: s.tinggi_badan || '',
      lingkar_kepala: s.lingkar_kepala || '',
      anak_ke: s.anak_ke || '',
      jumlah_saudara_kandung: s.jumlah_saudara_kandung || '',
      sekolah_asal: s.sekolah_asal || '',
    }))

    const ws = XLSX.utils.json_to_sheet(rows, { header: EXCEL_HEADERS })
    ws['!cols'] = EXCEL_HEADERS.map(() => ({ wch: 18 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa')
    XLSX.writeFile(wb, `Data-Siswa-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // --- Export: Excel (CSV) ---
  function handleExportCSV() {
    setShowExportMenu(false)
    const headers = [
      'Nama Lengkap', 'NIS', 'NISN', 'NIK', 'Nomor Ujian', 'Kelas', 'Jenis Kelamin', 'Agama', 'Status',
      'Tempat Lahir', 'Tanggal Lahir', 'Tahun Lahir',
      'Nama Ayah', 'NIK Ayah', 'Tahun Lahir Ayah',
      'Nama Ibu', 'NIK Ibu', 'Tahun Lahir Ibu',
      'Nama Orang Tua/Wali', 'No. HP Orang Tua', 'Alamat', 'Alamat Tempat Tinggal',
    ]
    const rows = filtered.map((s) => [
      s.nama_lengkap || '',
      s.nis || '',
      s.nisn || '',
      s.nik || '',
      s.nomor_ujian || '',
      s.kelas?.nama_kelas || '',
      s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
      s.agama || '',
      s.status || '',
      s.tempat_lahir || '',
      s.tanggal_lahir || '',
      s.tahun_lahir || '',
      s.nama_ayah || '',
      s.nik_ayah || '',
      s.tahun_lahir_ayah || '',
      s.nama_ibu || '',
      s.nik_ibu || '',
      s.tahun_lahir_ibu || '',
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
          {isAdmin && selectedIds.length > 0 && (
            <button className="btn-secondary text-red-600 hover:bg-red-50" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              Hapus Massal ({selectedIds.length})
            </button>
          )}
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
            <button className="btn-secondary" onClick={() => setShowImportDapodik(true)}>
              <UploadCloud size={16} /> Impor dari Dapodik
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
            placeholder="Cari nama, NIS, NISN, NIK, atau Nomor Ujian..."
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
              {isAdmin && (
                <th>
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && filtered.every((s) => selectedIds.includes(s.id))}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
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
              <tr><td colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 11 : 10} className="text-center py-8 text-ink-700/50">Belum ada data siswa.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                {isAdmin && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelectOne(s.id)}
                    />
                  </td>
                )}
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
          <form onSubmit={handleSubmit} className="card w-full max-w-2xl p-6 relative max-h-[90vh] overflow-y-auto">
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

            <Seksi judul="Data Pribadi">
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
              <Field label="NIK">
                <input className="input-field" placeholder="16 digit NIK sesuai KK/KTP" value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })} />
              </Field>
              <Field label="No. KK">
                <input className="input-field" value={form.no_kk}
                  onChange={(e) => setForm({ ...form, no_kk: e.target.value })} />
              </Field>
              <Field label="No. Registrasi Akta Lahir" full>
                <input className="input-field" value={form.no_registrasi_akta_lahir}
                  onChange={(e) => setForm({ ...form, no_registrasi_akta_lahir: e.target.value })} />
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
              <Field label="Tahun Lahir (jika tanggal pasti tidak diketahui)">
                <input type="number" placeholder="Contoh: 2015" className="input-field" value={form.tahun_lahir || ''}
                  onChange={(e) => setForm({ ...form, tahun_lahir: e.target.value })} />
              </Field>
              <Field label="Anak ke-berapa">
                <input type="number" className="input-field" value={form.anak_ke || ''}
                  onChange={(e) => setForm({ ...form, anak_ke: e.target.value })} />
              </Field>
              <Field label="Jumlah Saudara Kandung">
                <input type="number" className="input-field" value={form.jumlah_saudara_kandung || ''}
                  onChange={(e) => setForm({ ...form, jumlah_saudara_kandung: e.target.value })} />
              </Field>
              <Field label="Kebutuhan Khusus">
                <input className="input-field" placeholder="Contoh: Tidak ada" value={form.kebutuhan_khusus}
                  onChange={(e) => setForm({ ...form, kebutuhan_khusus: e.target.value })} />
              </Field>
              <Field label="Pendidikan Sebelumnya / Sekolah Asal" full>
                <input className="input-field" placeholder="Contoh: TK Pertiwi Jerwatu"
                  value={form.pendidikan_sebelumnya}
                  onChange={(e) => setForm({ ...form, pendidikan_sebelumnya: e.target.value, sekolah_asal: e.target.value })} />
              </Field>
            </Seksi>

            <Seksi judul="Fisik & Kesehatan">
              <Field label="Berat Badan (kg)">
                <input type="number" className="input-field" value={form.berat_badan || ''}
                  onChange={(e) => setForm({ ...form, berat_badan: e.target.value })} />
              </Field>
              <Field label="Tinggi Badan (cm)">
                <input type="number" className="input-field" value={form.tinggi_badan || ''}
                  onChange={(e) => setForm({ ...form, tinggi_badan: e.target.value })} />
              </Field>
              <Field label="Lingkar Kepala (cm)">
                <input type="number" className="input-field" value={form.lingkar_kepala || ''}
                  onChange={(e) => setForm({ ...form, lingkar_kepala: e.target.value })} />
              </Field>
            </Seksi>

            <Seksi judul="Alamat">
              <Field label="Alamat (sesuai KTP/KK)" full>
                <textarea className="input-field" rows={2} value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
              </Field>
              <Field label="Alamat Tempat Tinggal (domisili saat ini)" full>
                <textarea className="input-field" rows={2} value={form.alamat_tinggal}
                  onChange={(e) => setForm({ ...form, alamat_tinggal: e.target.value })} />
              </Field>
              <Field label="RT"><input className="input-field" value={form.rt} onChange={(e) => setForm({ ...form, rt: e.target.value })} /></Field>
              <Field label="RW"><input className="input-field" value={form.rw} onChange={(e) => setForm({ ...form, rw: e.target.value })} /></Field>
              <Field label="Dusun"><input className="input-field" value={form.dusun} onChange={(e) => setForm({ ...form, dusun: e.target.value })} /></Field>
              <Field label="Kelurahan/Desa"><input className="input-field" value={form.kelurahan} onChange={(e) => setForm({ ...form, kelurahan: e.target.value })} /></Field>
              <Field label="Kecamatan"><input className="input-field" value={form.kecamatan} onChange={(e) => setForm({ ...form, kecamatan: e.target.value })} /></Field>
              <Field label="Kode Pos"><input className="input-field" value={form.kode_pos} onChange={(e) => setForm({ ...form, kode_pos: e.target.value })} /></Field>
              <Field label="Jenis Tinggal">
                <select className="input-field" value={form.jenis_tinggal} onChange={(e) => setForm({ ...form, jenis_tinggal: e.target.value })}>
                  <option value="">-</option>
                  <option value="Bersama Orang Tua">Bersama Orang Tua</option>
                  <option value="Wali">Wali</option>
                  <option value="Kost">Kost</option>
                  <option value="Asrama">Asrama</option>
                  <option value="Panti Asuhan">Panti Asuhan</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </Field>
              <Field label="Alat Transportasi"><input className="input-field" value={form.alat_transportasi} onChange={(e) => setForm({ ...form, alat_transportasi: e.target.value })} /></Field>
              <Field label="Lintang"><input className="input-field" value={form.lintang} onChange={(e) => setForm({ ...form, lintang: e.target.value })} /></Field>
              <Field label="Bujur"><input className="input-field" value={form.bujur} onChange={(e) => setForm({ ...form, bujur: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Kontak">
              <Field label="Telepon"><input className="input-field" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} /></Field>
              <Field label="HP"><input className="input-field" value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="No. HP Orang Tua/Wali"><input className="input-field" value={form.no_hp_orang_tua} onChange={(e) => setForm({ ...form, no_hp_orang_tua: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Data Ayah">
              <Field label="Nama Ayah"><input className="input-field" value={form.nama_ayah} onChange={(e) => setForm({ ...form, nama_ayah: e.target.value })} /></Field>
              <Field label="NIK Ayah"><input className="input-field" placeholder="16 digit NIK" value={form.nik_ayah} onChange={(e) => setForm({ ...form, nik_ayah: e.target.value })} /></Field>
              <Field label="Tahun Lahir Ayah"><input type="number" placeholder="Contoh: 1985" className="input-field" value={form.tahun_lahir_ayah || ''} onChange={(e) => setForm({ ...form, tahun_lahir_ayah: e.target.value })} /></Field>
              <Field label="Pendidikan Ayah"><input className="input-field" value={form.pendidikan_ayah} onChange={(e) => setForm({ ...form, pendidikan_ayah: e.target.value })} /></Field>
              <Field label="Pekerjaan Ayah"><input className="input-field" value={form.pekerjaan_ayah} onChange={(e) => setForm({ ...form, pekerjaan_ayah: e.target.value })} /></Field>
              <Field label="Penghasilan Ayah"><input className="input-field" value={form.penghasilan_ayah} onChange={(e) => setForm({ ...form, penghasilan_ayah: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Data Ibu">
              <Field label="Nama Ibu"><input className="input-field" value={form.nama_ibu} onChange={(e) => setForm({ ...form, nama_ibu: e.target.value })} /></Field>
              <Field label="NIK Ibu"><input className="input-field" placeholder="16 digit NIK" value={form.nik_ibu} onChange={(e) => setForm({ ...form, nik_ibu: e.target.value })} /></Field>
              <Field label="Tahun Lahir Ibu"><input type="number" placeholder="Contoh: 1988" className="input-field" value={form.tahun_lahir_ibu || ''} onChange={(e) => setForm({ ...form, tahun_lahir_ibu: e.target.value })} /></Field>
              <Field label="Pendidikan Ibu"><input className="input-field" value={form.pendidikan_ibu} onChange={(e) => setForm({ ...form, pendidikan_ibu: e.target.value })} /></Field>
              <Field label="Pekerjaan Ibu"><input className="input-field" value={form.pekerjaan_ibu} onChange={(e) => setForm({ ...form, pekerjaan_ibu: e.target.value })} /></Field>
              <Field label="Penghasilan Ibu"><input className="input-field" value={form.penghasilan_ibu} onChange={(e) => setForm({ ...form, penghasilan_ibu: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Orang Tua/Wali (Umum)">
              <Field label="Nama Orang Tua/Wali" full>
                <input className="input-field" value={form.nama_orang_tua}
                  onChange={(e) => setForm({ ...form, nama_orang_tua: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="pindah">Pindah</option>
                </select>
              </Field>
            </Seksi>

            <Seksi judul="Alamat Orang Tua (untuk Halaman Identitas Rapor)">
              <Field label="Kelurahan/Desa"><input className="input-field" value={form.ortu_kelurahan_desa} onChange={(e) => setForm({ ...form, ortu_kelurahan_desa: e.target.value })} /></Field>
              <Field label="Kecamatan"><input className="input-field" value={form.ortu_kecamatan} onChange={(e) => setForm({ ...form, ortu_kecamatan: e.target.value })} /></Field>
              <Field label="Kabupaten/Kota"><input className="input-field" value={form.ortu_kabupaten_kota} onChange={(e) => setForm({ ...form, ortu_kabupaten_kota: e.target.value })} /></Field>
              <Field label="Provinsi"><input className="input-field" value={form.ortu_provinsi} onChange={(e) => setForm({ ...form, ortu_provinsi: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Wali Peserta Didik (isi jika ada, selain orang tua)">
              <Field label="Nama Wali"><input className="input-field" value={form.nama_wali} onChange={(e) => setForm({ ...form, nama_wali: e.target.value })} /></Field>
              <Field label="NIK Wali"><input className="input-field" value={form.nik_wali} onChange={(e) => setForm({ ...form, nik_wali: e.target.value })} /></Field>
              <Field label="Tahun Lahir Wali"><input type="number" className="input-field" value={form.tahun_lahir_wali || ''} onChange={(e) => setForm({ ...form, tahun_lahir_wali: e.target.value })} /></Field>
              <Field label="Pendidikan Wali"><input className="input-field" value={form.pendidikan_wali} onChange={(e) => setForm({ ...form, pendidikan_wali: e.target.value })} /></Field>
              <Field label="Pekerjaan Wali"><input className="input-field" value={form.pekerjaan_wali} onChange={(e) => setForm({ ...form, pekerjaan_wali: e.target.value })} /></Field>
              <Field label="Penghasilan Wali"><input className="input-field" value={form.penghasilan_wali} onChange={(e) => setForm({ ...form, penghasilan_wali: e.target.value })} /></Field>
              <Field label="Alamat Wali" full>
                <textarea className="input-field" rows={2} value={form.alamat_wali}
                  onChange={(e) => setForm({ ...form, alamat_wali: e.target.value })} />
              </Field>
            </Seksi>

            <Seksi judul="Akademik & Kelulusan">
              <Field label="Nomor Ujian"><input className="input-field" placeholder="Dipakai di SKL" value={form.nomor_ujian} onChange={(e) => setForm({ ...form, nomor_ujian: e.target.value })} /></Field>
              <Field label="No. Seri Ijazah"><input className="input-field" value={form.no_seri_ijazah} onChange={(e) => setForm({ ...form, no_seri_ijazah: e.target.value })} /></Field>
              <Field label="SKHUN"><input className="input-field" value={form.skhun} onChange={(e) => setForm({ ...form, skhun: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Program Bantuan Sosial (KPS/KIP/KKS/PIP)">
              <Field label="Penerima KPS">
                <select className="input-field" value={form.penerima_kps} onChange={(e) => setForm({ ...form, penerima_kps: e.target.value })}>
                  <option value="">-</option><option value="Ya">Ya</option><option value="Tidak">Tidak</option>
                </select>
              </Field>
              <Field label="No. KPS"><input className="input-field" value={form.no_kps} onChange={(e) => setForm({ ...form, no_kps: e.target.value })} /></Field>
              <Field label="Penerima KIP">
                <select className="input-field" value={form.penerima_kip} onChange={(e) => setForm({ ...form, penerima_kip: e.target.value })}>
                  <option value="">-</option><option value="Ya">Ya</option><option value="Tidak">Tidak</option>
                </select>
              </Field>
              <Field label="Nomor KIP"><input className="input-field" value={form.nomor_kip} onChange={(e) => setForm({ ...form, nomor_kip: e.target.value })} /></Field>
              <Field label="Nama di KIP"><input className="input-field" value={form.nama_di_kip} onChange={(e) => setForm({ ...form, nama_di_kip: e.target.value })} /></Field>
              <Field label="Nomor KKS"><input className="input-field" value={form.nomor_kks} onChange={(e) => setForm({ ...form, nomor_kks: e.target.value })} /></Field>
              <Field label="Layak PIP (usulan sekolah)">
                <select className="input-field" value={form.layak_pip} onChange={(e) => setForm({ ...form, layak_pip: e.target.value })}>
                  <option value="">-</option><option value="Ya">Ya</option><option value="Tidak">Tidak</option>
                </select>
              </Field>
              <Field label="Alasan Layak PIP" full><input className="input-field" value={form.alasan_layak_pip} onChange={(e) => setForm({ ...form, alasan_layak_pip: e.target.value })} /></Field>
            </Seksi>

            <Seksi judul="Rekening (untuk pencairan bantuan)">
              <Field label="Bank"><input className="input-field" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></Field>
              <Field label="Nomor Rekening"><input className="input-field" value={form.no_rekening} onChange={(e) => setForm({ ...form, no_rekening: e.target.value })} /></Field>
              <Field label="Rekening Atas Nama"><input className="input-field" value={form.rekening_atas_nama} onChange={(e) => setForm({ ...form, rekening_atas_nama: e.target.value })} /></Field>
            </Seksi>

            <div className="mt-5 flex justify-end gap-3 sticky bottom-0 bg-white pt-3">
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
              <div className="card p-4 space-y-4 bg-white shadow-md">
                <SeksiProfil judul="Data Pribadi">
                  <ProfilRow label="NIS" value={profilLihat.nis} />
                  <ProfilRow label="NISN" value={profilLihat.nisn} />
                  <ProfilRow label="NIK" value={profilLihat.nik} />
                  <ProfilRow label="No. KK" value={profilLihat.no_kk} />
                  <ProfilRow label="No. Registrasi Akta Lahir" value={profilLihat.no_registrasi_akta_lahir} />
                  <ProfilRow label="Nomor Ujian" value={profilLihat.nomor_ujian} />
                  <ProfilRow label="Kelas" value={profilLihat.kelas?.nama_kelas} />
                  <ProfilRow label="Jenis Kelamin" value={profilLihat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                  <ProfilRow label="Agama" value={profilLihat.agama} />
                  <ProfilRow label="Tempat, Tanggal Lahir" value={tempatTanggalLahir(profilLihat)} />
                  <ProfilRow label="Anak ke-berapa" value={profilLihat.anak_ke} />
                  <ProfilRow label="Jumlah Saudara Kandung" value={profilLihat.jumlah_saudara_kandung} />
                  <ProfilRow label="Kebutuhan Khusus" value={profilLihat.kebutuhan_khusus} />
                  <ProfilRow label="Sekolah Asal" value={profilLihat.sekolah_asal || profilLihat.pendidikan_sebelumnya} />
                </SeksiProfil>

                <SeksiProfil judul="Fisik">
                  <ProfilRow label="Berat Badan" value={profilLihat.berat_badan ? `${profilLihat.berat_badan} kg` : null} />
                  <ProfilRow label="Tinggi Badan" value={profilLihat.tinggi_badan ? `${profilLihat.tinggi_badan} cm` : null} />
                  <ProfilRow label="Lingkar Kepala" value={profilLihat.lingkar_kepala ? `${profilLihat.lingkar_kepala} cm` : null} />
                </SeksiProfil>

                <SeksiProfil judul="Alamat">
                  <ProfilRow label="Alamat" value={profilLihat.alamat} />
                  <ProfilRow label="Alamat Tempat Tinggal" value={profilLihat.alamat_tinggal} />
                  <ProfilRow
                    label="Detail"
                    value={[profilLihat.rt && `RT ${profilLihat.rt}`, profilLihat.rw && `RW ${profilLihat.rw}`, profilLihat.dusun, profilLihat.kelurahan, profilLihat.kecamatan, profilLihat.kode_pos]
                      .filter(Boolean).join(', ') || null}
                  />
                  <ProfilRow label="Jenis Tinggal" value={profilLihat.jenis_tinggal} />
                  <ProfilRow label="Alat Transportasi" value={profilLihat.alat_transportasi} />
                </SeksiProfil>

                <SeksiProfil judul="Kontak">
                  <ProfilRow label="Telepon" value={profilLihat.telepon} telepon />
                  <ProfilRow label="HP" value={profilLihat.hp} telepon />
                  <ProfilRow label="Email" value={profilLihat.email} />
                  <ProfilRow label="No. HP Orang Tua/Wali" value={profilLihat.no_hp_orang_tua} telepon />
                </SeksiProfil>

                <SeksiProfil judul="Data Ayah">
                  <ProfilRow label="Nama Ayah" value={profilLihat.nama_ayah} />
                  <ProfilRow label="NIK Ayah" value={profilLihat.nik_ayah} />
                  <ProfilRow label="Tahun Lahir Ayah" value={profilLihat.tahun_lahir_ayah} />
                  <ProfilRow label="Pendidikan Ayah" value={profilLihat.pendidikan_ayah} />
                  <ProfilRow label="Pekerjaan Ayah" value={profilLihat.pekerjaan_ayah} />
                  <ProfilRow label="Penghasilan Ayah" value={profilLihat.penghasilan_ayah} />
                </SeksiProfil>

                <SeksiProfil judul="Data Ibu">
                  <ProfilRow label="Nama Ibu" value={profilLihat.nama_ibu} />
                  <ProfilRow label="NIK Ibu" value={profilLihat.nik_ibu} />
                  <ProfilRow label="Tahun Lahir Ibu" value={profilLihat.tahun_lahir_ibu} />
                  <ProfilRow label="Pendidikan Ibu" value={profilLihat.pendidikan_ibu} />
                  <ProfilRow label="Pekerjaan Ibu" value={profilLihat.pekerjaan_ibu} />
                  <ProfilRow label="Penghasilan Ibu" value={profilLihat.penghasilan_ibu} />
                </SeksiProfil>

                <SeksiProfil judul="Wali">
                  <ProfilRow label="Nama Wali" value={profilLihat.nama_wali} />
                  <ProfilRow label="Pekerjaan Wali" value={profilLihat.pekerjaan_wali} />
                  <ProfilRow label="Alamat Wali" value={profilLihat.alamat_wali} />
                </SeksiProfil>

                <SeksiProfil judul="Program Bantuan">
                  <ProfilRow label="Penerima KPS" value={profilLihat.penerima_kps} />
                  <ProfilRow label="No. KPS" value={profilLihat.no_kps} />
                  <ProfilRow label="Penerima KIP" value={profilLihat.penerima_kip} />
                  <ProfilRow label="Nomor KIP" value={profilLihat.nomor_kip} />
                  <ProfilRow label="Nomor KKS" value={profilLihat.nomor_kks} />
                  <ProfilRow label="Layak PIP" value={profilLihat.layak_pip} />
                  <ProfilRow label="Alasan Layak PIP" value={profilLihat.alasan_layak_pip} />
                </SeksiProfil>

                <SeksiProfil judul="Nama Orang Tua/Wali (Umum)">
                  <ProfilRow label="Nama Orang Tua/Wali" value={profilLihat.nama_orang_tua} />
                </SeksiProfil>
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
        templateHeaders={EXCEL_HEADERS}
        mapRow={(row) => {
          if (!row.nama_lengkap) return null
          const namaKelas = String(row.kelas || '').trim()

          // Pencocokan kelas (exact match, lalu fallback angka tingkat) sekarang
          // dipusatkan di lib/kelasMatch.js supaya konsisten dengan modal Impor Dapodik.
          const matchedKelas = matchKelasByName(kelasList, namaKelas)

          const toIntOrNull = (v) => {
            const n = parseInt(String(v || '').trim(), 10)
            return Number.isFinite(n) ? n : null
          }
          const toNumOrNull = (v) => {
            const s = String(v ?? '').trim()
            if (s === '') return null
            const n = Number(s)
            return Number.isFinite(n) ? n : null
          }
          const teks = (v) => String(v ?? '').trim()
          return {
            nama_lengkap: teks(row.nama_lengkap),
            nis: teks(row.nis),
            nisn: teks(row.nisn),
            nik: teks(row.nik),
            no_kk: teks(row.no_kk),
            nomor_ujian: teks(row.nomor_ujian),
            no_seri_ijazah: teks(row.no_seri_ijazah),
            skhun: teks(row.skhun),
            kelas_id: matchedKelas ? matchedKelas.id : null,
            jenis_kelamin: teks(row['jenis_kelamin(L/P)'] || row.jenis_kelamin || 'L').toUpperCase(),
            agama: teks(row.agama),
            tempat_lahir: teks(row.tempat_lahir),
            tanggal_lahir: row['tanggal_lahir(YYYY-MM-DD)'] || row.tanggal_lahir || null,
            tahun_lahir: toIntOrNull(row.tahun_lahir),
            nama_ayah: teks(row.nama_ayah),
            nik_ayah: teks(row.nik_ayah),
            tahun_lahir_ayah: toIntOrNull(row.tahun_lahir_ayah),
            pendidikan_ayah: teks(row.pendidikan_ayah),
            pekerjaan_ayah: teks(row.pekerjaan_ayah),
            penghasilan_ayah: teks(row.penghasilan_ayah),
            nama_ibu: teks(row.nama_ibu),
            nik_ibu: teks(row.nik_ibu),
            tahun_lahir_ibu: toIntOrNull(row.tahun_lahir_ibu),
            pendidikan_ibu: teks(row.pendidikan_ibu),
            pekerjaan_ibu: teks(row.pekerjaan_ibu),
            penghasilan_ibu: teks(row.penghasilan_ibu),
            nama_orang_tua: teks(row.nama_orang_tua),
            no_hp_orang_tua: teks(row.no_hp_orang_tua),
            alamat: teks(row.alamat),
            alamat_tinggal: teks(row.alamat_tinggal),
            rt: teks(row.rt),
            rw: teks(row.rw),
            dusun: teks(row.dusun),
            kelurahan: teks(row.kelurahan),
            kecamatan: teks(row.kecamatan),
            kode_pos: teks(row.kode_pos),
            jenis_tinggal: teks(row.jenis_tinggal),
            alat_transportasi: teks(row.alat_transportasi),
            telepon: teks(row.telepon),
            hp: teks(row.hp),
            email: teks(row.email),
            penerima_kps: teks(row['penerima_kps(Ya/Tidak)'] || row.penerima_kps),
            no_kps: teks(row.no_kps),
            penerima_kip: teks(row['penerima_kip(Ya/Tidak)'] || row.penerima_kip),
            nomor_kip: teks(row.nomor_kip),
            nama_di_kip: teks(row.nama_di_kip),
            nomor_kks: teks(row.nomor_kks),
            layak_pip: teks(row['layak_pip(Ya/Tidak)'] || row.layak_pip),
            alasan_layak_pip: teks(row.alasan_layak_pip),
            no_registrasi_akta_lahir: teks(row.no_registrasi_akta_lahir),
            bank: teks(row.bank),
            no_rekening: teks(row.no_rekening),
            rekening_atas_nama: teks(row.rekening_atas_nama),
            kebutuhan_khusus: teks(row.kebutuhan_khusus),
            berat_badan: toNumOrNull(row.berat_badan),
            tinggi_badan: toNumOrNull(row.tinggi_badan),
            lingkar_kepala: toNumOrNull(row.lingkar_kepala),
            anak_ke: toIntOrNull(row.anak_ke),
            jumlah_saudara_kandung: toIntOrNull(row.jumlah_saudara_kandung),
            sekolah_asal: teks(row.sekolah_asal),
            pendidikan_sebelumnya: teks(row.sekolah_asal),
            status: 'aktif',
          }
        }}
        onImport={importSiswaRows}
      />

      <DapodikImportModal
        open={showImportDapodik}
        onClose={() => { setShowImportDapodik(false); loadData() }}
        kelasList={kelasList}
        onImport={importSiswaRows}
      />
    </Layout>
  )
}

function Seksi({ judul, children }) {
  return (
    <div className="mt-5 first:mt-0 pt-4 first:pt-0 border-t first:border-t-0 border-ink-900/[0.08]">
      <p className="eyebrow mb-2 text-blue-900">{judul}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function SeksiProfil({ judul, children }) {
  return (
    <div>
      <p className="eyebrow text-blue-900/70 mb-2">{judul}</p>
      <div className="space-y-2">{children}</div>
    </div>
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
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-ink-700/50 shrink-0">{label}</span>
      <span className="text-ink-950 font-medium text-right inline-flex items-center gap-1.5">
        {value}
        {telepon && <TeleponLink nomor={value} />}
      </span>
    </div>
  )
}
