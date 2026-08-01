import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Loader2, LogIn } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    // Memicu animasi masuk sesaat setelah komponen ter-render
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) {
      setError('Email atau kata sandi salah. Silakan coba lagi.')
      setShake((s) => s + 1) // ganti key supaya animasi shake bisa diulang
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 px-4 relative overflow-hidden">
      {/* Ambient background — dua cahaya lembut yang melayang pelan, tidak mengganggu */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full bg-brass-400/10 blur-3xl animate-[float-a_9s_ease-in-out_infinite]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 -right-16 w-80 h-80 rounded-full bg-brass-400/[0.08] blur-3xl animate-[float-b_11s_ease-in-out_infinite]"
      />

      <div className="w-full max-w-sm relative">
        <div
          className={`text-center mb-8 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="relative w-12 h-12 mx-auto mb-4">
            {/* Cincin cahaya lembut di belakang logo, berdenyut pelan */}
            <div className="absolute inset-0 rounded-xl bg-brass-400/40 blur-md animate-[glow-pulse_2.8s_ease-in-out_infinite]" />
            <div className="relative w-12 h-12 rounded-xl bg-brass-400 flex items-center justify-center font-display font-bold text-ink-950 text-xl">
              S
            </div>
          </div>
          <h1 className="font-display text-2xl font-semibold text-paper">SIMAK</h1>
          <p className="text-sm text-paper/50 mt-1">Sistem Informasi Manajemen Sekolah</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`card p-6 space-y-4 transition-all duration-700 ease-out delay-150 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div
            className={`transition-all duration-500 ease-out delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <label className="eyebrow mb-1.5 block">Email</label>
            <input
              type="email"
              required
              className="input-field transition-shadow duration-200 focus:shadow-[0_0_0_3px_rgba(217,183,105,0.25)]"
              placeholder="kepsek@sekolah.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div
            className={`transition-all duration-500 ease-out delay-[400ms] ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <label className="eyebrow mb-1.5 block">Kata Sandi</label>
            <input
              type="password"
              required
              className="input-field transition-shadow duration-200 focus:shadow-[0_0_0_3px_rgba(217,183,105,0.25)]"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              key={shake}
              className="text-sm text-red-600 animate-[shake_0.4s_ease-in-out]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full transition-transform duration-150 active:scale-[0.98] hover:scale-[1.01]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Masuk
          </button>
        </form>

        <p
          className={`text-center text-xs text-paper/40 mt-5 transition-all duration-700 ease-out delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Akun admin dibuat lewat Supabase Dashboard &mdash; lihat panduan setup.
        </p>
      </div>

      {/* Keyframes animasi kustom — tidak memerlukan perubahan tailwind.config */}
      <style>{`
        @keyframes float-a {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(18px, 14px); }
        }
        @keyframes float-b {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(-16px, -12px); }
        }
        @keyframes glow-pulse {
          0%, 100% { opacity: 0.35; }
          50% { opacity: 0.7; }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
