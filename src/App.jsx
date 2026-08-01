import Galeri from './pages/Galeri'
import Dokumen from './pages/Dokumen'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Siswa from './pages/Siswa'
import HasilUjian from './pages/HasilUjian'
import Guru from './pages/Guru'
import Kelas from './pages/Kelas'
import Jadwal from './pages/Jadwal'
import Presensi from './pages/Presensi'
import Nilai from './pages/Nilai'
import Pengumuman from './pages/Pengumuman'
import Inventaris from './pages/Inventaris'
import Agenda from './pages/Agenda'
import Surat from './pages/Surat'
import Rapor from './pages/Rapor'
import LaporanBulanan from './pages/LaporanBulanan'
import Keuangan from './pages/Keuangan'
import Backup from './pages/Backup'
import ProfilSekolah from './pages/ProfilSekolah'
import PPDBPublik from './pages/PPDBPublik'
import PPDBAdmin from './pages/PPDBAdmin'
import Perpustakaan from './pages/Perpustakaan'
import RPP from './pages/RPP'
import BuatUjian from './pages/BuatUjian'
import UjianOnline from './pages/UjianOnline'
import ProfilSaya from './pages/ProfilSaya'
function ProtectedRoute({ children, adminOnly }) {
  const { session, loading, isAdmin } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper text-ink-700/50 text-sm">
        Memuat...
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Halaman publik — TIDAK perlu login, dibagikan ke orang tua calon siswa */}
      <Route path="/ppdb" element={<PPDBPublik />} />
<Route path="/ujian-online" element={<UjianOnline />} />
...
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/siswa" element={<ProtectedRoute adminOnly><Siswa /></ProtectedRoute>} />
      <Route path="/guru" element={<ProtectedRoute adminOnly><Guru /></ProtectedRoute>} />
      <Route path="/kelas" element={<ProtectedRoute adminOnly><Kelas /></ProtectedRoute>} />
      <Route path="/jadwal" element={<ProtectedRoute><Jadwal /></ProtectedRoute>} />
      <Route path="/presensi" element={<ProtectedRoute><Presensi /></ProtectedRoute>} />
      <Route path="/nilai" element={<ProtectedRoute><Nilai /></ProtectedRoute>} />
      <Route path="/rapor" element={<ProtectedRoute><Rapor /></ProtectedRoute>} />
      <Route path="/inventaris" element={<ProtectedRoute adminOnly><Inventaris /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
      <Route path="/surat" element={<ProtectedRoute adminOnly><Surat /></ProtectedRoute>} />
      <Route path="/laporan" element={<ProtectedRoute adminOnly><LaporanBulanan /></ProtectedRoute>} />
      <Route path="/keuangan" element={<ProtectedRoute adminOnly><Keuangan /></ProtectedRoute>} />
      <Route path="/backup" element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
      <Route path="/profil-sekolah" element={<ProtectedRoute adminOnly><ProfilSekolah /></ProtectedRoute>} />
      <Route path="/ppdb-admin" element={<ProtectedRoute adminOnly><PPDBAdmin /></ProtectedRoute>} />
      <Route path="/perpustakaan" element={<ProtectedRoute><Perpustakaan /></ProtectedRoute>} />
      <Route path="/pengumuman" element={<ProtectedRoute><Pengumuman /></ProtectedRoute>} />
      <Route path="/galeri" element={<ProtectedRoute><Galeri /></ProtectedRoute>} />
      <Route path="/dokumen" element={<ProtectedRoute><Dokumen /></ProtectedRoute>} />
      <Route path="/rpp" element={<ProtectedRoute><RPP /></ProtectedRoute>} />
      <Route path="/buat-ujian" element={<ProtectedRoute><BuatUjian /></ProtectedRoute>} />
      <Route path="/profil-saya" element={<ProtectedRoute><ProfilSaya /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
