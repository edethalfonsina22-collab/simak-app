import { useState, useEffect } from 'react'
import BankSoal from './pages/BankSoal'
import KartuSiswa from './pages/KartuSiswa'
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
import SuratKeterangan from './pages/SuratKeterangan'
import Rapor from './pages/Rapor'
import RaporCetak from './pages/RaporCetak'
import LaporanBulanan from './pages/LaporanBulanan'
import Keuangan from './pages/Keuangan'
import Kuitansi from './pages/Kuitansi'
import Backup from './pages/Backup'
import ProfilSekolah from './pages/ProfilSekolah'
import PPDBPublik from './pages/PPDBPublik'
import PPDBAdmin from './pages/PPDBAdmin'
import Perpustakaan from './pages/Perpustakaan'
import RPP from './pages/RPP'
import ArsipRPP from './pages/ArsipRPP'
import BuatUjian from './pages/BuatUjian'
import UjianOnline from './pages/UjianOnline'
import ProfilSaya from './pages/ProfilSaya'
import SertifikatPenghargaan from './pages/SertifikatPenghargaan'
import PengajuanSuratAktif from './pages/PengajuanSuratAktif'
import PengajuanEditSiswa from './pages/PengajuanEditSiswa'
import HariLibur from './pages/HariLibur'
import Rapat from './pages/Rapat'
import RapatVideo from './pages/RapatVideo'
import Loader from './components/Loader'

function ProtectedRoute({ children, adminOnly }) {
  const { session, loading, isAdmin } = useAuth()
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeElapsed(true), 900)
    return () => clearTimeout(timer)
  }, [])

  if (loading || !minTimeElapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader />
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
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/siswa" element={<ProtectedRoute><Siswa /></ProtectedRoute>} />
      <Route path="/hasil-ujian" element={<ProtectedRoute><HasilUjian /></ProtectedRoute>} />
      <Route path="/guru" element={<ProtectedRoute adminOnly><Guru /></ProtectedRoute>} />
      <Route path="/kelas" element={<ProtectedRoute adminOnly><Kelas /></ProtectedRoute>} />
      <Route path="/jadwal" element={<ProtectedRoute><Jadwal /></ProtectedRoute>} />
      <Route path="/presensi" element={<ProtectedRoute><Presensi /></ProtectedRoute>} />
      <Route path="/nilai" element={<ProtectedRoute><Nilai /></ProtectedRoute>} />
      <Route path="/rapor" element={<ProtectedRoute><Rapor /></ProtectedRoute>} />
      <Route path="/rapor/cetak" element={<ProtectedRoute><RaporCetak /></ProtectedRoute>} />
      <Route path="/inventaris" element={<ProtectedRoute adminOnly><Inventaris /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
      <Route path="/surat" element={<ProtectedRoute adminOnly><Surat /></ProtectedRoute>} />
      <Route path="/surat-keterangan" element={<ProtectedRoute adminOnly><SuratKeterangan /></ProtectedRoute>} />
      <Route path="/laporan" element={<ProtectedRoute adminOnly><LaporanBulanan /></ProtectedRoute>} />
      <Route path="/hari-libur" element={<ProtectedRoute adminOnly><HariLibur /></ProtectedRoute>} />
      <Route path="/keuangan" element={<ProtectedRoute adminOnly><Keuangan /></ProtectedRoute>} />
      <Route path="/kuitansi" element={<ProtectedRoute adminOnly><Kuitansi /></ProtectedRoute>} />
      <Route path="/backup" element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
      <Route path="/profil-sekolah" element={<ProtectedRoute adminOnly><ProfilSekolah /></ProtectedRoute>} />
      <Route path="/ppdb-admin" element={<ProtectedRoute adminOnly><PPDBAdmin /></ProtectedRoute>} />
      <Route path="/perpustakaan" element={<ProtectedRoute><Perpustakaan /></ProtectedRoute>} />
      <Route path="/pengumuman" element={<ProtectedRoute><Pengumuman /></ProtectedRoute>} />
      <Route path="/galeri" element={<ProtectedRoute><Galeri /></ProtectedRoute>} />
      <Route path="/dokumen" element={<ProtectedRoute><Dokumen /></ProtectedRoute>} />
     <Route path="/rpp" element={<ProtectedRoute><RPP /></ProtectedRoute>} />
<Route path="/arsip-rpp" element={<ProtectedRoute><ArsipRPP /></ProtectedRoute>} />
      <Route path="/pengajuan-surat-aktif" element={<ProtectedRoute><PengajuanSuratAktif /></ProtectedRoute>} />
      <Route path="/perbaikan-data-siswa" element={<ProtectedRoute><PengajuanEditSiswa /></ProtectedRoute>} />
      <Route path="/bank-soal" element={<ProtectedRoute><BankSoal /></ProtectedRoute>} />
      <Route path="/kartu" element={<ProtectedRoute adminOnly><KartuSiswa /></ProtectedRoute>} />
      <Route path="/buat-ujian" element={<ProtectedRoute><BuatUjian /></ProtectedRoute>} />
      <Route path="/profil-saya" element={<ProtectedRoute><ProfilSaya /></ProtectedRoute>} />
      <Route path="/sertifikat" element={<ProtectedRoute><SertifikatPenghargaan /></ProtectedRoute>} />
      <Route path="/rapat" element={<ProtectedRoute><Rapat /></ProtectedRoute>} />
      <Route path="/rapat/:roomId" element={<ProtectedRoute><RapatVideo /></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
