// npm install jspdf html2canvas docx file-saver

import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { Document, Packer, Paragraph, TextRun, AlignmentType } from "docx";
import { saveAs } from "file-saver";

/**
 * Render elemen HTML (ref ke SuratKeteranganPrintTemplate) menjadi PDF
 * dan langsung diunduh ke browser. Mendukung multi-halaman kalau isi surat panjang.
 */
export async function exportSuratToPDF(elementRef, filename) {
  const element = elementRef.current;
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(`${filename}.pdf`);
}

/**
 * Generate file .docx dari data surat (record tabel surat_keterangan)
 * dan data profil sekolah (kop surat + penandatangan), lalu diunduh.
 */
export async function exportSuratToDocx(surat, sekolah) {
  const FONT = "Times New Roman";

  const p = (text, opts = {}) =>
    new Paragraph({
      alignment: opts.align || AlignmentType.JUSTIFIED,
      spacing: { after: opts.after ?? 200, line: 276 },
      children: [
        new TextRun({ text, bold: !!opts.bold, size: 24, font: FONT }),
      ],
    });

  const isiParagraf = surat.isi
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => p(line));

  const tanggal = new Date(surat.tanggal_surat).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, bottom: 1134, left: 1701, right: 1134 },
          },
        },
        children: [
          p(sekolah?.nama_dinas || "PEMERINTAH DAERAH", {
            bold: true,
            align: AlignmentType.CENTER,
            after: 0,
          }),
          p(sekolah?.nama_sekolah || "NAMA SEKOLAH", {
            bold: true,
            align: AlignmentType.CENTER,
            after: 0,
          }),
          p(sekolah?.alamat || "", {
            align: AlignmentType.CENTER,
            after: 300,
          }),
          p(surat.judul || "SURAT KETERANGAN", {
            bold: true,
            align: AlignmentType.CENTER,
            after: 0,
          }),
          p(`Nomor: ${surat.nomor_surat}`, {
            align: AlignmentType.CENTER,
            after: 300,
          }),
          ...isiParagraf,
          p(`${sekolah?.kota || ""}, ${tanggal}`, {
            align: AlignmentType.RIGHT,
            after: 0,
          }),
          p("Kepala Sekolah", { align: AlignmentType.RIGHT, after: 1200 }),
          p(sekolah?.nama_kepala_sekolah || "", {
            bold: true,
            align: AlignmentType.RIGHT,
            after: 0,
          }),
          p(`NIP. ${sekolah?.nip_kepala_sekolah || "-"}`, {
            align: AlignmentType.RIGHT,
            after: 0,
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${surat.nomor_surat.replace(/\//g, "-")}.docx`);
}
