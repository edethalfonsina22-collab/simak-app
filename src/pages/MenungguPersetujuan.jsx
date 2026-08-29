import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Clock3, XCircle, LogOut, RefreshCcw } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function MenungguPersetujuan() {
  const { session, statusAkun, signOut, refreshProfil } = useAuth()
  const [mengecek, setMengecek] = useState(false)

  // Cek ulang status secara berkala — begitu admin utama menyetujui,
  // pengguna otomatis diarahkan ke dasbor tanpa perlu refresh manual.
  useEffect(() => {
    const interval = setInterval(() => {
      refreshProfil()
    }, 15000)
    return () => clearInterval(interval)
  }, [refreshProfil])

  if (!session) return <Navigate to="/login" replace />
  if (statusAkun !== 'menunggu' && statusAkun !== 'ditolak') {
    return <Navigate to="/" replace />
  }

  const ditolak = statusAkun === 'ditolak'

  async function handleCekManual() {
    setMengecek(true)
    await refreshProfil()
    setMengecek(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-center">
        <div
          className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
            ditolak ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'
          }`}
        >
          {ditolak ? <XCircle size={28} /> : <Clock3 size={28} />}
        </div>

        <h1 className="font-display font-semibold text-lg text-slate-800">
          {ditolak ? 'Pendaftaran Ditolak' : 'Menunggu Persetujuan'}
        </h1>

        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          {ditolak
            ? 'Maaf, pendaftaran akun Anda ditolak oleh admin sekolah. Silakan hubungi admin sekolah Anda untuk informasi lebih lanjut.'
            : 'Akun Anda sudah terdaftar dan sedang menunggu persetujuan dari admin utama sekolah. Anda akan otomatis masuk begitu akun disetujui.'}
        </p>

        <div className="flex flex-col gap-2 mt-6">
          {!ditolak && (
            <button
              onClick={handleCekManual}
              disabled={mengecek}
              className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-60"
            >
              <RefreshCcw size={16} className={mengecek ? 'animate-spin' : ''} />
              Cek Status Sekarang
            </button>
          )}
          <button
            onClick={signOut}
            className="flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <LogOut size={16} />
            Keluar
          </button>
        </div>
      </div>
    </div>
  )
}
