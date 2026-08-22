import React from "react";
import { MAPEL_IJAZAH, jumlahNilai } from "./IjazahPrintTemplate";

const SklPrintTemplate = React.forwardRef(function SklPrintTemplate(
  { siswa, nilai, sekolah, skl, tahunPelajaran },
  ref
) {
  const groupA = MAPEL_IJAZAH.filter((m) => m.grup === "A");
  const groupB = MAPEL_IJAZAH.filter((m) => m.grup === "B");
  const fmt = (n) => (n === undefined || n === null || n === "" || isNaN(n) ? "-" : Number(n).toFixed(2));
  const tanggalTerbit = skl?.tanggal_terbit
    ? new Date(skl.tanggal_terbit).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "";

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        width: "210mm",
        minHeight: "297mm",
        padding: "20mm 18mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: "12.5pt",
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
          borderBottom: "3px double #000",
          paddingBottom: 8,
          marginBottom: 20,
        }}
      >
        {sekolah?.logo_url && (
          <img src={sekolah.logo_url} alt="Logo" style={{ width: 64, height: 64, objectFit: "contain" }} />
        )}
        <div style={{ flex: 1, textAlign: "center" }}>
          {sekolah?.dinas_pendidikan && <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.dinas_pendidikan}</p>}
          {sekolah?.kabupaten && (
            <p style={{ fontWeight: "bold", margin: 0 }}>PEMERINTAH KABUPATEN {sekolah.kabupaten}</p>
          )}
          <p style={{ fontWeight: "bold", margin: 0, fontSize: "14pt" }}>{sekolah?.nama_sekolah || "NAMA SEKOLAH"}</p>
          <p style={{ fontStyle: "italic", fontSize: "10pt", margin: 0 }}>
            {sekolah?.kecamatan ? `Kecamatan ${sekolah.kecamatan} — ` : ""}
            {sekolah?.alamat}
          </p>
        </div>
      </div>

      <p style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", margin: "0 0 2px 0" }}>
        SURAT KETERANGAN LULUS
      </p>
      <p style={{ textAlign: "center", margin: "0 0 18px 0" }}>Nomor: {skl?.nomor_skl || "-"}</p>

      <p style={{ textAlign: "justify" }}>
        Yang bertanda tangan di bawah ini Kepala {sekolah?.nama_sekolah}
        {sekolah?.kecamatan ? `, Kecamatan ${sekolah.kecamatan}` : ""}
        {sekolah?.kabupaten ? `, Kabupaten ${sekolah.kabupaten}` : ""}
        {sekolah?.provinsi ? `, Provinsi ${sekolah.provinsi}` : ""}, menerangkan bahwa:
      </p>

      <table style={{ borderCollapse: "collapse", margin: "10px 0 14px 0" }}>
        <tbody>
          <Baris label="Nama" nilai={siswa?.nama_lengkap} />
          <Baris label="Tempat, Tanggal Lahir" nilai={`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`} />
          <Baris label="NIS" nilai={siswa?.nis} />
          <Baris label="NISN" nilai={siswa?.nisn} />
          <Baris label="Nomor Ujian" nilai={siswa?.nomor_ujian} />
        </tbody>
      </table>

      <p style={{ textAlign: "justify" }}>
        Bahwa siswa/siswi tersebut di atas benar-benar murid Kelas VI {sekolah?.nama_sekolah} dan telah mengikuti
        Asesmen Sekolah Tahun Pelajaran {tahunPelajaran} dan dinyatakan <strong>BERHASIL</strong> dengan nilai
        sebagai berikut:
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12pt", margin: "10px 0 16px 0" }}>
        <thead>
          <tr>
            <th style={th}>No</th>
            <th style={{ ...th, textAlign: "left" }}>Mata Pelajaran</th>
            <th style={th}>Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdGroup} colSpan={3}>I. Ujian Sekolah</td>
          </tr>
          {groupA.map((m, i) => (
            <tr key={m.key}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
              <td style={td}>{fmt(nilai?.[m.key])}</td>
            </tr>
          ))}
          <tr>
            <td style={tdGroup} colSpan={3}>II. Nilai Praktik</td>
          </tr>
          {groupB.map((m, i) => (
            <tr key={m.key}>
              <td style={td}>{groupA.length + i + 1}</td>
              <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
              <td style={td}>{fmt(nilai?.[m.key])}</td>
            </tr>
          ))}
          <tr>
            <td style={tdGroup} colSpan={2}>Jumlah</td>
            <td style={tdGroup}>{fmt(jumlahNilai(nilai))}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ textAlign: "justify" }}>
        Demikian Surat Keterangan Lulus ini dibuat untuk digunakan seperlunya, sambil menantikan tibanya ijazah
        yang bersangkutan.
      </p>

      <div style={{ textAlign: "right", marginTop: 30 }}>
        <p style={{ margin: 0 }}>
          {sekolah?.tempat_ttd || sekolah?.kecamatan || ""}, {tanggalTerbit}
        </p>
        <p style={{ margin: 0 }}>Kepala Sekolah</p>
        {sekolah?.ttd_url ? (
          <img src={sekolah.ttd_url} alt="TTD" style={{ height: 60, margin: "6px 0" }} />
        ) : (
          <div style={{ height: 60 }} />
        )}
        <p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{sekolah?.kepala_sekolah}</p>
        <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah}</p>
      </div>
    </div>
  );
});

function Baris({ label, nilai }) {
  return (
    <tr>
      <td style={{ padding: "1px 0", width: 190 }}>{label}</td>
      <td style={{ padding: "1px 6px", width: 10 }}>:</td>
      <td style={{ padding: "1px 0" }}>{nilai || "-"}</td>
    </tr>
  );
}

function formatTanggal(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

const th = { border: "1px solid #000", padding: "5px 7px", background: "#f0f0f0", fontWeight: "bold" };
const td = { border: "1px solid #000", padding: "4px 7px", textAlign: "center" };
const tdGroup = { border: "1px solid #000", padding: "4px 7px", fontWeight: "bold", background: "#fafafa" };

export default SklPrintTemplate;
