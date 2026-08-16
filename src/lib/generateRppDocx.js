// src/lib/generateRppDocx.js
//
// Generator RPP (.docx) yang jalan LANGSUNG DI BROWSER — sama seperti
// generateLembarPersetujuan() yang sudah ada di RPP.jsx (pakai pdf-lib).
// Di sini kita pakai package "docx" untuk membuat file Word.
//
// Cara ini TIDAK butuh kamu install/jalankan apa pun secara lokal:
// cukup pastikan "docx" ada di package.json (lihat catatan di bawah),
// push ke GitHub, dan Vercel yang akan install + build otomatis.

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

function bullet(text) {
  return new Paragraph({
    numbering: { reference: 'bullet-list', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: FONT })],
  })
}

function numbered(text) {
  return new Paragraph({
    numbering: { reference: 'num-tujuan', level: 0 },
    spacing: { after: 80 },
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
  const lines = Array.isArray(text) ? text : String(text).split('\n')
  return new TableCell({
    borders: cellBorder,
    width: { size: opts.width ?? 3000, type: WidthType.DXA },
    shading: opts.shade ? { type: ShadingType.CLEAR, fill: 'EEF2F7' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: lines.map(
      (line, idx) =>
        new Paragraph({
          spacing: { after: idx === lines.length - 1 ? 0 : 40 },
          children: [new TextRun({ text: line, bold: opts.bold, size: 22, font: FONT })],
        })
    ),
  })
}

function identityRow(label, value) {
  return new TableRow({
    children: [idCell(label, { width: 2600, bold: true, shade: true }), idCell(':', { width: 260 }), idCell(value, { width: 6100 })],
  })
}

function penilaianTable(rowsData) {
  const header = new TableRow({
    tableHeader: true,
    children: ['No', 'Aspek Penilaian', 'Teknik', 'Instrumen', 'Waktu Penilaian'].map((t, i) =>
      idCell(t, { width: i === 0 ? 600 : i === 1 ? 2600 : i === 4 ? 1800 : 2000, bold: true, shade: true })
    ),
  })
  const rows = rowsData.map(
    (r, i) =>
      new TableRow({
        children: [
          idCell(String(i + 1), { width: 600 }),
          idCell(r.aspek, { width: 2600 }),
          idCell(r.teknik, { width: 2000 }),
          idCell(r.instrumen, { width: 2000 }),
          idCell(r.waktu, { width: 1800 }),
        ],
      })
  )
  return new Table({ width: { size: 9000, type: WidthType.DXA }, columnWidths: [600, 2600, 2000, 2000, 1800], rows: [header, ...rows] })
}

function buildDocument(data) {
  const kdRows = [
    new TableRow({
      children: [idCell('Kompetensi Dasar', { bold: true, shade: true, width: 4480 }), idCell('Indikator Pencapaian Kompetensi', { bold: true, shade: true, width: 4480 })],
    }),
    ...data.kompetensiDasar.map(
      (item) => new TableRow({ children: [idCell(item.kd, { width: 4480 }), idCell(item.indikator, { width: 4480 })] })
    ),
  ]

  const langkahBlocks = [
    { key: 'pendahuluan', label: '1. Kegiatan Pendahuluan' },
    { key: 'inti', label: '2. Kegiatan Inti' },
    { key: 'penutup', label: '3. Kegiatan Penutup' },
  ].flatMap(({ key, label }) => {
    const block = data.langkah[key]
    return [p(`${label} (${block.waktu})`, { bold: true, after: 80 }), ...block.kegiatan.map((k) => bullet(k))]
  })

  return new Document({
    numbering: {
      config: [
        { reference: 'bullet-list', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] },
        { reference: 'num-tujuan', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400, hanging: 260 } } } }] },
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 } } },
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
            children: [new TextRun({ text: `${data.mataPelajaran} — Kelas ${data.kelas}`, size: 22, font: FONT, color: '4B5563' })],
          }),

          heading('A. Identitas'),
          new Table({
            width: { size: 8960, type: WidthType.DXA },
            columnWidths: [2600, 260, 6100],
            rows: [
              identityRow('Satuan Pendidikan', data.satuanPendidikan),
              identityRow('Mata Pelajaran', data.mataPelajaran),
              identityRow('Kelas / Semester', `${data.kelas} / ${data.semester}`),
              identityRow('Tahun Ajaran', data.tahunAjaran),
              identityRow('Materi Pokok', data.materiPokok),
              identityRow('Alokasi Waktu', data.alokasiWaktu),
            ],
          }),
          p('', { after: 120 }),

          heading('B. Kompetensi Inti (KI)'),
          ...data.kompetensiInti.map((ki) => p(ki)),

          heading('C. Kompetensi Dasar (KD) dan Indikator Pencapaian Kompetensi (IPK)'),
          new Table({ width: { size: 8960, type: WidthType.DXA }, columnWidths: [4480, 4480], rows: kdRows }),
          p('', { after: 120 }),

          heading('D. Tujuan Pembelajaran'),
          ...data.tujuanPembelajaran.map((t) => numbered(t)),

          heading('E. Materi Pembelajaran'),
          ...data.materiPembelajaran.map((m) => bullet(m)),

          heading('F. Pendekatan, Model, dan Metode Pembelajaran'),
          bullet(`Pendekatan: ${data.pendekatanModelMetode.pendekatan}`),
          bullet(`Model: ${data.pendekatanModelMetode.model}`),
          bullet(`Metode: ${data.pendekatanModelMetode.metode}`),

          heading('G. Media, Alat, dan Sumber Belajar'),
          bullet(`Media: ${data.media.join(', ')}`),
          bullet(`Alat: ${data.alat.join(', ')}`),
          bullet(`Sumber Belajar: ${data.sumberBelajar.join(', ')}`),

          heading('H. Langkah-Langkah Pembelajaran'),
          ...langkahBlocks,

          heading('I. Penilaian Pembelajaran'),
          penilaianTable(data.penilaian),
          p('', { after: 200 }),

          heading('J. Lampiran'),
          ...data.lampiran.map((l) => bullet(l)),

          p('', { after: 300 }),
          new Table({
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
                  new TableCell({ width: { size: 4480, type: WidthType.DXA }, children: [p('Mengetahui,'), p('Kepala Sekolah'), p('', { after: 700 }), p(`( ${data.namaKepalaSekolah || '.................................'} )`)] }),
                  new TableCell({ width: { size: 4480, type: WidthType.DXA }, children: [p(data.kotaTanggal), p(`Guru ${data.mataPelajaran} Kelas ${data.kelas}`), p('', { after: 700 }), p(`( ${data.namaGuru || '.................................'} )`)] }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  })
}

/**
 * Bikin file .docx dari data RPP, langsung download di browser.
 * Dipanggil dari onClick tombol, contoh:
 *   downloadRppDocx(template)
 */
export async function downloadRppDocx(data, filename) {
  const doc = buildDocument(data)
  const blob = await Packer.toBlob(doc)
  const name =
    filename ||
    `RPP_${data.mataPelajaran}_Kelas${data.kelas}_${data.materiPokok}.docx`
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '')

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Sama seperti di atas, tapi mengembalikan File — berguna kalau mau
 * langsung diupload ke Supabase Storage tanpa lewat proses download dulu.
 */
export async function buildRppDocxFile(data, filename) {
  const doc = buildDocument(data)
  const blob = await Packer.toBlob(doc)
  const name =
    filename ||
    `RPP_${data.mataPelajaran}_Kelas${data.kelas}_${data.materiPokok}.docx`
      .replace(/\s+/g, '_')
      .replace(/[^\w.-]/g, '')
  return new File([blob], name, { type: blob.type })
}
