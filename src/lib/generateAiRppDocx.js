// src/lib/generateAiRppDocx.js
//
// Generator .docx untuk hasil "Rekomendasi RPP (AI)" di ArsipRPP.jsx.
// Berbeda dari generateRppDocx.js (yang butuh data RPP terstruktur lengkap),
// file ini menerima TEKS BEBAS hasil Gemini (lihat api/generate-rpp.js) dan
// mem-parsingnya jadi heading/paragraf/bullet, lalu dirender jadi Word.
//
// Versi ini mendukung 2 "mode" konten dalam satu teks:
//   1. RPP inti  -> 4 bagian bernomor (Tujuan Pembelajaran, Langkah-Langkah,
//      Metode & Media, Penilaian) -> heading ukuran sedang, warna abu-gelap.
//   2. Lampiran   -> diawali baris "LAMPIRAN A: ...", "LAMPIRAN B: ...", dst
//      (lihat prompt di api/generate-rpp.js) -> tiap lampiran dimulai di
//      halaman baru dengan heading lebih besar berwarna amber, supaya
//      terlihat jelas beda dari badan RPP.
//
// Jalan langsung di browser, tidak perlu instalasi apa pun secara lokal.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, LevelFormat,
} from 'docx'

const FONT = 'Calibri'

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align,
    pageBreakBefore: opts.pageBreakBefore,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22, font: FONT })],
  })
}

// Heading bagian RPP inti (1-4)
function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: '1F2937' })],
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
    children: [new TextRun({ text, size: 22, font: FONT })],
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

// Heading bagian RPP inti: hanya dianggap heading kalau judulnya cocok salah
// satu dari 4 bagian yang diminta di prompt (whitelist) — supaya baris
// bernomor lain (mis. soal nomor 1 di LKPD) TIDAK ikut dianggap heading.
const RPP_HEADING_KEYWORDS = [
  'tujuan pembelajaran',
  'langkah-langkah pembelajaran',
  'metode & media pembelajaran',
  'metode dan media pembelajaran',
  'penilaian / asesmen',
  'penilaian/asesmen',
  'penilaian dan asesmen',
]
const NUMBERED_LINE_RE = /^(?:\*\*)?\s*\d+[.).]\s*(.+?)(?:\*\*)?\s*$/
const LAMPIRAN_RE = /^\*{0,2}LAMPIRAN\s+([A-Z])\s*:\s*(.+?)\*{0,2}$/i
const SUB_HEADING_RE = /^(pendahuluan|kegiatan inti|inti|penutup)\s*[:.]?\s*$/i
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
 * elemen docx. Toleran terhadap variasi kecil format — baris yang tidak
 * cocok pola apa pun tetap dirender sebagai paragraf biasa.
 */
function parseAiText(rawText) {
  const lines = (rawText || '').split('\n').map((l) => l.trim())
  const elements = []
  let inLampiran = false

  for (const line of lines) {
    if (!line) continue

    // Lampiran baru (halaman baru + heading besar)
    const lampiranMatch = line.match(LAMPIRAN_RE)
    if (lampiranMatch) {
      inLampiran = true
      elements.push(lampiranHeading(`Lampiran ${lampiranMatch[1].toUpperCase()}: ${stripMd(lampiranMatch[2])}`))
      continue
    }

    // Sub-bagian Pendahuluan/Inti/Penutup (khusus di dalam RPP inti)
    if (!inLampiran && SUB_HEADING_RE.test(stripMd(line))) {
      elements.push(subheading(stripMd(line)))
      continue
    }

    // Baris bernomor: heading RPP inti (whitelist) kalau belum masuk lampiran,
    // selain itu dianggap item bernomor biasa (soal LKPD, kisi-kisi, dst)
    const numberedMatch = line.match(NUMBERED_LINE_RE)
    if (numberedMatch) {
      if (!inLampiran && isRppSectionHeading(numberedMatch[1])) {
        elements.push(heading(stripMd(numberedMatch[1])))
      } else {
        elements.push(p(stripMd(line), { after: 90 }))
      }
      continue
    }

    const bulletMatch = line.match(BULLET_RE)
    if (bulletMatch) {
      elements.push(bullet(stripMd(bulletMatch[1])))
      continue
    }

    elements.push(p(stripMd(line)))
  }

  return elements
}

function buildDocument({ mataPelajaran, kelas, materi, tahunAjaran, semester, resultText }) {
  const bodyElements = parseAiText(resultText)

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
