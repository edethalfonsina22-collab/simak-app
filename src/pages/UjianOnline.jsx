import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // sesuaikan kalau nama/lokasi file berbeda

// Halaman ini dipasang terpisah, contoh route: /ujian-online
// TIDAK perlu login siswa sama sekali — dan HARUS di luar <ProtectedRoute> di App.jsx.

// Mengacak urutan array secara acak (Fisher-Yates), tidak mengubah array aslinya.
function acakUrutan(arr) {
  const hasil = [...arr];
  for (let i = hasil.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [hasil[i], hasil[j]] = [hasil[j], hasil[i]];
  }
  return hasil;
}

export default function UjianOnline() {
  const [tahap, setTahap] = useState('masuk'); // masuk | pilih-nama | kerjakan | selesai
  const [kodeUjian, setKodeUjian] = useState('');
  const [ujian, setUjian] = useState(null);
  const [soalList, setSoalList] = useState([]);
  const [daftarSiswa, setDaftarSiswa] = useState([]); // [{nis, nama_lengkap}]
  const [nisSiswa, setNisSiswa] = useState('');
  const [namaSiswa, setNamaSiswa] = useState('');
  const [jawaban, setJawaban] = useState({});
  const [error, setError] = useState('');
  const [memuat, setMemuat] = useState(false);
  const [skorAkhir, setSkorAkhir] = useState(null);
  const [sudahMengerjakan, setSudahMengerjakan] = useState(null); // null = belum dicek, angka = skor lama, false = belum pernah
  const [cekStatusLoading, setCekStatusLoading] = useState(false);
  // Pemetaan posisi tampil (A/B/C/D di layar) -> huruf jawaban asli di database,
  // dibuat sekali per siswa per soal supaya isi pilihan jawaban terlihat acak
  // (anti-nyontek), tapi tetap konsisten selama siswa mengerjakan.
  const [pemetaanPilihan, setPemetaanPilihan] = useState({}); // { [soalId]: ['C','A','D','B'] }

  // Kalau siswa membuka lewat link yang sudah membawa ?kode=XXXXXX,
  // ambil otomatis dari URL dan langsung cari ujiannya — tidak perlu ketik manual.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kodeDariUrl = params.get('kode');
    if (kodeDariUrl) {
      setKodeUjian(kodeDariUrl.toUpperCase());
      cariUjian(kodeDariUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cariUjian(kodeOverride) {
    setError('');
    const kodeInput = (kodeOverride ?? kodeUjian).trim();
    if (!kodeInput) {
      setError('Masukkan kode ujian dulu.');
      return;
    }
    setMemuat(true);

    const kode = kodeInput.toUpperCase();

    const { data: ujianData, error: errUjian } = await supabase
      .from('ujian_publik')
      .select('*')
      .eq('kode_ujian', kode)
      .single();

    if (errUjian || !ujianData) {
      setError('Kode ujian tidak ditemukan. Cek lagi kode dari gurumu.');
      setMemuat(false);
      return;
    }

    if (ujianData.status !== 'aktif') {
      setError('Ujian ini belum diaktifkan oleh guru. Tanyakan ke gurumu.');
      setMemuat(false);
      return;
    }

    const { data: soalData, error: errSoal } = await supabase
      .from('soal_ujian_publik')
      .select('*')
      .eq('ujian_id', ujianData.id)
      .order('urutan', { ascending: true });

    if (errSoal || !soalData || soalData.length === 0) {
      setError('Soal untuk ujian ini belum tersedia.');
      setMemuat(false);
      return;
    }

    // Ambil daftar siswa di kelas ini dari tabel "siswa" (kelas_id, nama_lengkap, nis)
    const { data: siswaData, error: errSiswa } = await supabase
      .from('siswa_publik')
      .select('nis, nama_lengkap')
      .eq('kelas_id', ujianData.kelas_id)
      .order('nama_lengkap', { ascending: true });

    if (errSiswa || !siswaData) {
      setError('Gagal mengambil daftar siswa kelas ini.');
      setMemuat(false);
      return;
    }

    setUjian(ujianData);

    // Acak urutan soal per siswa (anti-nyontek antar siswa yang duduk berdekatan)
    const soalTeracak = acakUrutan(soalData);

    // Untuk setiap soal, buat pemetaan posisi tampil A/B/C/D -> huruf jawaban asli.
    // Contoh: pemetaan['id-soal-1'] = ['C','A','D','B'] artinya slot A di layar
    // menampilkan konten pilihan_c asli, slot B menampilkan pilihan_a asli, dst.
    const pemetaan = {};
    soalData.forEach((s) => {
      pemetaan[s.id] = acakUrutan(['A', 'B', 'C', 'D']);
    });

    setSoalList(soalTeracak);
    setPemetaanPilihan(pemetaan);
    setDaftarSiswa(siswaData);
    setMemuat(false);
    setTahap('pilih-nama');
  }

  function pilihJawaban(soalId, pilihan) {
    setJawaban({ ...jawaban, [soalId]: pilihan });
  }

  // Dipanggil begitu siswa memilih namanya, sebelum mulai mengerjakan.
  // Kalau NIS ini sudah pernah submit ujian ini, tampilkan skornya dan
  // blokir tombol "Mulai Kerjakan" — supaya siswa tidak buang waktu
  // mengisi ulang semua soal baru ditolak di akhir.
  async function cekStatusUjian(nis) {
    setSudahMengerjakan(null);
    if (!nis) return;
    setCekStatusLoading(true);
    const { data, error: errCek } = await supabase.rpc('cek_status_ujian', {
      p_kode_ujian: ujian.kode_ujian,
      p_nis_siswa: nis,
    });
    setCekStatusLoading(false);
    if (!errCek && data && data.length > 0 && data[0].sudah_mengerjakan) {
      setSudahMengerjakan(data[0].skor);
    } else {
      setSudahMengerjakan(false);
    }
  }

  async function kirimJawaban() {
    if (!nisSiswa) {
      setError('Pilih namamu dulu dari daftar.');
      return;
    }
    const belumDijawab = soalList.filter((s) => !jawaban[s.id]);
    if (belumDijawab.length > 0) {
      setError(`Masih ada ${belumDijawab.length} soal yang belum dijawab.`);
      return;
    }

    setMemuat(true);
    setError('');

    const { data, error: errSubmit } = await supabase.rpc('submit_ujian', {
      p_kode_ujian: ujian.kode_ujian,
      p_nis_siswa: nisSiswa,
      p_nama_siswa: namaSiswa,
      p_jawaban: jawaban,
    });

    setMemuat(false);

    if (errSubmit) {
      setError(errSubmit.message || 'Gagal mengirim jawaban.');
      return;
    }

    setSkorAkhir(data);
    setTahap('selesai');
  }

  // ---------- TAHAP 1: MASUKKAN KODE UJIAN ----------
  if (tahap === 'masuk') {
    return (
      <div className="max-w-sm mx-auto mt-16 p-6 rounded-xl border shadow-sm text-center">
        <h1 className="text-xl font-semibold mb-4">Ujian Online</h1>
        <input
          value={kodeUjian}
          onChange={(e) => setKodeUjian(e.target.value)}
          placeholder="Masukkan Kode Ujian"
          className="w-full border rounded-lg px-3 py-2 text-center text-lg font-mono tracking-widest uppercase"
          maxLength={6}
        />
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          onClick={() => cariUjian()}
          disabled={memuat}
          className="mt-4 w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {memuat ? 'Mencari...' : 'Lanjut'}
        </button>
      </div>
    );
  }

  // ---------- TAHAP 2: PILIH NAMA ----------
  if (tahap === 'pilih-nama') {
    return (
      <div className="max-w-sm mx-auto mt-16 p-6 rounded-xl border shadow-sm text-center">
        <h1 className="text-xl font-semibold">{ujian.judul}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {ujian.mata_pelajaran} · Kelas {ujian.nama_kelas}
        </p>
        <select
          value={nisSiswa}
          onChange={(e) => {
            const nis = e.target.value;
            setNisSiswa(nis);
            const siswa = daftarSiswa.find((s) => s.nis === nis);
            setNamaSiswa(siswa?.nama_lengkap || '');
            setError('');
            cekStatusUjian(nis);
          }}
          className="w-full border rounded-lg px-3 py-2"
        >
          <option value="">-- Pilih namamu --</option>
          {daftarSiswa.map((s) => (
            <option key={s.nis} value={s.nis}>
              {s.nama_lengkap}
            </option>
          ))}
        </select>

        {cekStatusLoading && (
          <p className="text-sm text-gray-400 mt-2">Mengecek status...</p>
        )}

        {sudahMengerjakan !== null && sudahMengerjakan !== false && (
          <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Kamu sudah mengerjakan ujian ini sebelumnya. Skor kamu:{' '}
            <strong>{sudahMengerjakan}</strong>. Setiap siswa hanya bisa mengerjakan 1 kali.
          </div>
        )}

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <button
          onClick={() => {
            if (!nisSiswa) {
              setError('Pilih namamu dulu.');
              return;
            }
            if (sudahMengerjakan !== null && sudahMengerjakan !== false) {
              setError('Kamu sudah mengerjakan ujian ini sebelumnya.');
              return;
            }
            setError('');
            setTahap('kerjakan');
          }}
          disabled={cekStatusLoading || (sudahMengerjakan !== null && sudahMengerjakan !== false)}
          className="mt-4 w-full py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Mulai Kerjakan
        </button>
      </div>
    );
  }

  // ---------- TAHAP 3: KERJAKAN SOAL ----------
  if (tahap === 'kerjakan') {
    return (
      <div className="max-w-2xl mx-auto mt-8 p-6 space-y-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">{ujian.judul}</h1>
          <p className="text-sm text-gray-500">
            {namaSiswa} · {Object.keys(jawaban).length}/{soalList.length} terjawab
          </p>
        </div>

        {soalList.map((s, i) => (
          <div key={s.id} className="border rounded-xl p-4">
            <p className="font-medium mb-3">
              {i + 1}. {s.soal}
            </p>
            {['a', 'b', 'c', 'd'].map((huruf, idx) => {
              // hurufAsli = huruf jawaban sesungguhnya di database untuk konten yang
              // ditampilkan di slot ini (posisi tampil sudah diacak per siswa)
              const petaSoal = pemetaanPilihan[s.id];
              const hurufAsli = petaSoal ? petaSoal[idx] : huruf.toUpperCase();
              const kontenPilihan = s[`pilihan_${hurufAsli.toLowerCase()}`];
              return (
                <label
                  key={huruf}
                  className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer mb-1 ${
                    jawaban[s.id] === hurufAsli ? 'bg-blue-50 border border-blue-300' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name={`soal-${s.id}`}
                    checked={jawaban[s.id] === hurufAsli}
                    onChange={() => pilihJawaban(s.id, hurufAsli)}
                  />
                  <span>
                    {huruf.toUpperCase()}. {kontenPilihan}
                  </span>
                </label>
              );
            })}
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={kirimJawaban}
          disabled={memuat}
          className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50"
        >
          {memuat ? 'Mengirim...' : 'Selesai & Kumpulkan'}
        </button>
      </div>
    );
  }

  // ---------- TAHAP 4: SELESAI ----------
  if (tahap === 'selesai') {
    return (
      <div className="max-w-sm mx-auto mt-16 p-6 rounded-xl border shadow-sm text-center">
        <h1 className="text-xl font-semibold mb-2">Selesai! 🎉</h1>
        <p className="text-gray-600 mb-4">Terima kasih, {namaSiswa}.</p>
        <div className="text-4xl font-bold text-green-600">{skorAkhir}</div>
        <p className="text-sm text-gray-500 mt-1">Skor kamu</p>
      </div>
    );
  }

  return null;
}
