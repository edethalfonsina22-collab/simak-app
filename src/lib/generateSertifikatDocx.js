// src/lib/generateSertifikatDocx.js
//
// Generator .docx untuk Sertifikat / Piagam Penghargaan (guru maupun siswa).
// Layout landscape satu halaman dengan bingkai dekoratif, nama penerima besar
// di tengah, kalimat isi (bisa hasil AI dari /api/generate-sertifikat atau
// ditulis manual), dan blok tanda tangan Kepala Sekolah.
//
// Jalan langsung di browser, tidak perlu instalasi apa pun secara lokal.

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType,
} from 'docx'

const FONT_TITLE = 'Georgia'
const FONT_BODY = 'Calibri'

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
  tempatTtd,
  tanggal,
}) {
  const judulBesar = jenis === 'sertifikat' ? 'SERTIFIKAT' : 'PIAGAM PENGHARGAAN'

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 16838, height: 11906 }, // A4 landscape
            margin: { top: 900, bottom: 900, left: 1000, right: 1000 },
          },
        },
        children: [
          // Bingkai dekoratif ganda — dua garis border bersarang sebagai
          // pengganti frame gambar, dibuat dari border tabel 1-sel penuh halaman.
          new Table({
            width: { size: 14838, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.DOUBLE, size: 18, color: '1e3a5f' },
              bottom: { style: BorderStyle.DOUBLE, size: 18, color: '1e3a5f' },
              left: { style: BorderStyle.DOUBLE, size: 18, color: '1e3a5f' },
              right: { style: BorderStyle.DOUBLE, size: 18, color: '1e3a5f' },
            },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    margins: { top: 500, bottom: 500, left: 700, right: 700 },
                    children: [
                      centered(
                        [new TextRun({ text: (namaSekolah || 'SEKOLAH').toUpperCase(), bold: true, size: 22, font: FONT_BODY, color: '1e3a5f' })],
                        { after: 400 }
                      ),

                      centered(
                        [new TextRun({ text: judulBesar, bold: true, size: 60, font: FONT_TITLE, color: '1e3a5f' })],
                        { after: 60 }
                      ),
                      centered(
                        [new TextRun({ text: jenis === 'sertifikat' ? 'Diberikan kepada' : 'Dengan bangga diberikan kepada', italics: true, size: 22, font: FONT_BODY, color: '4B5563' })],
                        { after: 260 }
                      ),

                      centered(
                        [new TextRun({ text: namaPenerima || '-', bold: true, size: 44, font: FONT_TITLE, color: 'B45309' })],
                        { after: 60 }
                      ),
                      centered(
                        [new TextRun({ text: '________________________________________', size: 22, font: FONT_BODY, color: '9CA3AF' })],
                        { after: 300 }
                      ),

                      centered(
                        [new TextRun({ text: deskripsi || '', size: 24, font: FONT_BODY, color: '1F2937' })],
                        { after: 500 }
                      ),

                      centered(
                        [new TextRun({ text: buildKotaTanggal(tempatTtd, tanggal), size: 20, font: FONT_BODY, color: '4B5563' })],
                        { after: 700 }
                      ),

                      centered(
                        [new TextRun({ text: 'Kepala Sekolah', size: 20, font: FONT_BODY })],
                        { after: 700 }
                      ),
                      centered(
                        [new TextRun({ text: `( ${namaKepalaSekolah || '.................................'} )`, bold: true, size: 22, font: FONT_BODY })],
                        { after: 0 }
                      ),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
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
