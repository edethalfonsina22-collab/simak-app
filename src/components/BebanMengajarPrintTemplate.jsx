import React from "react";
import { supabase } from "../lib/supabaseClient";

function getPublicUrl(path) {
  if (!path) return null;
  const { data } = supabase.storage.from("profil-sekolah").getPublicUrl(path);
  return data?.publicUrl || null;
}

function jumlahJamMengajar(row) {
  return (
    Number(row.kelas_1 || 0) +
    Number(row.kelas_2 || 0) +
    Number(row.kelas_3 || 0) +
    Number(row.kelas_4 || 0) +
    Number(row.kelas_5 || 0) +
    Number(row.kelas_6 || 0) +
    Number(row.mengajar_sekolah_lain || 0)
  );
}

function bebanKeseluruhan(row) {
  return jumlahJamMengajar(row) + Number(row.tugas_tambahan_jam || 0);
}

function formatTanggalIndo(tgl) {
  if (!tgl) return "";
  return new Date(tgl).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const th = {
  border: "1px solid #000",
  padding: "3px",
  fontWeight: "bold",
  fontSize: "9pt",
  textAlign: "center",
  verticalAlign: "middle",
};
const td = {
  border: "1px solid #000",
  padding: "3px",
  fontSize: "9pt",
  textAlign: "center",
  verticalAlign: "middle",
};

// forwardRef supaya elemen ini bisa di-capture oleh html2canvas di exportBebanMengajarToPDF
const BebanMengajarPrintTemplate = React.forwardRef(function BebanMengajarPrintTemplate(
  { sk, sekolah },
  ref
) {
  const rows = sk?.rows || [];
  const tanggalSk = formatTanggalIndo(sk?.tanggal_sk);

  // Fallback: kalau sekolah.logo_url / ttd_url tidak dikirim langsung,
  // bangun dari logo_path / ttd_kepala_sekolah_path yang tersimpan di tabel profil_sekolah
  const logoUrl = sekolah?.logo_url || getPublicUrl(sekolah?.logo_path);
  const ttdUrl = sekolah?.ttd_url || getPublicUrl(sekolah?.ttd_kepala_sekolah_path);

  const totalPerKolom = rows.reduce(
    (acc, r) => {
      acc.kelas_1 += Number(r.kelas_1 || 0);
      acc.kelas_2 += Number(r.kelas_2 || 0);
      acc.kelas_3 += Number(r.kelas_3 || 0);
      acc.kelas_4 += Number(r.kelas_4 || 0);
      acc.kelas_5 += Number(r.kelas_5 || 0);
      acc.kelas_6 += Number(r.kelas_6 || 0);
      acc.mengajar_sekolah_lain += Number(r.mengajar_sekolah_lain || 0);
      acc.jumlah += jumlahJamMengajar(r);
      acc.tugas_tambahan_jam += Number(r.tugas_tambahan_jam || 0);
      acc.beban += bebanKeseluruhan(r);
      return acc;
    },
    {
      kelas_1: 0, kelas_2: 0, kelas_3: 0, kelas_4: 0, kelas_5: 0, kelas_6: 0,
      mengajar_sekolah_lain: 0, jumlah: 0, tugas_tambahan_jam: 0, beban: 0,
    }
  );

  return (
    <div ref={ref} style={{ background: "#fff" }}>
      {/* ===== HALAMAN 1: NASKAH SK ===== */}
      <div
        style={{
          width: "210mm",
          minHeight: "297mm",
          padding: "20mm 18mm",
          background: "#fff",
          fontFamily: "'Times New Roman', serif",
          fontSize: "12pt",
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
          {logoUrl && (
            <img
              src={logoUrl}
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

        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
            KEPUTUSAN KEPALA {(sekolah?.nama_sekolah || "SEKOLAH").toUpperCase()}
          </p>
          {sekolah?.kecamatan && (
            <p style={{ fontWeight: "bold", margin: 0 }}>{sekolah.kecamatan.toUpperCase()}</p>
          )}
          <p style={{ margin: 0 }}>NOMOR : {sk?.nomor_sk}</p>
          <p style={{ fontWeight: "bold", margin: "6px 0 0 0" }}>TENTANG</p>
          <p style={{ fontWeight: "bold", margin: 0 }}>
            PEMBAGIAN TUGAS GURU DALAM PROSES BELAJAR MENGAJAR / WALI KELAS
            DAN STRUKTUR ORGANISASI {(sekolah?.nama_sekolah || "").toUpperCase()}
          </p>
          <p style={{ margin: "6px 0 0 0" }}>SEMESTER : {sk?.semester}</p>
          <p style={{ margin: 0 }}>TAHUN PELAJARAN : {sk?.tahun_ajaran}</p>
        </div>

        <p>Kepala {sekolah?.nama_sekolah || "Sekolah"},</p>

        <table style={{ width: "100%", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: 110, fontWeight: "bold" }}>Menimbang</td>
              <td style={{ verticalAlign: "top", width: 14 }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Demi kelancaran program belajar mengajar, pengelolaan kelas dan
                pengendalian teknis pada {sekolah?.nama_sekolah || "sekolah ini"}, perlu
                ditetapkan pembagian tugas guru secara jelas dan tepat dengan keputusan
                Kepala {sekolah?.nama_sekolah || "Sekolah"}.
              </td>
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Mengingat</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                1. Undang-Undang No 20 Tahun 2003 tentang Sistem Pendidikan Nasional;<br />
                2. Peraturan Pemerintah No 28 Tahun 1993 tentang Pendidikan Dasar;<br />
                3. Surat Keputusan bersama Menteri Pendidikan dan Kebudayaan dan Kepala
                Badan Administrasi Kepegawaian Negara Nomor: 0433/1993 dan Nomor 25
                Tahun 1990.
              </td>
            </tr>
          </tbody>
        </table>

        <p style={{ textAlign: "center", fontWeight: "bold", margin: "16px 0" }}>MEMUTUSKAN</p>

        <table style={{ width: "100%" }}>
          <tbody>
            <tr>
              <td style={{ verticalAlign: "top", width: 110, fontWeight: "bold" }}>Menetapkan</td>
              <td style={{ verticalAlign: "top", width: 14 }}>:</td>
              <td />
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Pertama</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Pembagian Tugas Guru dalam proses belajar mengajar Semester {sk?.semester}{" "}
                Tahun Pelajaran {sk?.tahun_ajaran} seperti dalam lampiran keputusan ini.
              </td>
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Kedua</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Masing-masing guru melaporkan pelaksanaan tugasnya secara tertulis dan
                berkala kepada Kepala Sekolah.
              </td>
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Ketiga</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Segala biaya yang timbul akibat pelaksanaan tugas ini dibebankan pada
                anggaran yang sesuai.
              </td>
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Keempat</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Apabila terdapat kekeliruan dalam keputusan ini akan diadakan perbaikan
                sebagaimana mestinya.
              </td>
            </tr>
            <tr>
              <td style={{ verticalAlign: "top", fontWeight: "bold" }}>Kelima</td>
              <td style={{ verticalAlign: "top" }}>:</td>
              <td style={{ verticalAlign: "top", textAlign: "justify" }}>
                Keputusan ini mulai berlaku sejak tanggal ditetapkan.
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", marginTop: 40 }}>
          <p style={{ margin: 0 }}>
            Ditetapkan di : {sk?.tempat_ditetapkan || sekolah?.tempat_ttd || sekolah?.kecamatan}
          </p>
          <p style={{ margin: 0 }}>Pada Tanggal : {tanggalSk}</p>
          <p style={{ margin: "8px 0 0 0" }}>Kepala Sekolah</p>
          {ttdUrl ? (
            <img
              src={ttdUrl}
              alt="Tanda tangan"
              style={{ height: 70, objectFit: "contain", margin: "0 0 0 auto" }}
            />
          ) : (
            <div style={{ height: 70 }} />
          )}
          <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
            {sekolah?.kepala_sekolah || "____________________"}
          </p>
          <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah || "-"}</p>
        </div>
      </div>

      {/* ===== HALAMAN 2: LAMPIRAN TABEL BEBAN MENGAJAR (landscape) ===== */}
      <div
        style={{
          width: "297mm",
          minHeight: "210mm",
          padding: "12mm",
          background: "#fff",
          fontFamily: "'Times New Roman', serif",
          color: "#000",
          boxSizing: "border-box",
          pageBreakBefore: "always",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 10, fontSize: "10pt" }}>
          <p style={{ margin: 0 }}>
            LAMPIRAN : SURAT KEPUTUSAN KEPALA {(sekolah?.nama_sekolah || "").toUpperCase()}
          </p>
          <p style={{ margin: 0 }}>NOMOR : {sk?.nomor_sk}</p>
          <p style={{ margin: 0 }}>TANGGAL : {tanggalSk}</p>
          <p style={{ fontWeight: "bold", margin: "6px 0 0 0" }}>
            PEMBAGIAN BEBAN MENGAJAR GURU SEMESTER {sk?.semester} TAHUN PELAJARAN{" "}
            {sk?.tahun_ajaran}
          </p>
          <p style={{ fontWeight: "bold", margin: 0 }}>
            {(sekolah?.nama_sekolah || "").toUpperCase()}
          </p>
          {sekolah?.kecamatan && <p style={{ margin: 0 }}>{sekolah.kecamatan.toUpperCase()}</p>}
          {sekolah?.kabupaten && <p style={{ margin: 0 }}>{sekolah.kabupaten.toUpperCase()}</p>}
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th} rowSpan={3}>No</th>
              <th style={th} rowSpan={3}>Nama/NIP/Pangkat/Gol</th>
              <th style={th} rowSpan={3}>Status Guru</th>
              <th style={th} rowSpan={3}>Jabatan</th>
              <th style={th} colSpan={7}>Rincian Beban Mengajar per Minggu</th>
              <th style={th} rowSpan={3}>Jumlah Jam Mengajar</th>
              <th style={th} colSpan={2} rowSpan={2}>Tugas Tambahan</th>
              <th style={th} rowSpan={3}>Beban Keseluruhan</th>
              <th style={th} rowSpan={3}>Keterangan</th>
            </tr>
            <tr>
              <th style={th} colSpan={6}>Rombongan Belajar</th>
              <th style={th} rowSpan={2}>Sklh Lain</th>
            </tr>
            <tr>
              <th style={th}>I</th>
              <th style={th}>II</th>
              <th style={th}>III</th>
              <th style={th}>IV</th>
              <th style={th}>V</th>
              <th style={th}>VI</th>
              <th style={th}>Uraian</th>
              <th style={th}>Jam</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.guru_id}>
                <td style={td}>{idx + 1}</td>
                <td style={{ ...td, textAlign: "left" }}>
                  {r.nama_lengkap}
                  <br />
                  NIP. {r.nip || "-"}
                  <br />
                  {r.pangkat_golongan || "-"}
                </td>
                <td style={td}>{r.status_kepegawaian || "-"}</td>
                <td style={td}>{r.jabatan || "-"}</td>
                <td style={td}>{r.kelas_1 || "-"}</td>
                <td style={td}>{r.kelas_2 || "-"}</td>
                <td style={td}>{r.kelas_3 || "-"}</td>
                <td style={td}>{r.kelas_4 || "-"}</td>
                <td style={td}>{r.kelas_5 || "-"}</td>
                <td style={td}>{r.kelas_6 || "-"}</td>
                <td style={td}>{r.mengajar_sekolah_lain || "-"}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{jumlahJamMengajar(r)}</td>
                <td style={td}>{r.tugas_tambahan || "-"}</td>
                <td style={td}>{r.tugas_tambahan_jam || "-"}</td>
                <td style={{ ...td, fontWeight: "bold" }}>{bebanKeseluruhan(r)}</td>
                <td style={td}>{r.keterangan || ""}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: "bold" }}>
              <td style={td} colSpan={4}>JUMLAH JAM MENGAJAR</td>
              <td style={td}>{totalPerKolom.kelas_1}</td>
              <td style={td}>{totalPerKolom.kelas_2}</td>
              <td style={td}>{totalPerKolom.kelas_3}</td>
              <td style={td}>{totalPerKolom.kelas_4}</td>
              <td style={td}>{totalPerKolom.kelas_5}</td>
              <td style={td}>{totalPerKolom.kelas_6}</td>
              <td style={td}>{totalPerKolom.mengajar_sekolah_lain}</td>
              <td style={td}>{totalPerKolom.jumlah}</td>
              <td style={td} />
              <td style={td}>{totalPerKolom.tugas_tambahan_jam}</td>
              <td style={td}>{totalPerKolom.beban}</td>
              <td style={td} />
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "right", marginTop: 30 }}>
          <p style={{ margin: 0 }}>Mengetahui</p>
          <p style={{ margin: 0 }}>Kepala Sekolah</p>
          {ttdUrl ? (
            <img
              src={ttdUrl}
              alt="Tanda tangan"
              style={{ height: 70, objectFit: "contain", margin: "0 0 0 auto" }}
            />
          ) : (
            <div style={{ height: 70 }} />
          )}
          <p style={{ fontWeight: "bold", textDecoration: "underline", margin: 0 }}>
            {sekolah?.kepala_sekolah || "____________________"}
          </p>
          <p style={{ margin: 0 }}>NIP. {sekolah?.nip_kepala_sekolah || "-"}</p>
        </div>
      </div>
    </div>
  );
});

export default BebanMengajarPrintTemplate;
