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
  if (sukses) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center bg-white p-6 rounded-2xl border border-slate-200">
          <CheckCircle2 className="mx-auto text-green-500 mb-3" size={40} />
          <h1 className="text-lg font-semibold text-slate-800">Pendaftaran Berhasil</h1>
          <p className="text-sm text-slate-500 mt-2">
            Akun Anda sudah dibuat dan sedang menunggu persetujuan admin sekolah. Anda akan bisa login
            setelah disetujui.
          </p>
          <Link to="/login" className="inline-block mt-4 text-sm font-medium text-blue-600">
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

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-slate-50">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
        <div className="text-center mb-2">
          <UserPlus className="mx-auto text-blue-600 mb-2" size={28} />
          <h1 className="text-lg font-semibold text-slate-800">Daftar Akun</h1>
          <p className="text-xs text-slate-500 mt-1">Akun akan aktif setelah disetujui admin sekolah.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Nama Lengkap</label>
          <input required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.nama} onChange={(e) => ubah('nama', e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Jabatan</label>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.jabatan} onChange={(e) => ubah('jabatan', e.target.value)}>
            <option value="guru">Guru</option>
            <option value="admin">Admin</option>
            <option value="kepala_sekolah">Kepala Sekolah</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Sekolah</label>
          <select required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.sekolahId} onChange={(e) => ubah('sekolahId', e.target.value)}>
            <option value="">-- Pilih Sekolah --</option>
            {daftarSekolah.map((s) => (
              <option key={s.id} value={s.id}>{s.nama_sekolah}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Email</label>
          <input type="email" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.email} onChange={(e) => ubah('email', e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Kata Sandi</label>
          <input type="password" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.password} onChange={(e) => ubah('password', e.target.value)} />
        </div>

        <div>
          <label className="text-xs font-medium text-slate-600 mb-1 block">Konfirmasi Kata Sandi</label>
          <input type="password" required className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm"
            value={form.konfirmasi} onChange={(e) => ubah('konfirmasi', e.target.value)} />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-medium py-2.5 rounded-lg disabled:opacity-60">
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Daftar'}
        </button>

        <p className="text-center text-xs text-slate-500">
          Sudah punya akun? <Link to="/login" className="text-blue-600 font-medium">Masuk</Link>
        </p>
      </form>
    </div>
  )
}
