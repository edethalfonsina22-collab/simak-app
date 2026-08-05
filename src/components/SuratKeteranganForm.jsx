import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SuratKeteranganPrintTemplate from "./SuratKeteranganPrintTemplate";
import { exportSuratToPDF, exportSuratToDocx } from "../utils/suratKeteranganExport";
import BebanMengajarForm from "./BebanMengajarForm";

// Daftar jenis surat yang didukung tombol "Generate Otomatis".
// Tambah jenis baru cukup: (1) tambah entri di sini, (2) buat fungsi templateXxx di bawah,
// (3) tambah case di switch dalam useEffect auto-generate.
const JENIS_SURAT = [
  { key: "pindah", label: "Pindah Sekolah", judul: "Surat Keterangan Pindah Sekolah" },
  { key: "izin", label: "Izin", judul: "Surat Keterangan Izin" },
  { key: "aktif", label: "Keterangan Aktif", judul: "Surat Keterangan Aktif" },
  { key: "lulus", label: "Keterangan Lulus", judul: "Surat Keterangan Lulus" },
  { key: "bebas", label: "Template Bebas", judul: "" },
];

// Mode "beban_mengajar" ditangani terpisah dari JENIS_SURAT di atas karena
// strukturnya beda total (bukan surat per-siswa/guru, tapi SK + tabel semua guru).
const MODE_BEBAN_MENGAJAR = "beban_mengajar";

function templatePindah({ nama, nisn, ttl, kelas, alasan, tujuan, tanggal }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Tempat, Tgl Lahir : ${ttl}
Kelas             : ${kelas}

adalah benar siswa/i pada sekolah kami dan telah mengajukan pindah/keluar dari sekolah ini terhitung mulai tanggal ${tanggal} dengan alasan ${alasan}, untuk melanjutkan pendidikan ke ${tujuan}.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

function templateIzin({ nama, nisn, kelas, alasan, tanggal }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Kelas             : ${kelas}

adalah benar siswa/i pada sekolah kami dan diberikan izin tidak masuk sekolah pada tanggal ${tanggal} dengan alasan ${alasan}.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

function templateAktif({ nama, nisn, kelas, namaSekolah }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Kelas             : ${kelas}

adalah benar siswa/i yang masih aktif dan terdaftar di ${namaSekolah || "sekolah kami"} pada tahun ajaran berjalan.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

function templateLulus({ nama, nisn, kelas, namaSekolah }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Kelas             : ${kelas}

adalah benar siswa/i ${namaSekolah || "sekolah kami"} dan telah dinyatakan LULUS pada tahun ajaran berjalan.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

export default function SuratKeteranganForm({ onSaved }) {
  const [jenis, setJenis] = useState("pindah");

  const [siswaList, setSiswaList] = useState([]);
  const [siswaId, setSiswaId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [tanggalPindah, setTanggalPindah] = useState("");

  // --- Guru (dropdown pilihan manual) ---
  const [guruList, setGuruList] = useState([]);
  const [guruId, setGuruId] = useState("");
  const [loadErrorGuru, setLoadErrorGuru] = useState("");

  const [judul, setJudul] = useState("");
  const [isi, setIsi] = useState("");
  const [nomorSurat, setNomorSurat] = useState("");
  const [tanggalSurat, setTanggalSurat] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [sekolah, setSekolah] = useState(null);
  const [suratTersimpan, setSuratTersimpan] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const printRef = useRef(null);

  // Jenis yang butuh pilih siswa dari daftar
  const butuhSiswa = ["pindah", "izin", "aktif", "lulus"].includes(jenis);
  // Jenis yang butuh field alasan + tanggal (pindah & izin)
  const butuhAlasanTanggal = ["pindah", "izin"].includes(jenis);
  // Jenis yang butuh field "sekolah tujuan" (khusus pindah)
  const butuhTujuan = jenis === "pindah";

  useEffect(() => {
    async function loadSiswa() {
      const { data, error } = await supabase
        .from("siswa")
        .select("id, nama_lengkap, nisn, tempat_lahir, tanggal_lahir, kelas:kelas_id(nama_kelas)")
        .order("nama_lengkap", { ascending: true });

      if (error) {
        console.error("Gagal memuat data siswa:", error);
        setLoadError(
          "Gagal memuat daftar siswa: " + error.message + " (cek Console browser untuk detail)"
        );
        setSiswaList([]);
        return;
      }

      setSiswaList(data || []);
      if (!data || data.length === 0) {
        setLoadError(
          "Daftar siswa kosong. Pastikan tabel 'siswa' sudah berisi data dan RLS mengizinkan akses baca."
        );
      } else {
        setLoadError("");
      }
    }

    async function loadGuru() {
      const { data, error } = await supabase
        .from("guru")
        .select("id, nama_lengkap")
        .order("nama_lengkap", { ascending: true });

      if (error) {
        console.error("Gagal memuat data guru:", error);
        setLoadErrorGuru(
          "Gagal memuat daftar guru: " + error.message
        );
        setGuruList([]);
        return;
      }
      setGuruList(data || []);
      setLoadErrorGuru("");
    }

    async function loadSekolah() {
      const { data, error } = await supabase
        .from("profil_sekolah")
        .select("*")
        .maybeSingle();

      if (error) {
        console.error("Gagal memuat profil sekolah:", error);
        return;
      }
      setSekolah(data || null);
    }

    loadSiswa();
    loadGuru();
    loadSekolah();
  }, []);

  // Auto-generate isi surat setiap kali jenis atau field terkait berubah
  useEffect(() => {
    if (jenis === "bebas" || jenis === MODE_BEBAN_MENGAJAR) return;

    const siswa = siswaList.find((s) => s.id === siswaId);
    if (!siswa) return;

    const jenisInfo = JENIS_SURAT.find((j) => j.key === jenis);
    const ttl = `${siswa.tempat_lahir || "-"}, ${
      siswa.tanggal_lahir
        ? new Date(siswa.tanggal_lahir).toLocaleDateString("id-ID")
        : "-"
    }`;
    const tanggalFormatted = tanggalPindah
      ? new Date(tanggalPindah).toLocaleDateString("id-ID")
      : "-";

    let teksIsi = "";
    switch (jenis) {
      case "pindah":
        teksIsi = templatePindah({
          nama: siswa.nama_lengkap,
          nisn: siswa.nisn || "-",
          ttl,
          kelas: siswa.kelas?.nama_kelas || "-",
          alasan: alasan || "-",
          tujuan: tujuan || "-",
          tanggal: tanggalFormatted,
        });
        break;
      case "izin":
        teksIsi = templateIzin({
          nama: siswa.nama_lengkap,
          nisn: siswa.nisn || "-",
          kelas: siswa.kelas?.nama_kelas || "-",
          alasan: alasan || "-",
          tanggal: tanggalFormatted,
        });
        break;
      case "aktif":
        teksIsi = templateAktif({
          nama: siswa.nama_lengkap,
          nisn: siswa.nisn || "-",
          kelas: siswa.kelas?.nama_kelas || "-",
          namaSekolah: sekolah?.nama_sekolah,
        });
        break;
      case "lulus":
        teksIsi = templateLulus({
          nama: siswa.nama_lengkap,
          nisn: siswa.nisn || "-",
          kelas: siswa.kelas?.nama_kelas || "-",
          namaSekolah: sekolah?.nama_sekolah,
        });
        break;
      default:
        return;
    }

    setJudul(jenisInfo.judul);
    setIsi(teksIsi);
  }, [jenis, siswaId, alasan, tujuan, tanggalPindah, siswaList, sekolah]);

  function gantiJenis(j) {
    setJenis(j);
    setSuratTersimpan(null);
    setSiswaId("");
    setAlasan("");
    setTujuan("");
    setTanggalPindah("");
    if (j === "bebas") {
      setJudul("");
      setIsi("");
    }
  }

  async function handleSimpan() {
    if (!nomorSurat.trim() || !isi.trim()) {
      alert("Nomor surat dan isi surat wajib diisi.");
      return;
    }
    if (saving) return; // cegah klik ganda

    setSaving(true);

    // Cegah duplikat: cek dulu apakah nomor surat ini sudah pernah tersimpan
    const { data: existing, error: checkError } = await supabase
      .from("surat_keterangan")
      .select("id")
      .eq("nomor_surat", nomorSurat.trim())
      .maybeSingle();

    if (checkError) {
      console.error("Gagal memeriksa nomor surat:", checkError);
    }
    if (existing) {
      setSaving(false);
      alert("Nomor surat ini sudah pernah digunakan. Gunakan nomor surat lain.");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("surat_keterangan")
      .insert({
        jenis,
        nomor_surat: nomorSurat.trim(),
        judul: judul.trim() || "Surat Keterangan",
        siswa_id: butuhSiswa ? siswaId || null : null,
        guru_id: guruId || null,
        isi,
        data: butuhAlasanTanggal ? { alasan, tujuan, tanggalPindah } : {},
        tanggal_surat: tanggalSurat,
        dibuat_oleh: userData?.user?.id,
      })
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert("Gagal menyimpan surat: " + error.message);
      return;
    }

    setSuratTersimpan(data);
    onSaved?.(data);
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {JENIS_SURAT.map((j) => (
          <button
            key={j.key}
            type="button"
            onClick={() => gantiJenis(j.key)}
            className={`px-4 py-2 rounded ${
              jenis === j.key ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            {j.label}
          </button>
        ))}
        {/* Tombol baru: Generate Beban Mengajar */}
        <button
          type="button"
          onClick={() => gantiJenis(MODE_BEBAN_MENGAJAR)}
          className={`px-4 py-2 rounded ${
            jenis === MODE_BEBAN_MENGAJAR ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
        >
          Generate Beban Mengajar
        </button>
      </div>

      {jenis === MODE_BEBAN_MENGAJAR ? (
        <BebanMengajarForm sekolah={sekolah} />
      ) : (
        <>
          {butuhSiswa && (
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border rounded px-3 py-2 col-span-2"
                value={siswaId}
                onChange={(e) => setSiswaId(e.target.value)}
              >
                <option value="">Pilih Siswa</option>
                {siswaList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nama_lengkap} — Kelas {s.kelas?.nama_kelas || "-"}
                  </option>
                ))}
              </select>
              {loadError && (
                <p className="col-span-2 text-sm text-red-600">{loadError}</p>
              )}

              {butuhAlasanTanggal && (
                <>
                  <input
                    className="border rounded px-3 py-2"
                    placeholder={jenis === "pindah" ? "Alasan pindah" : "Alasan izin"}
                    value={alasan}
                    onChange={(e) => setAlasan(e.target.value)}
                  />
                  <input
                    type="date"
                    className="border rounded px-3 py-2"
                    value={tanggalPindah}
                    onChange={(e) => setTanggalPindah(e.target.value)}
                  />
                </>
              )}

              {butuhTujuan && (
                <input
                  className="border rounded px-3 py-2 col-span-2"
                  placeholder="Sekolah tujuan"
                  value={tujuan}
                  onChange={(e) => setTujuan(e.target.value)}
                />
              )}
            </div>
          )}

          {jenis === "bebas" && (
            <input
              className="border rounded px-3 py-2 w-full"
              placeholder="Judul surat (mis. Surat Keterangan Berkelakuan Baik)"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
            />
          )}

          {/* Dropdown pilih Guru — manual, berlaku untuk semua jenis surat */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">
              Guru (penanggung jawab / pembuat surat)
            </label>
            <select
              className="border rounded px-3 py-2 w-full"
              value={guruId}
              onChange={(e) => setGuruId(e.target.value)}
            >
              <option value="">— Pilih Guru —</option>
              {guruList.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nama_lengkap}
                </option>
              ))}
            </select>
            {loadErrorGuru && (
              <p className="text-sm text-red-600 mt-1">{loadErrorGuru}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input
              className="border rounded px-3 py-2"
              placeholder="Nomor surat (mis. 421.2/10/2026)"
              value={nomorSurat}
              onChange={(e) => setNomorSurat(e.target.value)}
            />
            <input
              type="date"
              className="border rounded px-3 py-2"
              value={tanggalSurat}
              onChange={(e) => setTanggalSurat(e.target.value)}
            />
          </div>

          <textarea
            className="border rounded px-3 py-2 w-full h-56 font-serif"
            placeholder="Isi surat (bisa diedit bebas sebelum disimpan)"
            value={isi}
            onChange={(e) => setIsi(e.target.value)}
          />

          <button
            type="button"
            disabled={saving}
            onClick={handleSimpan}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : "Simpan Surat"}
          </button>

          {suratTersimpan && (
            <div className="mt-6 border-t pt-4 space-y-3">
              <p className="font-medium">Surat tersimpan — unduh:</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() =>
                    exportSuratToPDF(
                      printRef,
                      suratTersimpan.nomor_surat.replace(/\//g, "-")
                    )
                  }
                  className="bg-red-600 text-white px-4 py-2 rounded"
                >
                  Unduh PDF
                </button>
                <button
                  type="button"
                  onClick={() => exportSuratToDocx(suratTersimpan, sekolah)}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Unduh DOCX
                </button>
              </div>

              <div className="overflow-auto border" style={{ maxHeight: 500 }}>
                <SuratKeteranganPrintTemplate
                  ref={printRef}
                  surat={suratTersimpan}
                  sekolah={sekolah}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
