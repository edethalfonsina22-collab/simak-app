import { useState, useEffect } from 'react'
import BankSoal from './pages/BankSoal'
import KartuSiswa from './pages/KartuSiswa'
import Galeri from './pages/Galeri'
import GaleriOrangTua from './pages/GaleriOrangTua'
import Dokumen from './pages/Dokumen'
import Pesan from './pages/Pesan'
import PesanPusat from './pages/PesanPusat'
import ScanDokumen from './pages/ScanDokumen'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/AuthContext'
import { supabase } from './lib/supabaseClient'
import Login from './pages/Login'
import Register from './pages/Register'
import MenungguPersetujuan from './pages/MenungguPersetujuan'
import PersetujuanAkun from './pages/PersetujuanAkun'
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
import KeuanganKelas from './pages/KeuanganKelas'
import Kuitansi from './pages/Kuitansi'
import Nota from './pages/Nota'
import KuitansiJasa from './pages/KuitansiJasa'
import Backup from './pages/Backup'
import ProfilSekolah from './pages/ProfilSekolah'
import ManajemenSekolah from './pages/ManajemenSekolah'
import PPDBPublik from './pages/PPDBPublik'
import PPDBAdmin from './pages/PPDBAdmin'
import Perpustakaan from './pages/Perpustakaan'
import RPP from './pages/RPP'
import ArsipRPP from './pages/ArsipRPP'
import BuatUjian from './pages/BuatUjian'
import UjianOnline from './pages/UjianOnline'
import ProfilSaya from './pages/ProfilSaya'
import SertifikatPenghargaan from './pages/SertifikatPenghargaan'
import PortofolioSiswa from './pages/PortofolioSiswa'
import PengajuanSuratAktif from './pages/PengajuanSuratAktif'
import PengajuanEditSiswa from './pages/PengajuanEditSiswa'
import PengajuanKebutuhanKelas from './pages/PengajuanKebutuhanKelas'
import HariLibur from './pages/HariLibur'
import KalenderPendidikan from './pages/KalenderPendidikan'
import Rapat from './pages/Rapat'
import RapatVideo from './pages/RapatVideo'
import Ijazah from './pages/Ijazah'
import NilaiAsesmen from './pages/NilaiAsesmen'
import SuratKeteranganLulus from './pages/SuratKeteranganLulus'
import BuatKuisSeru from './pages/BuatKuisSeru'
import KuisSeru from './pages/KuisSeru'
import HasilKuisSeru from './pages/HasilKuisSeru'
import RaporAnak from './pages/RaporAnak'
import PresensiAnak from './pages/PresensiAnak'
import Loader from './components/Loader'

function ProtectedRoute({ children, adminOnly, adminUtamaOnly, superAdminOnly }) {
  const { session, loading, isAdmin, isAdminUtama, isSuperAdmin, statusAkun } = useAuth()
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

  // Akun yang belum disetujui (atau ditolak) tidak boleh mengakses halaman manapun
  // selain halaman menunggu persetujuan.
  if (statusAkun === 'menunggu' || statusAkun === 'ditolak') {
    return <Navigate to="/menunggu-persetujuan" replace />
  }

  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  if (adminUtamaOnly && !isAdminUtama) return <Navigate to="/" replace />
  if (superAdminOnly && !isSuperAdmin) return <Navigate to="/" replace />
  return children
}

// Guard khusus halaman menunggu persetujuan: butuh login, tapi TIDAK dialihkan
// oleh pengecekan status_akun di ProtectedRoute (justru halaman ini yang menampilkannya).
function RouteMenunggu({ children }) {
  const { session, loading, statusAkun } = useAuth()
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
  if (statusAkun !== 'menunggu' && statusAkun !== 'ditolak') return <Navigate to="/" replace />
  return children
}

// Nota.jsx menerima `sekolah` lewat prop (beda dari Kuitansi.jsx/KuitansiJasa.jsx
// yang mengambil sendiri profil sekolah secara internal) — wrapper kecil ini
// mengambilkan profil sekolah dengan cara yang sama supaya kop surat di cetakan
// nota tetap terisi.
function NotaDenganSekolah() {
  const { profil } = useAuth()
  const sekolahId = profil?.sekolah_id
  const [sekolah, setSekolah] = useState(null)

  useEffect(() => {
    if (!sekolahId) return
    supabase
      .from('profil_sekolah')
      .select('*')
      .eq('sekolah_id', sekolahId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSekolah({
            nama: data.nama_sekolah,
            alamat: data.alamat,
            kota: data.kabupaten,
          })
        }
      })
  }, [sekolahId])

  return <Nota sekolah={sekolah} />
}

export default function App() {
  return (
    <Routes>
      {/* Halaman publik — TIDAK perlu login, dibagikan ke orang tua calon siswa */}
      <Route path="/ppdb" element={<PPDBPublik />} />
      <Route path="/ujian-online" element={<UjianOnline />} />
      {/* Kuis Seru: game kuis untuk siswa kelas 1-3, tanpa login (sama pola dengan ujian-online) */}
      <Route path="/kuis-seru" element={<KuisSeru />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/menunggu-persetujuan" element={<RouteMenunggu><MenungguPersetujuan /></RouteMenunggu>} />
      <Route path="/persetujuan-akun" element={<ProtectedRoute adminUtamaOnly><PersetujuanAkun /></ProtectedRoute>} />
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
      {/* Halaman khusus orang tua — read-only, anak diambil lewat tabel
          orang_tua_siswa (lihat getAnakSaya di AuthContext), bukan lewat
          dropdown bebas seperti /rapor dan /presensi milik guru. */}
      <Route path="/rapor-anak" element={<ProtectedRoute><RaporAnak /></ProtectedRoute>} />
      <Route path="/presensi-anak" element={<ProtectedRoute><PresensiAnak /></ProtectedRoute>} />
      <Route path="/galeri-orang-tua" element={<ProtectedRoute><GaleriOrangTua /></ProtectedRoute>} />
      <Route path="/nilai-asesmen" element={<ProtectedRoute><NilaiAsesmen /></ProtectedRoute>} />
      <Route path="/ijazah" element={<ProtectedRoute><Ijazah /></ProtectedRoute>} />
      <Route path="/skl" element={<ProtectedRoute><SuratKeteranganLulus /></ProtectedRoute>} />
      <Route path="/inventaris" element={<ProtectedRoute adminOnly><Inventaris /></ProtectedRoute>} />
      <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
      <Route path="/surat" element={<ProtectedRoute adminOnly><Surat /></ProtectedRoute>} />
      <Route path="/surat-keterangan" element={<ProtectedRoute adminOnly><SuratKeterangan /></ProtectedRoute>} />
      <Route path="/laporan" element={<ProtectedRoute adminOnly><LaporanBulanan /></ProtectedRoute>} />
      <Route path="/hari-libur" element={<ProtectedRoute adminOnly><HariLibur /></ProtectedRoute>} />
      {/* Kalender Pendidikan: BUKAN adminOnly — guru tetap bisa melihat kalender,
          kontrol edit (klik tanggal untuk ubah status) sudah dibatasi di dalam
          komponen lewat isAdmin dari useAuth(). */}
      <Route path="/kalender-pendidikan" element={<ProtectedRoute><KalenderPendidikan /></ProtectedRoute>} />
      <Route path="/keuangan" element={<ProtectedRoute adminOnly><Keuangan /></ProtectedRoute>} />
      {/* Keuangan Kelas: BUKAN adminOnly — ini kas kelas yang dipegang wali kelas (guru),
          admin tetap bisa membuka untuk memantau semua kelas. */}
      <Route path="/keuangan-kelas" element={<ProtectedRoute><KeuanganKelas /></ProtectedRoute>} />
      <Route path="/kuitansi" element={<ProtectedRoute adminOnly><Kuitansi /></ProtectedRoute>} />
      {/* Sebelumnya belum terdaftar di sini meski halamannya sudah ada di src/pages —
          jadi /nota dan /kuitansi-jasa tidak bisa dibuka sama sekali. */}
      <Route path="/nota" element={<ProtectedRoute adminOnly><NotaDenganSekolah /></ProtectedRoute>} />
      <Route path="/kuitansi-jasa" element={<ProtectedRoute adminOnly><KuitansiJasa /></ProtectedRoute>} />
      <Route path="/backup" element={<ProtectedRoute adminOnly><Backup /></ProtectedRoute>} />
      <Route path="/profil-sekolah" element={<ProtectedRoute adminUtamaOnly><ProfilSekolah /></ProtectedRoute>} />
      <Route path="/manajemen-sekolah" element={<ProtectedRoute superAdminOnly><ManajemenSekolah /></ProtectedRoute>} />
      <Route path="/ppdb-admin" element={<ProtectedRoute adminOnly><PPDBAdmin /></ProtectedRoute>} />
      <Route path="/perpustakaan" element={<ProtectedRoute><Perpustakaan /></ProtectedRoute>} />
      <Route path="/pengumuman" element={<ProtectedRoute><Pengumuman /></ProtectedRoute>} />
      <Route path="/galeri" element={<ProtectedRoute><Galeri /></ProtectedRoute>} />
      <Route path="/dokumen" element={<ProtectedRoute><Dokumen /></ProtectedRoute>} />
      <Route path="/pesan" element={<ProtectedRoute><Pesan /></ProtectedRoute>} />
      <Route path="/pesan-pusat" element={<ProtectedRoute adminOnly><PesanPusat /></ProtectedRoute>} />
      {/* Scan Dokumen: OCR upload/foto dokumen jadi teks yang bisa diunduh sebagai
          Word/txt. Sengaja BUKAN adminOnly — guru juga butuh fitur ini. */}
      <Route path="/scan-dokumen" element={<ProtectedRoute><ScanDokumen /></ProtectedRoute>} />
     <Route path="/rpp" element={<ProtectedRoute><RPP /></ProtectedRoute>} />
<Route path="/arsip-rpp" element={<ProtectedRoute><ArsipRPP /></ProtectedRoute>} />
      <Route path="/pengajuan-surat-aktif" element={<ProtectedRoute><PengajuanSuratAktif /></ProtectedRoute>} />
      <Route path="/perbaikan-data-siswa" element={<ProtectedRoute><PengajuanEditSiswa /></ProtectedRoute>} />
      <Route path="/pengajuan-kebutuhan-kelas" element={<ProtectedRoute><PengajuanKebutuhanKelas /></ProtectedRoute>} />
      <Route path="/bank-soal" element={<ProtectedRoute><BankSoal /></ProtectedRoute>} />
      <Route path="/buat-kuis-seru" element={<ProtectedRoute><BuatKuisSeru /></ProtectedRoute>} />
      <Route path="/hasil-kuis-seru" element={<ProtectedRoute><HasilKuisSeru /></ProtectedRoute>} />
      <Route path="/kartu" element={<ProtectedRoute adminOnly><KartuSiswa /></ProtectedRoute>} />
      <Route path="/buat-ujian" element={<ProtectedRoute><BuatUjian /></ProtectedRoute>} />
      <Route path="/profil-saya" element={<ProtectedRoute><ProfilSaya /></ProtectedRoute>} />
      <Route path="/sertifikat" element={<ProtectedRoute><SertifikatPenghargaan /></ProtectedRoute>} />
      <Route path="/portofolio-siswa" element={<ProtectedRoute><PortofolioSiswa /></ProtectedRoute>} />
      <Route path="/rapat" element={<ProtectedRoute><Rapat /></ProtectedRoute>} />
      {/* Sengaja TIDAK dibungkus ProtectedRoute — link rapat dibagikan ke
          peserta yang mungkin belum/tidak punya akun (mis. orang tua, tamu),
          jadi mereka bisa langsung gabung cukup dengan mengisi nama.
          RapatVideo sendiri yang menangani kasus sudah login vs tamu. */}
      <Route path="/rapat/:roomId" element={<RapatVideo />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
