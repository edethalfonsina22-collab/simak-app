import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  DoorOpen,
  CalendarClock,
  ClipboardCheck,
  BookOpenCheck,
  Megaphone,
  Power,
  Boxes,
  CalendarDays,
  Mail,
  FileBadge,
  FileText,
  FileSignature,
  Wallet,
  DatabaseBackup,
  UserPlus,
  Landmark,
  Library,
  NotebookPen,
  Archive,
  UserCircle,
  Images,
  HardDrive,
  ClipboardList,
  Database,
  IdCard,
  FilePlus,
  CalendarOff,
  FileCheck2,
  UserCog,
  Award,
  Video,
  Receipt,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

// Menu ADMIN dikelompokkan per kategori supaya tidak jadi satu daftar panjang
const groupsAdmin = [
  {
    label: null, // tanpa judul grup — selalu di atas
    links: [
      { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
      { to: '/profil-saya', label: 'Profil Saya', icon: UserCircle },
      { to: '/rapat', label: 'Rapat Video', icon: Video },
      { to: '/galeri', label: 'Galeri Kegiatan', icon: Images },
      { to: '/dokumen', label: 'Dokumen Penting', icon: HardDrive },
      { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
    ],
  },
  {
    label: 'Akademik',
    links: [
      { to: '/siswa', label: 'Data Siswa', icon: Users },
      { to: '/guru', label: 'Data Guru', icon: GraduationCap },
      { to: '/kelas', label: 'Kelas', icon: DoorOpen },
      { to: '/jadwal', label: 'Jadwal Pelajaran', icon: CalendarClock },
      { to: '/presensi', label: 'Presensi', icon: ClipboardCheck },
      { to: '/nilai', label: 'Nilai Siswa', icon: BookOpenCheck },
      { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
      { to: '/rpp', label: 'RPP', icon: NotebookPen },
      { to: '/arsip-rpp', label: 'Arsip RPP', icon: Archive },
      { to: '/sertifikat', label: 'Sertifikat & Penghargaan', icon: Award },
      { to: '/buat-ujian', label: 'Buat Ujian', icon: FilePlus },
      { to: '/hasil-ujian', label: 'Hasil Ujian', icon: ClipboardList },
      { to: '/bank-soal', label: 'Bank Soal', icon: Database },
    ],
  },
  {
    label: 'Keuangan & Aset',
    links: [
      { to: '/keuangan', label: 'Keuangan', icon: Wallet },
      { to: '/kuitansi', label: 'Kuitansi', icon: Receipt },
      { to: '/perpustakaan', label: 'Perpustakaan', icon: Library },
      { to: '/inventaris', label: 'Inventaris', icon: Boxes },
    ],
  },
  {
    label: 'Administrasi',
    links: [
      { to: '/pengajuan-surat-aktif', label: 'Pengajuan Surat Aktif', icon: FileCheck2 },
      { to: '/perbaikan-data-siswa', label: 'Perbaikan Data Siswa', icon: UserCog },
      { to: '/agenda', label: 'Agenda Sekolah', icon: CalendarDays },
      { to: '/surat', label: 'Surat Masuk/Keluar', icon: Mail },
      { to: '/surat-keterangan', label: 'Surat Keterangan', icon: FileSignature },
      { to: '/ppdb-admin', label: 'PPDB Siswa Baru', icon: UserPlus },
      { to: '/laporan', label: 'Laporan Bulanan', icon: FileText },
      { to: '/hari-libur', label: 'Hari Libur', icon: CalendarOff },
      { to: '/backup', label: 'Backup Data', icon: DatabaseBackup },
      { to: '/profil-sekolah', label: 'Profil Sekolah', icon: Landmark },
      { to: '/kartu', label: 'Cetak Kartu', icon: IdCard },
    ],
  },
]

// Menu GURU: tetap ringkas, tidak perlu dikelompokkan
const linksGuru = [
  { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
  { to: '/profil-saya', label: 'Profil Saya', icon: UserCircle },
  { to: '/rapat', label: 'Rapat Video', icon: Video },
  { to: '/galeri', label: 'Galeri Kegiatan', icon: Images },
  { to: '/dokumen', label: 'Dokumen Penting', icon: HardDrive },
  { to: '/siswa', label: 'Data Siswa', icon: Users },
  { to: '/presensi', label: 'Presensi', icon: ClipboardCheck },
  { to: '/nilai', label: 'Nilai Siswa', icon: BookOpenCheck },
  { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
  { to: '/rpp', label: 'RPP', icon: NotebookPen },
  { to: '/arsip-rpp', label: 'Arsip RPP', icon: Archive },
  { to: '/sertifikat', label: 'Sertifikat & Penghargaan', icon: Award },
  { to: '/pengajuan-surat-aktif', label: 'Pengajuan Surat Aktif', icon: FileCheck2 },
  { to: '/perbaikan-data-siswa', label: 'Perbaikan Data Siswa', icon: UserCog },
  { to: '/buat-ujian', label: 'Buat Ujian', icon: FilePlus },
  { to: '/hasil-ujian', label: 'Hasil Ujian', icon: ClipboardList },
  { to: '/bank-soal', label: 'Bank Soal', icon: Database },
  { to: '/perpustakaan', label: 'Perpustakaan', icon: Library },
  { to: '/jadwal', label: 'Jadwal Pelajaran', icon: CalendarClock },
  { to: '/agenda', label: 'Agenda Sekolah', icon: CalendarDays },
  { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
          isActive
            ? 'bg-gradient-to-r from-blue-500 to-indigo-400 text-white shadow-sm shadow-black/20'
            : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={17}
            strokeWidth={1.8}
            fill={isActive ? 'rgba(255,255,255,0.25)' : 'currentColor'}
            fillOpacity={isActive ? 1 : 0.15}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

// Ambil URL foto guru dari kolom foto_profil_path (isinya path storage,
// bukan URL lengkap) di bucket "foto-profil".
function getFotoUrl(fotoProfilPath) {
  if (!fotoProfilPath) return null
  if (fotoProfilPath.startsWith('http')) return fotoProfilPath
  const { data } = supabase.storage.from('foto-profil').getPublicUrl(fotoProfilPath)
  return data?.publicUrl || null
}

function getInisial(nama) {
  if (!nama) return '?'
  const kata = nama.trim().split(/\s+/)
  const inisial = kata.length > 1 ? kata[0][0] + kata[1][0] : kata[0].slice(0, 2)
  return inisial.toUpperCase()
}

export default function Sidebar() {
  const { signOut, session, profil, isAdmin } = useAuth()
  const fotoUrl = getFotoUrl(profil?.foto_profil_path)
  const namaTampil = profil?.nama_lengkap || session?.user?.email || 'Pengguna'

  return (
    <aside className="w-64 shrink-0 bg-blue-950 text-white flex flex-col h-screen sticky top-0 border-r border-blue-900/50">
      <div className="relative overflow-hidden px-4 py-5 border-b border-white/10 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900">
        {/* Motif batik dekoratif (senada dengan banner dashboard) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.35] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="batikSidebar" width="46" height="46" patternUnits="userSpaceOnUse">
              <circle cx="23" cy="23" r="12" fill="none" stroke="#fbbf24" strokeWidth="1.4" />
              <circle cx="23" cy="23" r="4" fill="none" stroke="#fbbf24" strokeWidth="1.4" />
              <path d="M23 5 v8 M23 33 v8 M5 23 h8 M33 23 h8" stroke="#fbbf24" strokeWidth="1.4" />
              <path d="M10 10 l4 4 M32 10 l-4 4 M10 36 l4 -4 M32 36 l-4 -4" stroke="#fbbf24" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#batikSidebar)" />
        </svg>

        <div className="relative flex items-center gap-3">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={namaTampil}
              className="w-11 h-11 rounded-full object-cover shrink-0 border-2 border-white/20"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center font-display font-bold text-white text-sm shrink-0 border-2 border-white/20">
              {getInisial(namaTampil)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-[13px] leading-tight truncate text-white">{namaTampil}</p>
            <p className="text-[11px] text-white/50 mt-0.5">{isAdmin ? 'Admin' : 'Guru'}</p>
          </div>
          <button
            onClick={signOut}
            title="Keluar"
            className="w-10 h-10 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors shrink-0"
          >
            <Power size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto py-4 px-3 bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950">
        {/* Motif batik area menu — gaya berbeda dari header (kawung/diamond, bukan lingkaran) */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.22] pointer-events-none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="batikMenu"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect x="12" y="0" width="12" height="12" fill="none" stroke="#fbbf24" strokeWidth="1.2" />
              <circle cx="18" cy="6" r="2.6" fill="#fbbf24" />
              <path d="M0 18 L18 0 M18 36 L36 18" stroke="#fbbf24" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#batikMenu)" />
        </svg>

        <div className="relative">
        {isAdmin ? (
          groupsAdmin.map((group, i) => (
            <div key={group.label ?? `top-${i}`} className={i > 0 ? 'mt-5' : ''}>
              {group.label && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-white/35">
                  {group.label}
                </p>
              )}
              <div className="space-y-1">
                {group.links.map((link) => (
                  <NavItem key={link.to} {...link} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="space-y-1">
            {linksGuru.map((link) => (
              <NavItem key={link.to} {...link} />
            ))}
          </div>
        )}
        </div>
      </nav>
    </aside>
  )
}
