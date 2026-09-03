import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../context/AuthContext'
import BulkImportModal from '../components/BulkImportModal'
import TeleponLink from '../components/TeleponLink'
import { Plus, UploadCloud, Pencil, Trash2, Search, X, Loader2, GraduationCap, CalendarDays } from 'lucide-react'

// emptyForm mengikuti seluruh field Formulir Dapodik (bukan hanya data inti)
const emptyForm = {
  // Data Pribadi
  nama_lengkap: '',
  nip: '',
  nuptk: '',
  nik: '',
  no_kk: '',
  jenis_kelamin: 'L',
  tempat_lahir: '',
  tanggal_lahir: '',
  agama: '',
  kewarganegaraan: 'ID',
  status_perkawinan: '',
  nama_ibu_kandung: '',
  nama_pasangan: '',
  nip_pasangan: '',
  pekerjaan_pasangan: '',
  pendidikan_terakhir: '',
  // Kepegawaian
  status_kepegawaian: '',
  jenis_ptk: '',
  mata_pelajaran: '',
  tugas_tambahan: '',
  pangkat_golongan: '',
  sumber_gaji: '',
  sk_cpns: '',
  tanggal_cpns: '',
  sk_pengangkatan: '',
  tmt_pengangkatan: '',
  lembaga_pengangkatan: '',
  tmt_pns: '',
  sudah_lisensi_kepsek: 'Tidak',
  pernah_diklat_pengawas: 'Tidak',
  karpeg: '',
  karis_karsu: '',
  nuks: '',
  // Alamat & Lokasi
  alamat_jalan: '',
  rt: '',
  rw: '',
  nama_dusun: '',
  desa_kelurahan: '',
  kecamatan: '',
  kode_pos: '',
  lintang: '',
  bujur: '',
  // Kontak
  telepon: '',
  no_hp: '',
  email: '',
  // Lainnya
  keahlian_braille: 'Tidak',
  keahlian_bahasa_isyarat: 'Tidak',
  npwp: '',
  nama_wajib_pajak: '',
  bank: '',
  no_rekening: '',
  rekening_atas_nama: '',
  // Status internal aplikasi
  status: 'aktif',
}

function formatTanggal(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

// Format singkat untuk widget kalender: "Sel, 17 Agu 2026"
function formatTanggalSingkat(tgl) {
  if (!tgl) return ''
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return tgl
  }
}

// Mengubah berbagai bentuk tanggal dari file impor (Date object, serial Excel,
// atau teks "yyyy-mm-dd") menjadi string "yyyy-mm-dd" yang aman disimpan ke Postgres.
function parseTanggalImpor(raw) {
  if (raw === null || raw === undefined || raw === '') return null
  if (raw instanceof Date && !isNaN(raw)) return raw.toISOString().slice(0, 10)
  if (typeof raw === 'number') {
    // Serial tanggal Excel (basis 1899-12-30)
    const ms = Math.round((raw - 25569) * 86400 * 1000)
    const d = new Date(ms)
    return isNaN(d) ? null : d.toISOString().slice(0, 10)
  }
  const s = String(raw).trim()
  if (!s) return null
  const d = new Date(s)
  return isNaN(d) ? null : d.toISOString().slice(0, 10)
}

function teks(v) {
  if (v === null || v === undefined) return ''
  const s = String(v).trim()
  return s === 'nan' || s === 'NaN' ? '' : s
}

export default function Guru() {
  const { sekolahId } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [profilLihat, setProfilLihat] = useState(null) // guru yang sedang dilihat detail profilnya

  // Widget "Hari Libur Terdekat" — mengambil dari tabel hari_libur yang sama dengan halaman Hari Libur
  const [liburMendatang, setLiburMendatang] = useState([])
  const [loadingLibur, setLoadingLibur] = useState(true)

  async function loadData() {
    if (!sekolahId) {
      setData([])
      setLoading(false)
      setProfilLihat(null)
      return
    }

    setLoading(true)
    const { data: guru, error } = await supabase
      .from('guru')
      .select('*')
      .eq('sekolah_id', sekolahId)
      .order('nama_lengkap')

    if (error) {
      console.error('Gagal memuat data guru:', error)
      alert('Gagal memuat data guru: ' + error.message)
    }

    setData(guru || [])
    setLoading(false)

    // Jaga agar modal profil tetap sinkron kalau datanya baru saja diubah
    if (profilLihat) {
      const updated = (guru || []).find((g) => g.id === profilLihat.id)
      if (updated) setProfilLihat(updated)
      else setProfilLihat(null)
    }
  }

  async function loadLiburMendatang() {
    setLoadingLibur(true)
    const hariIni = new Date().toISOString().slice(0, 10)
    const { data: libur } = await supabase
      .from('hari_libur')
      .select('*')
      .gte('tanggal', hariIni)
      .order('tanggal')
      .limit(5)
    setLiburMendatang(libur || [])
    setLoadingLibur(false)
  }

  useEffect(() => {
    loadData()
    loadLiburMendatang()
  }, [sekolahId])

  // Foto profil guru — memakai bucket & kolom yang sama persis dengan Profil Saya
  function fotoUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
  }

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...emptyForm, ...row, tanggal_lahir: row.tanggal_lahir ? String(row.tanggal_lahir).slice(0, 10) : '' })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!sekolahId) {
      alert('Belum ada sekolah aktif. Pilih sekolah terlebih dahulu.')
      return
    }

    setSaving(true)

    const payload = {
      ...form,
      sekolah_id: sekolahId,
      tanggal_lahir: form.tanggal_lahir || null,
      tanggal_cpns: form.tanggal_cpns || null,
      tmt_pengangkatan: form.tmt_pengangkatan || null,
      tmt_pns: form.tmt_pns || null,
      lintang: form.lintang === '' ? null : Number(form.lintang),
      bujur: form.bujur === '' ? null : Number(form.bujur),
    }

    const { error } = editingId
      ? await supabase.from('guru').update(payload).eq('id', editingId).eq('sekolah_id', sekolahId)
      : await supabase.from('guru').insert(payload)

    setSaving(false)

    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!sekolahId) {
      alert('Belum ada sekolah aktif. Pilih sekolah terlebih dahulu.')
      return
    }

    if (!confirm('Hapus data guru ini?')) return

    const { error } = await supabase
      .from('guru')
      .delete()
      .eq('id', id)
      .eq('sekolah_id', sekolahId)

    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const filtered = data.filter((g) =>
    `${g.nama_lengkap} ${g.nip} ${g.nuptk} ${g.mata_pelajaran}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout
      title="Data Guru"
      subtitle={`${data.length} guru & staf terdaftar`}
      actions={
        <>
          <button className="btn-secondary" onClick={() => setShowImport(true)} disabled={!sekolahId}>
            <UploadCloud size={16} /> Impor Massal
          </button>
          <button className="btn-primary" onClick={openAdd} disabled={!sekolahId}>
            <Plus size={16} /> Tambah Guru
          </button>
        </>
      }
    >
      {/* Kartu pencarian — aksen garis biru→maroon di tepi atas sebagai identitas modul Guru */}
      <div className="card relative overflow-hidden p-4 mb-4">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-red-900" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
            <GraduationCap size={18} />
          </div>
          <div className="relative max-w-sm w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input className="input-field pl-9" placeholder="Cari nama, NIP, NUPTK, atau mapel..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Widget Hari Libur Terdekat — kalender pendidikan, sumber data sama dengan halaman Hari Libur */}
      <div className="card relative overflow-hidden p-4 mb-4">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 to-blue-600" />
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-red-900/10 text-red-900 flex items-center justify-center shrink-0">
            <CalendarDays size={18} />
          </div>
          <div>
            <p className="font-display font-semibold text-sm text-ink-950">Hari Libur Terdekat</p>
            <p className="text-xs text-ink-700/50">Kalender pendidikan tahun ajaran berjalan</p>
          </div>
        </div>

        {loadingLibur && (
          <p className="text-sm text-ink-700/50 py-2">Memuat...</p>
        )}

        {!loadingLibur && liburMendatang.length === 0 && (
          <p className="text-sm text-ink-700/50 py-2">Tidak ada hari libur mendatang yang terjadwal.</p>
        )}

        {!loadingLibur && liburMendatang.length > 0 && (
          <ul className="divide-y divide-ink-950/5">
            {liburMendatang.map((l) => (
              <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink-950">{l.keterangan}</span>
                <span className="text-ink-700/50 font-medium shrink-0 ml-4">{formatTanggalSingkat(l.tanggal)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!sekolahId && (
        <div className="card p-6 mb-4">
          <p className="font-display font-semibold text-ink-950">Belum ada sekolah aktif</p>
          <p className="text-sm text-ink-700/60 mt-1">
            Pilih sekolah terlebih dahulu agar data guru yang ditampilkan sesuai sekolah.
          </p>
        </div>
      )}

      {sekolahId && <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr className="border-b-2 border-blue-600/20">
              <th>Nama Lengkap</th>
              <th>NIP</th>
              <th>NUPTK</th>
              <th>Mata Pelajaran</th>
              <th>No. HP</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={8} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-ink-700/50">Belum ada data guru.</td></tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} className="hover:bg-blue-600/[0.03] transition-colors">
                <td className="font-medium">
                  <button
                    type="button"
                    onClick={() => setProfilLihat(g)}
                    className="hover:underline hover:text-blue-700 text-left"
                  >
                    {g.nama_lengkap}
                  </button>
                </td>
                <td className="font-mono text-xs">{g.nip}</td>
                <td className="font-mono text-xs">{g.nuptk}</td>
                <td>{g.mata_pelajaran}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    {g.no_hp}
                    <TeleponLink nomor={g.no_hp} />
                  </span>
                </td>
                <td>{g.email}</td>
                <td>
                  <span className={`badge ${g.status === 'aktif' ? 'bg-blue-600/15 text-blue-700' : 'bg-red-900/10 text-red-900'}`}>
                    {g.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(g)} className="p-2 hover:bg-blue-600/10 rounded-lg text-blue-700/70"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(g.id)} className="p-2 hover:bg-red-900/10 rounded-lg text-red-900/70"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}

      {showForm && sekolahId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card relative overflow-hidden w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-red-900" />
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
                <GraduationCap size={19} />
              </div>
              <h2 className="font-display text-xl font-semibold">{editingId ? 'Ubah Data Guru' : 'Tambah Guru'}</h2>
            </div>

            <SeksiForm judul="Data Pribadi">
              <Field label="Nama Lengkap" full>
                <input required className="input-field" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} />
              </Field>
              <Field label="NIP"><input className="input-field" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} /></Field>
              <Field label="NUPTK"><input className="input-field" value={form.nuptk} onChange={(e) => setForm({ ...form, nuptk: e.target.value })} /></Field>
              <Field label="NIK"><input className="input-field" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} /></Field>
              <Field label="No. KK"><input className="input-field" value={form.no_kk} onChange={(e) => setForm({ ...form, no_kk: e.target.value })} /></Field>
              <Field label="Jenis Kelamin">
                <select className="input-field" value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Agama"><input className="input-field" value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })} /></Field>
              <Field label="Tempat Lahir"><input className="input-field" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} /></Field>
              <Field label="Tanggal Lahir"><input type="date" className="input-field" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} /></Field>
              <Field label="Kewarganegaraan"><input className="input-field" value={form.kewarganegaraan} onChange={(e) => setForm({ ...form, kewarganegaraan: e.target.value })} /></Field>
              <Field label="Pendidikan Terakhir"><input className="input-field" value={form.pendidikan_terakhir} onChange={(e) => setForm({ ...form, pendidikan_terakhir: e.target.value })} /></Field>
              <Field label="Status Perkawinan">
                <select className="input-field" value={form.status_perkawinan} onChange={(e) => setForm({ ...form, status_perkawinan: e.target.value })}>
                  <option value="">-</option>
                  <option value="Belum Kawin">Belum Kawin</option>
                  <option value="Kawin">Kawin</option>
                  <option value="Cerai Hidup">Cerai Hidup</option>
                  <option value="Cerai Mati">Cerai Mati</option>
                </select>
              </Field>
              <Field label="Nama Ibu Kandung"><input className="input-field" value={form.nama_ibu_kandung} onChange={(e) => setForm({ ...form, nama_ibu_kandung: e.target.value })} /></Field>
              <Field label="Nama Suami/Istri"><input className="input-field" value={form.nama_pasangan} onChange={(e) => setForm({ ...form, nama_pasangan: e.target.value })} /></Field>
              <Field label="NIP Suami/Istri"><input className="input-field" value={form.nip_pasangan} onChange={(e) => setForm({ ...form, nip_pasangan: e.target.value })} /></Field>
              <Field label="Pekerjaan Suami/Istri" full><input className="input-field" value={form.pekerjaan_pasangan} onChange={(e) => setForm({ ...form, pekerjaan_pasangan: e.target.value })} /></Field>
            </SeksiForm>

            <SeksiForm judul="Kepegawaian">
              <Field label="Status Kepegawaian">
                <input className="input-field" placeholder="PNS / PPPK / Honor..." value={form.status_kepegawaian} onChange={(e) => setForm({ ...form, status_kepegawaian: e.target.value })} />
              </Field>
              <Field label="Jenis PTK"><input className="input-field" value={form.jenis_ptk} onChange={(e) => setForm({ ...form, jenis_ptk: e.target.value })} /></Field>
              <Field label="Mata Pelajaran"><input className="input-field" value={form.mata_pelajaran} onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })} /></Field>
              <Field label="Tugas Tambahan"><input className="input-field" value={form.tugas_tambahan} onChange={(e) => setForm({ ...form, tugas_tambahan: e.target.value })} /></Field>
              <Field label="Pangkat / Golongan"><input className="input-field" value={form.pangkat_golongan} onChange={(e) => setForm({ ...form, pangkat_golongan: e.target.value })} /></Field>
              <Field label="Sumber Gaji"><input className="input-field" value={form.sumber_gaji} onChange={(e) => setForm({ ...form, sumber_gaji: e.target.value })} /></Field>
              <Field label="SK CPNS"><input className="input-field" value={form.sk_cpns} onChange={(e) => setForm({ ...form, sk_cpns: e.target.value })} /></Field>
              <Field label="Tanggal CPNS"><input type="date" className="input-field" value={form.tanggal_cpns} onChange={(e) => setForm({ ...form, tanggal_cpns: e.target.value })} /></Field>
              <Field label="SK Pengangkatan"><input className="input-field" value={form.sk_pengangkatan} onChange={(e) => setForm({ ...form, sk_pengangkatan: e.target.value })} /></Field>
              <Field label="TMT Pengangkatan"><input type="date" className="input-field" value={form.tmt_pengangkatan} onChange={(e) => setForm({ ...form, tmt_pengangkatan: e.target.value })} /></Field>
              <Field label="Lembaga Pengangkatan" full><input className="input-field" value={form.lembaga_pengangkatan} onChange={(e) => setForm({ ...form, lembaga_pengangkatan: e.target.value })} /></Field>
              <Field label="TMT PNS"><input type="date" className="input-field" value={form.tmt_pns} onChange={(e) => setForm({ ...form, tmt_pns: e.target.value })} /></Field>
              <Field label="Karpeg"><input className="input-field" value={form.karpeg} onChange={(e) => setForm({ ...form, karpeg: e.target.value })} /></Field>
              <Field label="Karis/Karsu"><input className="input-field" value={form.karis_karsu} onChange={(e) => setForm({ ...form, karis_karsu: e.target.value })} /></Field>
              <Field label="NUKS"><input className="input-field" value={form.nuks} onChange={(e) => setForm({ ...form, nuks: e.target.value })} /></Field>
              <Field label="Sudah Lisensi Kepsek">
                <select className="input-field" value={form.sudah_lisensi_kepsek} onChange={(e) => setForm({ ...form, sudah_lisensi_kepsek: e.target.value })}>
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </Field>
              <Field label="Pernah Diklat Pengawas">
                <select className="input-field" value={form.pernah_diklat_pengawas} onChange={(e) => setForm({ ...form, pernah_diklat_pengawas: e.target.value })}>
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </Field>
            </SeksiForm>

            <SeksiForm judul="Alamat & Lokasi">
              <Field label="Alamat Jalan" full><input className="input-field" value={form.alamat_jalan} onChange={(e) => setForm({ ...form, alamat_jalan: e.target.value })} /></Field>
              <Field label="RT"><input className="input-field" value={form.rt} onChange={(e) => setForm({ ...form, rt: e.target.value })} /></Field>
              <Field label="RW"><input className="input-field" value={form.rw} onChange={(e) => setForm({ ...form, rw: e.target.value })} /></Field>
              <Field label="Nama Dusun"><input className="input-field" value={form.nama_dusun} onChange={(e) => setForm({ ...form, nama_dusun: e.target.value })} /></Field>
              <Field label="Desa/Kelurahan"><input className="input-field" value={form.desa_kelurahan} onChange={(e) => setForm({ ...form, desa_kelurahan: e.target.value })} /></Field>
              <Field label="Kecamatan"><input className="input-field" value={form.kecamatan} onChange={(e) => setForm({ ...form, kecamatan: e.target.value })} /></Field>
              <Field label="Kode Pos"><input className="input-field" value={form.kode_pos} onChange={(e) => setForm({ ...form, kode_pos: e.target.value })} /></Field>
              <Field label="Lintang"><input className="input-field" value={form.lintang} onChange={(e) => setForm({ ...form, lintang: e.target.value })} /></Field>
              <Field label="Bujur"><input className="input-field" value={form.bujur} onChange={(e) => setForm({ ...form, bujur: e.target.value })} /></Field>
            </SeksiForm>

            <SeksiForm judul="Kontak">
              <Field label="Telepon"><input className="input-field" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} /></Field>
              <Field label="No. HP"><input className="input-field" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} /></Field>
              <Field label="Email"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
            </SeksiForm>

            <SeksiForm judul="Lainnya">
              <Field label="Keahlian Braille">
                <select className="input-field" value={form.keahlian_braille} onChange={(e) => setForm({ ...form, keahlian_braille: e.target.value })}>
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </Field>
              <Field label="Keahlian Bahasa Isyarat">
                <select className="input-field" value={form.keahlian_bahasa_isyarat} onChange={(e) => setForm({ ...form, keahlian_bahasa_isyarat: e.target.value })}>
                  <option value="Tidak">Tidak</option>
                  <option value="Ya">Ya</option>
                </select>
              </Field>
              <Field label="NPWP"><input className="input-field" value={form.npwp} onChange={(e) => setForm({ ...form, npwp: e.target.value })} /></Field>
              <Field label="Nama Wajib Pajak"><input className="input-field" value={form.nama_wajib_pajak} onChange={(e) => setForm({ ...form, nama_wajib_pajak: e.target.value })} /></Field>
              <Field label="Bank"><input className="input-field" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} /></Field>
              <Field label="Nomor Rekening"><input className="input-field" value={form.no_rekening} onChange={(e) => setForm({ ...form, no_rekening: e.target.value })} /></Field>
              <Field label="Rekening Atas Nama"><input className="input-field" value={form.rekening_atas_nama} onChange={(e) => setForm({ ...form, rekening_atas_nama: e.target.value })} /></Field>
              <Field label="Status di Aplikasi" full>
                <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </Field>
            </SeksiForm>

            <div className="mt-5 flex justify-end gap-3 sticky bottom-0 bg-white pt-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />} Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Lihat Profil — identitas lengkap + foto besar, dibuka dengan klik nama guru (pola sama seperti di Data Siswa) */}
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

            <div className="relative bg-gradient-to-br from-blue-900 to-blue-950 pt-8 pb-16 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/20 bg-white/10 flex items-center justify-center shrink-0">
                {fotoUrl(profilLihat.foto_profil_path) ? (
                  <img src={fotoUrl(profilLihat.foto_profil_path)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-white/60">{profilLihat.nama_lengkap?.[0]}</span>
                )}
              </div>
              <p className="font-display font-semibold text-lg text-white mt-3 text-center px-6">{profilLihat.nama_lengkap}</p>
              <span className={`badge mt-1.5 ${profilLihat.status === 'aktif' ? 'bg-sage-500/20 text-sage-100' : 'bg-white/10 text-white/70'}`}>
                {profilLihat.status}
              </span>
            </div>

            <div className="px-6 -mt-12 pb-6">
              <div className="card p-4 space-y-4 bg-white shadow-md">
                <SeksiProfil judul="Data Pribadi">
                  <ProfilRow label="NIP" value={profilLihat.nip} />
                  <ProfilRow label="NUPTK" value={profilLihat.nuptk} />
                  <ProfilRow label="NIK" value={profilLihat.nik} />
                  <ProfilRow label="No. KK" value={profilLihat.no_kk} />
                  <ProfilRow label="Jenis Kelamin" value={profilLihat.jenis_kelamin === 'L' ? 'Laki-laki' : profilLihat.jenis_kelamin === 'P' ? 'Perempuan' : null} />
                  <ProfilRow label="Agama" value={profilLihat.agama} />
                  <ProfilRow label="Tempat, Tgl Lahir" value={profilLihat.tempat_lahir || profilLihat.tanggal_lahir ? `${profilLihat.tempat_lahir || '-'}, ${formatTanggal(profilLihat.tanggal_lahir) || '-'}` : null} />
                  <ProfilRow label="Kewarganegaraan" value={profilLihat.kewarganegaraan} />
                  <ProfilRow label="Pendidikan Terakhir" value={profilLihat.pendidikan_terakhir} />
                  <ProfilRow label="Status Perkawinan" value={profilLihat.status_perkawinan} />
                  <ProfilRow label="Nama Ibu Kandung" value={profilLihat.nama_ibu_kandung} />
                  <ProfilRow label="Nama Suami/Istri" value={profilLihat.nama_pasangan} />
                  <ProfilRow label="Pekerjaan Suami/Istri" value={profilLihat.pekerjaan_pasangan} />
                </SeksiProfil>

                <SeksiProfil judul="Kepegawaian">
                  <ProfilRow label="Status Kepegawaian" value={profilLihat.status_kepegawaian} />
                  <ProfilRow label="Jenis PTK" value={profilLihat.jenis_ptk} />
                  <ProfilRow label="Mata Pelajaran" value={profilLihat.mata_pelajaran} />
                  <ProfilRow label="Tugas Tambahan" value={profilLihat.tugas_tambahan} />
                  <ProfilRow label="Pangkat / Golongan" value={profilLihat.pangkat_golongan} />
                  <ProfilRow label="Sumber Gaji" value={profilLihat.sumber_gaji} />
                  <ProfilRow label="SK Pengangkatan" value={profilLihat.sk_pengangkatan} />
                  <ProfilRow label="TMT Pengangkatan" value={formatTanggal(profilLihat.tmt_pengangkatan)} />
                  <ProfilRow label="Lembaga Pengangkatan" value={profilLihat.lembaga_pengangkatan} />
                  <ProfilRow label="TMT PNS" value={formatTanggal(profilLihat.tmt_pns)} />
                </SeksiProfil>

                <SeksiProfil judul="Alamat">
                  <ProfilRow
                    label="Alamat Lengkap"
                    value={[profilLihat.alamat_jalan, profilLihat.rt && `RT ${profilLihat.rt}`, profilLihat.rw && `RW ${profilLihat.rw}`, profilLihat.nama_dusun, profilLihat.desa_kelurahan, profilLihat.kecamatan, profilLihat.kode_pos]
                      .filter(Boolean).join(', ') || null}
                  />
                </SeksiProfil>

                <SeksiProfil judul="Kontak">
                  <ProfilRow label="Telepon" value={profilLihat.telepon} telepon />
                  <ProfilRow label="No. HP" value={profilLihat.no_hp} telepon />
                  <ProfilRow label="Email" value={profilLihat.email} />
                </SeksiProfil>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setProfilLihat(null); openEdit(profilLihat) }}
                  className="btn-secondary flex-1 justify-center"
                >
                  <Pencil size={15} /> Ubah Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkImportModal
        open={showImport}
        onClose={() => { setShowImport(false); loadData() }}
        title="Impor Data Guru (Format Dapodik)"
        templateHeaders={[
          'Nama', 'NUPTK', 'JK', 'Tempat Lahir', 'Tanggal Lahir', 'NIP', 'Status Kepegawaian', 'Jenis PTK', 'Agama',
          'Alamat Jalan', 'RT', 'RW', 'Nama Dusun', 'Desa/Kelurahan', 'Kecamatan', 'Kode Pos', 'Telepon', 'HP', 'Email',
          'Tugas Tambahan', 'SK CPNS', 'Tanggal CPNS', 'SK Pengangkatan', 'TMT Pengangkatan', 'Lembaga Pengangkatan',
          'Pangkat Golongan', 'Sumber Gaji', 'Nama Ibu Kandung', 'Status Perkawinan', 'Nama Suami/Istri', 'NIP Suami/Istri',
          'Pekerjaan Suami/Istri', 'TMT PNS', 'Sudah Lisensi Kepala Sekolah', 'Pernah Diklat Kepengawasan',
          'Keahlian Braille', 'Keahlian Bahasa Isyarat', 'NPWP', 'Nama Wajib Pajak', 'Kewarganegaraan', 'Bank',
          'Nomor Rekening Bank', 'Rekening Atas Nama', 'NIK', 'No KK', 'Karpeg', 'Karis/Karsu', 'Lintang', 'Bujur', 'NUKS',
        ]}
        // mapRow menerima file ekspor Dapodik apa adanya (header persis seperti unduhan resmi).
        // Baris tanpa 'Nama' dilewati (biasanya baris judul/metadata di bagian atas file Dapodik).
        mapRow={(row) => {
          const nama = teks(row['Nama'])
          if (!nama) return null
          return {
            nama_lengkap: nama,
            nuptk: teks(row['NUPTK']),
            nik: teks(row['NIK']),
            no_kk: teks(row['No KK']),
            jenis_kelamin: teks(row['JK']).toUpperCase() === 'P' ? 'P' : 'L',
            tempat_lahir: teks(row['Tempat Lahir']),
            tanggal_lahir: parseTanggalImpor(row['Tanggal Lahir']),
            nip: teks(row['NIP']),
            status_kepegawaian: teks(row['Status Kepegawaian']),
            jenis_ptk: teks(row['Jenis PTK']),
            agama: teks(row['Agama']),
            alamat_jalan: teks(row['Alamat Jalan']),
            rt: teks(row['RT']),
            rw: teks(row['RW']),
            nama_dusun: teks(row['Nama Dusun']),
            desa_kelurahan: teks(row['Desa/Kelurahan']),
            kecamatan: teks(row['Kecamatan']),
            kode_pos: teks(row['Kode Pos']),
            telepon: teks(row['Telepon']),
            no_hp: teks(row['HP']),
            email: teks(row['Email']),
            tugas_tambahan: teks(row['Tugas Tambahan']),
            sk_cpns: teks(row['SK CPNS']),
            tanggal_cpns: parseTanggalImpor(row['Tanggal CPNS']),
            sk_pengangkatan: teks(row['SK Pengangkatan']),
            tmt_pengangkatan: parseTanggalImpor(row['TMT Pengangkatan']),
            lembaga_pengangkatan: teks(row['Lembaga Pengangkatan']),
            pangkat_golongan: teks(row['Pangkat Golongan']),
            sumber_gaji: teks(row['Sumber Gaji']),
            nama_ibu_kandung: teks(row['Nama Ibu Kandung']),
            status_perkawinan: teks(row['Status Perkawinan']),
            nama_pasangan: teks(row['Nama Suami/Istri']),
            nip_pasangan: teks(row['NIP Suami/Istri']),
            pekerjaan_pasangan: teks(row['Pekerjaan Suami/Istri']),
            tmt_pns: parseTanggalImpor(row['TMT PNS']),
            sudah_lisensi_kepsek: teks(row['Sudah Lisensi Kepala Sekolah']) || 'Tidak',
            pernah_diklat_pengawas: teks(row['Pernah Diklat Kepengawasan']) || 'Tidak',
            keahlian_braille: teks(row['Keahlian Braille']) || 'Tidak',
            keahlian_bahasa_isyarat: teks(row['Keahlian Bahasa Isyarat']) || 'Tidak',
            npwp: teks(row['NPWP']),
            nama_wajib_pajak: teks(row['Nama Wajib Pajak']),
            kewarganegaraan: teks(row['Kewarganegaraan']) || 'ID',
            bank: teks(row['Bank']),
            no_rekening: teks(row['Nomor Rekening Bank']),
            rekening_atas_nama: teks(row['Rekening Atas Nama']),
            karpeg: teks(row['Karpeg']),
            karis_karsu: teks(row['Karis/Karsu']),
            lintang: row['Lintang'] === undefined || row['Lintang'] === '' || row['Lintang'] === null ? null : Number(row['Lintang']),
            bujur: row['Bujur'] === undefined || row['Bujur'] === '' || row['Bujur'] === null ? null : Number(row['Bujur']),
            nuks: teks(row['NUKS']),
            mata_pelajaran: teks(row['Mata Pelajaran']) || teks(row['Jenis PTK']),
            status: 'aktif',
          }
        }}
        onImport={async (rows) => {
          if (!sekolahId) throw new Error('Belum ada sekolah aktif. Pilih sekolah terlebih dahulu.')

          const rowsWithSchool = rows.map((row) => ({
            ...row,
            sekolah_id: sekolahId,
          }))

          const { error } = await supabase.from('guru').insert(rowsWithSchool)
          if (error) throw error
          return { count: rowsWithSchool.length }
        }}
      />
    </Layout>
  )
}

function SeksiForm({ judul, children }) {
  return (
    <div className="mt-5 first:mt-0">
      <p className="eyebrow text-blue-700 mb-2">{judul}</p>
      <div className="grid grid-cols-2 gap-3">{children}</div>
    </div>
  )
}

function SeksiProfil({ judul, children }) {
  return (
    <div>
      <p className="eyebrow text-blue-700/70 mb-2">{judul}</p>
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
  if (!value) return null
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
