import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Loader2, LogIn } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) setError('Email atau kata sandi salah. Silakan coba lagi.')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-brass-400 flex items-center justify-center font-display font-bold text-ink-950 text-xl mx-auto mb-4">
            S
          </div>
          <h1 className="font-display text-2xl font-semibold text-paper">SIMAK</h1>
          <p className="text-sm text-paper/50 mt-1">Sistem Informasi Manajemen Sekolah</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div>
            <label className="eyebrow mb-1.5 block">Email</label>
            <input
              type="email"
              required
              className="input-field"
              placeholder="kepsek@sekolah.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="eyebrow mb-1.5 block">Kata Sandi</label>
            <input
              type="password"
              required
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Masuk
          </button>
        </form>

        <p className="text-center text-xs text-paper/40 mt-5">
          Akun admin dibuat lewat Supabase Dashboard &mdash; lihat panduan setup.
        </p>
      </div>
    </div>
  )
}
