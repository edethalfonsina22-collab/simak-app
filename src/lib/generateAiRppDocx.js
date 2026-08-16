// src/lib/generateAiRppDocx.js
//
// Generator .docx untuk hasil "Rekomendasi RPP (AI)" di ArsipRPP.jsx.
// Berbeda dari generateRppDocx.js (yang butuh data RPP terstruktur lengkap),
// file ini menerima TEKS BEBAS hasil Gemini (lihat api/generate-rpp.js) dan
// mem-parsingnya jadi heading/paragraf/bullet, lalu dirender jadi Word.
//
// Versi ini mendukung 2 "mode" konten dalam satu teks:
//   1. RPP inti  -> 4 bagian (Tujuan Pembelajaran, Langkah-Langkah,
//      Metode & Media, Penilaian) -> heading ukuran sedang, warna abu-gelap.
//   2. Lampiran   -> diawali baris "LAMPIRAN A: ...", "LAMPIRAN B: ...", dst
//      -> tiap lampiran dimulai di halaman baru dengan heading lebih besar
//      berwarna amber, supaya terlihat jelas beda dari badan RPP.
//
// PERBAIKAN vs versi sebelumnya:
//   - Deteksi heading bagian RPP inti sekarang toleran terhadap berbagai
//     format penomoran AI: "1. Judul", "1) Judul", "A. Judul", judul
//     ALL CAPS berdiri sendiri, atau judul dibungkus **tebal** sendirian
//     di satu baris — tidak hanya format "angka titik" seperti sebelumnya.
//   - Teks **tebal** di TENGAH kalimat sekarang benar-benar dirender bold
//     di Word (sebelumnya tanda ** hanya dihapus, jadi bold hilang).
//   - Baris kosong berturut-turut tidak lagi menghasilkan tumpukan
//     paragraf tak rapi.
//   - Blok tanda tangan Guru & Kepala Sekolah dipertegas dengan garis
//     bawah (bukan cuma tanda kurung titik-titik) supaya jelas terlihat
//     sebagai tempat tanda tangan.
//
// Jalan langsung di browser, tidak perlu instalasi apa pun secara lokal.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, LevelFormat,
} from 'docx'

const FONT = 'Calibri'

// --- Render teks dengan dukungan **bold** inline ---
// Memecah "kalimat **penting** biasa" jadi beberapa TextRun, sebagian bold.
function textRuns(text, baseOpts = {}) {
  const parts = text.split(/(\*\*.+?\*\*)/g).filter((s) => s.length > 0)
  if (parts.length === 0) {
    return [new TextRun({ text: '', size: baseOpts.size ?? 22, font: FONT })]
  }
  return parts.map((part) => {
    const isBold = /^\*\*.+\*\*$/.test(part)
    const clean = isBold ? part.slice(2, -2) : part
    return new TextRun({
      text: clean,
      bold: isBold || baseOpts.bold,
      italics: baseOpts.italics,
      size: baseOpts.size ?? 22,
      font: FONT,
      color: baseOpts.color,
    })
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align,
    pageBreakBefore: opts.pageBreakBefore,
    children: textRuns(text, opts),
  })
}

// Heading bagian RPP inti (1-4)
function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text: stripMd(text), bold: true, size: 24, font: FONT, color: '1F2937' })],
  })
}

// Heading Lampiran — halaman baru, warna beda supaya jelas terpisah dari RPP inti
function lampiranHeading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 0, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'D97706', space: 8 } },
    children: [new TextRun({ text, bold: true, size: 28, font: FONT, color: 'B45309' })],
  })
}

function subheading(text) {
  return new Paragraph({
    spacing: { before: 140, after: 80 },
    children: [new TextRun({ text, bold: true, size: 22, font: FONT, color: '374151' })],
  })
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'ai-bullet-list', level: 0 },
    spacing: { after: 60 },
    children: textRuns(text),
  })
}

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
  left: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
  right: { style: BorderStyle.SINGLE, size: 4, color: '9CA3AF' },
}

function idCell(text, opts = {}) {
  return new TableCell({
    borders: cellBorder,
    width: { size: opts.width ?? 3000, type: WidthType.DXA },
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: 'EEF2F7' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: opts.bold, size: 22, font: FONT })] })],
  })
}

function identityRow(label, value) {
  return new TableRow({
    children: [
      idCell(label, { width: 2600, bold: true, shade: true }),
      idCell(':', { width: 260 }),
      idCell(value || '-', { width: 6100 }),
    ],
  })
}

// --- Pola pengenalan baris ---

// Kata kunci 4 bagian inti RPP — dicek dengan "includes", jadi cocok untuk
// format penomoran apa pun (angka, huruf, atau tanpa nomor sama sekali).
const RPP_HEADING_KEYWORDS = [
  'tujuan pembelajaran',
  'langkah-langkah pembelajaran',
  'langkah pembelajaran',
  'metode & media pembelajaran',
  'metode dan media pembelajaran',
  'media pembelajaran',
  'penilaian / asesmen',
  'penilaian/asesmen',
  'penilaian dan asesmen',
  'asesmen',
]

// Baris "1. teks", "1) teks", "A. teks", "a) teks" — prefix penomoran apa pun.
const NUMBERED_LINE_RE = /^(?:\*\*)?\s*(?:\d+|[A-Za-z])[.)]\s*(.+?)(?:\*\*)?\s*$/
// Judul berdiri sendiri: ALL CAPS (min 3 huruf) atau dibungkus **tebal** penuh.
const STANDALONE_HEADING_RE = /^(?:\*\*(.+)\*\*|([A-ZÀ-Ý][A-ZÀ-Ý\s/&-]{2,}))$/
const LAMPIRAN_RE = /^\*{0,2}LAMPIRAN\s+([A-Z])\s*:\s*(.+?)\*{0,2}$/i
const SUB_HEADING_RE = /^(?:\*\*)?(pendahuluan|kegiatan inti|inti|penutup)(?:\*\*)?\s*[:.]?\s*$/i
const BULLET_RE = /^[-*•]\s+(.+)$/

function stripMd(text) {
  return text.replace(/\*\*/g, '').trim()
}

function isRppSectionHeading(title) {
  const t = stripMd(title).toLowerCase()
  return RPP_HEADING_KEYWORDS.some((k) => t.includes(k))
}

/**
 * Parsing teks bebas hasil AI (RPP inti + opsional Lampiran) jadi array
 * elemen docx. Toleran terhadap variasi format — baris yang tidak cocok
 * pola apa pun tetap dirender sebagai paragraf biasa (dengan bold inline
 * tetap dihormati).
 */
function parseAiText(rawText) {
  const lines = (rawText || '').split('\n').map((l) => l.trim())
  const elements = []
  let inLampiran = false
  let lampiranStartIndex = null

  for (const line of lines) {
    if (!line) continue

    // Lampiran baru (halaman baru + heading besar)
    const lampiranMatch = line.match(LAMPIRAN_RE)
    if (lampiranMatch) {
      if (lampiranStartIndex === null) lampiranStartIndex = elements.length
      inLampiran = true
      elements.push(lampiranHeading(`Lampiran ${lampiranMatch[1].toUpperCase()}: ${stripMd(lampiranMatch[2])}`))
      continue
    }

    // Sub-bagian Pendahuluan/Inti/Penutup (khusus di dalam RPP inti)
    if (!inLampiran && SUB_HEADING_RE.test(line)) {
      elements.push(subheading(stripMd(line)))
      continue
    }

    // Baris bernomor (angka ATAU huruf): heading RPP inti kalau cocok
    // whitelist & belum masuk lampiran, selain itu item bernomor biasa.
    const numberedMatch = line.match(NUMBERED_LINE_RE)
    if (numberedMatch) {
      if (!inLampiran && isRppSectionHeading(numberedMatch[1])) {
        elements.push(heading(numberedMatch[1]))
      } else {
        elements.push(p(stripMd(line), { after: 90 }))
      }
      continue
    }

    // Judul berdiri sendiri tanpa nomor (ALL CAPS atau **tebal** penuh satu baris)
    const standaloneMatch = line.match(STANDALONE_HEADING_RE)
    if (standaloneMatch) {
      const title = standaloneMatch[1] || standaloneMatch[2]
      if (!inLampiran && isRppSectionHeading(title)) {
        elements.push(heading(title))
        continue
      }
    }

    const bulletMatch = line.match(BULLET_RE)
    if (bulletMatch) {
      elements.push(bullet(bulletMatch[1]))
      continue
    }

    elements.push(p(line))
  }

  return { elements, lampiranStartIndex: lampiranStartIndex ?? elements.length }
}

// Blok tanda tangan Guru & Kepala Sekolah — ditempatkan tepat setelah RPP
// inti (sebelum Lampiran, kalau ada). Garis bawah dipakai supaya area
// tanda tangan terlihat jelas walau nama belum diisi.
function signatureLine(name) {
  return p(name ? `( ${name} )` : '_________________________', { bold: !!name })
}

function buildSignatureBlock({ mataPelajaran, kelas, namaGuru, namaKepalaSekolah, kotaTanggal }) {
  return new Table({
    width: { size: 8960, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
    },
    columnWidths: [4480, 4480],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4480, type: WidthType.DXA },
            children: [
              p('Mengetahui,'),
              p('Kepala Sekolah'),
              p('', { after: 700 }),
              signatureLine(namaKepalaSekolah),
            ],
          }),
          new TableCell({
            width: { size: 4480, type: WidthType.DXA },
            children: [
              p(kotaTanggal || ''),
              p(`Guru ${mataPelajaran || ''} Kelas ${kelas || ''}`),
              p('', { after: 700 }),
              signatureLine(namaGuru),
            ],
          }),
        ],
      }),
    ],
  })
}

function buildDocument({ mataPelajaran, kelas, materi, tahunAjaran, semester, resultText, namaGuru, namaKepalaSekolah, kotaTanggal }) {
  const { elements: parsedElements, lampiranStartIndex } = parseAiText(resultText)
  const coreElements = parsedElements.slice(0, lampiranStartIndex)
  const lampiranElements = parsedElements.slice(lampiranStartIndex)
  const bodyElements = [
    ...coreElements,
    p('', { after: 240 }),
    buildSignatureBlock({ mataPelajaran, kelas, namaGuru, namaKepalaSekolah, kotaTanggal }),
    ...lampiranElements,
  ]

  return new Document({
    numbering: {
      config: [
        {
          reference: 'ai-bullet-list',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '•',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 400, hanging: 260 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
            children: [new TextRun({ text: 'RENCANA PELAKSANAAN PEMBELAJARAN (RPP)', bold: true, size: 30, font: FONT })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 260 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '1F2937', space: 8 } },
            children: [
              new TextRun({
                text: `Draf disusun dengan bantuan AI — ${mataPelajaran} · Kelas ${kelas}`,
                size: 22,
                font: FONT,
                color: '4B5563',
              }),
            ],
          }),

          heading('Identitas'),
          new Table({
            width: { size: 8960, type: WidthType.DXA },
            columnWidths: [2600, 260, 6100],
            rows: [
              identityRow('Mata Pelajaran', mataPelajaran),
              identityRow('Kelas / Semester', `${kelas || '-'} / ${semester || '-'}`),
              identityRow('Tahun Ajaran', tahunAjaran || '-'),
              identityRow('Materi Pokok', materi),
            ],
          }),
          p('', { after: 200 }),

          ...bodyElements,

          p('', { after: 260 }),
          new Paragraph({
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: 'Catatan: draf ini (termasuk lampiran) dihasilkan otomatis oleh AI dan sebaiknya diperiksa/disesuaikan kembali oleh guru sebelum digunakan.',
                italics: true,
                size: 18,
                font: FONT,
                color: '6B7280',
              }),
            ],
          }),
        ],
      },
    ],
  })
}

/**
 * Bikin file .docx dari hasil draf AI, langsung download di browser.
 */
export async function downloadAiRppDocx(data, filename) {
  const doc = buildDocument(data)
  const blob = await Packer.toBlob(doc)
  const name = filename || defaultFileName(data)

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Sama seperti di atas, tapi mengembalikan File — dipakai supaya file bisa
 * langsung "dititipkan" ke input file form upload tanpa perlu didownload
 * manual dulu oleh user.
 */
export async function buildAiRppDocxFile(data, filename) {
  const doc = buildDocument(data)
  const blob = await Packer.toBlob(doc)
  const name = filename || defaultFileName(data)
  return new File([blob], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function defaultFileName({ mataPelajaran, kelas, materi }) {
  return `RPP_AI_${mataPelajaran}_Kelas${kelas}_${materi}.docx`
    .replace(/\s+/g, '_')
    .replace(/[^\w.-]/g, '')
}
