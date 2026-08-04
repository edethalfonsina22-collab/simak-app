import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SuratKeteranganPrintTemplate from "./SuratKeteranganPrintTemplate";
import { exportSuratToPDF, exportSuratToDocx } from "../utils/suratKeteranganExport";

// ---------- Template: Keterangan Pindah Sekolah (siswa) ----------
function templatePindah({ nama, nisn, ttl, kelas, alasan, tujuan, tanggal }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Tempat, Tgl Lahir : ${ttl}
Kelas             : ${kelas}

adalah benar siswa/i pada sekolah kami dan telah mengajukan pindah/keluar dari sekolah ini terhitung mulai tanggal ${tanggal} dengan alasan ${alasan}, untuk melanjutkan pendidikan ke ${tujuan}.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

// ---------- Template: SK Mengajar (guru) ----------
function templateMengajar({ nama, nip, mapel, kelasAjar, tahunAjaran, tanggal }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NIP               : ${nip}

adalah benar guru pada sekolah kami dan diberi tugas untuk mengajar mata pelajaran ${mapel} pada kelas ${kelasAjar} untuk Tahun Ajaran ${tahunAjaran}, terhitung mulai tanggal ${tanggal}.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

const JENIS_OPTIONS = [
  { value: "pindah", label: "Keterangan Pindah Sekolah" },
  { value: "mengajar", label: "SK Mengajar Guru" },
  { value: "bebas", label: "Template Bebas" },
];

export default function SuratKeteranganForm({ onSaved }) {
  const [jenis, setJenis] = useState("pindah");

  // --- data siswa (untuk jenis "pindah") ---
  const [siswaList, setSiswaList] = useState([]);
  const [siswaId, setSiswaId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [tanggalPindah, setTanggalPindah] = useState("");

  // --- data guru (untuk jenis "mengajar") ---
  const [guruList, setGuruList] = useState([]);
  const [guruId, setGuruId] = useState("");
  const [mapel, setMapel] = useState("");
  const [kelasAjar, setKelasAjar] = useState("");
  const [tahunAjaran, setTahunAjaran] = useState("");
  const [tanggalMulaiMengajar, setTanggalMulaiMengajar] = useState("");

  // --- field umum ---
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

  // Ambil data siswa, guru, dan profil sekolah
  useEffect(() => {
    supabase
      .from("siswa")
      .select("id, nama, nisn, tempat_lahir, tanggal_lahir, kelas:kelas_id(nama)")
      .then(({ data, error }) => {
        if (error) {
          console.error("[siswa] gagal dimuat:", error);
          setLoadError(
            (prev) => prev + `Gagal memuat data siswa: ${error.message}. `
          );
          return;
        }
        setSiswaList(data || []);
      });

    supabase
      .from("guru")
      .select("id, nama, nip, mapel")
      .then(({ data, error }) => {
        if (error) {
          console.error("[guru] gagal dimuat:", error);
          setLoadError(
            (prev) => prev + `Gagal memuat data guru: ${error.message}. `
          );
          return;
        }
        setGuruList(data || []);
      });

    supabase
      .from("profil_sekolah")
      .select("*")
      .single()
      .then(({ data, error }) => {
        if (error) console.error("[profil_sekolah] gagal dimuat:", error);
        setSekolah(data || null);
      });
  }, []);

  // Auto-generate isi surat: pindah (siswa)
  useEffect(() => {
    if (jenis !== "pindah") return;
    const siswa = siswaList.find((s) => s.id === siswaId);
    if (!siswa) return;

    setJudul("Surat Keterangan Pindah Sekolah");
    setIsi(
      templatePindah({
        nama: siswa.nama,
        nisn: siswa.nisn || "-",
        ttl: `${siswa.tempat_lahir || "-"}, ${
          siswa.tanggal_lahir
            ? new Date(siswa.tanggal_lahir).toLocaleDateString("id-ID")
            : "-"
        }`,
        kelas: siswa.kelas?.nama || "-",
        alasan: alasan || "-",
        tujuan: tujuan || "-",
        tanggal: tanggalPindah
          ? new Date(tanggalPindah).toLocaleDateString("id-ID")
          : "-",
      })
    );
  }, [jenis, siswaId, alasan, tujuan, tanggalPindah, siswaList]);

  // Auto-generate isi surat: mengajar (guru)
  useEffect(() => {
    if (jenis !== "mengajar") return;
    const guru = guruList.find((g) => g.id === guruId);
    if (!guru) return;

    setJudul("Surat Keterangan Mengajar");
    setIsi(
      templateMengajar({
        nama: guru.nama,
        nip: guru.nip || "-",
        mapel: mapel || guru.mapel || "-",
        kelasAjar: kelasAjar || "-",
        tahunAjaran: tahunAjaran || "-",
        tanggal: tanggalMulaiMengajar
          ? new Date(tanggalMulaiMengajar).toLocaleDateString("id-ID")
          : "-",
      })
    );
  }, [jenis, guruId, mapel, kelasAjar, tahunAjaran, tanggalMulaiMengajar, guruList]);

  function gantiJenis(j) {
    setJenis(j);
    setSuratTersimpan(null);
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
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();

    const payload = {
      jenis,
      nomor_surat: nomorSurat.trim(),
      judul: judul.trim() || "Surat Keterangan",
      siswa_id: jenis === "pindah" ? siswaId || null : null,
      guru_id: jenis === "mengajar" ? guruId || null : null,
      isi,
      data:
        jenis === "pindah"
          ? { alasan, tujuan, tanggalPindah }
          : jenis === "mengajar"
          ? { mapel, kelasAjar, tahunAjaran, tanggalMulaiMengajar }
          : {},
      tanggal_surat: tanggalSurat,
      dibuat_oleh: userData?.user?.id,
    };

    const { data, error } = await supabase
      .from("surat_keterangan")
      .insert(payload)
      .select()
      .single();

    setSaving(false);

    if (error) {
      alert("Gagal menyimpan surat: " + error.message);
      console.error(error);
      return;
    }

    setSuratTersimpan(data);
    onSaved?.(data);
  }

  return (
    <div className="space-y-4">
      {loadError && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-sm p-3 rounded">
          {loadError} Cek koneksi tabel / RLS di Supabase.
        </div>
      )}

      <div className="flex gap-3 flex-wrap">
        {JENIS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => gantiJenis(opt.value)}
            className={`px-4 py-2 rounded ${
              jenis === opt.value ? "bg-blue-600 text-white" : "bg-gray-100"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {jenis === "pindah" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            className="border rounded px-3 py-2 col-span-2"
            value={siswaId}
            onChange={(e) => setSiswaId(e.target.value)}
          >
            <option value="">
              {siswaList.length === 0 ? "Tidak ada data siswa" : "Pilih Siswa"}
            </option>
            {siswaList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} — {s.kelas?.nama || "-"}
              </option>
            ))}
          </select>
          <input
            className="border rounded px-3 py-2"
            placeholder="Alasan pindah"
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Sekolah tujuan"
            value={tujuan}
            onChange={(e) => setTujuan(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={tanggalPindah}
            onChange={(e) => setTanggalPindah(e.target.value)}
          />
        </div>
      )}

      {jenis === "mengajar" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            className="border rounded px-3 py-2 col-span-2"
            value={guruId}
            onChange={(e) => setGuruId(e.target.value)}
          >
            <option value="">
              {guruList.length === 0 ? "Tidak ada data guru" : "Pilih Guru"}
            </option>
            {guruList.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nama} — {g.nip || "-"}
              </option>
            ))}
          </select>
          <input
            className="border rounded px-3 py-2"
            placeholder="Mata pelajaran"
            value={mapel}
            onChange={(e) => setMapel(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Kelas yang diajar (mis. VII A, VIII B)"
            value={kelasAjar}
            onChange={(e) => setKelasAjar(e.target.value)}
          />
          <input
            className="border rounded px-3 py-2"
            placeholder="Tahun ajaran (mis. 2026/2027)"
            value={tahunAjaran}
            onChange={(e) => setTahunAjaran(e.target.value)}
          />
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={tanggalMulaiMengajar}
            onChange={(e) => setTanggalMulaiMengajar(e.target.value)}
          />
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
    </div>
  );
}
