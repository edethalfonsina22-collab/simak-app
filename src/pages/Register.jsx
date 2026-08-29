import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react'

export default function Register() {
  const { session } = useAuth()
  const [daftarSekolah, setDaftarSekolah] = useState([])
  const [form, setForm] = useState({
    nama: '',
    email: '',
    password: '',
    konfirmasi: '',
    jabatan: 'guru',
    sekolahId: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [sukses, setSukses] = useState(false)

  useEffect(() => {
    supabase
      .from('sekolah')
      .select('id, nama_sekolah')
      .order('nama_sekolah')
      .then(({ data }) => setDaftarSekolah(data || []))
  }, [])

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
            Akun Anda sudah dibuat dan sedang menunggu persetujuan admin sekolah. Anda akan bisa login
            setelah disetujui.
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
    if (!form.sekolahId) {
      setError('Pilih sekolah terlebih dahulu.')
      return
    }

    setLoading(true)

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
    })

    if (signUpError) {
      setLoading(false)
      setError(signUpError.message || 'Gagal mendaftar. Coba lagi.')
      return
    }

    const userId = signUpData?.user?.id
    if (!userId) {
      setLoading(false)
      setError('Gagal membuat akun. Coba lagi.')
      return
    }

    const { error: profilError } = await supabase.from('profil').insert({
      id: userId,
      role: form.jabatan === 'guru' ? 'guru' : 'admin',
      jabatan: form.jabatan,
      sekolah_id: form.sekolahId,
      nama_lengkap_pendaftar: form.nama,
      email_pendaftar: form.email,
      status_akun: 'menunggu',
    })

    // Penting: karena "Confirm email" nonaktif, signUp otomatis membuat sesi login.
    // User belum disetujui, jadi paksa logout supaya tidak bisa masuk aplikasi dulu.
    await supabase.auth.signOut()

    setLoading(false)

    if (profilError) {
      setError('Akun terbuat tapi data profil gagal disimpan: ' + profilError.message)
      return
    }

    setSukses(true)
  }

  const inputClass =
    'w-full bg-slate-900/60 border border-blue-500/25 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20'
  const labelClass = 'text-xs font-medium text-blue-200/70 mb-1 block tracking-wide'

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <Background />

      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-slate-900/70 backdrop-blur-xl p-7 rounded-2xl border border-blue-400/30 shadow-[0_0_40px_-10px_rgba(59,130,246,0.35)] space-y-4"
      >
        <div className="text-center mb-2">
          <div className="mx-auto mb-3 w-14 h-14 rounded-full border border-blue-400/40 flex items-center justify-center bg-blue-400/10 shadow-[0_0_20px_-4px_rgba(96,165,250,0.6)]">
            <UserPlus className="text-blue-300" size={24} />
          </div>
          <h1 className="text-xl font-bold text-white tracking-widest uppercase">Daftar Akun</h1>
          <p className="text-xs text-blue-200/60 mt-1">Akun akan aktif setelah disetujui admin sekolah.</p>
        </div>

        <div>
          <label className={labelClass}>Nama Lengkap</label>
          <input required className={inputClass}
            value={form.nama} onChange={(e) => ubah('nama', e.target.value)} />
        </div>

        <div>
          <label className={labelClass}>Jabatan</label>
          <select className={inputClass}
            value={form.jabatan} onChange={(e) => ubah('jabatan', e.target.value)}>
            <option value="guru" className="bg-slate-900">Guru</option>
            <option value="admin" className="bg-slate-900">Admin</option>
            <option value="kepala_sekolah" className="bg-slate-900">Kepala Sekolah</option>
          </select>
        </div>

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
    </div>
  )
}
