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
// - orientasi: "landscape" (default) | "portrait" — mengatur lebar & ukuran
//   font konten supaya cocok dengan ukuran kertas yang dipilih di halaman
//   Ijazah.jsx. Landscape pakai F4 (330mm, lega untuk 9 kolom mapel).
//   Potrait pakai lebar A4 (~186mm konten) sehingga font & padding
//   dikecilkan supaya kolom tetap muat, meski jadi lebih rapat.
//
// CATATAN PRINT (fix lebar terpotong saat dicetak):
// Elemen root memakai className "print-only print-rekap" (bukan cuma
// "print-only" seperti KuitansiPrintTemplate). Lebar di sini WAJIB selalu
// sama persis dengan ukuran @page yang disetel di Ijazah.jsx (lihat style
// dinamis di sana): 330mm untuk landscape, ~210mm (potrait, dikurangi
// margin halaman) untuk potrait. Kalau salah satu diubah, sisi kanan tabel
// (kolom SBK/PJOK/Mulok/JUMLAH) bisa kepotong saat dicetak.
const RekapIjazahPrintTemplate = React.forwardRef(function RekapIjazahPrintTemplate(
  { siswaList, sekolah, tahunPelajaran, orientasi = "landscape" },
  ref
) {
  const isLandscape = orientasi !== "portrait";
  const groupA = MAPEL_REKAP.filter((m) => m.grup === "A");
  const groupB = MAPEL_REKAP.filter((m) => m.grup === "B");
  const daftar = siswaList || [];
  const fmt = (n) => (n === undefined || n === null || n === "" || isNaN(n) ? "-" : Number(n).toFixed(2));

  // Ambang batas jumlah siswa: sampai 10 siswa, tabel nilai + tanda tangan
  // masih cukup muat digabung dalam 1 halaman. Lebih dari 10 siswa, tabel
  // sendiri sudah memakan hampir/lebih dari 1 halaman penuh, sehingga blok
  // tanda tangan dipaksa pindah ke halaman baru yang bersih (bukan berebut
  // sisa ruang tipis di ujung halaman tabel).
  const AMBANG_HALAMAN_TERPISAH = 10;
  const halamanTerpisah = daftar.length > AMBANG_HALAMAN_TERPISAH;

  // Ukuran konten menyesuaikan orientasi. Landscape (F4) tetap seperti
  // semula (330mm, font 10.5pt). Potrait (A4, ~210mm dikurangi margin
  // halaman) dibuat lebih ringkas: font & padding sel dikecilkan supaya 9
  // kolom mapel + biodata tetap muat dalam lebar yang jauh lebih sempit.
  const lebarKonten = isLandscape ? "330mm" : "210mm";
  const tinggiMin = isLandscape ? "210mm" : "297mm";
  const fontDasar = isLandscape ? "10.5pt" : "7.5pt";
  const paddingKonten = isLandscape ? "14mm 12mm" : "10mm 8mm";
  const paddingSel = isLandscape ? "3px 5px" : "2px 3px";
  const paddingHeader = isLandscape ? "4px 5px" : "3px 3px";
  // Jarak sebelum blok tanda tangan (Mengetahui Pengawas / Kepala Sekolah).
  // - Kalau digabung 1 halaman (<=10 siswa): jarak dibuat rapat supaya naik
  //   dan tidak meluber ke halaman berikutnya.
  // - Kalau dipisah ke halaman baru (>10 siswa): blok tanda tangan jadi
  //   satu-satunya isi di halaman itu, jadi jaraknya dibuat lebih longgar
  //   (dalam mm, konsisten dengan satuan @page) supaya tidak menempel di
  //   pojok kiri-atas kertas.
  const jarakTandaTangan = halamanTerpisah
    ? (isLandscape ? "40mm" : "60mm")
    : (isLandscape ? 30 : 12);

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
        width: lebarKonten,
        minHeight: tinggiMin,
        padding: paddingKonten,
        background: "#fff",
        fontFamily: "'Times New Roman', serif",
        fontSize: fontDasar,
        lineHeight: 1.4,
        color: "#000",
        boxSizing: "border-box",
      }}
    >
      <p style={{ textAlign: "center", fontWeight: "bold", margin: "0 0 8px 0" }}>
        DATA : PENGISIAN IJAZAH KELULUSAN TAHUN PELAJARAN {tahunPelajaran}
      </p>

      <table style={{ borderCollapse: "collapse", marginBottom: 10, fontSize: fontDasar }}>
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
            <th rowSpan={2} style={th(paddingHeader)}>NO</th>
            <th rowSpan={2} style={th(paddingHeader)}>NAMA SISWA</th>
            <th rowSpan={2} style={th(paddingHeader)}>TEMPAT TANGGAL LAHIR</th>
            <th rowSpan={2} style={th(paddingHeader)}>NOMOR INDUK SISWA</th>
            <th rowSpan={2} style={th(paddingHeader)}>NISN</th>
            <th colSpan={groupA.length} style={th(paddingHeader)}>KELOMPOK A</th>
            <th colSpan={groupB.length} style={th(paddingHeader)}>KELOMPOK B</th>
            <th rowSpan={2} style={th(paddingHeader)}>JUMLAH</th>
          </tr>
          <tr>
            {groupA.map((m) => (
              <th key={m.key} style={th(paddingHeader)}>{m.label}</th>
            ))}
            {groupB.map((m) => (
              <th key={m.key} style={th(paddingHeader)}>{m.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {daftar.map((siswa, i) => (
            <tr key={siswa.nis || i}>
              <td style={td(paddingSel)}>{i + 1}</td>
              <td style={{ ...td(paddingSel), textAlign: "left" }}>{siswa?.nama_lengkap}</td>
              <td style={td(paddingSel)}>{`${siswa?.tempat_lahir || ""}, ${formatTanggal(siswa?.tanggal_lahir)}`}</td>
              <td style={td(paddingSel)}>{siswa?.nis}</td>
              <td style={td(paddingSel)}>{siswa?.nisn}</td>
              {groupA.map((m) => (
                <td key={m.key} style={td(paddingSel)}>{fmt(siswa?.nilai?.[m.key])}</td>
              ))}
              {groupB.map((m) => (
                <td key={m.key} style={td(paddingSel)}>{fmt(siswa?.nilai?.[m.key])}</td>
              ))}
              <td style={{ ...td(paddingSel), fontWeight: "bold" }}>{fmt(jumlahNilaiSiswa(siswa?.nilai))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={
          halamanTerpisah
            ? { pageBreakBefore: "always", breakBefore: "page" }
            : undefined
        }
      >
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: jarakTandaTangan, fontSize: fontDasar }}>
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
              <td style={{ height: isLandscape ? 50 : 36, textAlign: "center", verticalAlign: "bottom" }}>
                {sekolah?.ttd_pengawas_url && (
                  <img
                    src={sekolah.ttd_pengawas_url}
                    alt="TTD Pengawas"
                    style={{ height: isLandscape ? 44 : 32 }}
                    onError={(e) => {
                      // Kalau gambar TTD gagal dimuat (URL tidak valid/rusak),
                      // sembunyikan elemen img sepenuhnya supaya tidak muncul
                      // kotak "broken image" bawaan browser yang mempersempit
                      // ruang tanda tangan manual.
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
              </td>
              <td />
              <td style={{ height: isLandscape ? 50 : 36, textAlign: "center", verticalAlign: "bottom" }}>
                {sekolah?.ttd_url && (
                  <img
                    src={sekolah.ttd_url}
                    alt="TTD Kepala Sekolah"
                    style={{ height: isLandscape ? 44 : 32 }}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                )}
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

const th = (padding) => ({ border: "1px solid #000", padding, background: "#f0f0f0", fontWeight: "bold" });
const td = (padding) => ({ border: "1px solid #000", padding, textAlign: "center" });

export default RekapIjazahPrintTemplate;
