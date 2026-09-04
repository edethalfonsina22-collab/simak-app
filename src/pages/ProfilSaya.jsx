import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import GrafikAktivitas from '../components/GrafikAktivitas'
import { Camera, Loader2, Save, Users, School, ShieldCheck, UserCircle2, Clock, CheckCircle2, XCircle, UserPlus, X } from 'lucide-react'
// ASUMSI: menggunakan library `react-barcode` untuk membuat kode batang (linear barcode) di sisi klien.
// Install dulu kalau belum ada: npm install react-barcode
import Barcode from 'react-barcode'
// Menggunakan library `qrcode` (sudah ada di package.json) untuk membuat QR code sebagai data URL PNG.
import QRCode from 'qrcode'

const LABEL_JABATAN = {
  admin: 'Admin',
  admin_utama: 'Admin Utama',
  superadmin: 'Superadmin',
  kepala_sekolah: 'Kepala Sekolah',
  guru: 'Guru',
}

// Kartu profil untuk akun yang tidak tertaut ke tabel `guru` (admin / admin_utama /
// superadmin / kepala sekolah). Dibuat setara dengan kartu guru: foto profil, QR code,
// barcode identitas, dan field data diri yang sama (NUPTK, pangkat/golongan, no HP,
// tanggal lahir, pendidikan terakhir, alamat) — plus nama sekolah, karena admin/kepsek
// tidak punya baris di tabel `guru` untuk menyimpan semua ini.
// `adminData` diambil terpisah (bukan dari AuthContext) karena AuthContext hanya
// mengambil role/jabatan/guru_id/sekolah_id/status_akun, tidak termasuk field-field ini.
function ProfilAdminCard({ profil, userId, adminData }) {
  const [form, setForm] = useState({
    nama_lengkap_pendaftar: adminData?.nama_lengkap_pendaftar || '',
    email_pendaftar: adminData?.email_pendaftar || '',
    nuptk: adminData?.nuptk || '',
    pangkat_golongan: adminData?.pangkat_golongan || '',
    no_hp: adminData?.no_hp || '',
    tanggal_lahir: adminData?.tanggal_lahir || '',
    pendidikan_terakhir: adminData?.pendidikan_terakhir || '',
    alamat: adminData?.alamat || '',
  })
  const [fotoPath, setFotoPath] = useState(adminData?.foto_profil_path || '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  // QR code identitas admin/kepsek (dibuat dari user id -> data URL PNG), sama pola
  // seperti QR guru tapi memakai userId karena admin/kepsek tidak punya guru_id.
  const [qrDataUrl, setQrDataUrl] = useState('')

  // Sinkronkan form/foto kalau adminData datang belakangan (query async di komponen induk
  // selesai setelah render pertama komponen ini).
  useEffect(() => {
    setForm({
      nama_lengkap_pendaftar: adminData?.nama_lengkap_pendaftar || '',
      email_pendaftar: adminData?.email_pendaftar || '',
      nuptk: adminData?.nuptk || '',
      pangkat_golongan: adminData?.pangkat_golongan || '',
      no_hp: adminData?.no_hp || '',
      tanggal_lahir: adminData?.tanggal_lahir || '',
      pendidikan_terakhir: adminData?.pendidikan_terakhir || '',
      alamat: adminData?.alamat || '',
    })
    setFotoPath(adminData?.foto_profil_path || '')
  }, [adminData])

  useEffect(() => {
    if (!userId) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(String(userId), {
      width: 144,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [userId])

  function fotoUrl() {
    if (!fotoPath) return null
    return supabase.storage.from('foto-profil').getPublicUrl(fotoPath).data.publicUrl
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingFoto(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/foto.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('foto-profil')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingFoto(false)
      return
    }

    // ASUMSI: tabel `profil` punya kolom `foto_profil_path` (sama seperti di tabel `guru`).
    // Kalau kolom ini belum ada, tambahkan dulu:
    // alter table profil add column foto_profil_path text;
    const { error: updateError } = await supabase
      .from('profil')
      .update({ foto_profil_path: path })
      .eq('id', userId)

    if (updateError) {
      alert('Gagal simpan foto: ' + updateError.message)
    } else {
      setFotoPath(path)
    }
    setUploadingFoto(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    // ASUMSI: tabel `profil` sudah punya kolom-kolom berikut (sama seperti di tabel
    // `guru`). Kalau belum ada, tambahkan dulu:
    // alter table profil add column nuptk text;
    // alter table profil add column pangkat_golongan text;
    // alter table profil add column no_hp text;
    // alter table profil add column tanggal_lahir date;
    // alter table profil add column pendidikan_terakhir text;
    // alter table profil add column alamat text;
    const { error } = await supabase
      .from('profil')
      .update({
        nama_lengkap_pendaftar: form.nama_lengkap_pendaftar,
        email_pendaftar: form.email_pendaftar,
        nuptk: form.nuptk,
        pangkat_golongan: form.pangkat_golongan,
        no_hp: form.no_hp,
        tanggal_lahir: form.tanggal_lahir || null,
        pendidikan_terakhir: form.pendidikan_terakhir,
        alamat: form.alamat,
      })
      .eq('id', userId)

    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      setSavedAt(new Date())
    }
    setSaving(false)
  }

  const labelJabatan = LABEL_JABATAN[profil?.jabatan] || LABEL_JABATAN[profil?.role] || profil?.jabatan || 'Admin'

  // Superadmin (akses semua sekolah) ditandai dengan sekolah_id kosong.
  // Admin/kepala sekolah biasa selalu terikat ke satu sekolah spesifik.
  const isSuperadmin = !profil?.sekolah_id
  const namaSekolah = adminData?.nama_sekolah

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-5">
      {/* Kartu identitas — gaya & tata letak disamakan dengan kartu guru: gradasi navy +
          motif batik emas, foto di kiri, QR code berseberangan di kanan */}
      <div className="relative overflow-hidden rounded-xl p-6 flex items-center justify-between gap-5 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        {/* Corak batik abstrak emas — sama seperti kartu guru, supaya konsisten secara visual */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="batikEmasAdmin"
              x="0"
              y="0"
              width="72"
              height="72"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(8)"
            >
              <g fill="none" stroke="#d4af37" strokeWidth="1.1">
                <ellipse cx="36" cy="24" rx="9" ry="14" opacity="0.55" />
                <ellipse cx="36" cy="48" rx="9" ry="14" opacity="0.55" />
                <ellipse cx="24" cy="36" rx="14" ry="9" opacity="0.55" />
                <ellipse cx="48" cy="36" rx="14" ry="9" opacity="0.55" />
                <circle cx="36" cy="36" r="3" opacity="0.7" />
              </g>
              <path
                d="M0 72 L18 54 L36 72 L54 54 L72 72"
                fill="none"
                stroke="#d4af37"
                strokeWidth="0.8"
                opacity="0.35"
              />
              <path d="M0 0 L18 18 L0 36" fill="none" stroke="#d4af37" strokeWidth="0.8" opacity="0.3" />
              <circle cx="8" cy="8" r="1.3" fill="#d4af37" opacity="0.4" />
              <circle cx="64" cy="16" r="1.3" fill="#d4af37" opacity="0.4" />
              <circle cx="16" cy="64" r="1.3" fill="#d4af37" opacity="0.4" />
            </pattern>
            <linearGradient id="batikFadeAdmin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#000000" stopOpacity="0" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="100%" height="100%" fill="url(#batikEmasAdmin)" />
          <rect x="0" y="0" width="100%" height="100%" fill="url(#batikFadeAdmin)" />
        </svg>

        <div className="relative flex items-center gap-5 min-w-0">
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-white/10 ring-2 ring-white/20 overflow-hidden flex items-center justify-center">
              {fotoUrl() ? (
                <img src={fotoUrl()} alt="Foto profil" className="w-full h-full object-cover" />
              ) : (
                <ShieldCheck size={28} className="text-white/80" />
              )}
            </div>
            <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brass-400 flex items-center justify-center cursor-pointer shadow-md">
              {uploadingFoto ? (
                <Loader2 size={13} className="animate-spin text-ink-950" />
              ) : (
                <Camera size={13} className="text-ink-950" />
              )}
              <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} disabled={uploadingFoto} />
            </label>
          </div>
          <div className="min-w-0">
            <p className="font-display font-semibold text-lg text-white truncate">
              {form.nama_lengkap_pendaftar || 'Nama belum diisi'}
            </p>
            <p className="text-sm text-blue-200/70">{labelJabatan}</p>
            <p className="text-xs text-brass-300/90 mt-0.5 truncate">
              {isSuperadmin ? 'Akses Semua Sekolah' : namaSekolah || 'Memuat nama sekolah...'}
            </p>
          </div>
        </div>

        {/* QR code — berseberangan (sisi kanan) dengan foto profil di sisi kiri, sama seperti kartu guru */}
        <div className="relative shrink-0 w-[88px] h-[88px] p-2 rounded-lg bg-white shadow-md flex items-center justify-center">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code identitas admin/kepsek" width={72} height={72} />
          ) : (
            <Loader2 size={18} className="animate-spin text-ink-700/30" />
          )}
        </div>
      </div>

      <div className="card relative overflow-hidden p-6 space-y-4">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Nama Lengkap</label>
            <input
              className="input w-full"
              value={form.nama_lengkap_pendaftar}
              onChange={(e) => setForm({ ...form, nama_lengkap_pendaftar: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">NUPTK</label>
            <input
              className="input w-full"
              placeholder="mis. 1234567890123456"
              value={form.nuptk}
              onChange={(e) => setForm({ ...form, nuptk: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Pangkat / Golongan</label>
            <input
              className="input w-full"
              placeholder="mis. Penata Muda / III-a"
              value={form.pangkat_golongan}
              onChange={(e) => setForm({ ...form, pangkat_golongan: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Nomor HP</label>
            <input
              className="input w-full"
              value={form.no_hp}
              onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Email</label>
            <input
              className="input w-full"
              type="email"
              value={form.email_pendaftar}
              onChange={(e) => setForm({ ...form, email_pendaftar: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Tanggal Lahir</label>
            <input
              className="input w-full"
              type="date"
              value={form.tanggal_lahir || ''}
              onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Pendidikan Terakhir</label>
            <input
              className="input w-full"
              placeholder="mis. S1 Pendidikan Guru SD"
              value={form.pendidikan_terakhir}
              onChange={(e) => setForm({ ...form, pendidikan_terakhir: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Jabatan</label>
            <input className="input w-full" value={labelJabatan} disabled />
          </div>
          <div>
            <label className="text-xs text-ink-700/60 mb-1 block">Sekolah</label>
            <input
              className="input w-full"
              value={isSuperadmin ? 'Akses Semua Sekolah' : namaSekolah || 'Memuat...'}
              disabled
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs text-ink-700/60 mb-1 block">Alamat</label>
            <textarea
              className="input w-full"
              rows={2}
              value={form.alamat}
              onChange={(e) => setForm({ ...form, alamat: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium disabled:opacity-50"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
          {savedAt && <span className="text-xs text-sage-500">Tersimpan</span>}
        </div>
      </div>

      {/* Kode batang ID admin/kepsek — sama pola seperti barcode guru, tapi memakai userId
          karena tidak ada baris di tabel `guru` untuk akun ini */}
      <div className="flex flex-col items-center gap-2 py-4 border-t border-ink-900/[0.08]">
        <div className="p-3 rounded-lg bg-white ring-1 ring-ink-900/[0.08] shadow-sm">
          <Barcode
            value={String(userId)}
            width={1.6}
            height={56}
            fontSize={12}
            background="#ffffff"
            lineColor="#1e3a5f"
          />
        </div>
        <p className="text-xs text-ink-700/50">ID {labelJabatan}</p>
      </div>
    </form>
  )
}

// Modal untuk menghubungkan anak tambahan (ke-2, ke-3, dst) ke akun orang
// tua yang sudah login. Sengaja dibuat terpisah dari alur pendaftaran
// (Register.jsx) — di sini siswa difilter dari sekolah_id akun yang sudah
// login (profil.sekolah_id), bukan dari sekolah yang dipilih di form
// pendaftaran. Memanggil tambahAnak() dari AuthContext yang sudah ada;
// baris baru otomatis berstatus 'menunggu' dan akan muncul di tab
// "Anak Menunggu" pada halaman admin PersetujuanAkun.jsx.
function ModalTambahAnak({ sekolahId, anakSudahTerhubung, onClose, onBerhasil }) {
  const { tambahAnak } = useAuth()
  const [daftarSiswa, setDaftarSiswa] = useState([])
  const [loadingSiswa, setLoadingSiswa] = useState(true)
  const [siswaId, setSiswaId] = useState('')
  const [hubungan, setHubungan] = useState('')
  const [mengirim, setMengirim] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let aktif = true
    async function muat() {
      setLoadingSiswa(true)
      const { data } = await supabase
        .from('siswa_publik_registrasi')
        .select('id, nama_lengkap, nis, nisn')
        .eq('sekolah_id', sekolahId)
        .order('nama_lengkap')
      if (!aktif) return
      // Sembunyikan siswa yang sudah tertaut (status menunggu/aktif) ke
      // akun ini, supaya tidak dobel kirim permintaan untuk anak yang sama.
      const idSudahAda = (anakSudahTerhubung || []).map((a) => a.siswa?.id).filter(Boolean)
      setDaftarSiswa((data || []).filter((s) => !idSudahAda.includes(s.id)))
      setLoadingSiswa(false)
    }
    if (sekolahId) muat()
    return () => {
      aktif = false
    }
  }, [sekolahId, anakSudahTerhubung])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!siswaId) {
      setError('Silakan pilih anak dari daftar.')
      return
    }
    if (!hubungan) {
      setError('Silakan pilih hubungan dengan anak.')
      return
    }
    setMengirim(true)
    const { error: err } = await tambahAnak({ siswaId, hubungan })
    setMengirim(false)
    if (err) {
      setError(err.message || 'Gagal mengirim permintaan.')
      return
    }
    onBerhasil()
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full p-5">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold text-ink-950">Tambah Anak</h2>
          <button type="button" onClick={onClose} className="text-ink-700/40 hover:text-ink-700/70">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-ink-700/50 mb-4">
          Pilih anak lain yang juga merupakan tanggungan Anda. Permintaan ini akan menunggu
          persetujuan admin sekolah sebelum muncul di daftar "Anak Terhubung".
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label-field">Nama Anak</label>
            <select
              className="input-field"
              value={siswaId}
              onChange={(e) => setSiswaId(e.target.value)}
              disabled={loadingSiswa}
            >
              <option value="">
                {loadingSiswa
                  ? 'Memuat daftar siswa...'
                  : daftarSiswa.length === 0
                    ? 'Tidak ada siswa lain yang bisa dipilih'
                    : '-- Pilih Anak --'}
              </option>
              {daftarSiswa.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_lengkap}
                  {s.nis ? ` (NIS: ${s.nis})` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-ink-700/40 mt-1">
              Tidak menemukan nama anak Anda? Hubungi admin sekolah untuk memastikan data siswa
              sudah terdaftar.
            </p>
          </div>

          <div>
            <label className="label-field">Hubungan dengan Anak</label>
            <select className="input-field" value={hubungan} onChange={(e) => setHubungan(e.target.value)}>
              <option value="">-- Pilih Hubungan --</option>
              <option value="ayah">Ayah</option>
              <option value="ibu">Ibu</option>
              <option value="wali">Wali</option>
            </select>
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button type="submit" disabled={mengirim} className="btn-primary w-full justify-center" >
            {mengirim && <Loader2 size={16} className="animate-spin" />}
            {mengirim ? 'Mengirim...' : 'Kirim Permintaan'}
          </button>
        </form>
      </div>
    </div>
  )
}

// Kartu profil untuk akun ORANG TUA/WALI — jauh lebih sederhana dari kartu
// guru/admin (tidak ada NUPTK, pangkat/golongan, QR/barcode identitas
// pegawai — semua itu tidak relevan untuk orang tua). Field yang bisa
// diisi hanya identitas dasar (nama, email, no HP, alamat) + foto profil.
// Di bawah kartu, ditampilkan juga daftar anak yang tertaut ke akun ini
// beserta status persetujuannya, supaya orang tua langsung tahu kalau ada
// hubungan yang masih menunggu/ditolak tanpa harus buka halaman lain, plus
// tombol untuk menghubungkan anak tambahan (ke-2, ke-3, dst).
function ProfilOrangTuaCard({ profil, userId }) {
  const { getAnakSaya } = useAuth()

  const [form, setForm] = useState({
    nama_lengkap_pendaftar: profil?.nama_lengkap_pendaftar || '',
    email_pendaftar: profil?.email_pendaftar || '',
    no_hp: profil?.no_hp || '',
    alamat: profil?.alamat || '',
  })
  const [fotoPath, setFotoPath] = useState(profil?.foto_profil_path || '')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  const [anakList, setAnakList] = useState([])
  const [loadingAnak, setLoadingAnak] = useState(true)
  const [showTambahAnak, setShowTambahAnak] = useState(false)

  useEffect(() => {
    setForm({
      nama_lengkap_pendaftar: profil?.nama_lengkap_pendaftar || '',
      email_pendaftar: profil?.email_pendaftar || '',
      no_hp: profil?.no_hp || '',
      alamat: profil?.alamat || '',
    })
    setFotoPath(profil?.foto_profil_path || '')
  }, [profil])

  async function muatAnak() {
    setLoadingAnak(true)
    const { data } = await getAnakSaya()
    setAnakList(data || [])
    setLoadingAnak(false)
  }

  useEffect(() => {
    muatAnak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function fotoUrl() {
    if (!fotoPath) return null
    return supabase.storage.from('foto-profil').getPublicUrl(fotoPath).data.publicUrl
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    setUploadingFoto(true)

    const ext = file.name.split('.').pop()
    const path = `${userId}/foto.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('foto-profil')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingFoto(false)
      return
    }

    const { error: updateError } = await supabase
      .from('profil')
      .update({ foto_profil_path: path })
      .eq('id', userId)

    if (updateError) {
      alert('Gagal simpan foto: ' + updateError.message)
    } else {
      setFotoPath(path)
    }
    setUploadingFoto(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('profil')
      .update({
        nama_lengkap_pendaftar: form.nama_lengkap_pendaftar,
        email_pendaftar: form.email_pendaftar,
        no_hp: form.no_hp,
        alamat: form.alamat,
      })
      .eq('id', userId)

    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      setSavedAt(new Date())
    }
    setSaving(false)
  }

  const STATUS_BADGE = {
    aktif: { label: 'Disetujui', className: 'bg-sage-500/10 text-sage-600', icon: CheckCircle2 },
    menunggu: { label: 'Menunggu Persetujuan', className: 'bg-amber-500/10 text-amber-600', icon: Clock },
    ditolak: { label: 'Ditolak', className: 'bg-red-50 text-red-700', icon: XCircle },
  }

  return (
    <div className="max-w-2xl space-y-5">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="relative overflow-hidden rounded-xl p-6 flex items-center justify-between gap-5 bg-gradient-to-br from-blue-900 to-blue-950">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          <div className="relative flex items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-white/10 ring-2 ring-white/20 overflow-hidden flex items-center justify-center">
                {fotoUrl() ? (
                  <img src={fotoUrl()} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <UserCircle2 size={32} className="text-white/80" />
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brass-400 flex items-center justify-center cursor-pointer shadow-md">
                {uploadingFoto ? (
                  <Loader2 size={13} className="animate-spin text-ink-950" />
                ) : (
                  <Camera size={13} className="text-ink-950" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} disabled={uploadingFoto} />
              </label>
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-lg text-white truncate">
                {form.nama_lengkap_pendaftar || 'Nama belum diisi'}
              </p>
              <p className="text-xs text-white/60 mt-0.5">Orang Tua/Wali</p>
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label-field">Nama Lengkap</label>
              <input
                className="input-field"
                value={form.nama_lengkap_pendaftar}
                onChange={(e) => setForm((f) => ({ ...f, nama_lengkap_pendaftar: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input
                className="input-field"
                type="email"
                value={form.email_pendaftar}
                onChange={(e) => setForm((f) => ({ ...f, email_pendaftar: e.target.value }))}
              />
            </div>
            <div>
              <label className="label-field">No. HP</label>
              <input
                className="input-field"
                value={form.no_hp}
                onChange={(e) => setForm((f) => ({ ...f, no_hp: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label-field">Alamat</label>
              <textarea
                className="input-field min-h-[70px]"
                value={form.alamat}
                onChange={(e) => setForm((f) => ({ ...f, alamat: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button className="btn-primary" type="submit" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              <Save size={16} /> Simpan
            </button>
            {savedAt && <p className="text-xs text-sage-600">Tersimpan.</p>}
          </div>
        </div>
      </form>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-display font-semibold text-ink-950 flex items-center gap-2">
            <Users size={16} /> Anak Terhubung
          </h4>
          <button
            type="button"
            onClick={() => setShowTambahAnak(true)}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brass-400/10 text-brass-600 hover:bg-brass-400/20"
          >
            <UserPlus size={14} /> Tambah Anak
          </button>
        </div>
        {loadingAnak ? (
          <p className="text-sm text-ink-700/50 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Memuat...
          </p>
        ) : anakList.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada anak yang tertaut ke akun ini.</p>
        ) : (
          <div className="space-y-2">
            {anakList.map((a) => {
              const badge = STATUS_BADGE[a.status] || STATUS_BADGE.menunggu
              const Icon = badge.icon
              return (
                <div key={a.id} className="flex items-center justify-between gap-3 border border-ink-950/10 rounded-lg p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-ink-950 truncate">{a.siswa?.nama_lengkap}</p>
                    <p className="text-xs text-ink-700/50">
                      {a.siswa?.kelas?.nama_kelas || '-'} · {a.hubungan || '-'}
                    </p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1 ${badge.className}`}>
                    <Icon size={12} /> {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showTambahAnak && (
        <ModalTambahAnak
          sekolahId={profil?.sekolah_id}
          anakSudahTerhubung={anakList}
          onClose={() => setShowTambahAnak(false)}
          onBerhasil={() => {
            setShowTambahAnak(false)
            muatAnak()
          }}
        />
      )}
    </div>
  )
}

export default function ProfilSaya() {
  const { profil, session, isAdmin, isOrangTua } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  // Kelas & siswa yang diampu (sebagai wali kelas)
  const [kelasAsuh, setKelasAsuh] = useState([]) // [{ id, nama_kelas, siswa: [...] }]
  const [loadingSiswa, setLoadingSiswa] = useState(true)

  // QR code identitas guru (dibuat dari qrcode -> data URL PNG)
  const [qrDataUrl, setQrDataUrl] = useState('')

  // Data pendaftar (nama, email, foto, nama sekolah) untuk akun admin/kepala sekolah
  // tanpa guru_id. Diambil terpisah dari AuthContext supaya AuthContext.jsx tidak perlu diubah.
  const [adminData, setAdminData] = useState(null)
  const [loadingAdminData, setLoadingAdminData] = useState(true)

  useEffect(() => {
    async function load() {
      if (!profil?.guru_id) {
        setLoading(false)
        setLoadingSiswa(false)
        return
      }
      const { data: row } = await supabase
        .from('guru')
        .select('*')
        .eq('id', profil.guru_id)
        .maybeSingle()
      setData(row)
      setLoading(false)
    }
    load()
  }, [profil])

  useEffect(() => {
    async function loadAdminData() {
      const userId = session?.user?.id
      if (profil?.guru_id || !isAdmin || !userId) {
        setLoadingAdminData(false)
        return
      }
      setLoadingAdminData(true)

      const { data: row } = await supabase
        .from('profil')
        .select(
          'nama_lengkap_pendaftar, email_pendaftar, foto_profil_path, nuptk, pangkat_golongan, no_hp, tanggal_lahir, pendidikan_terakhir, alamat'
        )
        .eq('id', userId)
        .maybeSingle()

      // Nama sekolah diambil lewat query terpisah (bukan join/embed) supaya tidak
      // tergantung ada-tidaknya foreign key profil.sekolah_id -> sekolah.id di skema
      // Supabase. Superadmin (sekolah_id kosong) tidak perlu query ini sama sekali.
      // ASUMSI: tabel `sekolah` punya kolom `nama_sekolah` — sesuaikan kalau nama
      // kolomnya berbeda di skema kamu (mis. `nama`).
      let namaSekolah = null
      if (profil?.sekolah_id) {
        const { data: sekolahRow } = await supabase
          .from('sekolah')
          .select('nama_sekolah')
          .eq('id', profil.sekolah_id)
          .maybeSingle()
        namaSekolah = sekolahRow?.nama_sekolah || null
      }

      setAdminData({ ...row, nama_sekolah: namaSekolah })
      setLoadingAdminData(false)
    }
    loadAdminData()
  }, [profil, isAdmin, session])

  useEffect(() => {
    async function loadSiswaAsuh() {
      if (!profil?.guru_id) {
        setLoadingSiswa(false)
        return
      }
      setLoadingSiswa(true)

      const { data: kelasList } = await supabase
        .from('kelas')
        .select('id, nama_kelas, tingkat')
        .eq('wali_kelas_id', profil.guru_id)
        .order('nama_kelas')

      if (!kelasList || kelasList.length === 0) {
        setKelasAsuh([])
        setLoadingSiswa(false)
        return
      }

      const kelasIds = kelasList.map((k) => k.id)
      const { data: siswaList } = await supabase
        .from('siswa')
        .select('id, nama_lengkap, nis, foto_path, kelas_id, status')
        .in('kelas_id', kelasIds)
        .eq('status', 'aktif')
        .order('nama_lengkap')

      const gabung = kelasList.map((k) => ({
        ...k,
        siswa: (siswaList || []).filter((s) => s.kelas_id === k.id),
      }))
      setKelasAsuh(gabung)
      setLoadingSiswa(false)
    }
    loadSiswaAsuh()
  }, [profil])

  // Buat QR code setiap kali id guru berubah/tersedia
  useEffect(() => {
    if (!data?.id) {
      setQrDataUrl('')
      return
    }
    QRCode.toDataURL(String(data.id), {
      width: 144,
      margin: 1,
      color: { dark: '#1e3a5f', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''))
  }, [data?.id])

  function fotoUrl() {
    if (!data?.foto_profil_path) return null
    return supabase.storage.from('foto-profil').getPublicUrl(data.foto_profil_path).data.publicUrl
  }

  function fotoSiswaUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-siswa').getPublicUrl(path).data.publicUrl
  }

  async function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)

    const ext = file.name.split('.').pop()
    const path = `${profil.guru_id}/foto.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('foto-profil')
      .upload(path, file, { upsert: true })

    if (uploadError) {
      alert('Gagal upload foto: ' + uploadError.message)
      setUploadingFoto(false)
      return
    }

    const { error: updateError } = await supabase
      .from('guru')
      .update({ foto_profil_path: path })
      .eq('id', profil.guru_id)

    if (updateError) {
      alert('Gagal simpan foto: ' + updateError.message)
    } else {
      setData({ ...data, foto_profil_path: path })
    }
    setUploadingFoto(false)
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase
      .from('guru')
      .update({
        nama_lengkap: data.nama_lengkap,
        mata_pelajaran: data.mata_pelajaran,
        no_hp: data.no_hp,
        email: data.email,
        alamat: data.alamat,
        tanggal_lahir: data.tanggal_lahir || null,
        pendidikan_terakhir: data.pendidikan_terakhir,
        nuptk: data.nuptk,
        pangkat_golongan: data.pangkat_golongan,
      })
      .eq('id', profil.guru_id)

    if (error) {
      alert('Gagal menyimpan: ' + error.message)
    } else {
      setSavedAt(new Date())
    }
    setSaving(false)
  }

  const sedangMemuat = loading || (!profil?.guru_id && isAdmin && loadingAdminData)

  if (sedangMemuat) {
    return (
      <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
        <p className="text-sm text-ink-700/50">Memuat...</p>
      </Layout>
    )
  }

  // Akun tanpa guru_id: kalau role-nya termasuk kelompok admin (admin, admin_utama,
  // superadmin, kepala_sekolah — persis sama dengan definisi `isAdmin` di AuthContext),
  // ini memang wajar, dia bukan baris di tabel `guru`. Tampilkan kartu profil admin,
  // bukan pesan yang menyuruh menautkan ke data guru (yang tidak relevan untuk mereka).
  if (!profil?.guru_id) {
    if (isAdmin) {
      return (
        <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
          <ProfilAdminCard profil={profil} userId={session?.user?.id} adminData={adminData} />
        </Layout>
      )
    }
    // Orang tua/wali juga tidak punya guru_id — ini WAJAR (mereka bukan
    // baris di tabel `guru`), jadi tampilkan kartu profil orang tua yang
    // sesuai, bukan pesan "hubungi admin" yang tadinya cuma ditujukan
    // untuk akun guru yang belum ditautkan.
    if (isOrangTua) {
      return (
        <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
          <ProfilOrangTuaCard profil={profil} userId={session?.user?.id} />
        </Layout>
      )
    }
    return (
      <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
        <div className="card p-6">
          <p className="text-sm text-ink-700/60">
            Akun Anda belum terhubung ke data guru. Hubungi admin untuk menautkan akun ini ke salah satu data guru.
          </p>
        </div>
      </Layout>
    )
  }

  if (!data) {
    return (
      <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
        <div className="card p-6">
          <p className="text-sm text-ink-700/60">
            Data guru untuk akun ini tidak ditemukan. Hubungi admin untuk memeriksa tautan akun.
          </p>
        </div>
      </Layout>
    )
  }

  const totalSiswaAsuh = kelasAsuh.reduce((sum, k) => sum + k.siswa.length, 0)

  return (
    <Layout title="Profil Saya" subtitle="Data diri dan foto profil Anda">
      <form onSubmit={handleSave} className="max-w-2xl space-y-5">
        {/* Kartu identitas — background biru tua (navy), kontras elegan dengan aksen emas */}
        <div className="relative overflow-hidden rounded-xl p-6 flex items-center justify-between gap-5 bg-gradient-to-br from-blue-900 to-blue-950">
          {/* Dekorasi lingkaran samar di background, senada dengan aksen bulat di identitas guru */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

          {/* Corak batik abstrak emas — motif kawung/parang disederhanakan, ditumpuk tipis di atas gradasi navy */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <pattern
                id="batikEmas"
                x="0"
                y="0"
                width="72"
                height="72"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(8)"
              >
                {/* motif kawung: empat lengkung elips mengelilingi titik pusat */}
                <g fill="none" stroke="#d4af37" strokeWidth="1.1">
                  <ellipse cx="36" cy="24" rx="9" ry="14" opacity="0.55" />
                  <ellipse cx="36" cy="48" rx="9" ry="14" opacity="0.55" />
                  <ellipse cx="24" cy="36" rx="14" ry="9" opacity="0.55" />
                  <ellipse cx="48" cy="36" rx="14" ry="9" opacity="0.55" />
                  <circle cx="36" cy="36" r="3" opacity="0.7" />
                </g>
                {/* garis parang halus di sela-sela motif kawung */}
                <path
                  d="M0 72 L18 54 L36 72 L54 54 L72 72"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.8"
                  opacity="0.35"
                />
                <path
                  d="M0 0 L18 18 L0 36"
                  fill="none"
                  stroke="#d4af37"
                  strokeWidth="0.8"
                  opacity="0.3"
                />
                <circle cx="8" cy="8" r="1.3" fill="#d4af37" opacity="0.4" />
                <circle cx="64" cy="16" r="1.3" fill="#d4af37" opacity="0.4" />
                <circle cx="16" cy="64" r="1.3" fill="#d4af37" opacity="0.4" />
              </pattern>
              <linearGradient id="batikFade" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#000000" stopOpacity="0" />
                <stop offset="100%" stopColor="#000000" stopOpacity="0.15" />
              </linearGradient>
            </defs>
            <rect x="0" y="0" width="100%" height="100%" fill="url(#batikEmas)" />
            <rect x="0" y="0" width="100%" height="100%" fill="url(#batikFade)" />
          </svg>

          <div className="relative flex items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-white/10 ring-2 ring-white/20 overflow-hidden flex items-center justify-center">
                {fotoUrl() ? (
                  <img src={fotoUrl()} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-display font-semibold text-white/70">
                    {data.nama_lengkap?.[0] || '?'}
                  </span>
                )}
              </div>
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-brass-400 flex items-center justify-center cursor-pointer shadow-md">
                {uploadingFoto ? (
                  <Loader2 size={13} className="animate-spin text-ink-950" />
                ) : (
                  <Camera size={13} className="text-ink-950" />
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleFotoChange} disabled={uploadingFoto} />
              </label>
            </div>
            <div className="min-w-0">
              <p className="font-display font-semibold text-lg text-white truncate">{data.nama_lengkap}</p>
              <p className="text-sm text-blue-200/70">{data.nip ? `NIP ${data.nip}` : 'NIP belum diisi'}</p>
            </div>
          </div>

          {/* QR code — berseberangan (sisi kanan) dengan foto profil di sisi kiri */}
          <div className="relative shrink-0 w-[88px] h-[88px] p-2 rounded-lg bg-white shadow-md flex items-center justify-center">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="QR Code identitas guru" width={72} height={72} />
            ) : (
              <Loader2 size={18} className="animate-spin text-ink-700/30" />
            )}
          </div>
        </div>

        <div className="card relative overflow-hidden p-6 space-y-4">
          <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Nama Lengkap</label>
              <input
                className="input w-full"
                value={data.nama_lengkap || ''}
                onChange={(e) => setData({ ...data, nama_lengkap: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Mata Pelajaran yang Diampu</label>
              <input
                className="input w-full"
                value={data.mata_pelajaran || ''}
                onChange={(e) => setData({ ...data, mata_pelajaran: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">NUPTK</label>
              <input
                className="input w-full"
                placeholder="mis. 1234567890123456"
                value={data.nuptk || ''}
                onChange={(e) => setData({ ...data, nuptk: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Pangkat / Golongan</label>
              <input
                className="input w-full"
                placeholder="mis. Penata Muda / III-a"
                value={data.pangkat_golongan || ''}
                onChange={(e) => setData({ ...data, pangkat_golongan: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Nomor HP</label>
              <input
                className="input w-full"
                value={data.no_hp || ''}
                onChange={(e) => setData({ ...data, no_hp: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Email</label>
              <input
                className="input w-full"
                type="email"
                value={data.email || ''}
                onChange={(e) => setData({ ...data, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Tanggal Lahir</label>
              <input
                className="input w-full"
                type="date"
                value={data.tanggal_lahir || ''}
                onChange={(e) => setData({ ...data, tanggal_lahir: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-ink-700/60 mb-1 block">Pendidikan Terakhir</label>
              <input
                className="input w-full"
                placeholder="mis. S1 Pendidikan Guru SD"
                value={data.pendidikan_terakhir || ''}
                onChange={(e) => setData({ ...data, pendidikan_terakhir: e.target.value })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs text-ink-700/60 mb-1 block">Alamat</label>
              <textarea
                className="input w-full"
                rows={2}
                value={data.alamat || ''}
                onChange={(e) => setData({ ...data, alamat: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            {savedAt && <span className="text-xs text-sage-500">Tersimpan</span>}
          </div>
        </div>
      </form>

      {/* Siswa yang diampu — hanya muncul kalau guru ini tercatat sebagai wali kelas di satu atau lebih kelas */}
      {!loadingSiswa && kelasAsuh.length > 0 && (
        <div className="max-w-2xl mt-5 space-y-4">
          <div className="relative overflow-hidden rounded-xl p-6 flex items-center gap-4 bg-gradient-to-br from-red-900 to-red-950">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
            <div className="relative w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0 text-white">
              <Users size={20} />
            </div>
            <div className="relative">
              <p className="font-display font-semibold text-lg text-white">
                {totalSiswaAsuh} siswa diampu
              </p>
              <p className="text-sm text-red-200/70 mt-0.5">
                Sebagai wali kelas di {kelasAsuh.length} kelas: {kelasAsuh.map((k) => k.nama_kelas).join(', ')}
              </p>
            </div>
          </div>

          {kelasAsuh.map((k) => (
            <div key={k.id} className="card relative overflow-hidden">
              <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-900 to-brass-400" />
              <div className="flex items-center gap-2 p-4 border-b border-ink-900/[0.06]">
                <School size={16} className="text-ink-700/50" />
                <p className="text-sm font-medium text-ink-950">
                  {k.nama_kelas} <span className="text-ink-700/40 font-normal">({k.siswa.length} siswa)</span>
                </p>
              </div>
              {k.siswa.length === 0 ? (
                <p className="text-sm text-ink-700/50 p-4">Belum ada siswa aktif di kelas ini.</p>
              ) : (
                <ul className="divide-y divide-ink-900/[0.06]">
                  {k.siswa.map((s) => (
                    <li key={s.id} className="p-3 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-ink-900/[0.06] overflow-hidden flex items-center justify-center shrink-0">
                        {fotoSiswaUrl(s.foto_path) ? (
                          <img src={fotoSiswaUrl(s.foto_path)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-ink-700/40">{s.nama_lengkap?.[0]}</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-950 truncate">{s.nama_lengkap}</p>
                        <p className="text-xs text-ink-700/50">NIS: {s.nis || '—'}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Kode batang ID guru — jadi pemisah visual antara bagian profil dan grafik aktivitas */}
      <div className="max-w-2xl mt-5 flex flex-col items-center gap-2 py-4 border-t border-ink-900/[0.08]">
        <div className="p-3 rounded-lg bg-white ring-1 ring-ink-900/[0.08] shadow-sm">
          <Barcode
            value={String(data.id)}
            width={1.6}
            height={56}
            fontSize={12}
            background="#ffffff"
            lineColor="#1e3a5f"
          />
        </div>
        <p className="text-xs text-ink-700/50">ID Absensi Guru</p>
      </div>

      <div className="max-w-2xl mt-5">
        <GrafikAktivitas guruId={profil.guru_id} />
      </div>
    </Layout>
  )
}
