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
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "2px solid #000",
          paddingBottom: 8,
          marginBottom: 24,
        }}
      >
        {sekolah?.logo_url && (
          <img
            src={sekolah.logo_url}
            alt="Logo"
            style={{ width: 64, height: 64, objectFit: "contain" }}
          />
        )}
        <div style={{ flex: 1, textAlign: "center" }}>
          {sekolah?.dinas_pendidikan && (
            <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.dinas_pendidikan}</p>
          )}
          {sekolah?.kabupaten && (
            <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.kabupaten}</p>
          )}
          <p style={{ fontWeight: "bold", margin: 0, fontSize: "14pt" }}>
            {sekolah?.nama_sekolah || "NAMA SEKOLAH"}
          </p>
          <p style={{ fontStyle: "italic", fontSize: "10pt", margin: 0 }}>
            {sekolah?.alamat}
          </p>
        </div>
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
          {sekolah?.tempat_ttd || sekolah?.kecamatan || "Warial"}, {tanggal}
        </p>
        <p style={{ margin: 0 }}>Kepala Sekolah</p>

        {sekolah?.ttd_url ? (
          <img
            src={sekolah.ttd_url}
            alt="Tanda tangan"
            style={{ height: 70, objectFit: "contain", margin: "0 auto" }}
          />
        ) : (
          <div style={{ height: 70 }} />
        )}

        <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
          {sekolah?.kepala_sekolah}
        </p>
        <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah || "-"}</p>
      </div>
    </div>
  );
});

export default SuratKeteranganPrintTemplate;
