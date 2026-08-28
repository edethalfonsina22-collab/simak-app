import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { ClipboardList, Loader2, Trophy, Users, Percent, ChevronLeft } from 'lucide-react';

export default function HasilKuisSeru() {
  const { profil, isAdmin } = useAuth();
  const guruId = profil?.guru_id || null;

  const [daftarKuis, setDaftarKuis] = useState([]);
  const [kuisLoading, setKuisLoading] = useState(true);

  const [kuisTerpilih, setKuisTerpilih] = useState(null);
  const [daftarHasil, setDaftarHasil] = useState([]);
  const [hasilLoading, setHasilLoading] = useState(false);

  // Ambil daftar Kuis Seru — guru biasa hanya lihat kuis buatannya sendiri,
  // admin bisa lihat semua kuis (sama pola aksesnya dengan menu lain di SIMAK).
  useEffect(() => {
    async function ambilDaftarKuis() {
      setKuisLoading(true);
      let query = supabase
        .from('kuis_seru')
        .select('*')
        .order('dibuat_pada', { ascending: false });

      if (!isAdmin) {
        query = query.eq('guru_id', guruId);
      }

      const { data, error } = await query;
      if (!error && data) setDaftarKuis(data);
      setKuisLoading(false);
    }
    ambilDaftarKuis();
  }, [guruId, isAdmin]);

  async function bukaHasilKuis(kuis) {
    setKuisTerpilih(kuis);
    setHasilLoading(true);
    const { data, error } = await supabase
      .from('hasil_kuis_seru')
      .select('*')
      .eq('kuis_id', kuis.id)
      .order('skor', { ascending: false });

    if (!error && data) setDaftarHasil(data);
    setHasilLoading(false);
  }

  function kembaliKeDaftarKuis() {
    setKuisTerpilih(null);
    setDaftarHasil([]);
  }

  const jumlahPeserta = daftarHasil.length;
  const rataRataSkor =
    jumlahPeserta > 0
      ? Math.round(daftarHasil.reduce((total, h) => total + h.skor, 0) / jumlahPeserta)
      : 0;
  const skorTertinggi = jumlahPeserta > 0 ? Math.max(...daftarHasil.map((h) => h.skor)) : 0;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white shadow-sm">
            <ClipboardList size={20} />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Hasil Kuis Seru</h1>
        </div>
        <p className="text-sm text-ink-700/60 mb-6">
          Lihat nilai siswa untuk tiap Kuis Seru yang sudah dibuat.
        </p>

        {!kuisTerpilih ? (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm">
            {kuisLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-700/50 py-8 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat daftar kuis...
              </div>
            ) : daftarKuis.length === 0 ? (
              <p className="text-sm text-ink-700/50 py-8 text-center">
                Belum ada Kuis Seru yang dibuat.
              </p>
            ) : (
              <div className="divide-y divide-ink-100">
                {daftarKuis.map((k) => (
                  <button
                    key={k.id}
                    onClick={() => bukaHasilKuis(k)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-pink-50/50"
                  >
                    <div>
                      <p className="text-sm font-semibold text-ink-900">{k.judul}</p>
                      <p className="text-xs text-ink-700/60">
                        {k.mata_pelajaran} • Kelas {k.kelas} • Kode {k.kode_kuis}
                      </p>
                    </div>
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                        k.status === 'aktif'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      {k.status === 'aktif' ? 'Aktif' : 'Draft'}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={kembaliKeDaftarKuis}
              className="flex items-center gap-1 text-sm text-ink-700/60 hover:text-ink-900 mb-4"
            >
              <ChevronLeft size={16} /> Kembali ke daftar kuis
            </button>

            <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 mb-4">
              <p className="text-xs text-ink-700/60 mb-1">Kuis</p>
              <h2 className="text-lg font-bold text-ink-900">{kuisTerpilih.judul}</h2>
              <p className="text-sm text-ink-700/60">
                {kuisTerpilih.mata_pelajaran} • Kelas {kuisTerpilih.kelas} • Kode{' '}
                {kuisTerpilih.kode_kuis}
              </p>
            </div>

            {hasilLoading ? (
              <div className="flex items-center gap-2 text-sm text-ink-700/50 py-8 justify-center">
                <Loader2 size={16} className="animate-spin" /> Memuat hasil...
              </div>
            ) : daftarHasil.length === 0 ? (
              <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 text-center">
                <p className="text-sm text-ink-700/50">Belum ada siswa yang mengerjakan kuis ini.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-xl border border-ink-100 p-4 text-center">
                    <Users size={16} className="text-pink-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-ink-900">{jumlahPeserta}</p>
                    <p className="text-xs text-ink-700/60">Peserta</p>
                  </div>
                  <div className="bg-white rounded-xl border border-ink-100 p-4 text-center">
                    <Percent size={16} className="text-pink-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-ink-900">{rataRataSkor}</p>
                    <p className="text-xs text-ink-700/60">Rata-rata</p>
                  </div>
                  <div className="bg-white rounded-xl border border-ink-100 p-4 text-center">
                    <Trophy size={16} className="text-pink-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-ink-900">{skorTertinggi}</p>
                    <p className="text-xs text-ink-700/60">Skor Tertinggi</p>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-ink-100 shadow-sm divide-y divide-ink-100">
                  {daftarHasil.map((h, i) => (
                    <div key={h.id} className="flex items-center gap-3 p-4">
                      <span className="w-7 h-7 flex items-center justify-center rounded-full bg-pink-50 text-pink-600 text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-900 truncate">{h.nama_siswa}</p>
                        <p className="text-xs text-ink-700/60">
                          Benar {h.jumlah_benar} dari {h.total_soal} soal
                        </p>
                      </div>
                      <span className="text-lg font-black text-pink-600 shrink-0">{h.skor}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
