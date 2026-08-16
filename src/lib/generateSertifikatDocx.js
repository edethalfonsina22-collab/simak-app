// src/lib/generateSertifikatDocx.js
//
// Generator .docx untuk Sertifikat / Piagam Penghargaan (guru maupun siswa).
// Layout landscape satu halaman dengan bingkai ganda (navy luar + emas dalam,
// dengan jarak di antara keduanya supaya terlihat sebagai dua frame terpisah),
// nama penerima besar di tengah bergaya kaligrafi, kalimat isi (bisa hasil AI
// dari /api/generate-sertifikat atau ditulis manual), dan blok tanda tangan
// Kepala Sekolah lengkap dengan NIP (opsional).
//
// Jalan langsung di browser, tidak perlu instalasi apa pun secara lokal.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType,
} from 'docx'

const FONT_TITLE = 'Georgia'
const FONT_SCRIPT = 'Georgia' // dipakai untuk nama penerima, italic besar
const FONT_BODY = 'Calibri'

const NAVY = '1e3a5f'
const GOLD = 'B8860B'
const GOLD_LIGHT = 'D4AF37'
const INK = '1F2937'
const MUTED = '4B5563'

function centered(children, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: opts.after ?? 120, before: opts.before ?? 0 },
    children,
  })
}

function buildKotaTanggal(tempatTtd, tanggal) {
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  return tempatTtd ? `${tempatTtd}, ${tgl}` : tgl
}

function buildDocument({
  jenis, // 'sertifikat' | 'penghargaan'
  namaPenerima,
  namaSekolah,
  deskripsi, // kalimat isi ("atas ..." / "sebagai ...")
  namaKepalaSekolah,
  nipKepalaSekolah,
  tempatTtd,
  tanggal,
}) {
  const judulBesar = jenis === 'sertifikat' ? 'SERTIFIKAT' : 'PIAGAM PENGHARGAAN'

  // Isi utama sertifikat — akan dibungkus dua lapis bingkai (emas di dalam,
  // navy di luar) supaya terasa seperti frame ganda, bukan garis tunggal.
  const isiKonten = [
    // Ornamen kecil di atas nama sekolah, sebagai aksen dekoratif ringan.
    centered(
      [new TextRun({ text: '❦', size: 28, font: FONT_TITLE, color: GOLD })],
      { after: 120 }
    ),
    centered(
      [new TextRun({ text: (namaSekolah || 'SEKOLAH').toUpperCase(), bold: true, size: 24, font: FONT_BODY, color: NAVY })],
      { after: 40 }
    ),
    // Garis pendek dekoratif di bawah nama sekolah — pemisah antara header
    // sekolah dan judul besar.
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 340 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD_LIGHT, space: 4 } },
      children: [new TextRun({ text: '        ', size: 4 })],
    }),

    centered(
      [new TextRun({ text: judulBesar, bold: true, size: 68, font: FONT_TITLE, color: NAVY })],
      { after: 40 }
    ),
    centered(
      [new TextRun({ text: jenis === 'sertifikat' ? 'Diberikan kepada' : 'Dengan bangga diberikan kepada', italics: true, size: 24, font: FONT_BODY, color: MUTED })],
      { after: 320 }
    ),

    // Nama penerima bergaya "kaligrafi" — miring, tebal, warna emas — dengan
    // garis panjang emas di bawahnya sebagai penekanan.
    centered(
      [new TextRun({ text: namaPenerima || '-', bold: true, italics: true, size: 52, font: FONT_SCRIPT, color: GOLD })],
      { after: 40 }
    ),
    centered(
      [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 20, font: FONT_BODY, color: GOLD_LIGHT })],
      { after: 340 }
    ),

    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 520 },
      children: [new TextRun({ text: deskripsi || '', size: 25, font: FONT_BODY, color: INK })],
    }),

    centered(
      [new TextRun({ text: buildKotaTanggal(tempatTtd, tanggal), size: 20, font: FONT_BODY, color: MUTED })],
      { after: 700 }
    ),

    centered(
      [new TextRun({ text: 'Kepala Sekolah', size: 20, font: FONT_BODY, color: INK })],
      { after: 700 }
    ),
    centered(
      [new TextRun({ text: `( ${namaKepalaSekolah || '.................................'} )`, bold: true, size: 22, font: FONT_BODY, color: INK })],
      { after: nipKepalaSekolah ? 40 : 0 }
    ),
    ...(nipKepalaSekolah
      ? [centered([new TextRun({ text: `NIP. ${nipKepalaSekolah}`, size: 19, font: FONT_BODY, color: MUTED })], { after: 0 })]
      : []),
  ]

  // Bingkai EMAS (dalam) — bungkus isiKonten.
  const bingkaiEmas = new Table({
    width: { size: 14300, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 8, color: GOLD },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD },
      left: { style: BorderStyle.SINGLE, size: 8, color: GOLD },
      right: { style: BorderStyle.SINGLE, size: 8, color: GOLD },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 420, bottom: 420, left: 600, right: 600 },
            children: isiKonten,
          }),
        ],
      }),
    ],
  })

  // Bingkai NAVY (luar) — bungkus bingkaiEmas, dengan margin di antara
  // keduanya supaya terlihat sebagai dua garis frame terpisah (frame ganda
  // beneran), bukan menempel jadi satu garis tebal.
  const bingkaiLuar = new Table({
    width: { size: 15238, type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.DOUBLE, size: 20, color: NAVY },
      bottom: { style: BorderStyle.DOUBLE, size: 20, color: NAVY },
      left: { style: BorderStyle.DOUBLE, size: 20, color: NAVY },
      right: { style: BorderStyle.DOUBLE, size: 20, color: NAVY },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            margins: { top: 220, bottom: 220, left: 220, right: 220 },
            // Table di dalam TableCell: docx mendukung nested table langsung
            // sebagai salah satu children dari TableCell.
            children: [bingkaiEmas],
          }),
        ],
      }),
    ],
  })

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 16838, height: 11906 }, // A4 landscape
            margin: { top: 700, bottom: 700, left: 800, right: 800 },
          },
        },
        children: [bingkaiLuar],
      },
    ],
  })
}

async function makeBlob(data) {
  const doc = buildDocument(data)
  return Packer.toBlob(doc)
}

/** Bikin file .docx dan langsung download di browser. */
export async function downloadSertifikatDocx(data, filename) {
  const blob = await makeBlob(data)
  const name = filename || defaultFileName(data)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

/** Sama seperti di atas, tapi mengembalikan File — dipakai untuk langsung diupload ke Storage. */
export async function buildSertifikatDocxFile(data, filename) {
  const blob = await makeBlob(data)
  const name = filename || defaultFileName(data)
  return new File([blob], name, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

function defaultFileName({ jenis, namaPenerima }) {
  const prefix = jenis === 'sertifikat' ? 'Sertifikat' : 'Piagam'
  return `${prefix}_${namaPenerima}.docx`.replace(/\s+/g, '_').replace(/[^\w.-]/g, '')
}
