// src/lib/generateAiRppDocx.js
//
// Generator .docx khusus untuk hasil "Rekomendasi RPP (AI)" di ArsipRPP.jsx.
// Berbeda dari generateRppDocx.js (yang butuh data RPP terstruktur lengkap:
// kompetensiInti, kompetensiDasar, dst), file ini menerima TEKS BEBAS hasil
// Gemini (lihat api/generate-rpp.js) dan mem-parsingnya jadi heading/paragraf/
// bullet secara sederhana, lalu dirender jadi Word dengan gaya yang senada
// (font Calibri, heading abu-gelap) dengan dokumen RPP lain di app.
//
// Jalan langsung di browser, sama seperti generateRppDocx.js — tidak perlu
// instalasi apa pun secara lokal, cukup push ke GitHub dan Vercel yang build.

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, LevelFormat,
} from 'docx'

const FONT = 'Calibri'

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after ?? 120 },
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, size: opts.size ?? 22, font: FONT })],
  })
}

function heading(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: FONT, color: '1F2937' })],
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

// Baris yang dianggap heading utama, misal: "1. Tujuan Pembelajaran",
// "1) Tujuan Pembelajaran", atau "**Tujuan Pembelajaran**"
const MAIN_HEADING_RE = /^(?:\*\*)?\s*\d+[.).]\s*(.+?)(?:\*\*)?\s*$/
// Baris sub-bagian di dalam Langkah-Langkah Pembelajaran
const SUB_HEADING_RE = /^(pendahuluan|kegiatan inti|inti|penutup)\s*[:.]?\s*$/i
// Baris bullet: diawali "-", "*", atau "•"
const BULLET_RE = /^[-*•]\s+(.+)$/

function stripMd(text) {
  return text.replace(/\*\*/g, '').trim()
}

/**
 * Parsing teks bebas hasil AI jadi array elemen docx (heading/sub/bullet/paragraf).
 * Format teks yang diharapkan (sesuai prompt di api/generate-rpp.js):
 *   1. Tujuan Pembelajaran
 *   2. Langkah-Langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
 *   3. Metode & Media Pembelajaran
 *   4. Penilaian / Asesmen
 * Tapi parser ini sengaja dibuat toleran — kalau AI sedikit mengubah format,
 * baris yang tidak cocok pola apa pun tetap dirender sebagai paragraf biasa.
 */
function parseAiText(rawText) {
  const lines = (rawText || '').split('\n').map((l) => l.trim())
  const elements = []

  for (const line of lines) {
    if (!line) continue

    const mainMatch = line.match(MAIN_HEADING_RE)
    if (mainMatch) {
      elements.push(heading(stripMd(mainMatch[1])))
      continue
    }

    if (SUB_HEADING_RE.test(stripMd(line))) {
      elements.push(subheading(stripMd(line)))
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
                text: 'Catatan: draf ini dihasilkan otomatis oleh AI dan sebaiknya diperiksa/disesuaikan kembali oleh guru sebelum digunakan.',
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
