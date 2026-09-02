import { useState, useEffect, useRef } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { Loader2, LogIn } from 'lucide-react'

// Latar belakang "kain merah putih" yang bergelombang seperti kain sungguhan
// tertiup angin. Dibangun dari 2 lapis path SVG per warna (fase & amplitudo
// berbeda) supaya terlihat seperti lipatan kain, bukan garis kaku tunggal.
function WavyClothBackground() {
  const svgRef = useRef(null)
  const redTopRef = useRef(null)
  const redTop2Ref = useRef(null)
  const whiteBottomRef = useRef(null)
  const whiteBottom2Ref = useRef(null)

  useEffect(() => {
    // Sistem koordinat internal SVG dibuat tetap (0-1000) dan diregangkan
    // penuh ke ukuran layar lewat preserveAspectRatio="none", jadi gelombang
    // otomatis menyesuaikan di layar mana pun tanpa perlu resize listener.
    const W = 1000
    const H = 1000
    let animationId
    let t = 0

    function wavePathTop(baseY, amp, waves, phase) {
      const N = 48
      const pts = []
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W
        const y = baseY + amp * Math.sin((i / N) * Math.PI * 2 * waves + phase)
        pts.push(`${x},${y}`)
      }
      return `M0,0 L0,${pts[0].split(',')[1]} L${pts.join(' L')} L${W},0 Z`
    }

    function wavePathBottom(baseY, amp, waves, phase) {
      const N = 48
      const pts = []
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * W
        const y = baseY + amp * Math.sin((i / N) * Math.PI * 2 * waves + phase)
        pts.push(`${x},${y}`)
      }
      return `M0,${H} L0,${pts[0].split(',')[1]} L${pts.join(' L')} L${W},${H} Z`
    }

    function frame() {
      t += 0.014
      if (redTopRef.current) {
        redTopRef.current.setAttribute('d', wavePathTop(260, 32, 2.5, t))
      }
      if (redTop2Ref.current) {
        redTop2Ref.current.setAttribute('d', wavePathTop(266, 24, 2.5, t * 1.3 + 1.5))
      }
      if (whiteBottomRef.current) {
        whiteBottomRef.current.setAttribute('d', wavePathBottom(760, 32, 2.5, -t * 1.1))
      }
      if (whiteBottom2Ref.current) {
        whiteBottom2Ref.current.setAttribute('d', wavePathBottom(754, 24, 2.5, -t * 1.4 + 2))
      }
      animationId = requestAnimationFrame(frame)
    }

    animationId = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1000 1000"
      preserveAspectRatio="none"
      className="wavy-cloth-svg"
      aria-hidden
    >
      <path ref={redTopRef} fill="#c81e1e" />
      <path ref={redTop2Ref} fill="#e23b3b" opacity="0.55" />
      <path ref={whiteBottomRef} fill="#f5f5f0" />
      <path ref={whiteBottom2Ref} fill="#ffffff" opacity="0.6" />
    </svg>
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
      <WavyClothBackground />
      <div className="login-overlay" aria-hidden />

      {/* Semboyan Ki Hajar Dewantara, huruf hias, diam di lipatan kain merah */}
      <div className="cloth-text cloth-text-top" aria-hidden>
        <p>Ing Ngarsa Sung Tuladha — di depan memberi teladan.</p>
        <p>Ing Madya Mangun Karsa — di tengah membangun semangat dan ide.</p>
        <p>Tut Wuri Handayani — di belakang memberi dorongan dan arahan.</p>
      </div>

      {/* Makna filosofis, huruf hias, diam di lipatan kain putih */}
      <div className="cloth-text cloth-text-bottom" aria-hidden>
        <p>Guru tidak selalu harus di depan.</p>
        <p>Guru memberi ruang bagi murid untuk tumbuh mandiri dan percaya diri.</p>
      </div>

      <div className="w-full max-w-sm relative z-10">
        <div
          className={`text-center mb-8 transition-all duration-700 ease-out ${
            mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
          }`}
        >
          <div className="relative w-12 h-12 mx-auto mb-4">
            <div className="login-badge-glow absolute inset-0 rounded-xl" />
            <div className="login-badge relative w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl">
              S
            </div>
          </div>
          <h1 className="login-title text-2xl font-semibold">SIMAK</h1>
          <p className="login-tagline text-[11px] font-medium uppercase tracking-[0.2em] mt-2">
            School Management Information System
          </p>
          <p className="login-school text-sm font-medium mt-1.5">WELCOME</p>
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
          className={`login-register text-center text-sm mt-5 transition-all duration-700 ease-out delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Belum punya akun?{' '}
          <Link to="/register" className="login-register-link font-medium">
            Daftar
          </Link>
        </p>

        <p
          className={`login-credit text-center text-xs italic mt-3 tracking-wide transition-all duration-700 ease-out delay-500 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          This application was crafted by{' '}
          <span className="not-italic font-semibold">LD_SALIM</span>
        </p>
      </div>

      {/* Style khusus halaman login */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&display=swap');

        .login-shell {
          --bg-1: #05061a;
          --bg-2: #0d1440;
          --accent: #60a5fa;
          --accent-strong: #bfdbfe;
          --ring: rgba(59, 130, 246, 0.28);
          --ring-soft: rgba(59, 130, 246, 0.12);
          --text-primary: #eaf2ff;
          --text-accent: #60a5fa;
          --code-text: rgba(147, 197, 253, 0.55);
          background: #05061a;
        }

        .wavy-cloth-svg {
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
          background: radial-gradient(circle at 50% 35%, rgba(5, 6, 26, 0.35), rgba(5, 6, 26, 0.78) 75%);
          pointer-events: none;
        }

        /* Huruf hias untuk tulisan di atas kain */
        .cloth-text {
          position: absolute;
          left: 24px;
          right: 24px;
          z-index: 1;
          text-align: center;
          font-family: 'Cinzel Decorative', serif;
          pointer-events: none;
        }
        .cloth-text p {
          margin: 0 0 6px;
          font-size: 13px;
          line-height: 1.5;
          letter-spacing: 0.01em;
        }
        .cloth-text p:last-child { margin-bottom: 0; }

        .cloth-text-top {
          top: 8%;
        }
        .cloth-text-top p {
          color: #fdecec;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
        }

        .cloth-text-bottom {
          bottom: 8%;
        }
        .cloth-text-bottom p {
          color: #7a1414;
        }

        @media (max-width: 480px) {
          .cloth-text p { font-size: 11px; }
        }

        .login-badge-glow {
          background: var(--accent);
          filter: blur(10px);
          opacity: 0.4;
          animation: glow-pulse 2.8s ease-in-out infinite;
        }
        .login-badge {
          background: linear-gradient(160deg, var(--accent-strong), var(--accent));
          color: #071233;
          box-shadow: 0 0 18px rgba(59, 130, 246, 0.45);
        }

        .login-title {
          color: var(--text-primary);
          text-shadow: 0 0 14px rgba(59, 130, 246, 0.35);
        }
        .login-tagline { color: var(--code-text); }
        .login-school { color: var(--text-accent); }

        .login-card {
          position: relative;
          border-radius: 16px;
          background: linear-gradient(160deg, rgba(13, 20, 64, 0.9), rgba(5, 6, 26, 0.94));
          border: 1px solid var(--ring-soft);
          box-shadow: 0 0 40px rgba(59, 130, 246, 0.08), 0 20px 40px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(6px);
        }
        .login-card::before {
          content: '';
          position: absolute;
          inset: -1px;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(120deg, rgba(59, 130, 246, 0.35), transparent 35%, transparent 65%, rgba(255, 255, 255, 0.15));
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
          background: rgba(59, 130, 246, 0.06);
          border: 1px solid var(--ring-soft);
          border-radius: 10px;
          padding: 10px 12px;
          color: var(--text-primary);
          outline: none;
        }
        .login-field::placeholder { color: rgba(234, 242, 255, 0.35); }
        .login-field:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
        }

        .login-error { color: #ff9d9d; }

        .login-register { color: var(--code-text); }
        .login-register-link {
          color: var(--text-accent);
          text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
        }
        .login-register-link:hover { color: var(--accent-strong); }

        .login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 600;
          color: #071233;
          background: linear-gradient(135deg, var(--accent-strong), var(--accent));
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.35);
          border: none;
          cursor: pointer;
        }
        .login-btn:disabled { opacity: 0.7; cursor: default; }

        .login-credit { color: var(--code-text); }
        .login-credit span {
          color: var(--text-accent);
          text-shadow: 0 0 8px rgba(59, 130, 246, 0.4);
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
          .wavy-cloth-svg path { transition: none; }
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
