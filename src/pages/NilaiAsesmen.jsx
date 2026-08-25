// src/pages/NilaiAsesmen.jsx
//
// Laman KHUSUS untuk mengisi & mengimpor nilai akhir 9 mapel (sumber data
// ijazah) — dipisah dari halaman Ijazah.jsx supaya format cetak di halaman
// Ijazah TIDAK terpengaruh sama sekali.
//
// Data disimpan ke tabel `nilai_ijazah` (siswa_id, tahun_pelajaran, +9 kolom
// mapel) — tabel yang SAMA PERSIS dipakai halaman Ijazah.jsx untuk mencetak
// rekap. Jadi begitu nilai diisi/diimpor di sini, halaman Ijazah otomatis
// "menarik" data terbaru tanpa perlu ada perubahan kode di Ijazah.jsx.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Layout from "../components/Layout";
import ImporNilaiAsesmenModal from "../components/ImporNilaiAsesmenModal";
import { MAPEL_IJAZAH, jumlahNilai, rataRataNilai } from "../components/IjazahPrintTemplate";
import { Loader2, Save, FileSpreadsheet } from "lucide-react";

// Tahun pelajaran default: kalau sekarang Juli-Des, "thn/thn+1"; kalau Jan-Jun, "thn-1/thn".
function tahunPelajaranDefault() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export default function NilaiAsesmen() {
  const [tahunPelajaran, setTahunPelajaran] = useState(tahunPelajaranDefault());
  const [kelasList, setKelasList] = useState([]);
  const [kelasId, setKelasId] = useState(null);
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({}); // siswa_id -> {pend_agama: .., ...}
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadKelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (kelasId !== null) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunPelajaran, kelasId]);

  async function loadKelas() {
    const { data: kelas } = await supabase.from("kelas").select("*").order("nama_kelas");
    setKelasList(kelas || []);
    const kelas6 = (kelas || []).find((k) => String(k.tingkat).trim().toUpperCase() === "VI");
    setKelasId(kelas6 ? kelas6.id : kelas?.[0]?.id ?? "");
  }

  async function loadAll() {
    setLoading(true);
    setSaved(false);
    let siswaQuery = supabase
      .from("siswa")
      .select("*, kelas(tingkat)")
      .eq("status", "aktif")
      .order("nama_lengkap");
    if (kelasId) siswaQuery = siswaQuery.eq("kelas_id", kelasId);

    const [{ data: siswa }, { data: nilai }] = await Promise.all([
      siswaQuery,
      supabase.from("nilai_ijazah").select("*").eq("tahun_pelajaran", tahunPelajaran),
    ]);
    setSiswaList(siswa || []);
    const map = {};
    (nilai || []).forEach((n) => {
      map[n.siswa_id] = n;
    });
    setNilaiMap(map);
    setLoading(false);
  }

  function ubahNilai(siswaId, key, value) {
    setSaved(false);
    setNilaiMap((prev) => ({
      ...prev,
      [siswaId]: { ...(prev[siswaId] || {}), [key]: value === "" ? null : Number(value) },
    }));
  }

  async function simpanSemua() {
    setSaving(true);
    const rows = siswaList.map((s) => ({
      siswa_id: s.id,
      tahun_pelajaran: tahunPelajaran,
      ...MAPEL_IJAZAH.reduce((acc, m) => {
        acc[m.key] = nilaiMap[s.id]?.[m.key] ?? null;
        return acc;
      }, {}),
    }));
    const { error } = await supabase
      .from("nilai_ijazah")
      .upsert(rows, { onConflict: "siswa_id,tahun_pelajaran" });
    setSaving(false);
    if (error) {
      alert("Gagal menyimpan nilai: " + error.message);
      return;
    }
    setSaved(true);
    loadAll();
  }

  const kelasAktif = useMemo(() => kelasList.find((k) => k.id === kelasId), [kelasList, kelasId]);

  return (
    <Layout
      title="Nilai Asesmen"
      subtitle="Input manual atau impor dari Excel — nilai akhir 9 mapel di sini menjadi sumber data untuk halaman Ijazah"
      actions={
        <div className="flex gap-2">
          <ImporNilaiAsesmenModal
            siswaList={siswaList}
            tahunPelajaranDefault={tahunPelajaran}
            onSelesai={loadAll}
          />
          <button className="btn-primary" onClick={simpanSemua} disabled={saving || loading}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Nilai
          </button>
        </div>
      }
    >
      <div className="card p-4 mb-6 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-ink-700/60 mb-1">Tahun Pelajaran</label>
          <input
            className="input-field w-40"
            value={tahunPelajaran}
            onChange={(e) => setTahunPelajaran(e.target.value)}
            placeholder="2025/2026"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700/60 mb-1">Kelas</label>
          <select
            className="input-field w-48"
            value={kelasId || ""}
            onChange={(e) => setKelasId(e.target.value)}
          >
            {kelasList.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama_kelas} (Tingkat {k.tingkat})
              </option>
            ))}
          </select>
        </div>
        <div className="text-sm text-ink-700/50 flex items-center gap-1.5">
          <FileSpreadsheet size={14} />
          {kelasAktif ? `${siswaList.length} siswa aktif di kelas ${kelasAktif.nama_kelas}` : ""}
        </div>
      </div>

      {loading ? (
        <p>Memuat...</p>
      ) : siswaList.length === 0 ? (
        <div className="card p-6 text-center text-ink-700/60">Belum ada siswa aktif di kelas ini.</div>
      ) : (
        <div className="card overflow-x-auto mb-4">
          <table className="table-shell">
            <thead>
              <tr>
                <th>Nama Siswa</th>
                {MAPEL_IJAZAH.map((m) => (
                  <th key={m.key} className="text-right">
                    {m.label.split(" ")[0]}
                  </th>
                ))}
                <th className="text-right">Jumlah</th>
                <th className="text-right">Rata²</th>
              </tr>
            </thead>
            <tbody>
              {siswaList.map((s) => {
                const v = nilaiMap[s.id] || {};
                return (
                  <tr key={s.id}>
                    <td>
                      <span className="font-semibold">{s.nama_lengkap}</span>
                      <div className="text-xs text-ink-700/50 font-mono">{s.nisn}</div>
                    </td>
                    {MAPEL_IJAZAH.map((m) => (
                      <td key={m.key} className="text-right">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          className="w-16 text-right rounded border border-ink-900/15 px-1.5 py-1 text-sm"
                          value={v[m.key] ?? ""}
                          onChange={(e) => ubahNilai(s.id, m.key, e.target.value)}
                        />
                      </td>
                    ))}
                    <td className="text-right font-semibold">{jumlahNilai(v).toFixed(2)}</td>
                    <td className="text-right font-semibold">{rataRataNilai(v).toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {siswaList.length > 0 && (
        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={simpanSemua} disabled={saving || loading}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Nilai
          </button>
          {saved && <span className="text-sm text-sage-600">Tersimpan. Lihat hasilnya di halaman Ijazah.</span>}
        </div>
      )}
    </Layout>
  );
}
