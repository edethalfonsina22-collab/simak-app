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
      { to: '/pengajuan-surat-aktif', label: 'Pengajuan Surat Aktif', icon: FileCheck2 },
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
  { to: '/galeri', label: 'Galeri Kegiatan', icon: Images },
  { to: '/dokumen', label: 'Dokumen Penting', icon: HardDrive },
  { to: '/siswa', label: 'Data Siswa', icon: Users },
  { to: '/presensi', label: 'Presensi', icon: ClipboardCheck },
  { to: '/nilai', label: 'Nilai Siswa', icon: BookOpenCheck },
  { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
  { to: '/rpp', label: 'RPP', icon: NotebookPen },
  { to: '/arsip-rpp', label: 'Arsip RPP', icon: Archive },
  { to: '/pengajuan-surat-aktif', label: 'Pengajuan Surat Aktif', icon: FileCheck2 },
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
            ? 'bg-blue-600 text-white'
            : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
        }`
      }
    >
      <Icon size={17} strokeWidth={2} />
      {label}
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
    <aside className="w-64 shrink-0 bg-slate-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={namaTampil}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/15"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center font-display font-bold text-white text-xs shrink-0">
              {getInisial(namaTampil)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display font-semibold text-[13px] leading-tight truncate">{namaTampil}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{isAdmin ? 'Admin' : 'Guru'}</p>
          </div>
          <button
            onClick={signOut}
            title="Keluar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors shrink-0"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
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
      </nav>
    </aside>
  )
}
