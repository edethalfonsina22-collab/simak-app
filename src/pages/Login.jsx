import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Loader2, LogIn } from 'lucide-react'

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shake, setShake] = useState(0)
  const [namaSekolah, setNamaSekolah] = useState('')

  useEffect(() => {
    // Memicu animasi masuk sesaat setelah komponen ter-render
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    supabase
      .from('profil_sekolah')
      .select('nama_sekolah')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.nama_sekolah) setNamaSekolah(data.nama_sekolah)
      })
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
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 relative overflow-hidden login-ledger">
      <div className="w-full max-w-sm relative">
        {/* Pelangi tipis melayang di atas logo */}
        <svg
          aria-hidden
          viewBox="0 0 340 170"
          className="pointer-events-none absolute left-1/2 -top-24 w-[280px] -translate-x-1/2 animate-[rainbow-breathe_5s_ease-in-out_infinite]"
        >
          <path d="M20 170 A150 150 0 0 1 320 170" stroke="#E8A33D" strokeWidth="7" strokeLinecap="round" opacity="0.85" fill="none" />
          <path d="M38 170 A132 132 0 0 1 302 170" stroke="#EA7C4C" strokeWidth="7" strokeLinecap="round" opacity="0.85" fill="none" />
          <path d="M56 170 A114 114 0 0 1 284 170" stroke="#D9556B" strokeWidth="7" strokeLinecap="round" opacity="0.85" fill="none" />
          <path d="M74 170 A96 96 0 0 1 266 170" stroke="#157A9E" strokeWidth="7" strokeLinecap="round" opacity="0.85" fill="none" />
          <path d="M92 170 A78 78 0 0 1 248 170" stroke="#0B4F6C" strokeWidth="7" strokeLinecap="round" opacity="0.85" fill="none" />
        </svg>

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
          <h1 className="font-display text-2xl font-semibold text-ink-950">SIMAK</h1>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-700/45 mt-2">
            School Management Information System
          </p>
          {namaSekolah && (
            <p className="text-sm font-medium text-ink-950 mt-1.5">{namaSekolah}</p>
          )}
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
          className={`text-center text-xs font-display italic text-ink-700/45 mt-5 tracking-wide transition-all duration-700 ease-out delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          This application was crafted by{' '}
          <span className="not-italic font-semibold text-ink-700/65">LD_SALIM</span>
        </p>
      </div>

      {/* Ombak tenang di dasar layar, dengan perahu berlayar pelan */}
      <div aria-hidden className="pointer-events-none fixed bottom-0 left-0 w-full h-[120px] overflow-hidden z-0">
        <div className="absolute bottom-[52px] w-[70px] h-[64px] animate-[sail_22s_linear_infinite,bob_2.6s_ease-in-out_infinite]">
          <svg viewBox="0 0 70 64" className="w-full h-full overflow-visible">
            <path d="M12 46 Q35 58 58 46 L52 54 Q35 60 18 54 Z" fill="#0B4F6C" />
            <line x1="35" y1="46" x2="35" y2="16" stroke="#5C3A21" strokeWidth="2" strokeLinecap="round" />
            <path d="M35 18 L35 44 Q22 40 18 26 Q24 20 35 18 Z" fill="#F6D186" stroke="#E8A33D" strokeWidth="1" />
            <path d="M35 18 L35 44 Q48 40 52 26 Q46 20 35 18 Z" fill="#F1C40F" stroke="#E8A33D" strokeWidth="1" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-[220%] h-full opacity-45 animate-[wave-scroll_16s_linear_infinite]">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0 110 Q150 80 300 110 T600 110 T900 110 T1200 110 T1500 110 T1800 110 V200 H0 Z" fill="#157A9E" />
          </svg>
        </div>
        <div className="absolute bottom-0 left-0 w-[220%] h-full animate-[wave-scroll_10s_linear_infinite]">
          <svg viewBox="0 0 1200 200" preserveAspectRatio="none" className="w-full h-full block">
            <path d="M0 120 Q150 145 300 120 T600 120 T900 120 T1200 120 T1500 120 T1800 120 V200 H0 Z" fill="#0B4F6C" />
          </svg>
        </div>
      </div>

      {/* Keyframes animasi kustom — tidak memerlukan perubahan tailwind.config */}
      <style>{`
        .login-ledger {
          background-image: repeating-linear-gradient(
            to bottom,
            transparent,
            transparent 37px,
            rgba(11,79,108,0.08) 38px
          );
        }
        @keyframes rainbow-breathe {
          0%, 100% { opacity: 0.55; transform: translateX(-50%) translateY(0); }
          50% { opacity: 0.9; transform: translateX(-50%) translateY(-4px); }
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
        @keyframes sail {
          0% { left: -8%; }
          100% { left: 106%; }
        }
        @keyframes bob {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-7px) rotate(2deg); }
        }
        @keyframes wave-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
