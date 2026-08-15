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
  const [namaSekolah, setNamaSekolah] = useState('SD Negeri Waria')

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
    <div className="login-shell min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="login-grid" aria-hidden />
      <div className="login-code" aria-hidden />

      {/* Bendera merah-putih (bunting) di bagian atas — nuansa HUT RI */}
      <div className="merdeka-bunting" aria-hidden>
        {Array.from({ length: 14 }).map((_, i) => (
          <span key={i} className={`merdeka-flag ${i % 2 === 0 ? 'is-red' : 'is-white'}`} />
        ))}
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Pita ucapan Dirgahayu RI ke-81 */}
        <div
          className={`merdeka-ribbon mb-5 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
          }`}
        >
          <span className="merdeka-ribbon-star">★</span>
          <span>Dirgahayu Republik Indonesia ke-81</span>
          <span className="merdeka-ribbon-star">★</span>
        </div>

        <div
          className={`text-center mb-8 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="relative w-12 h-12 mx-auto mb-4">
            {/* Cincin cahaya teal di belakang logo, berdenyut pelan — senada dengan loader */}
            <div className="login-badge-glow absolute inset-0 rounded-xl" />
            <div className="login-badge relative w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl">
              S
            </div>
          </div>
          <h1 className="login-title text-2xl font-semibold">SIMAK</h1>
          <p className="login-tagline text-[11px] font-medium uppercase tracking-[0.2em] mt-2">
            School Management Information System
          </p>
          {namaSekolah && (
            <p className="login-school text-sm font-medium mt-1.5">{namaSekolah}</p>
          )}
          <p className="merdeka-subtag text-[11px] font-medium mt-2 tracking-[0.15em] uppercase">
            17 Agustus 1945 &ndash; 17 Agustus 2026
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className={`login-card p-6 space-y-4 transition-all duration-700 ease-out delay-150 ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <div
            className={`transition-all duration-500 ease-out delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <label className="login-eyebrow mb-1.5 block">Email</label>
            <input
              type="email"
              required
              className="login-field w-full transition-shadow duration-200"
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
            <label className="login-eyebrow mb-1.5 block">Kata Sandi</label>
            <input
              type="password"
              required
              className="login-field w-full transition-shadow duration-200"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <p
              key={shake}
              className="login-error text-sm animate-[shake_0.4s_ease-in-out]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-btn w-full transition-transform duration-150 active:scale-[0.98] hover:scale-[1.01]"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
            Masuk
          </button>
        </form>

        <p
          className={`login-credit text-center text-xs italic mt-5 tracking-wide transition-all duration-700 ease-out delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          This application was crafted by{' '}
          <span className="not-italic font-semibold">LD_SALIM</span>
        </p>

        <p className="merdeka-footer text-center text-[11px] mt-3 tracking-wide">
          🇮🇩 Merdeka! Selamat Hari Kemerdekaan RI ke-81
        </p>
      </div>

      {/* Style khusus halaman login — palet & efek disamakan dengan Loader.css */}
      <style>{`
        .login-shell {
          --bg-1: #050b09;
          --bg-2: #0b201c;
          --accent: #5eead4;
          --accent-strong: #9dfff0;
          --ring: rgba(94, 234, 212, 0.28);
          --ring-soft: rgba(94, 234, 212, 0.12);
          --text-primary: #eafffa;
          --text-accent: #5eead4;
          --code-text: rgba(140, 214, 198, 0.32);
          --merah: #ff4d4d;
          --merah-strong: #e11d2e;
          --putih: #ffffff;
          background:
            radial-gradient(circle at 30% 25%, rgba(94, 234, 212, 0.10), transparent 55%),
            linear-gradient(160deg, var(--bg-1), var(--bg-2) 60%, var(--bg-1));
        }

        .login-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(var(--ring-soft) 1px, transparent 1px),
            linear-gradient(90deg, var(--ring-soft) 1px, transparent 1px);
          background-size: 36px 36px;
          opacity: 0.35;
          mask-image: radial-gradient(circle at 50% 35%, black 0%, transparent 70%);
        }

        .login-code {
          position: absolute;
          top: 0;
          right: 0;
          width: 22%;
          height: 100%;
          pointer-events: none;
          background-image: repeating-linear-gradient(
            var(--code-text) 0px,
            var(--code-text) 1px,
            transparent 1px,
            transparent 16px
          );
          opacity: 0.35;
          -webkit-mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
          mask-image: linear-gradient(to bottom, transparent, black 15%, black 85%, transparent);
        }

        /* --- Nuansa HUT Kemerdekaan RI ke-81 --- */
        .merdeka-bunting {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: space-between;
          padding: 0 4%;
          pointer-events: none;
          z-index: 5;
        }
        .merdeka-flag {
          width: 0;
          height: 0;
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 16px solid var(--merah-strong);
          opacity: 0.85;
          animation: bunting-sway 3.4s ease-in-out infinite;
          transform-origin: top center;
        }
        .merdeka-flag.is-white { border-top-color: var(--putih); opacity: 0.75; }
        .merdeka-flag:nth-child(odd) { animation-delay: 0.2s; }
        .merdeka-flag:nth-child(3n) { animation-delay: 0.6s; }

        .merdeka-ribbon {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
          color: #fff3f3;
          background: linear-gradient(90deg, var(--merah-strong), var(--merah), var(--merah-strong));
          border-radius: 999px;
          padding: 6px 14px;
          box-shadow: 0 0 18px rgba(225, 29, 46, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.15) inset;
        }
        .merdeka-ribbon-star { color: #ffe9a8; }

        .merdeka-subtag {
          color: var(--merah);
          opacity: 0.85;
        }

        .merdeka-footer {
          color: var(--code-text);
        }

        .login-badge-glow {
          background: var(--accent);
          filter: blur(10px);
          opacity: 0.4;
          animation: glow-pulse 2.8s ease-in-out infinite;
        }
        .login-badge {
          background: linear-gradient(160deg, var(--accent-strong), var(--accent));
          color: #06201c;
          box-shadow: 0 0 18px rgba(94, 234, 212, 0.45);
        }

        .login-title {
          color: var(--text-primary);
          text-shadow: 0 0 14px rgba(94, 234, 212, 0.35);
        }
        .login-tagline { color: var(--code-text); }
        .login-school { color: var(--text-accent); }

        .login-card {
          position: relative;
          border-radius: 16px;
          background: linear-gradient(160deg, rgba(11, 32, 28, 0.85), rgba(5, 11, 9, 0.9));
          border: 1px solid var(--ring-soft);
          box-shadow: 0 0 40px rgba(94, 234, 212, 0.06), 0 20px 40px rgba(0, 0, 0, 0.35);
        }
        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(120deg, rgba(225, 29, 46, 0.35), transparent 35%, transparent 65%, rgba(255, 255, 255, 0.2));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .login-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--code-text);
        }

        .login-field {
          background: rgba(94, 234, 212, 0.05);
          border: 1px solid var(--ring-soft);
          border-radius: 10px;
          padding: 10px 12px;
          color: var(--text-primary);
          outline: none;
        }
        .login-field::placeholder { color: rgba(234, 255, 250, 0.35); }
        .login-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.18);
        }

        .login-error { color: #ff9d9d; }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 600;
          color: #06201c;
          background: linear-gradient(135deg, var(--accent-strong), var(--accent));
          box-shadow: 0 0 20px rgba(94, 234, 212, 0.35);
          border: none;
          cursor: pointer;
        }
        .login-btn:disabled { opacity: 0.7; cursor: default; }

        .login-credit { color: var(--code-text); }
        .login-credit span {
          color: var(--text-accent);
          text-shadow: 0 0 8px rgba(94, 234, 212, 0.4);
        }

        @keyframes glow-pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes bunting-sway {
          0%, 100% { transform: rotate(-6deg); }
          50% { transform: rotate(6deg); }
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
