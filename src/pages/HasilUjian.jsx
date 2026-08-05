import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // sesuaikan kalau nama/lokasi file berbeda
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';

export default function HasilUjian() {
  const { session } = useAuth();
  const guruId = session?.user?.id;

  const [daftarUjian, setDaftarUjian] = useState([]);
  const [ujianDipilih, setUjianDipilih] = useState('');
  const [hasil, setHasil] = useState([]);
  const [soalDetail, setSoalDetail] = useState([]); // [{id, urutan, soal, jawaban_benar}]
  const [jumlahSoal, setJumlahSoal] = useState(0);
  const [memuat, setMemuat] = useState(true);
  const [tampilkanPerSoal, setTampilkanPerSoal] = useState(false);

  // Ambil semua ujian milik guru ini
  useEffect(() => {
    async function ambilUjian() {
      if (!guruId) return;
      const { data, error } = await supabase
        .from('ujian')
        .select('id, judul, mata_pelajaran, kode_ujian, status, kelas:kelas_id(nama_kelas)')
        .eq('guru_id', guruId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setDaftarUjian(data);
        if (data.length > 0) setUjianDipilih(data[0].id);
      }
      setMemuat(false);
    }
    ambilUjian();
  }, [guruId]);

  // Ambil hasil + detail soal setiap kali ujian yang dipilih berubah
  useEffect(() => {
    if (!ujianDipilih) return;

    async function ambilHasil() {
      const { data: hasilData } = await supabase
        .from('hasil_ujian')
        .select('id, nama_siswa, skor, waktu_selesai, jawaban')
        .eq('ujian_id', ujianDipilih)
        .order('skor', { ascending: false });

      setHasil(hasilData || []);

      // Ambil detail soal (bukan cuma jumlahnya) supaya bisa dicocokkan dengan
      // jawaban tiap siswa untuk analisis per-soal.
      const { data: soalData } = await supabase
        .from('soal_ujian')
        .select('id, urutan, soal, jawaban_benar')
        .eq('ujian_id', ujianDipilih)
        .order('urutan', { ascending: true });

      setSoalDetail(soalData || []);
      setJumlahSoal((soalData || []).length);
    }
    ambilHasil();

    // Real-time: setiap ada siswa baru submit, tabel otomatis update tanpa refresh
    const channel = supabase
      .channel(`hasil-ujian-${ujianDipilih}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hasil_ujian',
          filter: `ujian_id=eq.${ujianDipilih}`,
        },
        (payload) => {
          setHasil((prev) =>
            [...prev, payload.new].sort((a, b) => b.skor - a.skor)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ujianDipilih]);

  const ujianAktif = daftarUjian.find((u) => u.id === ujianDipilih);
  const rataRata =
    hasil.length > 0
      ? (hasil.reduce((sum, h) => sum + Number(h.skor), 0) / hasil.length).toFixed(1)
      : '-';

  // Statistik per soal: berapa % siswa yang menjawab benar soal ini.
  // Dipakai untuk menandai soal yang paling banyak salah (kandidat remedial).
  const statistikPerSoal = soalDetail.map((s, i) => {
    const totalBenar = hasil.filter((h) => h.jawaban?.[s.id] === s.jawaban_benar).length;
    const persen = hasil.length > 0 ? Math.round((totalBenar / hasil.length) * 100) : 0;
    return { ...s, nomor: i + 1, persen };
  });

  function unduhCSV() {
    const header = 'Nama Siswa,Skor,Waktu Selesai\n';
    const baris = hasil
      .map((h) => `"${h.nama_siswa}",${h.skor},"${new Date(h.waktu_selesai).toLocaleString('id-ID')}"`)
      .join('\n');
    const blob = new Blob([header + baris], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hasil-${ujianAktif?.judul || 'ujian'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (memuat) {
    return (
      <Layout title="Hasil Ujian" subtitle="Lihat hasil pengerjaan siswa">
        <div className="text-[#6b0f1a]/60 text-sm">Memuat...</div>
      </Layout>
    );
  }

  if (daftarUjian.length === 0) {
    return (
      <Layout title="Hasil Ujian" subtitle="Lihat hasil pengerjaan siswa">
        <div className="w-full max-w-3xl bg-white rounded-xl border border-[#6b0f1a]/15 shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2 text-[#3b0a0a] flex items-center gap-2">
            <span className="w-1.5 h-5 rounded-full bg-[#d4a017]"></span>
            Hasil Ujian
          </h3>
          <p className="text-sm text-[#6b0f1a]/60">
            Anda belum membuat ujian apa pun. Buat ujian dulu di menu "Buat Ujian".
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Hasil Ujian" subtitle="Lihat hasil pengerjaan siswa">
      <div className="w-full max-w-5xl space-y-5 bg-white rounded-xl border border-[#6b0f1a]/15 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#3b0a0a] flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-[#d4a017]"></span>
          Hasil Ujian
        </h3>

        <select
          value={ujianDipilih}
          onChange={(e) => setUjianDipilih(e.target.value)}
          className="w-full rounded-lg px-3 py-2 border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
        >
          {daftarUjian.map((u) => (
            <option key={u.id} value={u.id}>
              {u.judul} · {u.mata_pelajaran} · Kelas {u.kelas?.nama_kelas} · {u.kode_ujian} (
              {u.status})
            </option>
          ))}
        </select>

        {ujianAktif && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl p-4 text-center border border-[#6b0f1a]/15 bg-[#f7e6e3]/40">
              <div className="text-2xl font-bold text-[#6b0f1a]">{hasil.length}</div>
              <div className="text-xs text-[#6b0f1a]/60">Siswa mengerjakan</div>
            </div>
            <div className="rounded-xl p-4 text-center border border-[#6b0f1a]/15 bg-[#f7e6e3]/40">
              <div className="text-2xl font-bold text-[#6b0f1a]">{jumlahSoal}</div>
              <div className="text-xs text-[#6b0f1a]/60">Jumlah soal</div>
            </div>
            <div className="rounded-xl p-4 text-center border border-[#d4a017]/40 bg-[#d4a017]/10">
              <div className="text-2xl font-bold text-[#8a6a0d]">{rataRata}</div>
              <div className="text-xs text-[#6b0f1a]/60">Rata-rata skor</div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-[#6b0f1a]/60">
            {ujianAktif?.status === 'aktif'
              ? '🟢 Ujian aktif — hasil masuk otomatis secara real-time'
              : 'Ujian tidak aktif'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTampilkanPerSoal(!tampilkanPerSoal)}
              disabled={hasil.length === 0 || soalDetail.length === 0}
              className="text-sm px-3 py-1.5 rounded-lg border border-[#6b0f1a]/20 text-[#6b0f1a] hover:bg-[#6b0f1a]/5 transition-colors disabled:opacity-40"
            >
              {tampilkanPerSoal ? 'Sembunyikan Analisis Per Soal' : 'Lihat Analisis Per Soal'}
            </button>
            <button
              onClick={unduhCSV}
              disabled={hasil.length === 0}
              className="text-sm px-3 py-1.5 rounded-lg border border-[#6b0f1a]/20 text-[#6b0f1a] hover:bg-[#6b0f1a]/5 transition-colors disabled:opacity-40"
            >
              Unduh CSV
            </button>
          </div>
        </div>

        <table className="w-full text-sm rounded-xl overflow-hidden border border-[#6b0f1a]/10">
          <thead>
            <tr className="bg-[#6b0f1a] text-white">
              <th className="text-left px-4 py-2.5 font-medium">#</th>
              <th className="text-left px-4 py-2.5 font-medium">Nama Siswa</th>
              <th className="text-left px-4 py-2.5 font-medium">Skor</th>
              <th className="text-left px-4 py-2.5 font-medium">Waktu Selesai</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#6b0f1a]/8">
            {hasil.length === 0 && (
              <tr>
                <td colSpan={4} className="text-center px-4 py-6 text-[#6b0f1a]/40">
                  Belum ada siswa yang mengerjakan.
                </td>
              </tr>
            )}
            {hasil.map((h, i) => (
              <tr key={h.id} className="hover:bg-[#6b0f1a]/5 transition-colors">
                <td className="px-4 py-2 text-[#6b0f1a]/70">{i + 1}</td>
                <td className="px-4 py-2 font-medium text-[#3b0a0a]">{h.nama_siswa}</td>
                <td className="px-4 py-2 font-semibold text-[#6b0f1a]">{h.skor}</td>
                <td className="px-4 py-2 text-[#6b0f1a]/50">
                  {new Date(h.waktu_selesai).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {tampilkanPerSoal && hasil.length > 0 && soalDetail.length > 0 && (
          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold text-[#3b0a0a]">Analisis Per Soal</h4>
              <p className="text-xs text-[#6b0f1a]/50">
                Arahkan kursor ke nomor soal untuk lihat teks soal & jawaban benar. Kolom dengan
                latar merah (di bawah 50% benar) menandakan soal yang paling banyak salah —
                kandidat untuk dijelaskan ulang / remedial.
              </p>
            </div>

            <div className="overflow-x-auto border border-[#6b0f1a]/10 rounded-xl">
              <table className="text-sm border-collapse w-full">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-[#6b0f1a] text-white px-3 py-2 text-left whitespace-nowrap z-10">
                      Nama Siswa
                    </th>
                    {statistikPerSoal.map((s) => (
                      <th
                        key={s.id}
                        title={`Soal ${s.nomor}: ${s.soal}\nJawaban benar: ${s.jawaban_benar}\n${s.persen}% siswa menjawab benar`}
                        className={`px-2 py-2 text-center font-medium cursor-help ${
                          s.persen < 50 ? 'bg-red-100 text-red-700' : 'bg-[#f7e6e3]/60 text-[#6b0f1a]'
                        }`}
                      >
                        {s.nomor}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {hasil.map((h) => (
                    <tr key={h.id} className="border-t border-[#6b0f1a]/8">
                      <td className="sticky left-0 bg-white px-3 py-2 font-medium text-[#3b0a0a] whitespace-nowrap">
                        {h.nama_siswa}
                      </td>
                      {statistikPerSoal.map((s) => {
                        const benar = h.jawaban?.[s.id] === s.jawaban_benar;
                        return (
                          <td
                            key={s.id}
                            className={`px-2 py-2 text-center ${
                              benar ? 'text-green-600' : 'text-red-600 bg-red-50/60'
                            }`}
                          >
                            {benar ? '✓' : '✗'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="border-t-2 border-[#6b0f1a]/15 bg-[#f7e6e3]/40 font-semibold">
                    <td className="sticky left-0 bg-[#f7e6e3]/40 px-3 py-2 text-[#3b0a0a] whitespace-nowrap">
                      % Benar
                    </td>
                    {statistikPerSoal.map((s) => (
                      <td
                        key={s.id}
                        className={`px-2 py-2 text-center ${
                          s.persen < 50 ? 'text-red-700' : 'text-[#6b0f1a]'
                        }`}
                      >
                        {s.persen}%
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
