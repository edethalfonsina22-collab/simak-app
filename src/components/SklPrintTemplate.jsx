import React from "react";
import { MAPEL_IJAZAH, jumlahNilai } from "./IjazahPrintTemplate";

// Motif bingkai: ubin SVG kecil (diamond + bunga di tengah, warna biru) yang
// diulang sepanjang tepi lewat CSS border-image — meniru gaya bingkai
// ornamen biru pada sertifikat, tapi dibuat lebih tipis supaya tidak
// memakan banyak ruang cetak dan tetap rapi di kertas A4.
const FRAME_TILE = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="#2748a0"/>
    <rect x="2" y="2" width="60" height="60" fill="none" stroke="#8fa6e0" stroke-width="1"/>
    <path d="M32 10 L44 32 L32 54 L20 32 Z" fill="none" stroke="#c9d6f5" stroke-width="2"/>
    <circle cx="32" cy="32" r="6" fill="#c9d6f5"/>
    <circle cx="32" cy="32" r="2.4" fill="#2748a0"/>
  </svg>`
);
const FRAME_URL = `url("data:image/svg+xml,${FRAME_TILE}")`;

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
    // WRAPPER LUAR — HANYA mengatur lebar kertas (210mm) dan padding cetak.
    // PENTING: tidak ada lagi minHeight/maxHeight 297mm + overflow:hidden di
    // sini. Sebelumnya batasan itu memotong apa pun yang melebihi 297mm,
    // termasuk garis bingkai paling bawah kalau isi suratnya sedikit lebih
    // panjang dari perkiraan. Sekarang tingginya mengikuti isi (auto),
    // supaya bingkai di bawah tidak pernah "kepotong" — kalau isinya
    // memang muat 1 halaman, hasilnya otomatis 1 halaman juga.
    <div
      ref={ref}
      className="print-only"
      style={{
        display: "block",
        width: "210mm",
        padding: "4mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: "11.5pt",
        lineHeight: 1.4,
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      {/* BINGKAI ORNAMEN BIRU — sekarang "memeluk" langsung kotak konten di
          bawah ini (yang tingginya auto, mengikuti isi surat), bukan
          membungkus kotak luar berukuran tetap. Jadi border-image akan
          selalu selesai tepat di ujung konten, garis atas/bawah/kiri/kanan
          selalu utuh, berapa pun panjang isi suratnya. */}
      <div
        style={{
          display: "inline-block",
          width: "100%",
          border: "5mm solid transparent",
          borderImageSource: FRAME_URL,
          borderImageSlice: 22,
          borderImageWidth: "5mm",
          borderImageRepeat: "round",
          padding: "1.5mm",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            border: "1pt solid #2748a0",
            padding: "5mm 10mm",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* KOP SURAT — logo & teks disusun pakai flex (bukan position:absolute)
              supaya tata letaknya stabil dan tidak bergeser saat dicetak/di-PDF-kan,
              mengikuti pola yang sudah terbukti aman di IjazahPrintTemplate. */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              borderBottom: "3px double #2748a0",
              paddingBottom: 6,
              marginBottom: 10,
            }}
          >
            {sekolah?.logo_url && (
              <img
                src={sekolah.logo_url}
                alt="Logo"
                style={{ width: 58, height: 58, objectFit: "contain", flexShrink: 0 }}
              />
            )}
            <div style={{ flex: 1, textAlign: "center" }}>
              {/* Urutan & isi disamakan dengan IjazahPrintTemplate: field kabupaten/kecamatan
                  di Profil Sekolah sudah berisi teks lengkap, jadi tidak ditambah prefiks lagi
                  di sini supaya tidak dobel (mis. "Kabupaten PEMERINTAH KABUPATEN ..."). */}
              {sekolah?.kabupaten && (
                <p style={{ fontWeight: "bold", margin: 0, fontSize: "11.5pt", letterSpacing: "0.3px" }}>
                  {sekolah.kabupaten}
                </p>
              )}
              {sekolah?.dinas_pendidikan && (
                <p style={{ fontWeight: "bold", margin: 0, fontSize: "11.5pt", letterSpacing: "0.3px" }}>
                  {sekolah.dinas_pendidikan}
                </p>
              )}
              <p style={{ fontWeight: "bold", margin: "2px 0 0 0", fontSize: "14pt", letterSpacing: "0.5px" }}>
                {sekolah?.nama_sekolah || "NAMA SEKOLAH"}
              </p>
              {sekolah?.kecamatan && (
                <p style={{ fontWeight: "bold", margin: "1px 0 0 0", fontSize: "9.5pt" }}>{sekolah.kecamatan}</p>
              )}
              {sekolah?.alamat && (
                <p style={{ fontStyle: "italic", fontSize: "9.5pt", margin: "2px 0 0 0" }}>{sekolah.alamat}</p>
              )}
            </div>
            {/* Spacer di kanan seukuran logo, supaya blok teks tetap presisi di
                tengah kop surat saat logo ada di kiri (bukan miring ke kanan). */}
            {sekolah?.logo_url && <div style={{ width: 58, flexShrink: 0 }} />}
          </div>

          <p
            style={{
              textAlign: "center",
              fontWeight: "bold",
              textDecoration: "underline",
              margin: "0 0 2px 0",
              letterSpacing: "0.5px",
            }}
          >
            SURAT KETERANGAN LULUS
          </p>
          <p style={{ textAlign: "center", margin: "0 0 10px 0" }}>Nomor: {skl?.nomor_skl || "-"}</p>

          <p style={{ textAlign: "justify", margin: "0 0 6px 0" }}>
            Yang bertanda tangan di bawah ini Kepala {sekolah?.nama_sekolah}
            {sekolah?.kecamatan ? `, ${sekolah.kecamatan}` : ""}
            {sekolah?.kabupaten ? `, ${sekolah.kabupaten}` : ""}
            {sekolah?.provinsi ? `, Provinsi ${sekolah.provinsi}` : ""}, menerangkan bahwa:
          </p>

          <table style={{ borderCollapse: "collapse", margin: "0 0 10px 0" }}>
            <tbody>
              <Baris label="Nama" nilai={siswa?.nama_lengkap} />
              <Baris
                label="Tempat, Tanggal Lahir"
                nilai={`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`}
              />
              <Baris label="NIS" nilai={siswa?.nis} />
              <Baris label="NISN" nilai={siswa?.nisn} />
              <Baris label="Nomor Ujian" nilai={siswa?.nomor_ujian} />
            </tbody>
          </table>

          <p style={{ textAlign: "justify", margin: "0 0 6px 0" }}>
            Bahwa siswa/siswi tersebut di atas benar-benar murid Kelas VI {sekolah?.nama_sekolah} dan telah mengikuti
            Asesmen Sekolah Tahun Pelajaran {tahunPelajaran} dan dinyatakan <strong>BERHASIL</strong> dengan nilai
            sebagai berikut:
          </p>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "11pt",
              margin: "0 0 10px 0",
              pageBreakInside: "avoid",
            }}
          >
            <thead>
              <tr>
                <th style={th}>No</th>
                <th style={{ ...th, textAlign: "left" }}>Mata Pelajaran</th>
                <th style={th}>Nilai</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={tdGroup} colSpan={3}>
                  I. Ujian Sekolah
                </td>
              </tr>
              {groupA.map((m, i) => (
                <tr key={m.key}>
                  <td style={td}>{i + 1}</td>
                  <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
                  <td style={td}>{fmt(nilai?.[m.key])}</td>
                </tr>
              ))}
              <tr>
                <td style={tdGroup} colSpan={3}>
                  II. Nilai Praktik
                </td>
              </tr>
              {groupB.map((m, i) => (
                <tr key={m.key}>
                  <td style={td}>{groupA.length + i + 1}</td>
                  <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
                  <td style={td}>{fmt(nilai?.[m.key])}</td>
                </tr>
              ))}
              <tr>
                <td style={tdGroup} colSpan={2}>
                  Jumlah
                </td>
                <td style={tdGroup}>{fmt(jumlahNilai(nilai))}</td>
              </tr>
            </tbody>
          </table>

          <p style={{ textAlign: "justify", margin: 0 }}>
            Demikian Surat Keterangan Lulus ini dibuat untuk digunakan seperlunya, sambil menantikan tibanya ijazah
            yang bersangkutan.
          </p>

          <div style={{ textAlign: "right", marginTop: 16, pageBreakInside: "avoid" }}>
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
    </div>
  );
});

function Baris({ label, nilai }) {
  return (
    <tr>
      <td style={{ padding: "1px 8px 1px 0", width: 190 }}>{label}</td>
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

const th = { border: "1px solid #2748a0", padding: "3px 6px", background: "#eef1fb", fontWeight: "bold", letterSpacing: "0.2px" };
const td = { border: "1px solid #2748a0", padding: "3px 6px", textAlign: "center", verticalAlign: "middle" };
const tdGroup = { border: "1px solid #2748a0", padding: "3px 6px", fontWeight: "bold", background: "#f5f7fc" };

export default SklPrintTemplate;
