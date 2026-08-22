import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Layout from "../components/Layout";
import IjazahPrintTemplate, { MAPEL_IJAZAH, jumlahNilai, rataRataNilai } from "../components/IjazahPrintTemplate";
import { Loader2, Save, Printer } from "lucide-react";

// Tahun pelajaran default: kalau sekarang Juli-Des, "thn/thn+1"; kalau Jan-Jun, "thn-1/thn".
function tahunPelajaranDefault() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

export default function Ijazah() {
  const [tahunPelajaran, setTahunPelajaran] = useState(tahunPelajaranDefault());
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({}); // siswa_id -> {pend_agama: .., ...}
  const [sekolah, setSekolah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunPelajaran]);

  async function loadAll() {
    setLoading(true);
    const [{ data: siswa }, { data: nilai }, { data: profil }] = await Promise.all([
      supabase.from("siswa").select("*").eq("status", "aktif").order("nama_lengkap"),
      supabase.from("nilai_ijazah").select("*").eq("tahun_pelajaran", tahunPelajaran),
      supabase.from("profil_sekolah").select("*").eq("id", 1).maybeSingle(),
    ]);
    setSiswaList(siswa || []);
    const map = {};
    (nilai || []).forEach((n) => {
      map[n.siswa_id] = n;
    });
    setNilaiMap(map);
    setSekolah(profil || null);
    if (siswa?.length && !selectedId) setSelectedId(siswa[0].id);
    setLoading(false);
  }

  function ubahNilai(siswaId, key, value) {
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
    loadAll();
  }

  const siswaTerpilih = useMemo(() => siswaList.find((s) => s.id === selectedId), [siswaList, selectedId]);

  const sekolahUntukCetak = sekolah
    ? {
        nama_sekolah: sekolah.nama_sekolah,
        npsn: sekolah.npsn,
        kabupaten: sekolah.kabupaten,
        kecamatan: sekolah.kecamatan,
        dinas_pendidikan: sekolah.dinas_pendidikan,
        alamat: sekolah.alamat,
        provinsi: sekolah.provinsi,
        tempat_ttd: sekolah.tempat_ttd,
        kepala_sekolah: sekolah.kepala_sekolah,
        nip_kepala_sekolah: sekolah.nip_kepala_sekolah,
      }
    : null;

  return (
    <Layout
      title="Ijazah"
      subtitle="Pengisian nilai kelulusan (9 mapel) dan cetak data ijazah per siswa"
      actions={
        <button className="btn-primary" onClick={simpanSemua} disabled={saving || loading}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Simpan Nilai
        </button>
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
      </div>

      {loading ? (
        <p>Memuat...</p>
      ) : siswaList.length === 0 ? (
        <div className="card p-6 text-center text-ink-700/60">Belum ada siswa aktif.</div>
      ) : (
        <>
          <div className="card overflow-x-auto mb-6">
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
                    <tr key={s.id} className={selectedId === s.id ? "bg-brass-400/10" : ""}>
                      <td>
                        <button className="font-semibold text-left hover:underline" onClick={() => setSelectedId(s.id)}>
                          {s.nama_lengkap}
                        </button>
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

          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700/60 mb-1">Pratinjau Siswa</label>
                <select
                  className="input-field w-64"
                  value={selectedId || ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                >
                  {siswaList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_lengkap}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={() => window.print()}>
                <Printer size={16} /> Cetak Ijazah
              </button>
            </div>

            <div className="border border-ink-900/10 rounded-lg overflow-hidden" style={{ transform: "scale(0.72)", transformOrigin: "top center", marginBottom: "-28%" }}>
              <IjazahPrintTemplate
                siswa={siswaTerpilih}
                nilai={nilaiMap[selectedId] || {}}
                sekolah={sekolahUntukCetak}
                tahunPelajaran={tahunPelajaran}
              />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
