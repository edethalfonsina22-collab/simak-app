// Util bersama untuk mencocokkan nama kelas dari berbagai sumber (template impor biasa,
// unduhan Dapodik, dll) ke data kelas yang sudah ada di sistem (tabel `kelas`).
// Dipakai oleh Siswa.jsx (mapRow untuk "Impor Massal") dan DapodikImportModal.jsx,
// supaya logika pencocokannya konsisten di satu tempat saja.

// Ambil angka tingkat kelas dari string apapun formatnya
// (mis. "Kelas 1", "1", "1A", "Kls. 1", "Rombel 3") -> "1", "1", "1", "1", "3"
export function extractTingkatNumber(str) {
  const match = String(str || '').trim().match(/\d+/)
  return match ? match[0] : null
}

// Cocokkan nama kelas dari file impor dengan salah satu kelas di kelasList.
// 1) Coba exact match dulu (case-insensitive, sudah di-trim).
// 2) Kalau gagal, fallback ke pencocokan berdasarkan angka tingkat saja.
//    Ini AMAN dipakai selama kelas di sekolah cuma satu per tingkat (1-6),
//    tanpa rombel paralel (1A/1B dst). Kalau nanti ada rombel paralel,
//    fallback ini perlu diperketat lagi (misal dengan huruf rombel juga).
export function matchKelasByName(kelasList, namaKelas) {
  const nama = String(namaKelas || '').trim()
  if (!nama || !Array.isArray(kelasList)) return null

  let matched = kelasList.find(
    (k) => k.nama_kelas.trim().toLowerCase() === nama.toLowerCase()
  )

  if (!matched) {
    const targetNum = extractTingkatNumber(nama)
    if (targetNum) {
      matched = kelasList.find((k) => extractTingkatNumber(k.nama_kelas) === targetNum)
    }
  }

  return matched || null
}
