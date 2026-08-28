import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';
import { Gamepad2, Copy, Check, Rocket, Loader2, Sparkles } from 'lucide-react';

// Membuat kode kuis acak 6 karakter, misal: X7K2QP (pola sama seperti kode ujian)
function buatKodeKuis() {
  const karakter = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O, 1/I biar tidak tertukar
  let kode = '';
  for (let i = 0; i < 6; i++) {
    kode += karakter[Math.floor(Math.random() * karakter.length)];
  }
  return kode;
}

const PILIHAN_KELAS = ['1', '2', '3'];

export default function BuatKuisSeru() {
  const { profil } = useAuth();
  // kuis_seru.guru_id mengacu ke tabel "guru" (id guru), BUKAN id akun login —
  // sama seperti pola di AuthContext.jsx (profil.guru_id, bukan session.user.id).
  // Kalau akun admin tidak terhubung ke data guru manapun, guru_id-nya null (kolom memang nullable).
  const guruId = profil?.guru_id || null;

  const [judul, setJudul] = useState('');
  const [mapel, setMapel] = useState('');
  const [kelas, setKelas] = useState('1');

  const [bankSoalList, setBankSoalList] = useState([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [idTerpilih, setIdTerpilih] = useState(new Set());

  const [status, setStatus] = useState('idle'); // idle | menyimpan | selesai | error
  const [pesanError, setPesanError] = useState('');
  const [kuisDibuat, setKuisDibuat] = useState(null);
  const [tersalin, setTersalin] = useState(false);

  // Ambil soal dari Bank Soal, difilter otomatis ke kelas yang sedang dipilih (1/2/3)
  // supaya guru tidak perlu scroll cari soal kelas tinggi yang tidak relevan.
  useEffect(() => {
    async function ambilBankSoal() {
      setBankLoading(true);
      const { data, error } = await supabase
        .from('bank_soal')
        .select('*')
        .order('mata_pelajaran')
        .order('dibuat_pada', { ascending: false });
      if (!error && data) setBankSoalList(data);
      setBankLoading(false);
    }
    ambilBankSoal();
  }, []);

  const soalKelasIni = bankSoalList.filter((s) => String(s.kelas) === kelas);
  const soalTampil = mapel ? soalKelasIni.filter((s) => s.mata_pelajaran === mapel) : soalKelasIni;
  const daftarMapel = [...new Set(soalKelasIni.map((s) => s.mata_pelajaran))].sort();

  function toggleSoal(id) {
    setIdTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pilihSemua() {
    setIdTerpilih((prev) => {
      const semuaSudahTerpilih = soalTampil.every((s) => prev.has(s.id));
      const next = new Set(prev);
      if (semuaSudahTerpilih) {
        soalTampil.forEach((s) => next.delete(s.id));
      } else {
        soalTampil.forEach((s) => next.add(s.id));
      }
      return next;
    });
  }

  async function buatKuis() {
    if (!judul.trim()) {
      setPesanError('Judul kuis wajib diisi (contoh: "Kuis Seru Berhitung").');
      return;
    }
    if (!mapel) {
      setPesanError('Pilih mata pelajaran dulu.');
      return;
    }
    const dipilih = bankSoalList.filter((s) => idTerpilih.has(s.id));
    if (dipilih.length === 0) {
      setPesanError('Centang minimal 1 soal dari Bank Soal.');
      return;
    }

    setStatus('menyimpan');
    setPesanError('');

    const kodeKuis = buatKodeKuis();

    const { data: kuis, error: errKuis } = await supabase
      .from('kuis_seru')
      .insert({
        judul: judul.trim(),
        mata_pelajaran: mapel,
        kelas,
        kode_kuis: kodeKuis,
        guru_id: guruId,
        status: 'draft',
      })
      .select()
      .single();

    if (errKuis) {
      setPesanError('Gagal membuat kuis: ' + errKuis.message);
      setStatus('error');
      return;
    }

    const baris = dipilih.map((s, i) => ({
      kuis_id: kuis.id,
      soal: s.soal,
      pilihan_a: s.pilihan_a,
      pilihan_b: s.pilihan_b,
      pilihan_c: s.pilihan_c,
      pilihan_d: s.pilihan_d,
      jawaban_benar: s.jawaban_benar,
      urutan: i + 1,
    }));
    const { error: errSoal } = await supabase.from('soal_kuis_seru').insert(baris);

    if (errSoal) {
      setPesanError('Kuis dibuat tapi soal gagal disimpan: ' + errSoal.message);
      setStatus('error');
      return;
    }

    setKuisDibuat(kuis);
    setStatus('selesai');
  }

  async function aktifkanKuis() {
    const { error } = await supabase
      .from('kuis_seru')
      .update({ status: 'aktif' })
      .eq('id', kuisDibuat.id);
    if (!error) setKuisDibuat({ ...kuisDibuat, status: 'aktif' });
  }

  function buatLinkKuis(kode) {
    return `${window.location.origin}/kuis-seru?kode=${kode}`;
  }

  async function copyLinkKuis() {
    const teks = `Ayo main Kuis Seru: ${buatLinkKuis(kuisDibuat.kode_kuis)}\nKode Kuis: ${kuisDibuat.kode_kuis}`;
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch {
      // fallback diam-diam kalau clipboard API diblokir browser
    }
  }

  function buatKuisBaru() {
    setJudul('');
    setMapel('');
    setIdTerpilih(new Set());
    setKuisDibuat(null);
    setStatus('idle');
    setPesanError('');
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white shadow-sm">
            <Gamepad2 size={20} />
          </div>
          <h1 className="text-2xl font-bold text-ink-900">Buat Kuis Seru</h1>
        </div>
        <p className="text-sm text-ink-700/60 mb-6">
          Game kuis ringan untuk siswa kelas 1–3. Soal diambil dari Bank Soal, siswa mengerjakan
          lewat link/kode tanpa perlu login.
        </p>

        {kuisDibuat ? (
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-6">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-4">
              <Sparkles size={18} />
              Kuis "{kuisDibuat.judul}" berhasil dibuat!
            </div>

            <div className="bg-pink-50 rounded-xl p-4 mb-4">
              <p className="text-xs text-ink-700/60 mb-1">Kode Kuis</p>
              <p className="text-3xl font-black tracking-widest text-pink-600">{kuisDibuat.kode_kuis}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2 mb-5">
              <code className="flex-1 min-w-[200px] bg-ink-50 rounded-lg px-3 py-2 text-xs text-ink-700 break-all">
                {buatLinkKuis(kuisDibuat.kode_kuis)}
              </code>
              <button
                onClick={copyLinkKuis}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-ink-900 text-white text-sm font-medium hover:bg-ink-800"
              >
                {tersalin ? <Check size={15} /> : <Copy size={15} />}
                {tersalin ? 'Tersalin' : 'Salin Link'}
              </button>
            </div>

            {kuisDibuat.status === 'draft' ? (
              <button
                onClick={aktifkanKuis}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-400 text-white font-semibold text-sm hover:opacity-90"
              >
                <Rocket size={16} />
                Aktifkan Kuis Sekarang
              </button>
            ) : (
              <p className="text-sm text-emerald-600 font-medium">
                ✅ Kuis sudah aktif — siswa bisa langsung main lewat link di atas.
              </p>
            )}

            <button
              onClick={buatKuisBaru}
              className="block mt-4 text-sm text-ink-700/60 hover:text-ink-900 underline"
            >
              + Buat kuis lain
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6 space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Judul Kuis</label>
                <input
                  value={judul}
                  onChange={(e) => setJudul(e.target.value)}
                  placeholder="Kuis Seru Berhitung"
                  className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Kelas</label>
                <div className="flex gap-2">
                  {PILIHAN_KELAS.map((k) => (
                    <button
                      key={k}
                      onClick={() => {
                        setKelas(k);
                        setMapel('');
                        setIdTerpilih(new Set());
                      }}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${
                        kelas === k
                          ? 'bg-pink-500 text-white border-pink-500'
                          : 'border-ink-200 text-ink-700 hover:bg-ink-50'
                      }`}
                    >
                      Kelas {k}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1">Mata Pelajaran</label>
              <select
                value={mapel}
                onChange={(e) => {
                  setMapel(e.target.value);
                  setIdTerpilih(new Set());
                }}
                className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Pilih mata pelajaran —</option>
                {daftarMapel.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {daftarMapel.length === 0 && !bankLoading && (
                <p className="text-xs text-amber-600 mt-1">
                  Belum ada soal Bank Soal untuk Kelas {kelas}. Tambahkan dulu lewat menu Bank Soal.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-ink-700">
                  Pilih Soal ({idTerpilih.size} dipilih)
                </label>
                {soalTampil.length > 0 && (
                  <button onClick={pilihSemua} className="text-xs text-pink-600 hover:underline">
                    Pilih/Batal Semua
                  </button>
                )}
              </div>

              {bankLoading ? (
                <div className="flex items-center gap-2 text-sm text-ink-700/50 py-4">
                  <Loader2 size={16} className="animate-spin" /> Memuat soal...
                </div>
              ) : !mapel ? (
                <p className="text-sm text-ink-700/50 py-4">Pilih mata pelajaran dulu untuk melihat daftar soal.</p>
              ) : soalTampil.length === 0 ? (
                <p className="text-sm text-ink-700/50 py-4">Tidak ada soal untuk pilihan ini.</p>
              ) : (
                <div className="border border-ink-100 rounded-xl divide-y divide-ink-100 max-h-80 overflow-y-auto">
                  {soalTampil.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-3 p-3 hover:bg-pink-50/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={idTerpilih.has(s.id)}
                        onChange={() => toggleSoal(s.id)}
                        className="mt-1"
                      />
                      <span className="text-sm text-ink-800">{s.soal}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {pesanError && (
              <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{pesanError}</p>
            )}

            <button
              onClick={buatKuis}
              disabled={status === 'menyimpan'}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60"
            >
              {status === 'menyimpan' ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Membuat Kuis...
                </>
              ) : (
                <>
                  <Gamepad2 size={16} /> Buat Kuis
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
