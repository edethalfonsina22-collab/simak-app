import React from "react";

// Sembilan komponen nilai ijazah, dikelompokkan sesuai format resmi
// (Kelompok A = mapel ujian, Kelompok B = mapel praktik).
export const MAPEL_IJAZAH = [
  { key: "pend_agama", label: "Pendidikan Agama Dan Budi Pekerti", grup: "A" },
  { key: "pkn", label: "Pendidikan Pancasila Dan Kewarganegaraan", grup: "A" },
  { key: "bhs_indonesia", label: "Bahasa Indonesia", grup: "A" },
  { key: "matematika", label: "Matematika", grup: "A" },
  { key: "ipa", label: "Ilmu Pengetahuan Alam", grup: "A" },
  { key: "ips", label: "Ilmu Pengetahuan Sosial", grup: "A" },
  { key: "sbk", label: "Seni Budaya Dan Keterampilan", grup: "B" },
  { key: "pjok", label: "Pendidikan Jasmani Dan Kesehatan", grup: "B" },
  { key: "mulok", label: "Muatan Lokal", grup: "B" },
];

export function jumlahNilai(nilai) {
  return MAPEL_IJAZAH.reduce((sum, m) => sum + (Number(nilai?.[m.key]) || 0), 0);
}
export function rataRataNilai(nilai) {
  return jumlahNilai(nilai) / MAPEL_IJAZAH.length;
}

// forwardRef supaya elemen ini bisa dicetak lewat window.print() (kelas
// .print-only) atau di-capture html2canvas untuk export PDF, sama seperti
// SuratKeteranganPrintTemplate.
//
// CATATAN ORIENTASI CETAK (lanskap):
// Wrapper di bawah sudah diubah dari ukuran A4 potret (210mm x 297mm) ke
// A4 lanskap (297mm x 210mm). Tapi ukuran elemen saja TIDAK cukup untuk
// membuat browser mencetak ke kertas lanskap — kebanyakan browser tetap
// memakai orientasi kertas default (potret) lalu mengecilkan/memotong
// konten. Tambahkan juga aturan berikut di CSS global (mis. index.css):
//
//   @media print {
//     @page {
//       size: A4 landscape;
//       margin: 0;
//     }
//   }
//
// Kalau ada dokumen cetak lain (mis. Surat Keterangan) yang harus tetap
// potret, jangan pakai @page global tanpa nama di atas (itu akan membuat
// SEMUA dokumen ikut lanskap). Sebagai gantinya pakai @page bernama:
//
//   @page landscape-page {
//     size: A4 landscape;
//     margin: 0;
//   }
//
// lalu tambahkan `page: "landscape-page"` ke inline style wrapper di bawah
// (didukung baik di Chrome/Edge, target umum window.print()/html2canvas).
const IjazahPrintTemplate = React.forwardRef(function IjazahPrintTemplate(
  { siswa, nilai, sekolah, tahunPelajaran },
  ref
) {
  const groupA = MAPEL_IJAZAH.filter((m) => m.grup === "A");
  const groupB = MAPEL_IJAZAH.filter((m) => m.grup === "B");
  const fmt = (n) => (n === undefined || n === null || n === "" || isNaN(n) ? "-" : Number(n).toFixed(2));

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        // display:block ditambahkan secara eksplisit di sini (inline style)
        // supaya menang atas aturan `@media screen { .print-only { display: none } }`
        // di index.css — aturan itu untuk menyembunyikan lembar cetak saat
        // browsing biasa, tapi elemen ini juga dipakai sebagai kotak
        // "Pratinjau" di halaman Ijazah/SKL, jadi harus tetap terlihat di layar.
        display: "block",
        width: "297mm",
        minHeight: "210mm",
        padding: "15mm 18mm",
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
          {/* Urutan & isi disesuaikan dengan blangko resmi: Pemerintah Kabupaten,
              Dinas Pendidikan, Nama Sekolah, Kecamatan, lalu Alamat. Tidak lagi
              menambahkan prefiks "PEMERINTAH KABUPATEN"/"Kecamatan" di depan
              nilai field — karena field kabupaten/kecamatan di Profil Sekolah
              sudah berisi teks lengkap, prefiks tambahan bikin dobel. */}
          {sekolah?.kabupaten && <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.kabupaten}</p>}
          {sekolah?.dinas_pendidikan && <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.dinas_pendidikan}</p>}
          <p style={{ fontWeight: "bold", margin: 0, fontSize: "14pt" }}>{sekolah?.nama_sekolah || "NAMA SEKOLAH"}</p>
          {sekolah?.kecamatan && (
            <p style={{ fontWeight: "bold", margin: 0, fontSize: "10pt" }}>{sekolah.kecamatan}</p>
          )}
          {sekolah?.alamat && <p style={{ fontStyle: "italic", fontSize: "10pt", margin: 0 }}>{sekolah.alamat}</p>}
        </div>
      </div>

      <p style={{ textAlign: "center", fontWeight: "bold", textDecoration: "underline", margin: "0 0 2px 0" }}>
        DATA PENGISIAN IJAZAH
      </p>
      <p style={{ textAlign: "center", margin: "0 0 18px 0" }}>Tahun Pelajaran {tahunPelajaran}</p>

      <table style={{ borderCollapse: "collapse", marginBottom: 16 }}>
        <tbody>
          <Baris label="Nama Peserta" nilai={siswa?.nama_lengkap} />
          <Baris label="Tempat, Tanggal Lahir" nilai={`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`} />
          <Baris label="NIS" nilai={siswa?.nis} />
          <Baris label="NISN" nilai={siswa?.nisn} />
          <Baris label="Nomor Ujian" nilai={siswa?.nomor_ujian} />
          <Baris label="NPSN" nilai={sekolah?.npsn} />
        </tbody>
      </table>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12pt", marginBottom: 18 }}>
        <thead>
          <tr>
            <th style={th}>No</th>
            <th style={{ ...th, textAlign: "left" }}>Mata Pelajaran</th>
            <th style={th}>Nilai</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdGroup} colSpan={3}>Kelompok A</td>
          </tr>
          {groupA.map((m, i) => (
            <tr key={m.key}>
              <td style={td}>{i + 1}</td>
              <td style={{ ...td, textAlign: "left" }}>{m.label}</td>
              <td style={td}>{fmt(nilai?.[m.key])}</td>
            </tr>
          ))}
          <tr>
            <td style={tdGroup} colSpan={3}>Kelompok B</td>
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
          <tr>
            <td style={tdGroup} colSpan={2}>Rata-rata</td>
            <td style={tdGroup}>{fmt(rataRataNilai(nilai))}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ textAlign: "right", marginTop: 40 }}>
        <p style={{ margin: 0 }}>
          {sekolah?.tempat_ttd || sekolah?.kecamatan || ""}, {formatTanggal(new Date().toISOString())}
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

export default IjazahPrintTemplate;
