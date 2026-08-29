import { useState, useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Loader2, LogIn } from 'lucide-react'

// Latar belakang animasi "hujan kode" ala Matrix — digambar langsung via canvas,
// jadi tidak perlu file gambar/video terpisah dan hurufnya benar-benar bergerak.
function MatrixRainBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let columns = []
    let fontSize = 16
    let colCount = 0

    const chars = 'アイウエオカキクケコサシスセソタチツテト0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ<>/*+-=[]{}#%'

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      colCount = Math.floor(canvas.width / fontSize)
      columns = new Array(colCount).fill(0).map(() => Math.random() * -100)
    }

    function draw() {
      // Jejak transparan agar karakter lama memudar perlahan (efek trail)
      ctx.fillStyle = 'rgba(3, 10, 8, 0.10)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      ctx.font = `${fontSize}px monospace`

      for (let i = 0; i < colCount; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)]
        const x = i * fontSize
        const y = columns[i] * fontSize

        // Karakter paling depan lebih terang, sisanya redup — nuansa hijau khas
        ctx.fillStyle = Math.random() > 0.975 ? '#c8fff2' : 'rgba(94, 234, 212, 0.55)'
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

  return <canvas ref={canvasRef} className="matrix-rain-canvas" aria-hidden />
}

export default function Login() {
  const { session, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [shake, setShake] = useState(0)
  const namaSekolah = 'Dari pulau menuju dunia, pendidikan membuka cakrawala'

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
    <div className="login-shell min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <MatrixRainBackground />
      <div className="login-overlay" aria-hidden />

      <div className="w-full max-w-sm relative z-10">
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
            <p className="login-school text-xs font-medium mt-1.5 px-2 leading-snug">{namaSekolah}</p>
          )}
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
      </div>

      {/* Style khusus halaman login */}
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
          --code-text: rgba(140, 214, 198, 0.55);
          background: linear-gradient(160deg, var(--bg-1), var(--bg-2) 60%, var(--bg-1));
        }

        .matrix-rain-canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
        }

        .login-overlay {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: radial-gradient(circle at 50% 35%, rgba(3, 10, 8, 0.35), rgba(3, 10, 8, 0.75) 75%);
          pointer-events: none;
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
          background: linear-gradient(160deg, rgba(11, 32, 28, 0.88), rgba(5, 11, 9, 0.92));
          border: 1px solid var(--ring-soft);
          box-shadow: 0 0 40px rgba(94, 234, 212, 0.08), 0 20px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(6px);
        }
        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(120deg, rgba(94, 234, 212, 0.35), transparent 35%, transparent 65%, rgba(255, 255, 255, 0.15));
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
          background: rgba(94, 234, 212, 0.06);
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
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-4px); }
          40% { transform: translateX(4px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(3px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .matrix-rain-canvas { display: none; }
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
