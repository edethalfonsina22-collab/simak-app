import React from "react";
import { MAPEL_IJAZAH } from "./IjazahPrintTemplate";
import { jumlahSemester, rataRataSemester, hitungNilaiAkhir } from "../utils/parseNilaiAsesmen";

// Mencetak persis format "DAFTAR NILAI KOLEKTIF" (1 halaman = 1 siswa),
// sama seperti sheet Excel "RAPORT & ASESMEN" yang jadi acuan (lihat
// utils/parseNilaiAsesmen.js). Menerima nilai per-semester dari
// `detailMap` (mapel_key -> { semester: [IV-I,IV-II,V-I,V-II,VI-I,VI-II],
// nilaiAsesmen }) dan MENGHITUNG SENDIRI jumlah/rata-rata/nilai akhir
// lewat rumus yang sama dipakai di seluruh aplikasi, supaya angka yang
// tercetak selalu konsisten dengan yang tersimpan.
//
// Props:
// - siswa: { nama_lengkap, nis, nisn, nomor_ujian }
// - sekolah: { nama_sekolah, npsn, kabupaten, provinsi, tempat_ttd,
//              kepala_sekolah, nip_kepala_sekolah, ttd_url }
// - tahunPelajaran: string, mis. "2025/2026"
// - detailMap: Record<mapelKey, { semester: (number|null)[], nilaiAsesmen: number|null }>
const DaftarNilaiKolektifPrintTemplate = React.forwardRef(function DaftarNilaiKolektifPrintTemplate(
  { siswa, sekolah, tahunPelajaran, detailMap },
  ref
) {
  const fmt = (n) => (n === undefined || n === null || !Number.isFinite(n) ? "-" : Number(n).toFixed(2));

  let totalNilai = 0;

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        // display:block dipaksa lewat inline style (menang atas
        // `@media screen { .print-only { display:none } }`) supaya elemen
        // ini juga bisa dipakai sebagai kotak "Pratinjau" di layar, sama
        // seperti pola di IjazahPrintTemplate & RekapIjazahPrintTemplate.
        display: "block",
        width: "210mm",
        minHeight: "297mm",
        padding: "16mm 14mm",
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: "10.5pt",
        lineHeight: 1.4,
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      <p style={{ textAlign: "center", fontWeight: "bold", margin: "0 0 2px 0", fontSize: "13pt" }}>
        DAFTAR NILAI KOLEKTIF
      </p>
      <p style={{ textAlign: "center", margin: "0 0 14px 0" }}>TAHUN PELAJARAN {tahunPelajaran}</p>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 14, fontSize: "10.5pt" }}>
        <tbody>
          <tr>
            <td style={{ width: "50%", verticalAlign: "top", padding: 0 }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <IdentBaris label="Nama Peserta" nilai={siswa?.nama_lengkap} />
                  <IdentBaris label="NIS" nilai={siswa?.nis} />
                  <IdentBaris label="NISN" nilai={siswa?.nisn} />
                  <IdentBaris label="No Peserta" nilai={siswa?.nomor_ujian} />
                </tbody>
              </table>
            </td>
            <td style={{ width: "50%", verticalAlign: "top", padding: 0 }}>
              <table style={{ borderCollapse: "collapse" }}>
                <tbody>
                  <IdentBaris label="Provinsi" nilai={sekolah?.provinsi} />
                  <IdentBaris label="Kabupaten" nilai={sekolah?.kabupaten} />
                  <IdentBaris label="Sekolah" nilai={sekolah?.nama_sekolah} />
                  <IdentBaris label="NPSN" nilai={sekolah?.npsn} />
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "center", fontSize: "9pt" }}>
        <thead>
          <tr>
            <th rowSpan={3} style={th}>No</th>
            <th rowSpan={3} style={{ ...th, textAlign: "left" }}>Mata Pelajaran</th>
            <th colSpan={6} style={th}>Kelas / Semester</th>
            <th rowSpan={3} style={th}>Jumlah</th>
            <th rowSpan={3} style={th}>Rata-rata</th>
            <th rowSpan={3} style={th}>Nilai Asesmen</th>
            <th rowSpan={3} style={th}>Nilai</th>
          </tr>
          <tr>
            <th colSpan={2} style={th}>IV</th>
            <th colSpan={2} style={th}>V</th>
            <th colSpan={2} style={th}>VI</th>
          </tr>
          <tr>
            <th style={th}>I</th>
            <th style={th}>II</th>
            <th style={th}>I</th>
            <th style={th}>II</th>
            <th style={th}>I</th>
            <th style={th}>II</th>
          </tr>
        </thead>
        <tbody>
          {MAPEL_IJAZAH.map((m, i) => {
            const d = detailMap?.[m.key] || {};
            const semester = d.semester || [];
            const rata = rataRataSemester(semester);
            const nilaiAkhir = hitungNilaiAkhir(semester, d.nilaiAsesmen);
            if (Number.isFinite(nilaiAkhir)) totalNilai += nilaiAkhir;
            return (
              <tr key={m.key}>
                <td style={td}>{i + 1}</td>
                <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <td key={idx} style={td}>{fmt(semester[idx])}</td>
                ))}
                <td style={td}>{fmt(jumlahSemester(semester))}</td>
                <td style={td}>{fmt(rata)}</td>
                <td style={td}>{fmt(d.nilaiAsesmen)}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{fmt(nilaiAkhir)}</td>
              </tr>
            );
          })}
          <tr>
            <td style={tdGroup} colSpan={11}>Jumlah Nilai</td>
            <td style={tdGroup}>{fmt(totalNilai)}</td>
          </tr>
          <tr>
            <td style={tdGroup} colSpan={11}>Rata-rata</td>
            <td style={tdGroup}>{fmt(totalNilai / MAPEL_IJAZAH.length)}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: "8.5pt", marginTop: 10, lineHeight: 1.5 }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>Pengolahan Nilai Akhir Dengan Rumus:</p>
        <p style={{ margin: 0 }}>A. Nilai rata-rata rapor semester (kelas IV, V, VI)</p>
        <p style={{ margin: 0 }}>B. Nilai rata-rata praktik dan teori Asesmen Sekolah</p>
        <p style={{ margin: 0 }}>NA = Nilai Akhir = (A + B) / 2</p>
      </div>

      <div style={{ textAlign: "right", marginTop: 34 }}>
        <p style={{ margin: 0 }}>
          {sekolah?.tempat_ttd || sekolah?.kabupaten || ""}, {formatTanggal(new Date().toISOString())}
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

function IdentBaris({ label, nilai }) {
  return (
    <tr>
      <td style={{ padding: "1px 0", width: 90 }}>{label}</td>
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

const th = { border: "1px solid #000", padding: "3px 4px", background: "#f0f0f0", fontWeight: "bold" };
const td = { border: "1px solid #000", padding: "2.5px 4px" };
const tdGroup = { border: "1px solid #000", padding: "3px 4px", fontWeight: "bold", background: "#fafafa", textAlign: "right" };

export default DaftarNilaiKolektifPrintTemplate;
