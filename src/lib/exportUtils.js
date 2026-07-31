import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Ekspor array of object ke file Excel (.xlsx)
 * @param {Array<Object>} rows - data, tiap object jadi satu baris
 * @param {string} namaFile - tanpa ekstensi, contoh "data-siswa"
 * @param {string} namaSheet - nama sheet, contoh "Siswa"
 */
export function eksporExcel(rows, namaFile, namaSheet = 'Data') {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, namaSheet)
  XLSX.writeFile(wb, `${namaFile}.xlsx`)
}

/**
 * Ekspor BEBERAPA tabel sekaligus ke satu file Excel (.xlsx),
 * satu sheet per tabel. Dipakai untuk fitur Backup Data.
 * @param {Array<{ nama: string, rows: Array<Object> }>} daftarTabel
 * @param {string} namaFile - tanpa ekstensi
 */
export function eksporExcelMultiSheet(daftarTabel, namaFile) {
  const wb = XLSX.utils.book_new()
  for (const { nama, rows } of daftarTabel) {
    // Sheet Excel maksimal 31 karakter untuk nama sheet
    const namaSheet = nama.slice(0, 31)
    const dataAman = rows && rows.length > 0 ? rows : [{ info: 'Tidak ada data' }]
    const ws = XLSX.utils.json_to_sheet(dataAman)
    XLSX.utils.book_append_sheet(wb, ws, namaSheet)
  }
  XLSX.writeFile(wb, `${namaFile}.xlsx`)
}

/**
 * Ekspor tabel ke file PDF.
 * @param {string} judul - judul di atas tabel, misal "Rekap Presensi - Kelas 5A"
 * @param {string[]} kolom - header kolom, misal ['Nama', 'NIS', 'Status']
 * @param {Array<Array>} baris - array of array, tiap array = satu baris
 * @param {string} namaFile - tanpa ekstensi
 * @param {string} [subjudul] - teks kecil di bawah judul, misal tanggal/periode
 */
export function eksporPDF(judul, kolom, baris, namaFile, subjudul = '') {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(judul, 14, 16)
  if (subjudul) {
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(subjudul, 14, 22)
  }
  autoTable(doc, {
    head: [kolom],
    body: baris,
    startY: subjudul ? 27 : 22,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [17, 26, 46] }, // ink-950
  })
  doc.save(`${namaFile}.pdf`)
}

/**
 * Unduh data mentah (array of object per tabel) sebagai satu file JSON.
 * Berguna sebagai backup teknis yang bisa dipulihkan kembali nanti.
 * @param {Object} objekData - { namaTabel: [...rows], ... }
 * @param {string} namaFile - tanpa ekstensi
 */
export function unduhJSON(objekData, namaFile) {
  const teks = JSON.stringify(objekData, null, 2)
  const blob = new Blob([teks], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${namaFile}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
