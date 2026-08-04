import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import SuratKeteranganPrintTemplate from "./SuratKeteranganPrintTemplate";
import { exportSuratToPDF, exportSuratToDocx } from "../utils/suratKeteranganExport";

// Template otomatis untuk isi surat "Keterangan Pindah Sekolah".
// Admin masih bisa mengedit hasilnya sebelum disimpan (lihat textarea "isi" di bawah).
function templatePindah({ nama, nisn, ttl, kelas, alasan, tujuan, tanggal }) {
  return `Yang bertanda tangan di bawah ini Kepala Sekolah menerangkan bahwa:

Nama              : ${nama}
NISN              : ${nisn}
Tempat, Tgl Lahir : ${ttl}
Kelas             : ${kelas}

adalah benar siswa/i pada sekolah kami dan telah mengajukan pindah/keluar dari sekolah ini terhitung mulai tanggal ${tanggal} dengan alasan ${alasan}, untuk melanjutkan pendidikan ke ${tujuan}.

Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.`;
}

export default function SuratKeteranganForm({ onSaved }) {
  const [jenis, setJenis] = useState("pindah");

  const [siswaList, setSiswaList] = useState([]);
  const [siswaId, setSiswaId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [tujuan, setTujuan] = useState("");
  const [tanggalPindah, setTanggalPindah] = useState("");

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

  // Ambil data siswa (untuk jenis "pindah") dan profil sekolah (kop + penandatangan)
  useEffect(() => {
    async function loadSiswa() {
      const { data, error } = await supabase
        .from("siswa")
        .select("id, nama, nisn, tempat_lahir, tanggal_lahir, kelas:kelas_id(nama_kelas)")
        .order("nama", { ascending: true });

      if (error) {
        // Penyebab paling umum: RLS policy memblokir SELECT, atau relasi
        // kelas_id -> kelas belum di-set dengan benar di Supabase.
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

    async function loadSekolah() {
      const { data, error } = await supabase
        .from("profil_sekolah")
        .select("*")
        .maybeSingle(); // aman walau baris 0 atau lebih dari 1

      if (error) {
        console.error("Gagal memuat profil sekolah:", error);
        return;
      }
      setSekolah(data || null);
    }

    loadSiswa();
    loadSekolah();
  }, []);

  // Auto-generate isi surat saat jenis "pindah" dan field terkait berubah
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
        kelas: siswa.kelas?.nama_kelas || "-",
        alasan: alasan || "-",
        tujuan: tujuan || "-",
        tanggal: tanggalPindah
          ? new Date(tanggalPindah).toLocaleDateString("id-ID")
          : "-",
      })
    );
  }, [jenis, siswaId, alasan, tujuan, tanggalPindah, siswaList]);

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

    const { data, error } = await supabase
      .from("surat_keterangan")
      .insert({
        jenis,
        nomor_surat: nomorSurat.trim(),
        judul: judul.trim() || "Surat Keterangan",
        siswa_id: jenis === "pindah" ? siswaId || null : null,
        isi,
        data: jenis === "pindah" ? { alasan, tujuan, tanggalPindah } : {},
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
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => gantiJenis("pindah")}
          className={`px-4 py-2 rounded ${
            jenis === "pindah" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
        >
          Keterangan Pindah Sekolah
        </button>
        <button
          type="button"
          onClick={() => gantiJenis("bebas")}
          className={`px-4 py-2 rounded ${
            jenis === "bebas" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
        >
          Template Bebas
        </button>
      </div>

      {jenis === "pindah" && (
        <div className="grid grid-cols-2 gap-3">
          <select
            className="border rounded px-3 py-2 col-span-2"
            value={siswaId}
            onChange={(e) => setSiswaId(e.target.value)}
          >
            <option value="">Pilih Siswa</option>
            {siswaList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nama} — Kelas {s.kelas?.nama_kelas || "-"}
              </option>
            ))}
          </select>
          {loadError && (
            <p className="col-span-2 text-sm text-red-600">{loadError}</p>
          )}
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

          {/* Preview — juga menjadi elemen sumber capture PDF */}
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
