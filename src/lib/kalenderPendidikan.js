// src/lib/kalenderPendidikan.js
// Data dasar Kalender Pendidikan SD/MI — Tahun Pelajaran 2026/2027
//
// CATATAN:
// - Tanggal pada LIBUR_UMUM diambil dari tabel "LIBUR UMUM" pada dokumen
//   kalender pendidikan resmi, jadi sudah pasti.
// - Rentang pada KEGIATAN_RANGE (ATS, ASAS, ASKK, TKA, Libur Semester, dll)
//   adalah estimasi awal hasil pembacaan grid kalender. Sesuaikan di sini,
//   atau langsung lewat mode edit di halaman Kalender Pendidikan (admin)
//   yang tersimpan ke tabel Supabase "kalender_overrides".

export const TAHUN_AJARAN = '2026/2027'

export const BULAN = [
  { key: 'juli_2026', nama: 'Juli', tahun: 2026, bulan: 7 },
  { key: 'agustus_2026', nama: 'Agustus', tahun: 2026, bulan: 8 },
  { key: 'september_2026', nama: 'September', tahun: 2026, bulan: 9 },
  { key: 'oktober_2026', nama: 'Oktober', tahun: 2026, bulan: 10 },
  { key: 'november_2026', nama: 'November', tahun: 2026, bulan: 11 },
  { key: 'desember_2026', nama: 'Desember', tahun: 2026, bulan: 12 },
  { key: 'januari_2027', nama: 'Januari', tahun: 2027, bulan: 1 },
  { key: 'februari_2027', nama: 'Februari', tahun: 2027, bulan: 2 },
  { key: 'maret_2027', nama: 'Maret', tahun: 2027, bulan: 3 },
  { key: 'april_2027', nama: 'April', tahun: 2027, bulan: 4 },
  { key: 'mei_2027', nama: 'Mei', tahun: 2027, bulan: 5 },
  { key: 'juni_2027', nama: 'Juni', tahun: 2027, bulan: 6 },
]

export const SEMESTER = {
  GANJIL: {
    label: 'Semester Ganjil (I)',
    bulan: ['juli_2026', 'agustus_2026', 'september_2026', 'oktober_2026', 'november_2026', 'desember_2026'],
    totalHbe: 136,
  },
  GENAP: {
    label: 'Semester Genap (II)',
    bulan: ['januari_2027', 'februari_2027', 'maret_2027', 'april_2027', 'mei_2027', 'juni_2027'],
    totalHbe: 130,
  },
}

// Jumlah Hari Belajar Efektif (JML HBE) per bulan, sesuai kolom pada dokumen asli
export const JML_HBE = {
  juli_2026: 17,
  agustus_2026: 24,
  september_2026: 26,
  oktober_2026: 27,
  november_2026: 25,
  desember_2026: 17,
  januari_2027: 22,
  februari_2027: 23,
  maret_2027: 21,
  april_2027: 26,
  mei_2027: 22,
  juni_2027: 16,
}

// Kode keterangan (sesuai legenda "KETERANGAN" di dokumen) + warna badge Tailwind
export const KETERANGAN = {
  M: { label: 'Hari Minggu', dot: 'bg-red-500', badge: 'bg-red-500 text-white' },
  'M+': { label: 'Hari Pertama Masuk Sekolah / MPLS', dot: 'bg-emerald-500', badge: 'bg-emerald-500 text-white' },
  LU: { label: 'Libur Umum', dot: 'bg-red-500', badge: 'bg-red-500 text-white' },
  ATS: { label: 'Asesmen Tengah Semester', dot: 'bg-purple-500', badge: 'bg-purple-500 text-white' },
  ASAS: { label: 'Asesmen Sumatif Akhir Semester', dot: 'bg-blue-500', badge: 'bg-blue-500 text-white' },
  ASKK: { label: 'Asesmen Sumatif Kenaikan Kelas', dot: 'bg-blue-500', badge: 'bg-blue-500 text-white' },
  R: { label: 'Remedial', dot: 'bg-orange-500', badge: 'bg-orange-500 text-white' },
  TKA1: { label: 'TKA Tahap 1', dot: 'bg-amber-800', badge: 'bg-amber-800 text-white' },
  TKA2: { label: 'TKA Tahap 2', dot: 'bg-amber-800', badge: 'bg-amber-800 text-white' },
  'AS-SD': { label: 'Asesmen Sekolah (AS-SD)', dot: 'bg-teal-600', badge: 'bg-teal-600 text-white' },
  LP: { label: 'Pembagian Laporan Pendidikan', dot: 'bg-yellow-400', badge: 'bg-yellow-400 text-slate-900' },
  CB: { label: 'Cuti Bersama', dot: 'bg-red-500', badge: 'bg-red-500 text-white' },
  LS: { label: 'Libur Semester', dot: 'bg-yellow-400', badge: 'bg-yellow-400 text-slate-900' },
}

// Hari Libur Umum & Keagamaan Nasional (tanggal pasti, dari tabel dokumen)
export const LIBUR_UMUM = [
  { tanggal: '2026-08-17', keterangan: 'Kemerdekaan Indonesia', kode: 'LU' },
  { tanggal: '2026-08-25', keterangan: 'Maulid Nabi Muhammad SAW', kode: 'LU' },
  { tanggal: '2026-12-24', keterangan: 'Cuti Bersama', kode: 'CB' },
  { tanggal: '2026-12-25', keterangan: 'Kelahiran Tuhan Yesus (Natal)', kode: 'LU' },
  { tanggal: '2027-01-05', keterangan: "Isra' Mi'raj", kode: 'LU' },
  { tanggal: '2027-02-06', keterangan: 'Tahun Baru Imlek', kode: 'LU' },
  { tanggal: '2027-03-09', keterangan: 'Hari Raya Nyepi', kode: 'LU' },
  { tanggal: '2027-03-10', keterangan: 'Libur Idul Fitri', kode: 'LU' },
  { tanggal: '2027-03-11', keterangan: 'Libur Idul Fitri', kode: 'LU' },
  { tanggal: '2027-03-26', keterangan: 'Wafat Isa Almasih', kode: 'LU' },
  { tanggal: '2027-05-01', keterangan: 'Hari Buruh', kode: 'LU' },
  { tanggal: '2027-05-06', keterangan: 'Kenaikan Isa Almasih', kode: 'LU' },
  { tanggal: '2027-05-17', keterangan: 'Idul Adha 1447 H', kode: 'LU' },
  { tanggal: '2027-05-20', keterangan: 'Hari Raya Waisak', kode: 'LU' },
  { tanggal: '2027-06-01', keterangan: 'Hari Lahir Pancasila', kode: 'LU' },
  { tanggal: '2027-06-06', keterangan: 'Tahun Baru Hijriah', kode: 'LU' },
]

// Rentang kegiatan sekolah (ESTIMASI AWAL — silakan sesuaikan dengan SK final)
export const KEGIATAN_RANGE = [
  { mulai: '2026-07-13', selesai: '2026-07-15', kode: 'M+', keterangan: 'Hari Pertama Masuk Sekolah / MPLS' },
  { mulai: '2026-09-21', selesai: '2026-09-25', kode: 'ATS', keterangan: 'Asesmen Tengah Semester Ganjil' },
  { mulai: '2026-12-07', selesai: '2026-12-11', kode: 'ASAS', keterangan: 'Asesmen Sumatif Akhir Semester Ganjil' },
  { mulai: '2026-12-14', selesai: '2026-12-18', kode: 'R', keterangan: 'Remedial Semester Ganjil' },
  { mulai: '2026-12-19', selesai: '2026-12-19', kode: 'LP', keterangan: 'Pembagian Laporan Pendidikan Semester Ganjil' },
  { mulai: '2026-12-21', selesai: '2027-01-02', kode: 'LS', keterangan: 'Libur Semester Ganjil' },
  { mulai: '2027-03-01', selesai: '2027-03-05', kode: 'ATS', keterangan: 'Asesmen Tengah Semester Genap' },
  { mulai: '2027-05-10', selesai: '2027-05-11', kode: 'TKA1', keterangan: 'TKA Tahap 1' },
  { mulai: '2027-05-28', selesai: '2027-05-29', kode: 'TKA2', keterangan: 'TKA Tahap 2' },
  { mulai: '2027-06-07', selesai: '2027-06-11', kode: 'ASKK', keterangan: 'Asesmen Sumatif Kenaikan Kelas' },
  { mulai: '2027-06-14', selesai: '2027-06-18', kode: 'R', keterangan: 'Remedial Semester Genap' },
  { mulai: '2027-06-19', selesai: '2027-06-19', kode: 'LP', keterangan: 'Pembagian Laporan Pendidikan Semester Genap' },
  { mulai: '2027-06-21', selesai: '2027-07-11', kode: 'LS', keterangan: 'Libur Semester Genap' },
]

// ---------- Helper functions ----------

export function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toISODate(tahun, bulan, tanggal) {
  return `${tahun}-${pad2(bulan)}-${pad2(tanggal)}`
}

export function isMinggu(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`)
  return d.getDay() === 0
}

export function getLiburUmum(isoDate) {
  return LIBUR_UMUM.find((l) => l.tanggal === isoDate) || null
}

export function getKegiatan(isoDate) {
  return KEGIATAN_RANGE.find((k) => isoDate >= k.mulai && isoDate <= k.selesai) || null
}

/**
 * Menentukan status satu tanggal.
 * Prioritas: override manual (Supabase) > Hari Minggu > Libur Umum >
 * Rentang kegiatan > null (hari sekolah biasa).
 */
export function getStatusTanggal(isoDate, overrides = {}) {
  if (overrides[isoDate]) return overrides[isoDate]
  if (isMinggu(isoDate)) return { kode: 'M', keterangan: 'Hari Minggu' }

  const lu = getLiburUmum(isoDate)
  if (lu) return { kode: lu.kode, keterangan: lu.keterangan }

  const keg = getKegiatan(isoDate)
  if (keg) return { kode: keg.kode, keterangan: keg.keterangan }

  return null
}

export function jumlahHariDalamBulan(tahun, bulan) {
  return new Date(tahun, bulan, 0).getDate()
}
