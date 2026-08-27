import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import Layout from "../components/Layout";
import SklPrintTemplate from "../components/SklPrintTemplate";
import { Printer, Loader2, FilePlus2 } from "lucide-react";

function tahunPelajaranDefault() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

// ============================================================
// Kelas 6 dikenali dari kolom `tingkat` di tabel `kelas`, yang
// disimpan sebagai angka Romawi teks (lihat Kelas.jsx: placeholder
// "Contoh: VII"). Diterima juga "6" biasa untuk jaga-jaga kalau ada
// yang input angka biasa saat menambah data kelas.
// ============================================================
function isTingkat6(tingkat) {
  if (!tingkat) return false;
  const t = String(tingkat).trim().toUpperCase();
  return t === "VI" || t === "6";
}

const SEMUA_KELAS_6 = "__semua_kelas_6__";

export default function SuratKeteranganLulus() {
  const [tahunPelajaran, setTahunPelajaran] = useState(tahunPelajaranDefault());
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({});
  const [sklMap, setSklMap] = useState({});
  const [sekolah, setSekolah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  // Default: gabungan semua rombel kelas 6 (6A/VI-A, 6B/VI-B, dst) —
  // fitur SKL ini memang khusus kelas 6 (kelas kelulusan).
  const [filterKelasId, setFilterKelasId] = useState(SEMUA_KELAS_6);
  const [nomorSkl, setNomorSkl] = useState("421.2/001/2026");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunPelajaran]);

  async function loadAll() {
    setLoading(true);
    const [{ data: siswa, error: siswaErr }, { data: nilai }, { data: sklRows }, { data: profil }] =
      await Promise.all([
        supabase
          .from("siswa")
          .select("*, kelas:kelas_id(id, nama_kelas, tingkat, tahun_ajaran)")
          .eq("status", "aktif")
          .order("nama_lengkap"),
        supabase.from("nilai_ijazah").select("*").eq("tahun_pelajaran", tahunPelajaran),
        supabase.from("skl").select("*").eq("tahun_pelajaran", tahunPelajaran),
        supabase.from("profil_sekolah").select("*").eq("id", 1).maybeSingle(),
      ]);

    if (siswaErr) {
      console.error("Gagal memuat siswa:", siswaErr.message);
      alert("Gagal memuat data siswa: " + siswaErr.message);
    }

    setSiswaList(siswa || []);
    const nMap = {};
    (nilai || []).forEach((n) => (nMap[n.siswa_id] = n));
    setNilaiMap(nMap);
    const sMap = {};
    (sklRows || []).forEach((r) => (sMap[r.siswa_id] = r));
    setSklMap(sMap);
    setSekolah(profil || null);
    setLoading(false);
  }

  // Siswa kelas 6 saja (dasar dari semua filter di halaman ini).
  const siswaKelas6 = useMemo(
    () => siswaList.filter((s) => isTingkat6(s.kelas?.tingkat)),
    [siswaList]
  );

  // Daftar rombel kelas 6 yang tersedia untuk dropdown (misal VI-A, VI-B).
  // Kalau ada tahun_ajaran ganda dengan nama_kelas sama, tahun ajarannya
  // ikut ditampilkan supaya tidak ambigu.
  const kelas6Options = useMemo(() => {
    const map = new Map();
    siswaKelas6.forEach((s) => {
      if (s.kelas?.id && !map.has(s.kelas.id)) map.set(s.kelas.id, s.kelas);
    });
    return Array.from(map.values()).sort((a, b) => a.nama_kelas.localeCompare(b.nama_kelas));
  }, [siswaKelas6]);

  // Siswa yang ditampilkan: kelas 6, lalu dipersempit ke rombel tertentu
  // kalau dropdown memilih rombel spesifik (bukan "Semua Kelas 6").
  const siswaTampil = useMemo(() => {
    if (filterKelasId === SEMUA_KELAS_6) return siswaKelas6;
    return siswaKelas6.filter((s) => s.kelas_id === filterKelasId);
  }, [siswaKelas6, filterKelasId]);

  // Auto-pindah siswa terpilih kalau hilang dari daftar tampil.
  useEffect(() => {
    if (siswaTampil.length && !siswaTampil.some((s) => s.id === selectedId)) {
      setSelectedId(siswaTampil[0].id);
    } else if (!siswaTampil.length) {
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaTampil]);

  async function generateNomorUntukSemua() {
    if (!nomorSkl.trim()) {
      alert("Isi dulu Nomor Surat SKL-nya.");
      return;
    }
    setGenerating(true);
    const rows = siswaTampil
      .filter((s) => !sklMap[s.id])
      .map((s) => ({
        siswa_id: s.id,
        tahun_pelajaran: tahunPelajaran,
        nomor_skl: nomorSkl,
        tanggal_terbit: new Date().toISOString().slice(0, 10),
      }));
    if (rows.length) {
      const { error } = await supabase.from("skl").upsert(rows, { onConflict: "siswa_id,tahun_pelajaran" });
      if (error) {
        alert("Gagal membuat nomor SKL: " + error.message);
        setGenerating(false);
        return;
      }
    }
    setGenerating(false);
    loadAll();
  }

  async function terapkanNomorKeSemua() {
    if (!nomorSkl.trim()) {
      alert("Isi dulu Nomor Surat SKL-nya.");
      return;
    }
    if (!window.confirm(`Timpa nomor surat ${siswaTampil.length} siswa kelas 6 menjadi "${nomorSkl}"?`)) return;
    setGenerating(true);
    const rows = siswaTampil.map((s) => ({
      siswa_id: s.id,
      tahun_pelajaran: tahunPelajaran,
      nomor_skl: nomorSkl,
      tanggal_terbit: sklMap[s.id]?.tanggal_terbit || new Date().toISOString().slice(0, 10),
    }));
    const { error } = await supabase.from("skl").upsert(rows, { onConflict: "siswa_id,tahun_pelajaran" });
    if (error) {
      alert("Gagal menyeragamkan nomor SKL: " + error.message);
      setGenerating(false);
      return;
    }
    setGenerating(false);
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
        logo_url: sekolah.logo_url,
        ttd_url: sekolah.ttd_url,
      }
    : null;

  return (
    <Layout
      title="Surat Keterangan Lulus"
      subtitle="Khusus siswa kelas 6 — satu nomor SKL untuk semua, dicetak dari nilai ijazah yang sudah diisi"
      actions={
        <button className="btn-primary" onClick={generateNomorUntukSemua} disabled={generating || loading}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
          Buat SKL Untuk Siswa Baru
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
        <div>
          <label className="block text-xs font-semibold text-ink-700/60 mb-1">Pilih Kelas</label>
          <select
            className="input-field w-48"
            value={filterKelasId}
            onChange={(e) => setFilterKelasId(e.target.value)}
          >
            <option value={SEMUA_KELAS_6}>Semua Kelas 6</option>
            {kelas6Options.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama_kelas}
                {k.tahun_ajaran ? ` (${k.tahun_ajaran})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-700/60 mb-1">Nomor Surat SKL (dipakai untuk semua siswa)</label>
          <input className="input-field w-64" value={nomorSkl} onChange={(e) => setNomorSkl(e.target.value)} />
        </div>
        <button className="btn-secondary" onClick={terapkanNomorKeSemua} disabled={generating || loading}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : null}
          Samakan Nomor Ke Semua Siswa
        </button>
      </div>

      {loading ? (
        <p>Memuat...</p>
      ) : siswaTampil.length === 0 ? (
        <div className="card p-6 text-center text-ink-700/60">
          Belum ada siswa aktif di kelas 6{filterKelasId !== SEMUA_KELAS_6 ? " untuk rombel ini" : ""}.
        </div>
      ) : (
        <>
          <div className="card overflow-x-auto mb-6">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Nama Siswa</th>
                  <th>NISN</th>
                  <th>Kelas</th>
                  <th>Nomor SKL</th>
                  <th>Tanggal Terbit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {siswaTampil.map((s) => {
                  const skl = sklMap[s.id];
                  return (
                    <tr key={s.id} className={selectedId === s.id ? "bg-brass-400/10" : ""}>
                      <td className="font-semibold">{s.nama_lengkap}</td>
                      <td className="font-mono text-xs">{s.nisn}</td>
                      <td className="text-xs">{s.kelas?.nama_kelas || "-"}</td>
                      <td className="font-mono text-xs">
                        {skl ? (
                          skl.nomor_skl
                        ) : (
                          <span className="badge bg-amber-500/15 text-amber-600">Belum dibuat</span>
                        )}
                      </td>
                      <td>{skl ? new Date(skl.tanggal_terbit).toLocaleDateString("id-ID") : "-"}</td>
                      <td>
                        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => setSelectedId(s.id)}>
                          Lihat
                        </button>
                      </td>
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
                  {siswaTampil.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nama_lengkap}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary" onClick={() => window.print()} disabled={!sklMap[selectedId]}>
                <Printer size={16} /> Cetak SKL
              </button>
            </div>

            {!sklMap[selectedId] && (
              <p className="text-sm text-amber-600 mb-3">
                Siswa ini belum punya nomor SKL — klik "Buat SKL Untuk Siswa Baru" di atas dulu.
              </p>
            )}

            <div
              className="print-preview-scale border border-ink-900/10 rounded-lg overflow-hidden"
              style={{ transform: "scale(0.72)", transformOrigin: "top center", marginBottom: "-28%" }}
            >
              <SklPrintTemplate
                siswa={siswaTerpilih}
                nilai={nilaiMap[selectedId] || {}}
                sekolah={sekolahUntukCetak}
                skl={sklMap[selectedId]}
                tahunPelajaran={tahunPelajaran}
              />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}
