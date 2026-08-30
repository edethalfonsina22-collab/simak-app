import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Bell, MessageSquare, X, Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { useAuth } from '../lib/AuthContext'

// Data contoh sementara — nanti gampang diganti dengan fetch dari Supabase
// (misal tabel `notifikasi` dengan kolom: judul, deskripsi, dibuat_pada, dibaca)
const notifikasiContoh = [
  {
    id: 1,
    judul: 'Pengajuan surat aktif baru',
    deskripsi: 'Ada 1 pengajuan surat aktif menunggu persetujuan Anda.',
    waktu: '10 menit lalu',
    dibaca: false,
  },
  {
    id: 2,
    judul: 'Pengumuman baru diterbitkan',
    deskripsi: '"Info penting" baru saja ditambahkan ke daftar pengumuman.',
    waktu: '2 jam lalu',
    dibaca: false,
  },
  {
    id: 3,
    judul: 'Dokumen penting diunggah',
    deskripsi: 'Dokumen baru telah ditambahkan ke arsip sekolah.',
    waktu: 'Kemarin',
    dibaca: true,
  },
]

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifikasi, setNotifikasi] = useState(notifikasiContoh)
  const ref = useRef(null)

  const belumDibaca = notifikasi.filter((n) => !n.dibaca).length

  // Tutup dropdown saat klik di luar area
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function tandaiSemuaDibaca() {
    setNotifikasi((prev) => prev.map((n) => ({ ...n, dibaca: true })))
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifikasi"
        className="relative w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
      >
        <Bell size={19} strokeWidth={2} />
        {belumDibaca > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none border-2 border-white">
            {belumDibaca > 9 ? '9+' : belumDibaca}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <p className="font-display font-semibold text-sm text-slate-900">Notifikasi</p>
            {belumDibaca > 0 && (
              <button
                onClick={tandaiSemuaDibaca}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifikasi.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Belum ada notifikasi.</p>
            ) : (
              notifikasi.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-slate-50 last:border-0 flex gap-2.5 ${
                    n.dibaca ? '' : 'bg-blue-50/50'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.dibaca ? 'bg-transparent' : 'bg-blue-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{n.judul}</p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.deskripsi}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{n.waktu}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Banner "Pesan dari Admin" — muncul di atas konten halaman kalau akun yang
// sedang login punya 'catatan_admin' terisi (dikirim lewat tombol Kirim
// Pesan / Edit Pesan di halaman Persetujuan Akun). Begitu ditutup, pesan
// dihapus dari database (lewat tandaiPesanDibaca) supaya tidak muncul lagi.
function PesanAdminBanner() {
  const { pesanAdmin, tandaiPesanDibaca } = useAuth()
  const [menutup, setMenutup] = useState(false)
  const [memproses, setMemproses] = useState(false)

  if (!pesanAdmin || menutup) return null

  async function handleTutup() {
    setMemproses(true)
    setMenutup(true) // langsung sembunyikan di UI supaya terasa responsif
    await tandaiPesanDibaca()
    setMemproses(false)
  }

  return (
    <div className="mx-4 sm:mx-6 md:mx-8 mt-5 flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
      <MessageSquare size={18} className="text-blue-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900">Pesan dari Admin</p>
        <p className="text-sm text-blue-700 mt-0.5 whitespace-pre-wrap">{pesanAdmin}</p>
      </div>
      <button
        onClick={handleTutup}
        disabled={memproses}
        title="Tutup"
        className="text-blue-400 hover:text-blue-600 shrink-0 disabled:opacity-50"
      >
        <X size={16} />
      </button>
    </div>
  )
}

export default function Layout({ children, title, subtitle, actions }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  // Tutup drawer otomatis setiap kali pindah halaman (mis. setelah tap menu)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  // Kunci scroll body saat drawer terbuka di HP supaya konten di belakangnya tidak ikut geser
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 min-w-0 w-full">
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200 px-4 sm:px-6 md:px-8 py-3.5 md:py-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              title="Buka menu"
              className="w-10 h-10 -ml-1.5 shrink-0 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors md:hidden"
            >
              <Menu size={21} strokeWidth={2} />
            </button>
            <div className="min-w-0">
              <h1 className="font-display text-lg sm:text-xl md:text-2xl font-semibold text-slate-900 truncate">
                {title}
              </h1>
              {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5 truncate">{subtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationBell />
            {actions && <div className="flex items-center gap-2 sm:gap-3">{actions}</div>}
          </div>
        </header>
        <PesanAdminBanner />
        <div className="px-4 sm:px-6 md:px-8 py-5 md:py-7">{children}</div>
      </main>
    </div>
  )
}
