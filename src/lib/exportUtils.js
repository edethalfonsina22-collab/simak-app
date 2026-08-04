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
 * Ambil gambar dari URL publik lalu ubah jadi base64 (data URL), supaya bisa
 * disisipkan ke PDF via jsPDF addImage. SELALU aman: kalau gagal (logo/ttd
 * belum diupload, bucket tidak public, jaringan bermasalah, CORS, dsb),
 * fungsi ini mengembalikan null — TIDAK PERNAH melempar error ke pemanggilnya.
 * Fungsi ini generik: dipakai untuk logo sekolah maupun tanda tangan kepala
 * sekolah, karena keduanya sama-sama gambar publik di storage Supabase.
 * @param {string} url
 * @returns {Promise<{ base64: string, format: string }|null>}
 */
async function urlKeBase64(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn('Gambar tidak bisa diambil, status:', res.status)
      return null
    }
    const blob = await res.blob()
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('FileReader gagal membaca gambar'))
      reader.readAsDataURL(blob)
    })
    // Deteksi format dari mime type asli (PNG/JPEG), fallback ke PNG
    const format = blob.type && blob.type.includes('jpeg') ? 'JPEG' : 'PNG'
    return { base64, format }
  } catch (e) {
    console.warn('Gambar dilewati (gagal dimuat):', e.message || e)
    return null
  }
}

/**
 * Tempel gambar ke PDF dengan lebar/tinggi maksimum tertentu, TANPA membuat
 * gambar gepeng — rasio asli gambar tetap dipertahankan (di-fit ke dalam
 * kotak maxW x maxH). Kalau gagal (gambar korup, dsb), dilewati saja.
 * @param {jsPDF} doc
 * @param {{base64:string, format:string}} gambar - hasil dari urlKeBase64()
 * @param {number} x
 * @param {number} y
 * @param {number} maxW
 * @param {number} maxH
 */
function tempelGambarProporsional(doc, gambar, x, y, maxW, maxH) {
  try {
    const props = doc.getImageProperties(gambar.base64)
    let w = maxW
    let h = (props.height * w) / props.width
    if (h > maxH) {
      h = maxH
      w = (props.width * h) / props.height
    }
    doc.addImage(gambar.base64, gambar.format, x, y, w, h)
  } catch (e) {
    console.warn('Gambar gagal ditempel ke PDF, dilewati:', e.message || e)
  }
}

/**
 * Ekspor Daftar Hadir bulanan (format kertas absensi: NO/NAMA/JABATAN + kolom
 * tanggal 1..31 + rekap S/I/TK/JML) sebagai PDF landscape, kolom Minggu/libur
 * diwarnai merah, ditutup blok tanda tangan Kepala Sekolah (otomatis memakai
 * gambar tanda tangan elektronik dari Profil Sekolah jika tersedia). Kop
 * surat menampilkan logo sekolah di kiri (jika ada) dan susunan teks dinas/
 * kabupaten/nama sekolah/kecamatan/alamat di tengah.
 *
 * Fungsi ini ASYNC — panggil dengan `await eksporPDFDaftarHadir({...})`
 * dan bungkus pemanggilannya dengan try/catch di sisi komponen supaya
 * error apapun (bukan hanya soal logo/ttd) bisa ditangkap dan ditampilkan
 * ke pengguna, bukan membuat tombol "menggantung" tanpa penjelasan.
 *
 * @param {Object} opsi
 * @param {Object} opsi.profilSekolah - baris dari tabel profil_sekolah (id=1)
 * @param {string} [opsi.logoUrl] - URL publik logo sekolah (opsional)
 * @param {string} [opsi.ttdUrl] - URL publik tanda tangan elektronik kepala sekolah (opsional)
 * @param {string} opsi.bulanLabel - contoh 'Juni'
 * @param {number} opsi.tahun
 * @param {Array} opsi.baris - hasil dari susunDaftarHadir(...).baris
 * @param {number} opsi.totalHari
 * @param {(tanggal:number)=>boolean} opsi.isHariLibur
 * @param {string} opsi.tanggalCetak - contoh '30 Juni 2026'
 * @param {string} opsi.namaFile - tanpa ekstensi
 */
export async function eksporPDFDaftarHadir({
  profilSekolah = {},
  logoUrl = '',
  ttdUrl = '',
  bulanLabel,
  tahun,
  baris,
  totalHari,
  isHariLibur,
  tanggalCetak,
  namaFile,
}) {
  // Validasi input dasar dulu — kalau data penting kosong, gagalkan dengan
  // pesan yang jelas daripada membuat PDF setengah jadi atau error samar.
  if (!Array.isArray(baris)) {
    throw new Error('Data Daftar Hadir belum siap (baris kosong). Coba klik "Tampilkan Laporan" dulu sebelum mengunduh PDF.')
  }
  if (!totalHari || totalHari < 1) {
    throw new Error('Jumlah hari dalam bulan tidak valid.')
  }

  const kodeSel = (status) => {
    if (status === 'sakit') return 'S'
    if (status === 'izin') return 'I'
    if (status === 'alpa') return 'A'
    return ''
  }

  const doc = new jsPDF({ orientation: 'landscape', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()

  const teksTengah = (text, y, size = 10, bold = true) => {
    if (!text) return
    doc.setFontSize(size)
    doc.setFont(undefined, bold ? 'bold' : 'normal')
    doc.text(text, pageWidth / 2, y, { align: 'center' })
  }

  // Logo & tanda tangan diambil paralel — keduanya TIDAK BOLEH menggagalkan
  // keseluruhan PDF kalau gagal dimuat (lihat urlKeBase64).
  const [logo, ttd] = await Promise.all([urlKeBase64(logoUrl), urlKeBase64(ttdUrl)])
  if (logo) {
    tempelGambarProporsional(doc, logo, 14, 6, 22, 22)
  }

  teksTengah(profilSekolah.dinas_pendidikan, 10, 11, true)
  teksTengah(profilSekolah.kabupaten, 15, 10, false)
  teksTengah(profilSekolah.nama_sekolah, 21, 12, true)
  teksTengah(profilSekolah.kecamatan, 26, 10, false)
  teksTengah(profilSekolah.alamat, 31, 8, false)

  doc.setFont(undefined, 'bold')
  doc.setFontSize(9)
  doc.text(`BULAN: ${(bulanLabel || '').toUpperCase()} ${tahun}`, 14, 40)
  doc.setFont(undefined, 'normal')

  const kolomTanggal = Array.from({ length: totalHari }, (_, i) => String(i + 1))
  const head = [['NO', 'NAMA/NIP', 'JABATAN', ...kolomTanggal, 'S', 'I', 'TK', 'JML']]
  const body = baris.map((b) => [
    b.no,
    `${b.nama}\nNIP. ${b.nip}`,
    b.jabatan,
    ...b.statusHarian.map((s, i) => (isHariLibur(i + 1) ? '' : kodeSel(s))),
    b.sakit || '',
    b.izin || '',
    b.tanpaKeterangan || '',
    b.jumlahTidakHadir || '',
  ])

  autoTable(doc, {
    head,
    body,
    startY: 44,
    styles: { fontSize: 6, halign: 'center', cellPadding: 1, valign: 'middle' },
    headStyles: { fillColor: [17, 26, 46], fontSize: 6 },
    columnStyles: {
      0: { cellWidth: 7 },
      1: { cellWidth: 34, halign: 'left' },
      2: { cellWidth: 10 },
    },
    didParseCell: (data) => {
      const colIdx = data.column.index
      if (colIdx >= 3 && colIdx < 3 + totalHari) {
        const tgl = colIdx - 3 + 1
        if (isHariLibur(tgl)) {
          data.cell.styles.fillColor = [225, 29, 46]
          data.cell.styles.textColor = [255, 255, 255]
        }
      }
    },
  })

  const finalY = doc.lastAutoTable.finalY + 15
  const xKanan = pageWidth - 80
  doc.setFontSize(9)
  doc.text(`${profilSekolah.tempat_ttd || '(isi Nama Tempat di Profil Sekolah)'}, ${tanggalCetak}`, xKanan, finalY)
  doc.text('KEPALA SEKOLAH', xKanan, finalY + 5)

  // Tanda tangan elektronik: ditempel di ruang antara "KEPALA SEKOLAH" dan
  // nama kepala sekolah, memakai gambar dari Profil Sekolah kalau ada.
  // Kalau belum diupload, ruang ini tetap kosong seperti semula (tanpa error).
  if (ttd) {
    tempelGambarProporsional(doc, ttd, xKanan, finalY + 7, 40, 16)
  }

  doc.setFont(undefined, 'bold')
  doc.text(profilSekolah.kepala_sekolah || '________________', xKanan, finalY + 25)
  doc.setFont(undefined, 'normal')
  doc.text(`NIP. ${profilSekolah.nip_kepala_sekolah || '-'}`, xKanan, finalY + 30)

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
