import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // sesuaikan kalau nama/lokasi file berbeda
import { useAuth } from '../lib/AuthContext';

export default function HasilUjian() {
  const { session } = useAuth();
  const guruId = session?.user?.id;

  const [daftarUjian, setDaftarUjian] = useState([]);
  const [ujianDipilih, setUjianDipilih] = useState('');
  const [hasil, setHasil] = useState([]);
  const [jumlahSoal, setJumlahSoal] = useState(0);
  const [memuat, setMemuat] = useState(true);

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

  // Ambil hasil + jumlah soal setiap kali ujian yang dipilih berubah
  useEffect(() => {
    if (!ujianDipilih) return;

    async function ambilHasil() {
      const { data: hasilData } = await supabase
        .from('hasil_ujian')
        .select('id, nama_siswa, skor, waktu_selesai')
        .eq('ujian_id', ujianDipilih)
        .order('skor', { ascending: false });

      setHasil(hasilData || []);

      const { count } = await supabase
        .from('soal_ujian')
        .select('id', { count: 'exact', head: true })
        .eq('ujian_id', ujianDipilih);

      setJumlahSoal(count || 0);
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
    return <div className="p-6 text-gray-500 text-sm">Memuat...</div>;
  }

  if (daftarUjian.length === 0) {
    return (
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2">Hasil Ujian</h3>
        <p className="text-sm text-gray-500">
          Anda belum membuat ujian apa pun. Buat ujian dulu di menu "Buat Ujian".
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-5">
      <h3 className="text-lg font-semibold">Hasil Ujian</h3>

      <select
        value={ujianDipilih}
        onChange={(e) => setUjianDipilih(e.target.value)}
        className="w-full border rounded-lg px-3 py-2"
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
          <div className="border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{hasil.length}</div>
            <div className="text-xs text-gray-500">Siswa mengerjakan</div>
          </div>
          <div className="border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{jumlahSoal}</div>
            <div className="text-xs text-gray-500">Jumlah soal</div>
          </div>
          <div className="border rounded-xl p-4 text-center">
            <div className="text-2xl font-bold">{rataRata}</div>
            <div className="text-xs text-gray-500">Rata-rata skor</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {ujianAktif?.status === 'aktif'
            ? '🟢 Ujian aktif — hasil masuk otomatis secara real-time'
            : 'Ujian tidak aktif'}
        </p>
        <button
          onClick={unduhCSV}
          disabled={hasil.length === 0}
          className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50 disabled:opacity-40"
        >
          Unduh CSV
        </button>
      </div>

      <table className="w-full text-sm border rounded-xl overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left px-4 py-2">#</th>
            <th className="text-left px-4 py-2">Nama Siswa</th>
            <th className="text-left px-4 py-2">Skor</th>
            <th className="text-left px-4 py-2">Waktu Selesai</th>
          </tr>
        </thead>
        <tbody>
          {hasil.length === 0 && (
            <tr>
              <td colSpan={4} className="text-center px-4 py-6 text-gray-400">
                Belum ada siswa yang mengerjakan.
              </td>
            </tr>
          )}
          {hasil.map((h, i) => (
            <tr key={h.id} className="border-t">
              <td className="px-4 py-2">{i + 1}</td>
              <td className="px-4 py-2">{h.nama_siswa}</td>
              <td className="px-4 py-2 font-semibold">{h.skor}</td>
              <td className="px-4 py-2 text-gray-500">
                {new Date(h.waktu_selesai).toLocaleString('id-ID')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
