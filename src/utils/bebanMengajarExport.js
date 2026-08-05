import html2canvas from "html2canvas";
import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalMergeType,
  BorderStyle,
} from "docx";
import { supabase } from "../lib/supabaseClient";

function jumlahJamMengajar(row) {
  return (
    Number(row.kelas_1 || 0) +
    Number(row.kelas_2 || 0) +
    Number(row.kelas_3 || 0) +
    Number(row.kelas_4 || 0) +
    Number(row.kelas_5 || 0) +
    Number(row.kelas_6 || 0) +
    Number(row.mengajar_sekolah_lain || 0)
  );
}

function bebanKeseluruhan(row) {
  return jumlahJamMengajar(row) + Number(row.tugas_tambahan_jam || 0);
}

function formatTanggalIndo(tgl) {
  if (!tgl) return "-";
  return new Date(tgl).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Bangun public URL dari path storage kalau field *_url belum ada di objek sekolah
function getPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("profil-sekolah").getPublicUrl(path);
  return data?.publicUrl || null;
}

// Ambil gambar (logo/ttd) sebagai ArrayBuffer untuk dipakai ImageRun di docx.
// Kalau gagal (network/CORS/bucket privat), kembalikan null supaya DOCX tetap
// bisa ter-generate tanpa gambar, tidak melempar error ke user.
async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn("Gagal memuat gambar untuk DOCX:", err);
    return null;
  }
}

// ================= PDF (rasterisasi tiap halaman via html2canvas, lalu print) =================
export async function exportBebanMengajarToPDF(printRef, filenameBase) {
  const node = printRef?.current;
  if (!node) return;

  const pages = Array.from(node.children);
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup diblokir browser. Izinkan popup untuk mengunduh PDF.");
    return;
  }
  win.document.write(
    `<html><head><title>${filenameBase || "sk-beban-mengajar"}</title>
      <style>
        @page { margin: 0; }
        body { margin: 0; }
        img { display: block; width: 100%; page-break-after: always; }
        img:last-child { page-break-after: auto; }
      </style>
    </head><body></body></html>`
  );
  win.document.close();

  for (const page of pages) {
    // eslint-disable-next-line no-await-in-loop
    const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const img = win.document.createElement("img");
    img.src = canvas.toDataURL("image/png");
    win.document.body.appendChild(img);
  }

  win.focus();
  setTimeout(() => win.print(), 500);
}

// ================= DOCX (pakai library "docx") =================
function cell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    rowSpan: opts.rowSpan,
    columnSpan: opts.columnSpan,
    verticalMerge: opts.verticalMerge,
    verticalAlign: "center",
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.CENTER,
        children: [new TextRun({ text: String(text ?? ""), bold: opts.bold, size: 16 })],
      }),
    ],
  });
}

export async function exportBebanMengajarToDocx(sk, sekolah) {
  const rows = sk?.rows || [];
  const namaSekolah = sekolah?.nama_sekolah || "SD NEGERI ...";
  const namaKepsek = sekolah?.kepala_sekolah || "____________________";
  const nipKepsek = sekolah?.nip_kepala_sekolah || "-";

  // Resolve URL logo & ttd (fallback dari path storage), lalu ambil bytes-nya
  const logoUrl = sekolah?.logo_url || getPublicUrl(sekolah?.logo_path);
  const ttdUrl = sekolah?.ttd_url || getPublicUrl(sekolah?.ttd_kepala_sekolah_path);

  const [logoBuffer, ttdBuffer] = await Promise.all([
    fetchImageBuffer(logoUrl),
    fetchImageBuffer(ttdUrl),
  ]);

  // --- Halaman 1: naskah SK ---
  const naskahParagraphs = [
    ...(logoBuffer
      ? [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                data: logoBuffer,
                transformation: { width: 60, height: 60 },
              }),
            ],
          }),
        ]
      : []),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "DINAS PENDIDIKAN DAN KEBUDAYAAN", bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: namaSekolah.toUpperCase(), bold: true, size: 28 })] }),
    new Paragraph({ text: "" }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `KEPUTUSAN KEPALA ${namaSekolah.toUpperCase()}`, bold: true, underline: {} })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NOMOR : ${sk?.nomor_sk || "-"}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "TENTANG", bold: true })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "PEMBAGIAN TUGAS GURU DALAM PROSES BELAJAR MENGAJAR / WALI KELAS DAN STRUKTUR ORGANISASI " + namaSekolah.toUpperCase(),
          bold: true,
        }),
      ],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `SEMESTER : ${sk?.semester || "-"}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `TAHUN PELAJARAN : ${sk?.tahun_ajaran || "-"}` })] }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: `Kepala ${namaSekolah},` }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: "Menimbang\t: ", bold: true }),
        new TextRun({
          text: `Demi kelancaran program belajar mengajar, pengelolaan kelas dan pengendalian teknis pada ${namaSekolah}, perlu ditetapkan pembagian tugas guru secara jelas dan tepat dengan keputusan Kepala ${namaSekolah}.`,
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({
      children: [
        new TextRun({ text: "Mengingat\t: ", bold: true }),
        new TextRun({
          text: "1. Undang-Undang No 20 Tahun 2003 tentang Sistem Pendidikan Nasional; 2. Peraturan Pemerintah No 28 Tahun 1993 tentang Pendidikan Dasar; 3. Surat Keputusan bersama Menteri Pendidikan dan Kebudayaan dan Kepala Badan Administrasi Kepegawaian Negara Nomor: 0433/1993 dan Nomor 25 Tahun 1990.",
        }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "MEMUTUSKAN", bold: true })] }),
    new Paragraph({ text: "" }),
    new Paragraph({ children: [new TextRun({ text: "Menetapkan\t:", bold: true })] }),
    new Paragraph({
      children: [
        new TextRun({ text: "Pertama\t\t: ", bold: true }),
        new TextRun({ text: `Pembagian Tugas Guru dalam proses belajar mengajar Semester ${sk?.semester || "-"} Tahun Pelajaran ${sk?.tahun_ajaran || "-"} seperti dalam lampiran keputusan ini.` }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Kedua\t\t: ", bold: true }),
        new TextRun({ text: "Masing-masing guru melaporkan pelaksanaan tugasnya secara tertulis dan berkala kepada Kepala Sekolah." }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Ketiga\t\t: ", bold: true }),
        new TextRun({ text: "Segala biaya yang timbul akibat pelaksanaan tugas ini dibebankan pada anggaran yang sesuai." }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Keempat\t\t: ", bold: true }),
        new TextRun({ text: "Apabila terdapat kekeliruan dalam keputusan ini akan diadakan perbaikan sebagaimana mestinya." }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({ text: "Kelima\t\t: ", bold: true }),
        new TextRun({ text: "Keputusan ini mulai berlaku sejak tanggal ditetapkan." }),
      ],
    }),
    new Paragraph({ text: "" }),
    new Paragraph({ text: "" }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Ditetapkan di : ${sk?.tempat_ditetapkan || "-"}` })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `Pada Tanggal : ${formatTanggalIndo(sk?.tanggal_sk)}` })],
    }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Kepala Sekolah" })] }),
    ...(ttdBuffer
      ? [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new ImageRun({
                data: ttdBuffer,
                transformation: { width: 130, height: 70 },
              }),
            ],
          }),
        ]
      : [new Paragraph({ text: "" }), new Paragraph({ text: "" }), new Paragraph({ text: "" })]),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: namaKepsek, bold: true, underline: {} })],
    }),
    new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `NIP. ${nipKepsek}` })] }),
  ];

  // --- Halaman 2: lampiran tabel ---
  const headerRow1 = new TableRow({
    tableHeader: true,
    children: [
      cell("No", { rowSpan: 3 }),
      cell("Nama/NIP/Pangkat/Gol", { rowSpan: 3 }),
      cell("Status Guru", { rowSpan: 3 }),
      cell("Jabatan", { rowSpan: 3 }),
      cell("Rincian Beban Mengajar per Minggu", { columnSpan: 7 }),
      cell("Jumlah Jam Mengajar", { rowSpan: 3 }),
      cell("Tugas Tambahan", { columnSpan: 2, rowSpan: 2 }),
      cell("Beban Keseluruhan", { rowSpan: 3 }),
      cell("Keterangan", { rowSpan: 3 }),
    ],
  });
  const headerRow2 = new TableRow({
    tableHeader: true,
    children: [
      cell("Rombongan Belajar", { columnSpan: 6 }),
      cell("Sklh Lain", { rowSpan: 2 }),
    ],
  });
  const headerRow3 = new TableRow({
    tableHeader: true,
    children: [
      cell("I"), cell("II"), cell("III"), cell("IV"), cell("V"), cell("VI"),
      cell("Uraian"), cell("Jam"),
    ],
  });

  const dataRows = rows.map((r, idx) =>
    new TableRow({
      children: [
        cell(idx + 1),
        cell(`${r.nama_lengkap}\nNIP. ${r.nip || "-"}\n${r.pangkat_golongan || "-"}`, { align: AlignmentType.LEFT }),
        cell(r.status_kepegawaian || "-"),
        cell(r.jabatan || "-"),
        cell(r.kelas_1 || "-"),
        cell(r.kelas_2 || "-"),
        cell(r.kelas_3 || "-"),
        cell(r.kelas_4 || "-"),
        cell(r.kelas_5 || "-"),
        cell(r.kelas_6 || "-"),
        cell(r.mengajar_sekolah_lain || "-"),
        cell(jumlahJamMengajar(r), { bold: true }),
        cell(r.tugas_tambahan || "-"),
        cell(r.tugas_tambahan_jam || "-"),
        cell(bebanKeseluruhan(r), { bold: true }),
        cell(r.keterangan || ""),
      ],
    })
  );

  const totalRow = new TableRow({
    children: [
      cell("JUMLAH JAM MENGAJAR", { columnSpan: 4, bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_1 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_2 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_3 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_4 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_5 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.kelas_6 || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + Number(r.mengajar_sekolah_lain || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + jumlahJamMengajar(r), 0), { bold: true }),
      cell("", {}),
      cell(rows.reduce((a, r) => a + Number(r.tugas_tambahan_jam || 0), 0), { bold: true }),
      cell(rows.reduce((a, r) => a + bebanKeseluruhan(r), 0), { bold: true }),
      cell("", {}),
    ],
  });

  const lampiranTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow1, headerRow2, headerRow3, ...dataRows, totalRow],
  });

  const lampiranParagraphs = [
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `LAMPIRAN : SURAT KEPUTUSAN KEPALA ${namaSekolah.toUpperCase()}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `NOMOR : ${sk?.nomor_sk || "-"}` })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `TANGGAL : ${formatTanggalIndo(sk?.tanggal_sk)}` })] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `PEMBAGIAN BEBAN MENGAJAR GURU SEMESTER ${sk?.semester || "-"} TAHUN PELAJARAN ${sk?.tahun_ajaran || "-"}`, bold: true })],
    }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: namaSekolah.toUpperCase(), bold: true })] }),
    new Paragraph({ text: "" }),
  ];

  const doc = new Document({
    sections: [
      { properties: {}, children: naskahParagraphs },
      {
        properties: { page: { size: { orientation: "landscape" } } },
        children: [...lampiranParagraphs, lampiranTable],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `SK-Beban-Mengajar-${(sk?.nomor_sk || "draft").replace(/\//g, "-")}.docx`);
}
