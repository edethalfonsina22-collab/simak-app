// Util bersama untuk mencocokkan nama kelas dari berbagai sumber (template impor biasa,
// unduhan Dapodik, dll) ke data kelas yang sudah ada di sistem (tabel `kelas`).
// Dipakai oleh Siswa.jsx (mapRow untuk "Impor Massal") dan DapodikImportModal.jsx,
// supaya logika pencocokannya konsisten di satu tempat saja.

// Peta angka Romawi -> angka Arab, dipakai karena field "Tingkat" di menu Kelas
// sering diisi pakai format Romawi (mis. "VII"), sementara Dapodik selalu
// mengirim angka Arab (mis. "Kelas 7"). Dibatasi I-XII karena tingkat kelas
// sekolah tidak pernah lebih dari itu.
const ROMAN_TO_NUMBER = {
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
}

// Ambil angka tingkat kelas dari string apapun formatnya
// (mis. "Kelas 1", "1", "1A", "Kls. 1", "Rombel 3", "V", "Kelas V", "VI-A") -> "1", "1", "1", "1", "3", "5", "5", "6"
export function extractTingkatNumber(str) {
  const s = String(str || '').trim()
  if (!s) return null

  // 1) Coba angka Arab dulu (paling umum & paling pasti benar).
  const digitMatch = s.match(/\d+/)
  if (digitMatch) return digitMatch[0]

  // 2) Fallback ke angka Romawi (mis. "Kelas V", "VI", "VI-A"). Dipecah per-kata
  // supaya "VI-A" tetap kebaca ("vi" jadi token sendiri setelah dipisah karakter
  // non-huruf), dan supaya tidak salah tangkap kata lain yang cuma "mirip" romawi.
  const tokens = s.toLowerCase().split(/[^a-z]+/).filter(Boolean)
  for (const token of tokens) {
    if (ROMAN_TO_NUMBER[token]) return String(ROMAN_TO_NUMBER[token])
  }
  return null
}

// Cocokkan nama kelas dari file impor dengan salah satu kelas di kelasList.
// 1) Coba exact match dulu ke nama_kelas (case-insensitive, sudah di-trim).
// 2) Kalau gagal, fallback ke pencocokan berdasarkan angka tingkat saja —
//    dicoba dulu ke field `tingkat` (field ini memang dikhususkan untuk angka
//    jenjang, jadi paling akurat), baru kalau kelasList tidak punya field
//    `tingkat` (mis. hasil query yang cuma select id+nama_kelas) atau tidak
//    ketemu, coba lagi ke nama_kelas.
//    Aman dipakai selama kelas di sekolah cuma satu per tingkat (1-6),
//    tanpa rombel paralel (1A/1B dst). Kalau nanti ada rombel paralel,
//    fallback ini perlu diperketat lagi (misal dengan huruf rombel juga).
export function matchKelasByName(kelasList, namaKelas) {
  const nama = String(namaKelas || '').trim()
  if (!nama || !Array.isArray(kelasList)) return null

  let matched = kelasList.find(
    (k) => k.nama_kelas && k.nama_kelas.trim().toLowerCase() === nama.toLowerCase()
  )
  if (matched) return matched

  const targetNum = extractTingkatNumber(nama)
  if (targetNum) {
    matched = kelasList.find((k) => extractTingkatNumber(k.tingkat) === targetNum)
    if (!matched) {
      matched = kelasList.find((k) => extractTingkatNumber(k.nama_kelas) === targetNum)
    }
  }
  return matched || null
}
