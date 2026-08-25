// src/utils/parseNilaiAsesmen.js
//
// Parser untuk file Excel "DAFTAR NILAI KOLEKTIF" / "RAPORT & ASESMEN"
// (format seperti daftar_nilai_asesmen_2026.xlsx) — 1 sheet biasanya berisi
// data 1 peserta didik, lengkap dengan identitas (NAMA PESERTA, NIS, NISN,
// NO PESERTA) dan tabel 9 mapel dengan kolom nilai raport per semester,
// JUMLAH, RATA-RATA, NILAI ASESMEN, dan NILAI (nilai akhir).
//
// Kolom "NILAI" (nilai akhir per mapel) inilah yang disinkronkan ke tabel
// `nilai_ijazah` (dipakai oleh halaman Ijazah.jsx), karena strukturnya
// sudah persis sama: siswa_id, tahun_pelajaran, pend_agama, pkn,
// bhs_indonesia, matematika, ipa, ips, sbk, pjok, mulok.
//
// Dibuat robust terhadap variasi kecil di posisi kolom/baris (merge cell,
// spasi ganda, dsb.) dengan cara mencari LABEL teksnya, bukan mengandalkan
// nomor kolom/baris yang tetap.

// Harus sama persis dengan MAPEL_IJAZAH di src/components/IjazahPrintTemplate.jsx
const MAPEL_ALIASES = [
  { key: 'pend_agama', label: 'Pendidikan Agama Dan Budi Pekerti', aliases: ['pend. agama', 'pend agama', 'pendidikan agama', 'agama'] },
  { key: 'pkn', label: 'PKN', aliases: ['pkn', 'ppkn', 'pendidikan pancasila'] },
  { key: 'bhs_indonesia', label: 'Bahasa Indonesia', aliases: ['bhs indonesia', 'bahasa indonesia', 'b. indonesia'] },
  { key: 'matematika', label: 'Matematika', aliases: ['matematika'] },
  { key: 'ipa', label: 'IPA', aliases: ['ipa', 'ilmu pengetahuan alam'] },
  { key: 'ips', label: 'IPS', aliases: ['ips', 'ilmu pengetahuan sosial'] },
  { key: 'sbk', label: 'Seni Budaya Dan Keterampilan', aliases: ['sbdp', 'sbk', 'seni budaya'] },
  { key: 'pjok', label: 'PJOK', aliases: ['penjaskes', 'pjok', 'penjas', 'pendidikan jasmani'] },
  { key: 'mulok', label: 'Muatan Lokal', aliases: ['mulok', 'muatan lokal'] },
]

function bersihkanSel(v) {
  if (v === null || v === undefined) return ''
  return String(v).replace(/\s+/g, ' ').trim()
}

function normalisasi(v) {
  return bersihkanSel(v).toLowerCase().replace(/[.\-]/g, '').replace(/\s+/g, ' ').trim()
}

// Cari key MAPEL_IJAZAH yang cocok dengan teks nama mata pelajaran di Excel.
function cocokkanMapel(namaMapel) {
  const n = normalisasi(namaMapel)
  if (!n) return null
  for (const m of MAPEL_ALIASES) {
    if (m.aliases.some((a) => n.includes(a))) return m.key
  }
  return null
}

// Ambil nilai (angka/teks) pertama yang tidak kosong setelah kolom `labelIdx`
// pada baris yang sama, sambil membuang prefix ":" (mis. ": 776768768" -> "776768768").
function ambilNilaiSetelahLabel(row, labelIdx) {
  for (let j = labelIdx + 1; j < row.length; j++) {
    const v = row[j]
    if (v === null || v === undefined || v === '') continue
    let s = bersihkanSel(v)
    if (s.startsWith(':')) s = s.slice(1).trim()
    if (s === '') continue
    return s
  }
  return ''
}

// Cari nilai identitas (NIS/NISN/NAMA PESERTA/NO PESERTA) dengan mencocokkan
// label persis (bukan .includes, supaya "NIS" tidak ikut cocok dengan "NISN").
function cariIdentitas(rows, { exact, startsWith }) {
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const cell = row[i]
      if (typeof cell !== 'string') continue
      const label = bersihkanSel(cell).toUpperCase()
      const cocok = exact ? label === exact : label.startsWith(startsWith)
      if (cocok) {
        const nilai = ambilNilaiSetelahLabel(row, i)
        if (nilai) return nilai
      }
    }
  }
  return ''
}

function cariTahunPelajaran(rows) {
  for (const row of rows) {
    for (const cell of row) {
      const s = bersihkanSel(cell)
      const m = s.match(/(\d{4})\s*\/\s*(\d{4})/)
      if (m) return `${m[1]}/${m[2]}`
    }
  }
  return ''
}

// Cari baris header tabel nilai ("NO", "MATA PELAJARAN", "NILAI", dst.)
// lalu kumpulkan baris-baris mapel di bawahnya (dikenali dari kolom "NO"
// yang berisi angka urut 1..9), ambil nilai akhir dari kolom "NILAI".
function cariBarisMapel(rows) {
  let headerIdx = -1
  let noCol = -1
  let mapelCol = -1
  let nilaiCol = -1

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    let foundMapelHeader = false
    for (let c = 0; c < row.length; c++) {
      const label = normalisasi(row[c])
      if (label === 'no') noCol = c
      if (label === 'mata pelajaran') { mapelCol = c; foundMapelHeader = true }
      // "NILAI" harus persis "nilai" — bukan "nilai asesmen" — supaya tidak
      // salah ambil kolom Nilai Asesmen sebagai kolom Nilai (akhir).
      if (label === 'nilai') nilaiCol = c
    }
    if (foundMapelHeader) { headerIdx = r; break }
  }

  if (headerIdx === -1 || mapelCol === -1 || nilaiCol === -1) return []

  const hasil = []
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r]
    const noVal = noCol !== -1 ? row[noCol] : undefined
    if (typeof noVal !== 'number') {
      // Lewati baris sub-header (mis. "IV", "V", "VI" / "I", "II") di awal,
      // tapi berhenti begitu baris data mapel sudah mulai lalu terputus
      // (mis. sudah sampai baris "JUMLAH NILAI").
      if (hasil.length > 0) break
      continue
    }
    const namaMapel = bersihkanSel(row[mapelCol])
    const nilaiAkhir = row[nilaiCol]
    if (!namaMapel) continue
    hasil.push({
      namaMapel,
      key: cocokkanMapel(namaMapel),
      nilai: typeof nilaiAkhir === 'number' ? nilaiAkhir : Number(nilaiAkhir),
    })
  }
  return hasil
}

/**
 * Parse satu sheet (array-of-array hasil XLSX.utils.sheet_to_json(ws,{header:1}))
 * menjadi satu record siap-sync.
 *
 * @param {Array<Array<any>>} rows
 * @returns {{
 *   namaPeserta: string, nis: string, nisn: string, noPeserta: string,
 *   tahunPelajaran: string, nilai: Record<string, number>,
 *   mapelTidakDikenali: string[]
 * }}
 */
export function parseSheetNilaiAsesmen(rows) {
  const namaPeserta = cariIdentitas(rows, { exact: '', startsWith: 'NAMA PESERTA' })
  const nis = cariIdentitas(rows, { exact: 'NIS' })
  const nisn = cariIdentitas(rows, { exact: 'NISN' })
  const noPeserta = cariIdentitas(rows, { exact: '', startsWith: 'NO PESERTA' })
  const tahunPelajaran = cariTahunPelajaran(rows)
  const barisMapel = cariBarisMapel(rows)

  const nilai = {}
  const mapelTidakDikenali = []
  for (const b of barisMapel) {
    if (!Number.isFinite(b.nilai)) continue
    if (b.key) {
      nilai[b.key] = Math.round(b.nilai * 100) / 100
    } else {
      mapelTidakDikenali.push(b.namaMapel)
    }
  }

  return { namaPeserta, nis, nisn, noPeserta, tahunPelajaran, nilai, mapelTidakDikenali }
}

/**
 * Parse satu workbook SheetJS (bisa berisi banyak sheet, 1 sheet = 1 siswa)
 * lalu cocokkan tiap hasilnya ke `siswaList` (dari tabel `siswa`) berdasarkan
 * NIS atau NISN — sama seperti pola pencocokan impor massal di Siswa.jsx.
 *
 * @param {import('xlsx').WorkBook} workbook
 * @param {Array<{id:string, nis:string, nisn:string, nama_lengkap:string}>} siswaList
 * @param {typeof import('xlsx').utils} XLSXUtils - kirim XLSX.utils dari pemanggil
 */
export function parseWorkbookNilaiAsesmen(workbook, siswaList, XLSXUtils) {
  const hasil = []
  for (const sheetName of workbook.SheetNames) {
    const ws = workbook.Sheets[sheetName]
    const rows = XLSXUtils.sheet_to_json(ws, { header: 1, defval: null, raw: true })
    // Lewati sheet kosong / bukan sheet data nilai (tidak ada header "MATA PELAJARAN")
    const punyaMapel = rows.some((row) => row.some((c) => normalisasi(c) === 'mata pelajaran'))
    if (!punyaMapel) continue

    const parsed = parseSheetNilaiAsesmen(rows)

    const siswaCocok = siswaList.find(
      (s) =>
        (parsed.nis && s.nis && String(s.nis).trim() === String(parsed.nis).trim()) ||
        (parsed.nisn && s.nisn && String(s.nisn).trim() === String(parsed.nisn).trim())
    )

    hasil.push({
      sheetName,
      ...parsed,
      siswaId: siswaCocok ? siswaCocok.id : null,
      siswaNama: siswaCocok ? siswaCocok.nama_lengkap : null,
    })
  }
  return hasil
}

export { MAPEL_ALIASES }
