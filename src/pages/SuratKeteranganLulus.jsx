import { useEffect, useMemo, useRef, useState } from "react";
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
  const [kelasList, setKelasList] = useState([]);
  const [kelasId, setKelasId] = useState(null);
  const [siswaList, setSiswaList] = useState([]);
  const [nilaiMap, setNilaiMap] = useState({});
  const [sklMap, setSklMap] = useState({});
  const [sekolah, setSekolah] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [nomorPrefix, setNomorPrefix] = useState("421.2/");
  const previewRef = useRef(null);

  // Pilih siswa dari tabel lalu gulir otomatis ke kartu pratinjau di bawah,
  // supaya perubahannya kelihatan jelas (sebelumnya terasa "tidak merespon"
  // karena kartu pratinjau ada jauh di bawah tabel).
  function lihatSiswa(id) {
    setSelectedId(id);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Ambil daftar kelas sekali di awal, lalu default-kan ke kelas yang mengandung "6"
  useEffect(() => {
    loadKelas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (kelasId !== null) {
      loadAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahunPelajaran, kelasId]);

  async function loadKelas() {
    const { data: kelas } = await supabase.from("kelas").select("*").order("nama_kelas");
    setKelasList(kelas || []);
    // Tingkat disimpan sebagai angka Romawi (VII, VI, dst), jadi cocokkan persis "VI"
    // (bukan .includes, karena "VI" juga jadi substring dari "VII" dan "VIII")
    const kelas6 = (kelas || []).find((k) => String(k.tingkat).trim().toUpperCase() === "VI");
    setKelasId(kelas6 ? kelas6.id : kelas?.[0]?.id ?? "");
  }

  async function loadAll() {
    setLoading(true);
    let siswaQuery = supabase
      .from("siswa")
      .select("*, kelas(tingkat)")
      .eq("status", "aktif")
      .order("nama_lengkap");
    if (kelasId) siswaQuery = siswaQuery.eq("kelas_id", kelasId);

    const [{ data: siswa }, { data: nilai }, { data: sklRows }, { data: profil }] = await Promise.all([
      siswaQuery,
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
    // Pilih siswa pertama di kelas terpilih (reset kalau siswa lama tidak ada di kelas ini)
    if (siswa?.length && !siswa.some((s) => s.id === selectedId)) {
      setSelectedId(siswa[0].id);
    } else if (!siswa?.length) {
      setSelectedId(null);
    }
    setLoading(false);
  }

  // Buat nomor SKL untuk siswa yang belum punya, urut berdasar urutan nama
  // (mengikuti nomor urut siswa di tabel), format: {prefix}{urut}/{tahun berjalan}
  async function generateNomorUntukSemua() {
    setGenerating(true);
    const tahun = new Date().getFullYear();
    const rows = siswaList
      .filter((s) => !sklMap[s.id])
      .map((s, i) => ({
        siswa_id: s.id,
        tahun_pelajaran: tahunPelajaran,
        nomor_skl: `${nomorPrefix}${String(Object.keys(sklMap).length + i + 1).padStart(3, "0")}/${tahun}`,
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
      title="Surat Keterangan Lulus"
      subtitle="Nomor SKL otomatis per siswa, dicetak dari nilai ijazah yang sudah diisi"
      actions={
        <button className="btn-primary" onClick={generateNomorUntukSemua} disabled={generating || loading}>
          {generating ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
          Buat Nomor Untuk Siswa Baru
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
        <div>
          <label className="block text-xs font-semibold text-ink-700/60 mb-1">Awalan Nomor Surat</label>
          <input className="input-field w-40" value={nomorPrefix} onChange={(e) => setNomorPrefix(e.target.value)} />
        </div>
      </div>

      {loading ? (
        <p>Memuat...</p>
      ) : siswaList.length === 0 ? (
        <div className="card p-6 text-center text-ink-700/60">Belum ada siswa aktif di kelas ini.</div>
      ) : (
        <>
          <div className="card overflow-x-auto mb-6">
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Nama Siswa</th>
                  <th>NISN</th>
                  <th>Nomor SKL</th>
                  <th>Tanggal Terbit</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {siswaList.map((s) => {
                  const skl = sklMap[s.id];
                  return (
                    <tr key={s.id} className={selectedId === s.id ? "bg-brass-400/10" : ""}>
                      <td className="font-semibold">{s.nama_lengkap}</td>
                      <td className="font-mono text-xs">{s.nisn}</td>
                      <td className="font-mono text-xs">
                        {skl ? (
                          skl.nomor_skl
                        ) : (
                          <span className="badge bg-amber-500/15 text-amber-600">Belum dibuat</span>
                        )}
                      </td>
                      <td>{skl ? new Date(skl.tanggal_terbit).toLocaleDateString("id-ID") : "-"}</td>
                      <td>
                        <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => lihatSiswa(s.id)}>
                          Lihat
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card p-4" ref={previewRef}>
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
              <button className="btn-primary" onClick={() => window.print()} disabled={!sklMap[selectedId]}>
                <Printer size={16} /> Cetak SKL
              </button>
            </div>

            {!sklMap[selectedId] && (
              <p className="text-sm text-amber-600 mb-3">
                Siswa ini belum punya nomor SKL — klik "Buat Nomor Untuk Siswa Baru" di atas dulu.
              </p>
            )}

            <div className="border border-ink-900/10 rounded-lg overflow-auto" style={{ maxHeight: "70vh" }}>
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
