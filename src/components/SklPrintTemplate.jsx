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
        padding: "6mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        // PEMADATAN: font & line-height sedikit diturunkan (12.5pt/1.5
        // -> 11.5pt/1.35) supaya total tinggi konten muat di 1 halaman.
        fontSize: "11.5pt",
        lineHeight: 1.35,
        color: "#000",
        boxSizing: "border-box",
        display: "flex",
      }}
    >
      {/* Bingkai garis ganda mengelilingi halaman */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          border: "4px double #142c6e",
          // PEMADATAN: padding dalam bingkai diperkecil dari 12mm/14mm
          // menjadi 8mm/10mm.
          padding: "8mm 10mm",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            borderBottom: "3px double #000",
            paddingBottom: 6,
            marginBottom: 12,
          }}
        >
          {sekolah?.logo_url && (
            <img src={sekolah.logo_url} alt="Logo" style={{ width: 56, height: 56, objectFit: "contain" }} />
          )}
          <div style={{ flex: 1, textAlign: "center" }}>
            {/* PERBAIKAN TEKS DOBEL: field `dinas_pendidikan` dan
                `kabupaten` di Profil Sekolah SUDAH berisi teks lengkap
                (mis. "PEMERINTAH KABUPATEN KEPULAUAN ARU"), jadi tidak
                perlu ditambah prefiks apa pun lagi di sini — sebelumnya
                kode menambahkan "PEMERINTAH KABUPATEN " di depan
                {sekolah.kabupaten}, sehingga jadi dobel. */}
            {sekolah?.dinas_pendidikan && <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.dinas_pendidikan}</p>}
            {sekolah?.kabupaten && <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.kabupaten}</p>}
            <p style={{ fontWeight: "bold", margin: 0, fontSize: "13pt" }}>{sekolah?.nama_sekolah || "NAMA SEKOLAH"}</p>
            {/* Sama halnya, field `kecamatan` sudah berisi teks lengkap
                (mis. "KECAMATAN ARU UTARA TIMUR BATULEY"), jadi prefiks
                "Kecamatan " dihapus juga. */}
            <p style={{ fontStyle: "italic", fontSize: "9pt", margin: 0 }}>
              {sekolah?.kecamatan ? `${sekolah.kecamatan} — ` : ""}
              {sekolah?.alamat}
            </p>
          </div>
        </div>

        <p style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", margin: "0 0 2px 0" }}>
          SURAT KETERANGAN LULUS
        </p>
        <p style={{ textAlign: "center", margin: "0 0 10px 0" }}>Nomor: {skl?.nomor_skl || "-"}</p>

        {/* PERBAIKAN KALIMAT: sebelumnya ada prefiks "Kecamatan " dan
            "Kabupaten " sebelum nilai field yang sudah berisi teks
            lengkap, membuat kalimat jadi rancu/dobel. Sekarang field
            langsung dirangkai dengan koma. */}
        <p style={{ textAlign: "justify", margin: "0 0 8px 0" }}>
          Yang bertanda tangan di bawah ini Kepala {sekolah?.nama_sekolah}
          {sekolah?.kecamatan ? `, ${sekolah.kecamatan}` : ""}
          {sekolah?.kabupaten ? `, ${sekolah.kabupaten}` : ""}
          {sekolah?.provinsi ? `, Provinsi ${sekolah.provinsi}` : ""}, menerangkan bahwa:
        </p>

        <table style={{ borderCollapse: "collapse", margin: "0 0 8px 0" }}>
          <tbody>
            <Baris label="Nama" nilai={siswa?.nama_lengkap} />
            <Baris label="Tempat, Tanggal Lahir" nilai={`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`} />
            <Baris label="NIS" nilai={siswa?.nis} />
            <Baris label="NISN" nilai={siswa?.nisn} />
            <Baris label="Nomor Ujian" nilai={siswa?.nomor_ujian} />
          </tbody>
        </table>

        <p style={{ textAlign: "justify", margin: "0 0 8px 0" }}>
          Bahwa siswa/siswi tersebut di atas benar-benar murid Kelas VI {sekolah?.nama_sekolah} dan telah mengikuti
          Asesmen Sekolah Tahun Pelajaran {tahunPelajaran} dan dinyatakan <strong>BERHASIL</strong> dengan nilai
          sebagai berikut:
        </p>

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10.5pt", margin: "0 0 10px 0" }}>
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

        <p style={{ textAlign: "justify", margin: 0 }}>
          Demikian Surat Keterangan Lulus ini dibuat untuk digunakan seperlunya, sambil menantikan tibanya ijazah
          yang bersangkutan.
        </p>

        <div
          style={{
            textAlign: "right",
            marginTop: "auto",
            paddingTop: 14,
            pageBreakInside: "avoid",
            breakInside: "avoid",
          }}
        >
          <p style={{ margin: 0 }}>
            {sekolah?.tempat_ttd || sekolah?.kecamatan || ""}, {tanggalTerbit}
          </p>
          <p style={{ margin: 0 }}>Kepala Sekolah</p>
          {sekolah?.ttd_url ? (
            <img src={sekolah.ttd_url} alt="TTD" style={{ height: 50, margin: "4px 0" }} />
          ) : (
            <div style={{ height: 50 }} />
          )}
          <p style={{ margin: 0, fontWeight: "bold", textDecoration: "underline" }}>{sekolah?.kepala_sekolah}</p>
          <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah}</p>
        </div>
      </div>
    </div>
  );
});

function Baris({ label, nilai }) {
  return (
    <tr>
      <td style={{ padding: "1px 0", width: 180 }}>{label}</td>
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

const th = { border: "1px solid #000", padding: "3px 6px", background: "#f0f0f0", fontWeight: "bold" };
const td = { border: "1px solid #000", padding: "2px 6px", textAlign: "center" };
const tdGroup = { border: "1px solid #000", padding: "2px 6px", fontWeight: "bold", background: "#fafafa" };

export default SklPrintTemplate;
