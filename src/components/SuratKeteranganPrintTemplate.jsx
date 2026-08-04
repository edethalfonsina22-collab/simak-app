import React from "react";

// forwardRef supaya elemen ini bisa di-capture oleh html2canvas di exportSuratToPDF
const SuratKeteranganPrintTemplate = React.forwardRef(function SuratKeteranganPrintTemplate(
  { surat, sekolah },
  ref
) {
  const tanggal = surat?.tanggal_surat
    ? new Date(surat.tanggal_surat).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <div
      ref={ref}
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 18mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: "13pt",
        lineHeight: 1.5,
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          textAlign: "center",
          borderBottom: "2px solid #000",
          paddingBottom: 8,
          marginBottom: 24,
        }}
      >
        <p style={{ fontWeight: "bold", margin: 0 }}>
          {sekolah?.nama_dinas || "PEMERINTAH DAERAH"}
        </p>
        <p style={{ fontWeight: "bold", margin: 0, fontSize: "14pt" }}>
          {sekolah?.nama_sekolah || "NAMA SEKOLAH"}
        </p>
        <p style={{ fontStyle: "italic", fontSize: "10pt", margin: 0 }}>
          {sekolah?.alamat}
        </p>
      </div>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
          {surat?.judul || "SURAT KETERANGAN"}
        </p>
        <p style={{ margin: 0 }}>Nomor: {surat?.nomor_surat}</p>
      </div>

      <div style={{ textAlign: "justify", whiteSpace: "pre-line" }}>
        {surat?.isi}
      </div>

      <div style={{ textAlign: "right", marginTop: 48 }}>
        <p style={{ margin: 0 }}>
          {sekolah?.kota || "Warialau"}, {tanggal}
        </p>
        <p style={{ margin: 0 }}>Kepala Sekolah</p>
        <div style={{ height: 70 }} />
        <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
          {sekolah?.nama_kepala_sekolah}
        </p>
        <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah || "-"}</p>
      </div>
    </div>
  );
});

export default SuratKeteranganPrintTemplate;
