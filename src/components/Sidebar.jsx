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
  LogOut,
  Boxes,
  CalendarDays,
  Mail,
  FileBadge,
  FileText,
  Wallet,
  DatabaseBackup,
  UserPlus,
  Landmark,
  Library,
  NotebookPen,
  UserCircle,
  Images,
  HardDrive,
  ClipboardList,
  Database,
  IdCard,
  FilePlus,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

// Menu ADMIN dikelompokkan per kategori supaya tidak jadi satu daftar panjang
const groupsAdmin = [
  {
    label: null, // tanpa judul grup — selalu di atas
    links: [
      { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
      { to: '/profil-saya', label: 'Profil Saya', icon: UserCircle },
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
      { to: '/buat-ujian', label: 'Buat Ujian', icon: FilePlus },
      { to: '/hasil-ujian', label: 'Hasil Ujian', icon: ClipboardList },
      { to: '/bank-soal', label: 'Bank Soal', icon: Database },
    ],
  },
  {
    label: 'Keuangan & Aset',
    links: [
      { to: '/keuangan', label: 'Keuangan', icon: Wallet },
      { to: '/perpustakaan', label: 'Perpustakaan', icon: Library },
      { to: '/inventaris', label: 'Inventaris', icon: Boxes },
    ],
  },
  {
    label: 'Administrasi',
    links: [
      { to: '/agenda', label: 'Agenda Sekolah', icon: CalendarDays },
      { to: '/surat', label: 'Surat Masuk/Keluar', icon: Mail },
      { to: '/ppdb-admin', label: 'PPDB Siswa Baru', icon: UserPlus },
      { to: '/laporan', label: 'Laporan Bulanan', icon: FileText },
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
  { to: '/galeri', label: 'Galeri Kegiatan', icon: Images },
  { to: '/dokumen', label: 'Dokumen Penting', icon: HardDrive },
  { to: '/presensi', label: 'Presensi', icon: ClipboardCheck },
  { to: '/nilai', label: 'Nilai Siswa', icon: BookOpenCheck },
  { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
  { to: '/rpp', label: 'RPP', icon: NotebookPen },
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
        `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
          isActive
            ? 'bg-brass-400 text-ink-950'
            : 'text-paper/70 hover:bg-white/[0.06] hover:text-paper'
        }`
      }
    >
      <Icon size={17} strokeWidth={2} />
      {label}
    </NavLink>
  )
}

export default function Sidebar() {
  const { signOut, session, isAdmin } = useAuth()

  return (
    <aside className="w-64 shrink-0 bg-ink-950 text-paper flex flex-col h-screen sticky top-0">
      <div className="px-6 py-6 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-brass-400 flex items-center justify-center font-display font-bold text-ink-950 text-sm">
            S
          </div>
          <div>
            <p className="font-display font-semibold text-[15px] leading-none">SIMAK</p>
            <p className="text-[11px] text-paper/40 mt-1">{isAdmin ? 'Admin' : 'Guru'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {isAdmin ? (
          groupsAdmin.map((group, i) => (
            <div key={group.label ?? `top-${i}`} className={i > 0 ? 'mt-5' : ''}>
              {group.label && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider uppercase text-paper/35">
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
      </nav>

      <div className="px-4 py-4 border-t border-white/10">
        <p className="text-xs text-paper/40 truncate mb-2 px-1">{session?.user?.email}</p>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-paper/70 hover:bg-white/[0.06] hover:text-paper transition-colors"
        >
          <LogOut size={17} />
          Keluar
        </button>
      </div>
    </aside>
  )
}
