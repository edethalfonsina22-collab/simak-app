import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

/**
 * Parser PDF "Kertas Kerja RKAS/ARKAS" -> array baris { arkas, tanggal }
 * dengan bentuk output yang SAMA seperti hasil impor CSV/Excel lama, supaya
 * ArkasImportModal.jsx tidak perlu mengubah logika import ke Supabase.
 *
 * Cara kerja singkat:
 * 1. Ambil semua item teks per halaman lewat pdfjs, gabungkan jadi baris
 *    berdasarkan posisi Y (item yang Y-nya berdekatan dianggap satu baris).
 * 2. Satu baris data ARKAS bisa "pecah" jadi beberapa baris teks kalau
 *    uraian kegiatannya panjang (nama kegiatan otomatis wrap di PDF).
 *    Karena itu, baris teks digabung terus (mulai dari token no urut yang
 *    berurutan) sampai 11 token terakhir semuanya berbentuk angka rupiah
 *    (jumlah + 10 kolom BOSP Reguler/Daerah/Afirmasi-Kinerja/SiLPA/Lainnya
 *    x Operasi/Modal) - itu tandanya satu baris ARKAS sudah lengkap.
 * 3. Dari sisa teks di depan angka-angka itu, dipisahkan mana kode rekening
 *    (format panjang mis. "5.1.02.01.01.0012"), kode kegiatan (format
 *    "03.03.02."), nomor item ("001."), dan sisanya jadi uraian.
 * 4. Baris tanpa nomor item = baris rekap/header (bukan is_item). Baris
 *    dengan kode rekening + nomor item = baris item asli (is_item = true).
 *
 * PDF tidak punya kolom "tanggal" per baris, jadi semua baris memakai
 * tanggal 1 Januari tahun anggaran YANG TERTULIS DI PDF (bukan tahun
 * berjalan aplikasi) - diambil dari teks "TAHUN ANGGARAN : ####" di
 * halaman pertama dokumen.
 */

const NUMERIC_FIELDS = [
  'jumlah',
  'bosp_reguler_operasi', 'bosp_reguler_modal',
  'bosp_daerah_operasi', 'bosp_daerah_modal',
  'afirmasi_kinerja_operasi', 'afirmasi_kinerja_modal',
  'silpa_operasi', 'silpa_modal',
  'bosp_lainnya_operasi', 'bosp_lainnya_modal',
]

const AMOUNT_RE = /^\d{1,3}(\.\d{3})*$/
const KODE_KEGIATAN_RE = /^\d{2}(\.\d{2})*\.$/
const ITEM_NO_RE = /^\d{3}\.$/

function isKodeRekening(tok) {
  if (!/^[\d.]+$/.test(tok) || tok.endsWith('.')) return false
  const parts = tok.split('.')
  if (parts.length < 5) return false
  return parts[parts.length - 1].length === 4
}

function toAmount(tok) {
  const n = parseInt(String(tok).replace(/\./g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

async function extractLines(file) {
  const buf = await file.arrayBuffer()
  const pdf = await getDocument({ data: buf }).promise
  const allLines = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items = content.items
      .filter((it) => it.str && it.str.trim() !== '')
      .map((it) => ({ text: it.str.trim(), x: it.transform[4], y: it.transform[5] }))

    items.sort((a, b) => b.y - a.y || a.x - b.x)

    let currentY = null
    let currentLine = []
    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= 2) {
        currentLine.push(it)
        currentY = currentY === null ? it.y : currentY
      } else {
        allLines.push(currentLine.map((i) => i.text).join(' '))
        currentLine = [it]
        currentY = it.y
      }
    }
    if (currentLine.length) allLines.push(currentLine.map((i) => i.text).join(' '))
  }

  return allLines
}

function parseRowTokens(tokens) {
  const noUrut = parseInt(tokens[0], 10)
  const prefixTokens = tokens.slice(1, tokens.length - 11)
  const amountTokens = tokens.slice(tokens.length - 11)

  let idx = 0
  let kodeRekening = null
  let kodeKegiatan = null
  let itemNo = null

  if (prefixTokens[idx] && isKodeRekening(prefixTokens[idx])) {
    kodeRekening = prefixTokens[idx]
    idx++
  }
  if (prefixTokens[idx] && KODE_KEGIATAN_RE.test(prefixTokens[idx])) {
    kodeKegiatan = prefixTokens[idx]
    idx++
  }
  if (prefixTokens[idx] && ITEM_NO_RE.test(prefixTokens[idx])) {
    itemNo = prefixTokens[idx]
    idx++
  }
  const uraian = prefixTokens.slice(idx).join(' ').trim()

  let level = 1
  let isItem = false
  if (itemNo) {
    level = 5
    isItem = true
  } else if (kodeRekening) {
    level = 4
  } else if (kodeKegiatan) {
    level = kodeKegiatan.split('.').filter(Boolean).length
  }

  const arkas = {
    no_urut: noUrut,
    level,
    kode_kegiatan: kodeKegiatan,
    kode_rekening: kodeRekening,
    item_no: itemNo,
    uraian,
    is_item: isItem,
    status: 'draft',
  }
  NUMERIC_FIELDS.forEach((field, i) => {
    arkas[field] = toAmount(amountTokens[i])
  })

  return arkas
}

/**
 * @param {File} file - file PDF Kertas Kerja RKAS/ARKAS
 * @param {string} tahunAnggaranFallback - dipakai HANYA kalau teks
 *   "TAHUN ANGGARAN : ####" tidak ketemu di PDF
 * @param {string|null} npsnFallback
 * @returns {Promise<{ rows: Array<{arkas:object, tanggal:string}>, tahunAnggaran: string, npsn: string|null }>}
 */
export async function parseArkasPdf(file, tahunAnggaranFallback, npsnFallback) {
  const rawLines = await extractLines(file)
  const cleanLines = rawLines.map((l) => l.replace(/\bDraft\b/g, ' ').trim()).filter(Boolean)
  const fullText = cleanLines.join('\n')

  const tahunMatch = fullText.match(/TAHUN\s+ANGGARAN\s*:\s*(\d{4})/i)
  const npsnMatch = fullText.match(/NPSN\s*:\s*(\d+)/i)
  const tahunAnggaran = tahunMatch ? tahunMatch[1] : tahunAnggaranFallback
  const npsn = npsnMatch ? npsnMatch[1] : (npsnFallback || null)

  const rows = []
  let buffer = []
  let lastNoUrut = 0

  for (const line of cleanLines) {
    const tokens = line.split(/\s+/)

    if (buffer.length === 0) {
      const first = tokens[0]
      if (/^\d+$/.test(first) && parseInt(first, 10) === lastNoUrut + 1) {
        buffer = tokens
      } else {
        continue // baris kop surat / header tabel / total / tanda tangan, lewati
      }
    } else {
      buffer = buffer.concat(tokens)
    }

    const tail = buffer.slice(buffer.length - 11)
    if (tail.length === 11 && tail.every((t) => AMOUNT_RE.test(t))) {
      const arkas = parseRowTokens(buffer)
      rows.push({
        arkas: { ...arkas, tahun_anggaran: tahunAnggaran, npsn },
        tanggal: `${tahunAnggaran}-01-01`,
      })
      lastNoUrut = arkas.no_urut
      buffer = []
    }
  }

  if (rows.length === 0) {
    throw new Error('Tidak ada baris ARKAS yang terbaca dari PDF ini. Pastikan filenya adalah Kertas Kerja RKAS/ARKAS asli (bukan hasil scan/foto).')
  }

  return { rows, tahunAnggaran, npsn }
}
