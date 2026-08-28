import { useState } from 'react'
import { ArrowLeft, Loader2, UserPlus } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

export default function Register() {
  const { session, signUp, signOut } = useAuth()

  const [nama, setNama] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [konfirmasiPassword, setKonfirmasiPassword] =
    useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (session && !success) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()

    if (loading) return

    setError('')
    setSuccess(false)

    const namaBersih = nama.trim()
    const emailBersih = email.trim().toLowerCase()

    if (!namaBersih) {
      setError('Nama lengkap wajib diisi.')
      return
    }

    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }

    if (password !== konfirmasiPassword) {
      setError('Konfirmasi kata sandi tidak cocok.')
      return
    }

    setLoading(true)

    try {
      const { data, error: signUpError } = await signUp(
        emailBersih,
        password,
        {
          data: {
            nama_lengkap: namaBersih,
          },
        }
      )

      if (signUpError) {
        setError(
          signUpError.message || 'Pendaftaran gagal.'
        )
        return
      }

      // Jika konfirmasi email nonaktif, Supabase langsung membuat session.
      // Session harus ditutup karena akun tetap menunggu approval Admin.
      if (data?.session) {
        await signOut()
      }

      setSuccess(true)
    } catch (submitError) {
      setError(
        submitError?.message || 'Terjadi kesalahan saat mendaftar.'
      )
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <section className="w-full max-w-md rounded-2xl border border-emerald-400/20 bg-slate-900 p-8 text-center text-white shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
            <UserPlus size={28} />
          </div>

          <h1 className="text-2xl font-bold">
            Pendaftaran berhasil 🎉
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-300">
            Permohonan akun kamu sudah dikirim. Silakan tunggu
            persetujuan Admin sebelum login.
          </p>

          <Link
            to="/login"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300"
          >
            Kembali ke Login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl">
        <Link
          to="/login"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Kembali ke Login
        </Link>

        <div className="mb-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-400 text-slate-950">
            <UserPlus size={22} />
          </div>

          <h1 className="text-2xl font-bold">Daftar Akun</h1>

          <p className="mt-1 text-sm text-slate-400">
            Daftarkan akun Guru untuk menggunakan SIMAK.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">
              Nama Lengkap
            </span>

            <input
              type="text"
              required
              autoComplete="name"
              value={nama}
              onChange={(event) => setNama(event.target.value)}
              placeholder="Nama lengkap"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">
              Email
            </span>

            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@sekolah.sch.id"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">
              Kata Sandi
            </span>

            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 6 karakter"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm text-slate-300">
              Konfirmasi Kata Sandi
            </span>

            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={konfirmasiPassword}
              onChange={(event) =>
                setKonfirmasiPassword(event.target.value)
              }
              placeholder="Ulangi kata sandi"
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 outline-none transition focus:border-emerald-400"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && (
              <Loader2
                size={17}
                className="animate-spin"
              />
            )}

            {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-400">
          Sudah punya akun?{' '}
          <Link
            to="/login"
            className="font-semibold text-emerald-300 hover:text-emerald-200"
          >
            Masuk
          </Link>
        </p>
      </section>
    </main>
  )
}
