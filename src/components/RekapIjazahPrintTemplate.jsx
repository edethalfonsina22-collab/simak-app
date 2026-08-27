import React from "react";

// Sembilan komponen nilai, dikelompokkan sesuai format resmi
// (Kelompok A = mapel ujian, Kelompok B = mapel praktik).
// Disamakan dengan MAPEL_IJAZAH pada IjazahPrintTemplate supaya key nilai
// (nilai[siswa][mapel.key]) konsisten dipakai di kedua template.
export const MAPEL_REKAP = [
  { key: "pend_agama", label: "Pend Agama", grup: "A" },
  { key: "pkn", label: "PKn", grup: "A" },
  { key: "bhs_indonesia", label: "Bhs. Indo", grup: "A" },
  { key: "matematika", label: "Matematika", grup: "A" },
  { key: "ipa", label: "IPA", grup: "A" },
  { key: "ips", label: "IPS", grup: "A" },
  { key: "sbk", label: "SBK", grup: "B" },
  { key: "pjok", label: "PJOK", grup: "B" },
  { key: "mulok", label: "Mulok", grup: "B" },
];

export function jumlahNilaiSiswa(nilai) {
  return MAPEL_REKAP.reduce((sum, m) => sum + (Number(nilai?.[m.key]) || 0), 0);
}

// forwardRef supaya elemen ini bisa dicetak lewat window.print() (kelas
// .print-only) atau di-capture html2canvas untuk export PDF, sama seperti
// IjazahPrintTemplate.
//
// Props:
// - siswaList: array of { nama_lengkap, tempat_lahir, tanggal_lahir, nis, nisn, nilai: {...} }
// - sekolah: { nama_sekolah, npsn, kabupaten, provinsi, tempat_ttd,
//              kepala_sekolah, nip_kepala_sekolah, pengawas, nip_pengawas }
// - tahunPelajaran: string, mis. "2025/2026"
//
// CATATAN PRINT (fix lebar terpotong saat dicetak):
// Elemen root memakai className "print-only print-rekap" (bukan cuma
// "print-only" seperti KuitansiPrintTemplate). Class tambahan "print-rekap"
// dipakai oleh index.css untuk memberi elemen ini @page tersendiri
// (size: 330mm 210mm / F4 landscape) supaya lebar kertas cetak PERSIS sama
// dengan lebar konten (330mm) di bawah ini. Sebelumnya konten dicetak
// memakai @page global (A4 = 297mm lebar landscape) sehingga sisa 33mm di
// kanan (kira-kira kolom SBK, PJOK, Mulok, JUMLAH) selalu terpotong.
// Jangan ubah width di sini tanpa menyesuaikan juga @page rekap-landscape
// di index.css, karena keduanya harus selalu sama nilainya.
const RekapIjazahPrintTemplate = React.forwardRef(function RekapIjazahPrintTemplate(
  { siswaList, sekolah, tahunPelajaran },
  ref
) {
  const groupA = MAPEL_REKAP.filter((m) => m.grup === "A");
  const groupB = MAPEL_REKAP.filter((m) => m.grup === "B");
  const daftar = siswaList || [];
  const fmt = (n) => (n === undefined || n === null || n === "" || isNaN(n) ? "-" : Number(n).toFixed(2));

  return (
    <div
      ref={ref}
      className="print-only print-rekap"
      style={{
        // display:block ditambahkan secara eksplisit di sini (inline style)
        // supaya menang atas aturan `@media screen { .print-only { display: none } }`
        // di index.css — sama alasannya seperti di IjazahPrintTemplate: elemen
        // ini juga dipakai sebagai kotak "Pratinjau" di layar, bukan hanya
        // saat cetak.
        display: "block",
        width: "330mm", // F4/Folio landscape - kolom cukup banyak untuk 9 mapel + biodata
        minHeight: "210mm",
        padding: "14mm 12mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: "10.5pt",
        lineHeight: 1.4,
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      <p style={{ textAlign: "center", fontWeight: "bold", margin: "0 0 8px 0" }}>
        DATA : PENGISIAN IJAZAH KELULUSAN TAHUN PELAJARAN {tahunPelajaran}
      </p>

      <table style={{ borderCollapse: "collapse", marginBottom: 10, fontSize: "10.5pt" }}>
        <tbody>
          <Baris label="NAMA SEKOLAH" nilai={sekolah?.nama_sekolah} bold />
          <Baris label="NPSN" nilai={sekolah?.npsn} />
          <Baris label="KABUPATEN" nilai={sekolah?.kabupaten} />
          <Baris label="PROVINSI" nilai={sekolah?.provinsi} />
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center" }}>
        <thead>
          <tr>
            <th rowSpan={2} style={th}>NO</th>
            <th rowSpan={2} style={th}>NAMA SISWA</th>
            <th rowSpan={2} style={th}>TEMPAT TANGGAL LAHIR</th>
            <th rowSpan={2} style={th}>NOMOR INDUK SISWA</th>
            <th rowSpan={2} style={th}>NISN</th>
            <th colSpan={groupA.length} style={th}>KELOMPOK A</th>
            <th colSpan={groupB.length} style={th}>KELOMPOK B</th>
            <th rowSpan={2} style={th}>JUMLAH</th>
          </tr>
          <tr>
            {groupA.map((m) => (
              <th key={m.key} style={th}>{m.label}</th>
            ))}
            {groupB.map((m) => (
              <th key={m.key} style={th}>{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daftar.map((siswa, i) => (
            <tr key={siswa.nis || i}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, textAlign: "left" }}>{siswa?.nama_lengkap}</td>
              <td style={td}>{`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`}</td>
              <td style={td}>{siswa?.nis}</td>
              <td style={td}>{siswa?.nisn}</td>
              {groupA.map((m) => (
                <td key={m.key} style={td}>{fmt(siswa?.nilai?.[m.key])}</td>
              ))}
              {groupB.map((m) => (
                <td key={m.key} style={td}>{fmt(siswa?.nilai?.[m.key])}</td>
              ))}
              <td style={{ ...td, fontWeight: "bold" }}>{fmt(jumlahNilaiSiswa(siswa?.nilai))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 40, fontSize: "10.5pt" }}>
        <tbody>
          <tr>
            <td style={{ width: "26%" }} />
            <td style={{ width: "24%", textAlign: "center" }}>
              Mengetahui
              <br />
              Pengawas
            </td>
            {/* Kolom pemisah kosong supaya blok Pengawas dan Kepala Sekolah tidak berhimpitan */}
            <td style={{ width: "12%" }} />
            <td style={{ width: "38%", textAlign: "center" }}>
              {sekolah?.tempat_ttd || sekolah?.kabupaten || ""}, {formatTanggal(new Date().toISOString())}
              <br />
              Kepala Sekolah
            </td>
          </tr>
          <tr>
            <td />
            <td style={{ height: 50, textAlign: "center", verticalAlign: "bottom" }}>
              {sekolah?.ttd_pengawas_url && (
                <img src={sekolah.ttd_pengawas_url} alt="TTD Pengawas" style={{ height: 44 }} />
              )}
            </td>
            <td />
            <td style={{ height: 50, textAlign: "center", verticalAlign: "bottom" }}>
              {sekolah?.ttd_url && <img src={sekolah.ttd_url} alt="TTD Kepala Sekolah" style={{ height: 44 }} />}
            </td>
          </tr>
          <tr>
            <td />
            <td style={{ textAlign: "center", fontWeight: "bold" }}>
              <span style={{ textDecoration: "underline" }}>{sekolah?.pengawas}</span>
              <br />
              <span style={{ fontWeight: "normal" }}>NIP. {sekolah?.nip_pengawas}</span>
            </td>
            <td />
            <td style={{ textAlign: "center", fontWeight: "bold" }}>
              <span style={{ textDecoration: "underline" }}>{sekolah?.kepala_sekolah}</span>
              <br />
              <span style={{ fontWeight: "normal" }}>NIP. {sekolah?.nip_kepala_sekolah}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
});

function Baris({ label, nilai, bold }) {
  return (
    <tr>
      <td style={{ padding: "0 4px 0 0" }}>{label}</td>
      <td style={{ padding: "0 6px" }}>:</td>
      <td style={{ fontWeight: bold ? "bold" : "normal" }}>{nilai || "-"}</td>
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

const th = { border: "1px solid #000", padding: "4px 5px", background: "#f0f0f0", fontWeight: "bold" };
const td = { border: "1px solid #000", padding: "3px 5px", textAlign: "center" };

export default RekapIjazahPrintTemplate;
