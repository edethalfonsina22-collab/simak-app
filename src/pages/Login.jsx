import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Loader2, LogIn, UserPlus } from 'lucide-react'

// Latar belakang animasi "hujan kode" ala Matrix
function MatrixRainBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')

    let animationId
    let columns = []
    const fontSize = 16
    let colCount = 0

    const chars =
      'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/*+-=[]{}#%'

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      colCount = Math.floor(canvas.width / fontSize)
      columns = new Array(colCount)
        .fill(0)
        .map(() => Math.random() * -100)
    }

    function draw() {
      // Jejak transparan agar karakter lama memudar perlahan
      ctx.fillStyle = 'rgba(3, 10, 8, 0.10)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < colCount; i += 1) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        const x = i * fontSize
        const y = columns[i] * fontSize

        // Karakter paling depan lebih terang
        ctx.fillStyle =
          Math.random() > 0.975
            ? '#c8fff2'
            : 'rgba(94, 234, 212, 0.55)'

        ctx.fillText(char, x, y)

        if (y > canvas.height && Math.random() > 0.975) {
          columns[i] = 0
        }

        columns[i] += 0.6
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="matrix-rain-canvas"
      aria-hidden="true"
    />
  )
}

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
    // Memicu animasi masuk setelah komponen dirender
    const timeout = requestAnimationFrame(() => {
      setMounted(true)
    })

    return () => cancelAnimationFrame(timeout)
  }, [])

  useEffect(() => {
    supabase
      .from('profil_sekolah')
      .select('nama_sekolah')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data?.nama_sekolah) {
          setNamaSekolah(data.nama_sekolah)
        }
      })
  }, [])

  if (session) {
    return <Navigate to="/" replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await signIn(email, password)

    setLoading(false)

    if (signInError) {
      setError('Email atau kata sandi salah. Silakan coba lagi.')
      setShake((current) => current + 1)
    }
  }

  return (
    <div className="login-shell relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <MatrixRainBackground />

      <div className="login-overlay" aria-hidden="true" />

      <div className="relative z-10 w-full max-w-sm">
        <div
          className={`mb-8 text-center transition-all duration-700 ease-out ${
            mounted
              ? 'translate-y-0 opacity-100'
              : 'translate-y-3 opacity-0'
          }`}
        >
          <div className="relative mx-auto mb-4 h-12 w-12">
            <div className="login-badge-glow absolute inset-0 rounded-xl" />

            <div className="login-badge relative flex h-12 w-12 items-center justify-center rounded-xl text-xl font-bold">
              S
            </div>
          </div>

          <h1 className="login-title text-2xl font-semibold">SIMAK</h1>

          <p className="login-tagline mt-2 text-[11px] font-medium uppercase tracking-[0.2em]">
            School Management Information System
          </p>

          {namaSekolah && (
            <p className="login-school mt-1.5 text-sm font-medium">
              {namaSekolah}
            </p>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className={`login-card space-y-4 p-6 transition-all delay-150 duration-700 ease-out ${
            mounted
              ? 'translate-y-0 opacity-100'
              : 'translate-y-4 opacity-0'
          }`}
        >
          <div
            className={`transition-all delay-300 duration-500 ease-out ${
              mounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-2 opacity-0'
            }`}
          >
            <label className="login-eyebrow mb-1.5 block">
              Email
            </label>

            <input
              type="email"
              required
              className="login-field w-full transition-shadow duration-200"
              placeholder="kepsek@sekolah.sch.id"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div
            className={`transition-all delay-[400ms] duration-500 ease-out ${
              mounted
                ? 'translate-y-0 opacity-100'
                : 'translate-y-2 opacity-0'
            }`}
          >
            <label className="login-eyebrow mb-1.5 block">
              Kata Sandi
            </label>

            <input
              type="password"
              required
              className="login-field w-full transition-shadow duration-200"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error && (
            <p
              key={shake}
              className="login-error animate-[shake_0.4s_ease-in-out] text-sm"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="login-btn w-full transition-transform duration-150 hover:scale-[1.01] active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}

            {loading ? 'Memproses...' : 'Masuk'}
          </button>

          <div className="login-divider">
            <span>atau</span>
          </div>

          <p className="login-register text-center text-sm">
            Belum punya akun?{' '}
            <Link
              to="/register"
              className="login-register-link inline-flex items-center gap-1 font-semibold"
            >
              <UserPlus size={14} />
              Daftar
            </Link>
          </p>
        </form>

        <p
          className={`login-credit mt-5 text-center text-xs italic tracking-wide transition-all delay-500 duration-700 ease-out ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          This application was crafted by{' '}
          <span className="not-italic font-semibold">LD_SALIM</span>
        </p>
      </div>

      <style>{`
        .login-shell {
          --bg-1: #050b09;
          --bg-2: #0b201c;
          --accent: #5eead4;
          --accent-strong: #9dfff0;
          --ring-soft: rgba(94, 234, 212, 0.12);
          --text-primary: #eafffa;
          --text-accent: #5eead4;
          --code-text: rgba(140, 214, 198, 0.55);

          background: linear-gradient(
            160deg,
            var(--bg-1),
            var(--bg-2) 60%,
            var(--bg-1)
          );
        }

        .matrix-rain-canvas {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: radial-gradient(
            circle at 50% 35%,
            rgba(3, 10, 8, 0.35),
            rgba(3, 10, 8, 0.75) 75%
          );
          pointer-events: none;
        }

        .login-badge-glow {
          background: var(--accent);
          filter: blur(10px);
          opacity: 0.4;
          animation: glow-pulse 2.8s ease-in-out infinite;
        }

        .login-badge {
          color: #06201c;
          background: linear-gradient(
            160deg,
            var(--accent-strong),
            var(--accent)
          );
          box-shadow: 0 0 18px rgba(94, 234, 212, 0.45);
        }

        .login-title {
          color: var(--text-primary);
          text-shadow: 0 0 14px rgba(94, 234, 212, 0.35);
        }

        .login-tagline {
          color: var(--code-text);
        }

        .login-school {
          color: var(--text-accent);
        }

        .login-card {
          position: relative;
          border: 1px solid var(--ring-soft);
          border-radius: 16px;
          background: linear-gradient(
            160deg,
            rgba(11, 32, 28, 0.88),
            rgba(5, 11, 9, 0.92)
          );
          box-shadow:
            0 0 40px rgba(94, 234, 212, 0.08),
            0 20px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(6px);
        }

        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          padding: 1px;
          border-radius: 16px;
          background: linear-gradient(
            120deg,
            rgba(94, 234, 212, 0.35),
            transparent 35%,
            transparent 65%,
            rgba(255, 255, 255, 0.15)
          );
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }

        .login-eyebrow {
          color: var(--code-text);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .login-field {
          border: 1px solid var(--ring-soft);
          border-radius: 10px;
          padding: 10px 12px;
          color: var(--text-primary);
          background: rgba(94, 234, 212, 0.06);
          outline: none;
        }

        .login-field::placeholder {
          color: rgba(234, 255, 250, 0.35);
        }

        .login-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(94, 234, 212, 0.18);
        }

        .login-error {
          color: #ff9d9d;
        }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
          border-radius: 10px;
          padding: 11px 16px;
          color: #06201c;
          font-weight: 600;
          background: linear-gradient(
            135deg,
            var(--accent-strong),
            var(--accent)
          );
          box-shadow: 0 0 20px rgba(94, 234, 212, 0.35);
          cursor: pointer;
        }

        .login-btn:disabled {
          opacity: 0.7;
          cursor: default;
        }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--code-text);
          font-size: 11px;
          text-transform: uppercase;
        }

        .login-divider::before,
        .login-divider::after {
          content: '';
          height: 1px;
          flex: 1;
          background: var(--ring-soft);
        }

        .login-register {
          color: var(--code-text);
        }

        .login-register-link {
          color: var(--text-accent);
          transition: color 0.2s ease;
        }

        .login-register-link:hover {
          color: var(--accent-strong);
        }

        .login-credit {
          color: var(--code-text);
        }

        .login-credit span {
          color: var(--text-accent);
          text-shadow: 0 0 8px rgba(94, 234, 212, 0.4);
        }

        @keyframes glow-pulse {
          0%,
          100% {
            opacity: 0.3;
          }

          50% {
            opacity: 0.6;
          }
        }

        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }

          20% {
            transform: translateX(-4px);
          }

          40% {
            transform: translateX(4px);
          }

          60% {
            transform: translateX(-3px);
          }

          80% {
            transform: translateX(3px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .matrix-rain-canvas {
            display: none;
          }

          * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  )
}
