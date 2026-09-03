import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { Loader2, UserPlus, CheckCircle2, ListChecks, Info } from 'lucide-react'

export default function Register() {
  const { session, daftar } = useAuth()
  const [mode, setMode] = useState('gabung') // 'gabung' | 'baru'
  const [daftarSekolah, setDaftarSekolah] = useState([])
  const [form, setForm] = useState({
    nama: '',
    email: '',
    password: '',
    konfirmasi: '',
    jabatan: 'guru',
    sekolahId: '',
    namaSekolahBaru: '',
    siswaId: '',
    hubungan: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sukses, setSukses] = useState(false)

  // Daftar siswa untuk sekolah yang dipilih — hanya dimuat kalau jabatan
  // yang dipilih adalah "orang_tua", karena mereka wajib memilih anak.
  const [daftarSiswa, setDaftarSiswa] = useState([])
  const [loadingSiswa, setLoadingSiswa] = useState(false)

  const isOrangTua = form.jabatan === 'orang_tua'

  useEffect(() => {
    supabase
      .from('sekolah')
      .select('id, nama_sekolah')
      .order('nama_sekolah')
      .then(({ data }) => setDaftarSekolah(data || []))
  }, [])

  // Muat daftar siswa dari sekolah yang dipilih, khusus untuk pendaftar
  // orang tua/wali — supaya mereka bisa memilih anak dari daftar, bukan
  // mengetik manual (mengurangi risiko salah hubung ke siswa lain).
  useEffect(() => {
    if (!isOrangTua || !form.sekolahId) {
      setDaftarSiswa([])
      return
    }

    let aktif = true
    setLoadingSiswa(true)

    supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, nisn')
      .eq('sekolah_id', form.sekolahId)
      .order('nama_lengkap')
      .then(({ data }) => {
        if (!aktif) return
        setDaftarSiswa(data || [])
        setLoadingSiswa(false)
      })

    return () => {
      aktif = false
    }
  }, [isOrangTua, form.sekolahId])

  if (session) return <Navigate to="/" replace />

  // Background dipakai di kedua state (sukses maupun form)
  const Background = () => (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,#1e3a8a_0%,transparent_45%),radial-gradient(circle_at_85%_80%,#1d4ed8_0%,transparent_50%),linear-gradient(160deg,#05061a_0%,#0a0f2e_45%,#0d1440_100%)]" />
      <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="46" height="46" patternUnits="userSpaceOnUse">
            <path d="M 46 0 L 0 0 0 46" fill="none" stroke="#3b82f6" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl" />
      <div className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl" />
    </div>
  )

  if (sukses) {
    return (
      <div className="relative min-h-screen flex items-center justify-center px-4">
        <Background />
        <div className="relative max-w-sm w-full text-center bg-slate-900/70 backdrop-blur-xl p-7 rounded-2xl border border-blue-400/30 shadow-[0_0_40px_-10px_rgba(59,130,246,0.35)]">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full border border-emerald-400/40 flex items-center justify-center bg-emerald-400/10">
            <CheckCircle2 className="text-emerald-400" size={28} />
          </div>
          <h1 className="text-lg font-semibold text-white tracking-wide">Pendaftaran Berhasil</h1>
          <p className="text-sm text-blue-200/70 mt-2">
            {mode === 'baru'
              ? 'Sekolah dan akun Anda sudah dibuat, sedang menunggu persetujuan Superadmin. Anda akan bisa login setelah disetujui.'
              : isOrangTua
                ? 'Akun Anda sudah dibuat dan permintaan menghubungkan Anda dengan anak sedang menunggu persetujuan admin sekolah. Anda akan bisa login setelah disetujui.'
                : 'Akun Anda sudah dibuat dan sedang menunggu persetujuan admin sekolah. Anda akan bisa login setelah disetujui.'}
          </p>
          <Link to="/login" className="inline-block mt-4 text-sm font-medium text-blue-400 hover:text-blue-300">
            Kembali ke halaman Masuk
          </Link>
        </div>
      </div>
    )
  }

  function ubah(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // Jabatan "orang_tua" hanya boleh bergabung ke sekolah yang sudah ada
  // (tidak bisa sekaligus mendaftarkan sekolah baru), jadi mode dikunci
  // ke 'gabung' begitu jabatan ini dipilih. siswaId & hubungan direset
  // setiap kali jabatan berganti supaya tidak salah bawa data lama.
  function ubahJabatan(value) {
    setForm((f) => ({ ...f, jabatan: value, siswaId: '', hubungan: '' }))
    if (value === 'orang_tua') {
      setMode('gabung')
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password !== form.konfirmasi) {
      setError('Konfirmasi kata sandi tidak sama.')
      return
    }
    if (form.password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }
    if (mode === 'gabung' && !form.sekolahId) {
      setError('Pilih sekolah terlebih dahulu.')
      return
    }
    if (mode === 'baru' && !form.namaSekolahBaru.trim()) {
      setError('Isi nama sekolah yang akan didaftarkan.')
      return
    }
    if (isOrangTua && !form.siswaId) {
      setError('Pilih anak Anda dari daftar siswa.')
      return
    }
    if (isOrangTua && !form.hubungan) {
      setError('Pilih hubungan Anda dengan anak.')
      return
    }

    setLoading(true)

    const { error: daftarError } = await daftar({
      mode,
      namaLengkap: form.nama,
      jabatan: form.jabatan,
      email: form.email,
      password: form.password,
      sekolahId: form.sekolahId,
      namaSekolah: form.namaSekolahBaru.trim(),
      siswaId: form.siswaId || undefined,
      hubungan: form.hubungan || undefined,
    })

    setLoading(false)

    if (daftarError) {
      setError(daftarError.message || 'Gagal mendaftar. Coba lagi.')
      return
    }

    setSukses(true)
  }

  const inputClass =
    'w-full bg-slate-900/60 border border-blue-500/25 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'
  const labelClass = 'text-xs font-medium text-blue-200/70 mb-1 block tracking-wide'

  // Kotak petunjuk kecil di kiri/kanan form — reusable, gaya senada dengan
  // kartu form utama tapi lebih ringkas (dipakai untuk InfoBox langkah &
  // catatan di bawah).
  const InfoBox = ({ icon: Icon, title, items, side }) => (
    <div
      className={`w-full lg:w-56 shrink-0 bg-slate-900/70 backdrop-blur-xl p-5 rounded-2xl border border-blue-400/20 shadow-[0_0_30px_-12px_rgba(59,130,246,0.3)] ${
        side === 'left' ? 'order-2 lg:order-1' : 'order-3'
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full border border-blue-400/30 flex items-center justify-center bg-blue-400/10 shrink-0">
          <Icon className="text-blue-300" size={14} />
        </div>
        <h2 className="text-xs font-semibold text-white tracking-wide uppercase">{title}</h2>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="text-[11px] leading-relaxed text-blue-200/70 flex gap-2">
            <span className="text-blue-400 shrink-0">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 py-10">
      <Background />

      <div className="relative w-full max-w-4xl flex flex-col lg:flex-row items-stretch justify-center gap-4">
        <InfoBox
          side="left"
          icon={ListChecks}
          title="Langkah Pendaftaran"
          items={[
            'Isi nama lengkap sesuai identitas resmi.',
            'Pilih jabatan Anda: Guru, Admin, Kepala Sekolah, atau Orang Tua/Wali Murid.',
            'Guru/Admin/Kepala Sekolah: pilih sekolah yang sudah terdaftar, atau daftarkan sekolah baru.',
            'Orang Tua/Wali: pilih sekolah anak Anda, lalu pilih nama anak dari daftar siswa sekolah tersebut.',
            'Gunakan email aktif — dipakai untuk login.',
            'Buat kata sandi minimal 6 karakter.',
          ]}
        />

        <form
          onSubmit={handleSubmit}
          className="relative order-1 lg:order-2 w-full lg:w-[380px] shrink-0 bg-slate-900/70 backdrop-blur-xl p-7 rounded-2xl border border-blue-400/30 shadow-[0_0_40px_-10px_rgba(59,130,246,0.35)] space-y-4"
        >
        <div className="text-center mb-2">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full border border-blue-400/40 flex items-center justify-center bg-blue-400/10 shadow-[0_0_20px_-4px_rgba(96,165,250,0.6)]">
            <UserPlus className="text-blue-300" size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase">Daftar Akun</h1>
          <p className="text-xs text-blue-200/60 mt-1">Akun akan aktif setelah disetujui admin.</p>
        </div>

        <div>
          <label className={labelClass}>Jabatan</label>
          <select className={inputClass}
            value={form.jabatan} onChange={(e) => ubahJabatan(e.target.value)}>
            <option value="guru" className="bg-slate-900">Guru</option>
            <option value="admin" className="bg-slate-900">Admin</option>
            <option value="kepala_sekolah" className="bg-slate-900">Kepala Sekolah</option>
            <option value="orang_tua" className="bg-slate-900">Orang Tua / Wali Murid</option>
          </select>
          {mode === 'baru' && !isOrangTua && (
            <p className="text-[11px] text-blue-200/50 mt-1">
              Karena mendaftarkan sekolah baru, akun Anda otomatis jadi Admin Utama sekolah ini.
            </p>
          )}
          {isOrangTua && (
            <p className="text-[11px] text-blue-200/50 mt-1">
              Akun Orang Tua/Wali hanya dapat bergabung ke sekolah yang sudah terdaftar, lalu dihubungkan ke data anak Anda.
            </p>
          )}
        </div>

        <div>
          <label className={labelClass}>Nama Lengkap</label>
          <input required className={inputClass}
            value={form.nama} onChange={(e) => ubah('nama', e.target.value)} />
        </div>

        {/* Toggle mode: Gabung sekolah yang sudah ada / Daftar sekolah baru.
            Disembunyikan untuk Orang Tua/Wali — mereka wajib gabung ke
            sekolah yang sudah ada (tidak bisa mendaftarkan sekolah baru). */}
        {!isOrangTua && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/60 border border-blue-500/25 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setMode('gabung')}
              className={`py-2 rounded-md transition ${
                mode === 'gabung' ? 'bg-blue-500/80 text-white' : 'text-blue-200/60 hover:text-blue-200'
              }`}
            >
              Gabung Sekolah
            </button>
            <button
              type="button"
              onClick={() => setMode('baru')}
              className={`py-2 rounded-md transition ${
                mode === 'baru' ? 'bg-blue-500/80 text-white' : 'text-blue-200/60 hover:text-blue-200'
              }`}
            >
              Daftar Sekolah Baru
            </button>
          </div>
        )}

        {mode === 'gabung' || isOrangTua ? (
          <div>
            <label className={labelClass}>Sekolah</label>
            <select required className={inputClass}
              value={form.sekolahId} onChange={(e) => ubah('sekolahId', e.target.value)}>
              <option value="" className="bg-slate-900">-- Pilih Sekolah --</option>
              {daftarSekolah.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">{s.nama_sekolah}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className={labelClass}>Nama Sekolah Baru</label>
            <input required className={inputClass}
              placeholder="Contoh: SD Negeri Contoh"
              value={form.namaSekolahBaru} onChange={(e) => ubah('namaSekolahBaru', e.target.value)} />
          </div>
        )}

        {/* Khusus Orang Tua/Wali: pilih anak dari daftar siswa sekolah yang
            baru saja dipilih, lalu pilih hubungan dengan anak tersebut. */}
        {isOrangTua && (
          <>
            <div>
              <label className={labelClass}>Nama Anak</label>
              <select
                required
                className={inputClass}
                value={form.siswaId}
                onChange={(e) => ubah('siswaId', e.target.value)}
                disabled={!form.sekolahId || loadingSiswa}
              >
                <option value="" className="bg-slate-900">
                  {!form.sekolahId
                    ? '-- Pilih sekolah terlebih dahulu --'
                    : loadingSiswa
                      ? 'Memuat daftar siswa...'
                      : daftarSiswa.length === 0
                        ? 'Tidak ada siswa di sekolah ini'
                        : '-- Pilih Anak --'}
                </option>
                {daftarSiswa.map((s) => (
                  <option key={s.id} value={s.id} className="bg-slate-900">
                    {s.nama_lengkap}
                    {s.nis ? ` (NIS: ${s.nis})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-blue-200/50 mt-1">
                Tidak menemukan nama anak Anda? Hubungi admin sekolah untuk memastikan data siswa sudah terdaftar.
              </p>
            </div>

            <div>
              <label className={labelClass}>Hubungan dengan Anak</label>
              <select
                required
                className={inputClass}
                value={form.hubungan}
                onChange={(e) => ubah('hubungan', e.target.value)}
              >
                <option value="" className="bg-slate-900">-- Pilih Hubungan --</option>
                <option value="ayah" className="bg-slate-900">Ayah</option>
                <option value="ibu" className="bg-slate-900">Ibu</option>
                <option value="wali" className="bg-slate-900">Wali</option>
              </select>
            </div>
          </>
        )}

        <div>
          <label className={labelClass}>Email</label>
          <input type="email" required className={inputClass}
            value={form.email} onChange={(e) => ubah('email', e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Kata Sandi</label>
          <input type="password" required className={inputClass}
            value={form.password} onChange={(e) => ubah('password', e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Konfirmasi Kata Sandi</label>
          <input type="password" required className={inputClass}
            value={form.konfirmasi} onChange={(e) => ubah('konfirmasi', e.target.value)} />
        </div>

        {error && (
          <p className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-400 text-white font-medium py-2.5 rounded-lg shadow-[0_0_25px_-6px_rgba(59,130,246,0.7)] hover:brightness-110 transition disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Daftar'}
        </button>

        <p className="text-center text-xs text-blue-200/60">
          Sudah punya akun? <Link to="/login" className="text-blue-400 font-medium hover:text-blue-300">Masuk</Link>
        </p>
      </form>

        <InfoBox
          side="right"
          icon={Info}
          title="Perlu Diketahui"
          items={[
            'Akun baru berstatus "menunggu" sampai disetujui admin sekolah.',
            'Mode "Daftar Sekolah Baru" menjadikan Anda Admin Utama otomatis.',
            'Akun Orang Tua/Wali akan dihubungkan ke data anak yang dipilih, menunggu persetujuan admin.',
            'Anda baru bisa login setelah akun disetujui.',
            'Ada kendala? Hubungi admin sekolah Anda secara langsung.',
          ]}
        />
      </div>
    </div>
  )
}
