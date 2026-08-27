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

export default function SuratKeteranganLulus() {
  const [tahunPelajaran, setTahunPelajaran] = useState(tahunPelajaranDefault());
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({});
  const [sklMap, setSklMap] = useState({});
  const [sekolah, setSekolah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [filterKelas, setFilterKelas] = useState("semua"); // NEW: filter kelas
  // Diubah dari "Awalan Nomor Surat" (prefix + nomor urut otomatis per
  // siswa) menjadi SATU nomor surat utuh yang sama untuk seluruh siswa —
  // sesuai kebutuhan: SKL diterbitkan kolektif dengan satu nomor surat,
  // bukan bernomor urut per anak.
  const [nomorSkl, setNomorSkl] = useState("421.2/001/2026");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunPelajaran]);

  async function loadAll() {
    setLoading(true);
    const [{ data: siswa }, { data: nilai }, { data: sklRows }, { data: profil }] = await Promise.all([
      supabase.from("siswa").select("*").eq("status", "aktif").order("nama_lengkap"),
      supabase.from("nilai_ijazah").select("*").eq("tahun_pelajaran", tahunPelajaran),
      supabase.from("skl").select("*").eq("tahun_pelajaran", tahunPelajaran),
      supabase.from("profil_sekolah").select("*").eq("id", 1).maybeSingle(),
    ]);
    setSiswaList(siswa || []);
    const nMap = {};
    (nilai || []).forEach((n) => (nMap[n.siswa_id] = n));
    setNilaiMap(nMap);
    const sMap = {};
    (sklRows || []).forEach((r) => (sMap[r.siswa_id] = r));
    setSklMap(sMap);
    setSekolah(profil || null);
    if (siswa?.length && !selectedId) setSelectedId(siswa[0].id);
    setLoading(false);
  }

  // Daftar kelas unik yang tersedia dari siswa aktif, untuk isi dropdown filter.
  const kelasOptions = useMemo(() => {
    const set = new Set(siswaList.map((s) => s.kelas).filter(Boolean));
    return Array.from(set).sort();
  }, [siswaList]);

  // Siswa yang ditampilkan di tabel & dropdown pratinjau, sudah difilter kelas.
  const siswaTampil = useMemo(() => {
    if (filterKelas === "semua") return siswaList;
    return siswaList.filter((s) => s.kelas === filterKelas);
  }, [siswaList, filterKelas]);

  // Kalau siswa yang lagi dipilih untuk pratinjau hilang dari daftar
  // tampil (karena filter kelas berubah), otomatis pindah ke siswa
  // pertama yang masih ada di daftar tampil.
  useEffect(() => {
    if (siswaTampil.length && !siswaTampil.some((s) => s.id === selectedId)) {
      setSelectedId(siswaTampil[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaTampil]);

  // Buat SKL untuk siswa yang belum punya — SEMUA siswa memakai nomor
  // surat yang SAMA (nomorSkl), tidak lagi dihitung urut per siswa.
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

  // Terapkan satu nomor surat yang sama ke SEMUA siswa (termasuk yang
  // sudah punya nomor sebelumnya) — dipakai kalau nomorSkl diubah dan
  // perlu disamaratakan ulang ke seluruh SKL yang sudah terbit.
  // Mengikuti filter kelas yang sedang aktif.
  async function terapkanNomorKeSemua() {
    if (!nomorSkl.trim()) {
      alert("Isi dulu Nomor Surat SKL-nya.");
      return;
    }
    if (!window.confirm(`Timpa nomor surat ${siswaTampil.length} siswa menjadi "${nomorSkl}"?`)) return;
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
        // Sebelumnya field ini tidak ikut dikirim ke SklPrintTemplate,
        // makanya logo & tanda tangan tidak pernah muncul di cetakan
        // (bukan karena bug transform/print — datanya memang tidak
        // pernah sampai ke komponen cetak).
        logo_url: sekolah.logo_url,
        ttd_url: sekolah.ttd_url,
      }
    : null;

  return (
    <Layout
      title="Surat Keterangan Lulus"
      subtitle="Satu nomor SKL untuk semua siswa, dicetak dari nilai ijazah yang sudah diisi"
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
            className="input-field w-40"
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
          >
            <option value="semua">Semua Kelas</option>
            {kelasOptions.map((k) => (
              <option key={k} value={k}>
                {k}
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
          {filterKelas === "semua" ? "Belum ada siswa aktif." : `Tidak ada siswa aktif di kelas ${filterKelas}.`}
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
                      <td className="text-xs">{s.kelas || "-"}</td>
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
