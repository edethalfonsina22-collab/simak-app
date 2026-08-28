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
  ScrollText,
  Stamp,
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
  ShoppingCart,
  PackagePlus,
  FolderHeart,
  PiggyBank,
  FileSpreadsheet,
  Gamepad2,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'

const groupsAdmin = [
  {
    label: null,
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
      { to: '/nilai-asesmen', label: 'Nilai Asesmen', icon: FileSpreadsheet },
      { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
      { to: '/ijazah', label: 'Ijazah', icon: ScrollText },
      { to: '/skl', label: 'Surat Keterangan Lulus', icon: Stamp },
      { to: '/portofolio-siswa', label: 'Portofolio Siswa', icon: FolderHeart },
      { to: '/rpp', label: 'RPP', icon: NotebookPen },
      { to: '/arsip-rpp', label: 'Arsip RPP', icon: Archive },
      {
        to: '/sertifikat',
        label: 'Sertifikat & Penghargaan',
        icon: Award,
      },
      { to: '/buat-ujian', label: 'Buat Ujian', icon: FilePlus },
      { to: '/hasil-ujian', label: 'Hasil Ujian', icon: ClipboardList },
      { to: '/bank-soal', label: 'Bank Soal', icon: Database },
      {
        to: '/buat-kuis-seru',
        label: 'Kuis Seru (Kls 1-3)',
        icon: Gamepad2,
      },
    ],
  },
  {
    label: 'Keuangan & Aset',
    links: [
      { to: '/keuangan', label: 'Keuangan', icon: Wallet },
      {
        to: '/keuangan-kelas',
        label: 'Keuangan Kelas',
        icon: PiggyBank,
      },
      { to: '/kuitansi', label: 'Kuitansi', icon: Receipt },
      { to: '/kuitansi-jasa', label: 'Kuitansi Jasa', icon: Receipt },
      { to: '/nota', label: 'Nota Belanja', icon: ShoppingCart },
      { to: '/perpustakaan', label: 'Perpustakaan', icon: Library },
      { to: '/inventaris', label: 'Inventaris', icon: Boxes },
    ],
  },
  {
    label: 'Administrasi',
    links: [
      {
        to: '/pengajuan-surat-aktif',
        label: 'Pengajuan Surat Aktif',
        icon: FileCheck2,
      },
      {
        to: '/perbaikan-data-siswa',
        label: 'Perbaikan Data Siswa',
        icon: UserCog,
      },
      {
        to: '/pengajuan-kebutuhan-kelas',
        label: 'Kebutuhan Kelas',
        icon: PackagePlus,
      },
      { to: '/agenda', label: 'Agenda Sekolah', icon: CalendarDays },
      { to: '/surat', label: 'Surat Masuk/Keluar', icon: Mail },
      {
        to: '/surat-keterangan',
        label: 'Surat Keterangan',
        icon: FileSignature,
      },
      { to: '/ppdb-admin', label: 'PPDB Siswa Baru', icon: UserPlus },
      {
        to: '/persetujuan-admin',
        label: 'Persetujuan Akun',
        icon: UserCheck,
      },
      { to: '/laporan', label: 'Laporan Bulanan', icon: FileText },
      { to: '/hari-libur', label: 'Hari Libur', icon: CalendarOff },
      { to: '/backup', label: 'Backup Data', icon: DatabaseBackup },
      {
        to: '/profil-sekolah',
        label: 'Profil Sekolah',
        icon: Landmark,
      },
      { to: '/kartu', label: 'Cetak Kartu', icon: IdCard },
    ],
  },
]

const linksGuru = [
  { to: '/', label: 'Dasbor', icon: LayoutDashboard, end: true },
  { to: '/profil-saya', label: 'Profil Saya', icon: UserCircle },
  { to: '/rapat', label: 'Rapat Video', icon: Video },
  { to: '/galeri', label: 'Galeri Kegiatan', icon: Images },
  { to: '/dokumen', label: 'Dokumen Penting', icon: HardDrive },
  {
    to: '/keuangan-kelas',
    label: 'Keuangan Kelas',
    icon: PiggyBank,
  },
  { to: '/siswa', label: 'Data Siswa', icon: Users },
  { to: '/presensi', label: 'Presensi', icon: ClipboardCheck },
  { to: '/nilai', label: 'Nilai Siswa', icon: BookOpenCheck },
  {
    to: '/nilai-asesmen',
    label: 'Nilai Asesmen',
    icon: FileSpreadsheet,
  },
  { to: '/rapor', label: 'Rapor Siswa', icon: FileBadge },
  { to: '/ijazah', label: 'Ijazah', icon: ScrollText },
  { to: '/skl', label: 'Surat Keterangan Lulus', icon: Stamp },
  {
    to: '/portofolio-siswa',
    label: 'Portofolio Siswa',
    icon: FolderHeart,
  },
  { to: '/rpp', label: 'RPP', icon: NotebookPen },
  { to: '/arsip-rpp', label: 'Arsip RPP', icon: Archive },
  {
    to: '/sertifikat',
    label: 'Sertifikat & Penghargaan',
    icon: Award,
  },
  {
    to: '/pengajuan-surat-aktif',
    label: 'Pengajuan Surat Aktif',
    icon: FileCheck2,
  },
  {
    to: '/perbaikan-data-siswa',
    label: 'Perbaikan Data Siswa',
    icon: UserCog,
  },
  {
    to: '/pengajuan-kebutuhan-kelas',
    label: 'Kebutuhan Kelas',
    icon: PackagePlus,
  },
  { to: '/buat-ujian', label: 'Buat Ujian', icon: FilePlus },
  { to: '/hasil-ujian', label: 'Hasil Ujian', icon: ClipboardList },
  { to: '/bank-soal', label: 'Bank Soal', icon: Database },
  {
    to: '/buat-kuis-seru',
    label: 'Kuis Seru (Kls 1-3)',
    icon: Gamepad2,
  },
  { to: '/perpustakaan', label: 'Perpustakaan', icon: Library },
  {
    to: '/jadwal',
    label: 'Jadwal Pelajaran',
    icon: CalendarClock,
  },
  { to: '/agenda', label: 'Agenda Sekolah', icon: CalendarDays },
  { to: '/pengumuman', label: 'Pengumuman', icon: Megaphone },
]

function NavItem({ to, label, icon: Icon, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
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
            fill={
              isActive
                ? 'rgba(255,255,255,0.25)'
                : 'currentColor'
            }
            fillOpacity={isActive ? 1 : 0.15}
          />
          {label}
        </>
      )}
    </NavLink>
  )
}

function getFotoUrl(fotoProfilPath) {
  if (!fotoProfilPath) return null

  if (fotoProfilPath.startsWith('http')) {
    return fotoProfilPath
  }

  const { data } = supabase.storage
    .from('foto-profil')
    .getPublicUrl(fotoProfilPath)

  return data?.publicUrl || null
}

function getInisial(nama) {
  if (!nama) return '?'

  const kata = nama.trim().split(/\s+/)

  const inisial =
    kata.length > 1
      ? kata[0][0] + kata[1][0]
      : kata[0].slice(0, 2)

  return inisial.toUpperCase()
}

export default function Sidebar() {
  const { signOut, session, profil, isAdmin } = useAuth()

  const fotoUrl = getFotoUrl(profil?.foto_profil_path)
  const namaTampil =
    profil?.nama_lengkap || session?.user?.email || 'Pengguna'

  return (
    <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col border-r border-blue-900/50 bg-blue-950 text-white">
      <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 px-4 py-5">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.35]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="batikSidebar"
              width="46"
              height="46"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="23"
                cy="23"
                r="12"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.4"
              />
              <circle
                cx="23"
                cy="23"
                r="4"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.4"
              />
              <path
                d="M23 5v8M23 33v8M5 23h8M33 23h8"
                stroke="#fbbf24"
                strokeWidth="1.4"
              />
              <path
                d="M10 10l4 4M32 10l-4 4M10 36l4-4M32 36l-4-4"
                stroke="#fbbf24"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect
            width="100%"
            height="100%"
            fill="url(#batikSidebar)"
          />
        </svg>

        <div className="relative flex items-center gap-3">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={namaTampil}
              className="h-11 w-11 shrink-0 rounded-full border-2 border-white/20 object-cover"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white/20 bg-gradient-to-br from-blue-500 to-indigo-400 text-sm font-bold text-white">
              {getInisial(namaTampil)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-white">
              {namaTampil}
            </p>

            <p className="mt-0.5 text-[11px] text-white/50">
              {isAdmin ? 'Admin' : 'Guru'}
            </p>
          </div>

          <button
            type="button"
            onClick={signOut}
            title="Keluar"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-red-400 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <Power size={20} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <nav className="relative flex-1 overflow-y-auto bg-gradient-to-b from-blue-950 via-blue-900 to-indigo-950 px-3 py-4">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.22]"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="batikMenu"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(45)"
            >
              <rect
                x="12"
                y="0"
                width="12"
                height="12"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.2"
              />
              <circle
                cx="18"
                cy="6"
                r="2.6"
                fill="#fbbf24"
              />
              <path
                d="M0 18L18 0M18 36L36 18"
                stroke="#fbbf24"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect
            width="100%"
            height="100%"
            fill="url(#batikMenu)"
          />
        </svg>

        <div className="relative">
          {isAdmin ? (
            groupsAdmin.map((group, index) => (
              <div
                key={group.label ?? `top-${index}`}
                className={index > 0 ? 'mt-5' : ''}
              >
                {group.label && (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-white/35">
                    {group.label}
                  </p>
                )}

                <div className="space-y-1">
                  {group.links.map((link) => (
                    <NavItem
                      key={link.to}
                      {...link}
                    />
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-1">
              {linksGuru.map((link) => (
                <NavItem
                  key={link.to}
                  {...link}
                />
              ))}
            </div>
          )}
        </div>
      </nav>
    </aside>
  )
}
