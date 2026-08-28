import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Gamepad2, Loader2, CheckCircle2, XCircle, PartyPopper, ArrowRight } from 'lucide-react';

// Halaman PUBLIK — siswa membuka lewat link "/kuis-seru?kode=XXXXXX" tanpa perlu login.
// Jangan bungkus route ini dengan ProtectedRoute di App.jsx.

const HURUF_PILIHAN = ['a', 'b', 'c', 'd'];

export default function KuisSeru() {
  const [searchParams] = useSearchParams();
  const kodeDariUrl = (searchParams.get('kode') || '').toUpperCase().trim();

  // tahap: memuat | tidak_ditemukan | belum_aktif | isi_nama | mengerjakan | selesai
  const [tahap, setTahap] = useState('memuat');
  const [pesanError, setPesanError] = useState('');

  const [kuis, setKuis] = useState(null);
  const [daftarSoal, setDaftarSoal] = useState([]);

  const [namaSiswa, setNamaSiswa] = useState('');
  const [indexSoal, setIndexSoal] = useState(0);
  const [jawabanTerpilih, setJawabanTerpilih] = useState(null); // 'a'|'b'|'c'|'d' untuk soal berjalan
  const [semuaJawaban, setSemuaJawaban] = useState([]); // rekap jawaban per soal
  const [menyimpanHasil, setMenyimpanHasil] = useState(false);

  // Ambil data kuis + soal berdasarkan kode di URL
  useEffect(() => {
    async function ambilKuis() {
      if (!kodeDariUrl) {
        setTahap('tidak_ditemukan');
        setPesanError('Kode kuis tidak ditemukan di link. Minta link/kode yang benar ke gurumu.');
        return;
      }

      const { data: kuisData, error: errKuis } = await supabase
        .from('kuis_seru')
        .select('*')
        .eq('kode_kuis', kodeDariUrl)
        .maybeSingle();

      if (errKuis || !kuisData) {
        setTahap('tidak_ditemukan');
        setPesanError('Kuis dengan kode ini tidak ditemukan. Coba cek lagi kode/link-nya.');
        return;
      }

      if (kuisData.status !== 'aktif') {
        setKuis(kuisData);
        setTahap('belum_aktif');
        return;
      }

      const { data: soalData, error: errSoal } = await supabase
        .from('soal_kuis_seru')
        .select('*')
        .eq('kuis_id', kuisData.id)
        .order('urutan', { ascending: true });

      if (errSoal || !soalData || soalData.length === 0) {
        setTahap('tidak_ditemukan');
        setPesanError('Kuis ini belum punya soal. Coba lagi nanti.');
        return;
      }

      setKuis(kuisData);
      setDaftarSoal(soalData);
      setTahap('isi_nama');
    }

    ambilKuis();
  }, [kodeDariUrl]);

  function mulaiKuis() {
    if (!namaSiswa.trim()) {
      setPesanError('Isi namamu dulu ya.');
      return;
    }
    setPesanError('');
    setIndexSoal(0);
    setJawabanTerpilih(null);
    setSemuaJawaban([]);
    setTahap('mengerjakan');
  }

  function pilihJawaban(huruf) {
    if (jawabanTerpilih) return; // sudah dijawab, tidak bisa diganti
    setJawabanTerpilih(huruf);
  }

  async function lanjutSoalBerikutnya() {
    const soalIni = daftarSoal[indexSoal];
    const benar = jawabanTerpilih.toUpperCase() === String(soalIni.jawaban_benar).toUpperCase();

    const rekapBaru = [
      ...semuaJawaban,
      {
        soal_id: soalIni.id,
        jawaban_siswa: jawabanTerpilih,
        jawaban_benar: soalIni.jawaban_benar,
        benar,
      },
    ];
    setSemuaJawaban(rekapBaru);

    if (indexSoal + 1 < daftarSoal.length) {
      setIndexSoal(indexSoal + 1);
      setJawabanTerpilih(null);
    } else {
      await selesaikanKuis(rekapBaru);
    }
  }

  async function selesaikanKuis(rekapAkhir) {
    setTahap('selesai');

    const jumlahBenar = rekapAkhir.filter((r) => r.benar).length;
    const totalSoal = daftarSoal.length;
    const skor = Math.round((jumlahBenar / totalSoal) * 100);

    // Simpan hasil ke tabel hasil_kuis_seru kalau tabelnya ada.
    // Dibungkus try/catch supaya kalau tabel belum dibuat, siswa tetap lihat hasilnya.
    setMenyimpanHasil(true);
    try {
      await supabase.from('hasil_kuis_seru').insert({
        kuis_id: kuis.id,
        nama_siswa: namaSiswa.trim(),
        jumlah_benar: jumlahBenar,
        total_soal: totalSoal,
        skor,
      });
    } catch {
      // diamkan saja, tidak mengganggu pengalaman siswa
    } finally {
      setMenyimpanHasil(false);
    }
  }

  const jumlahBenarAkhir = semuaJawaban.filter((r) => r.benar).length;
  const skorAkhir =
    daftarSoal.length > 0 ? Math.round((jumlahBenarAkhir / daftarSoal.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-400 flex items-center justify-center text-white shadow-sm">
            <Gamepad2 size={20} />
          </div>
          <h1 className="text-xl font-bold text-ink-900">Kuis Seru</h1>
        </div>

        {tahap === 'memuat' && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-pink-500" />
            <p className="text-sm text-ink-700/60">Memuat kuis...</p>
          </div>
        )}

        {tahap === 'tidak_ditemukan' && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 text-center">
            <XCircle size={32} className="text-rose-500 mx-auto mb-3" />
            <p className="text-sm text-ink-700">{pesanError}</p>
          </div>
        )}

        {tahap === 'belum_aktif' && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-8 text-center">
            <Loader2 size={28} className="text-amber-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-ink-800 mb-1">Kuis "{kuis?.judul}" belum diaktifkan</p>
            <p className="text-sm text-ink-700/60">Minta gurumu untuk mengaktifkan kuis ini dulu, lalu buka lagi link-nya.</p>
          </div>
        )}

        {tahap === 'isi_nama' && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
            <p className="text-sm text-ink-700/60 mb-1">Kuis</p>
            <h2 className="text-lg font-bold text-ink-900 mb-1">{kuis.judul}</h2>
            <p className="text-sm text-ink-700/60 mb-5">
              {kuis.mata_pelajaran} • Kelas {kuis.kelas} • {daftarSoal.length} soal
            </p>

            <label className="block text-sm font-medium text-ink-700 mb-1">Nama kamu</label>
            <input
              value={namaSiswa}
              onChange={(e) => setNamaSiswa(e.target.value)}
              placeholder="Tulis namamu di sini"
              className="w-full border border-ink-200 rounded-lg px-3 py-2 text-sm mb-3"
              onKeyDown={(e) => e.key === 'Enter' && mulaiKuis()}
            />

            {pesanError && (
              <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-3">{pesanError}</p>
            )}

            <button
              onClick={mulaiKuis}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-orange-400 text-white font-bold text-sm hover:opacity-90"
            >
              <Gamepad2 size={16} /> Mulai Kuis
            </button>
          </div>
        )}

        {tahap === 'mengerjakan' && daftarSoal[indexSoal] && (
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-ink-700/60">
                Soal {indexSoal + 1} dari {daftarSoal.length}
              </p>
              <div className="w-32 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-pink-500 to-orange-400 transition-all"
                  style={{ width: `${((indexSoal + 1) / daftarSoal.length) * 100}%` }}
                />
              </div>
            </div>

            {daftarSoal[indexSoal].gambar_url && (
              <img
                src={daftarSoal[indexSoal].gambar_url}
                alt="Gambar soal"
                className="w-full max-h-56 object-contain rounded-xl bg-ink-50 mb-4"
              />
            )}
            <p className="text-base font-semibold text-ink-900 mb-4">{daftarSoal[indexSoal].soal}</p>

            <div className="space-y-2 mb-5">
              {HURUF_PILIHAN.map((huruf) => {
                const teksPilihan = daftarSoal[indexSoal][`pilihan_${huruf}`];
                if (!teksPilihan) return null;

                const sudahDijawab = jawabanTerpilih !== null;
                const iniDipilih = jawabanTerpilih === huruf;
                const iniJawabanBenar = String(daftarSoal[indexSoal].jawaban_benar).toUpperCase() === huruf.toUpperCase();

                let kelasTombol = 'border-ink-200 hover:bg-pink-50/50';
                if (sudahDijawab && iniJawabanBenar) {
                  kelasTombol = 'border-emerald-400 bg-emerald-50 text-emerald-700';
                } else if (sudahDijawab && iniDipilih && !iniJawabanBenar) {
                  kelasTombol = 'border-rose-400 bg-rose-50 text-rose-700';
                } else if (sudahDijawab) {
                  kelasTombol = 'border-ink-100 text-ink-700/40';
                }

                return (
                  <button
                    key={huruf}
                    onClick={() => pilihJawaban(huruf)}
                    disabled={sudahDijawab}
                    className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border text-sm font-medium transition ${kelasTombol}`}
                  >
                    <span className="w-6 h-6 flex items-center justify-center rounded-full bg-ink-50 text-xs font-bold uppercase shrink-0">
                      {huruf}
                    </span>
                    <span className="flex-1">{teksPilihan}</span>
                    {sudahDijawab && iniJawabanBenar && <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />}
                    {sudahDijawab && iniDipilih && !iniJawabanBenar && <XCircle size={18} className="text-rose-500 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {jawabanTerpilih && (
              <button
                onClick={lanjutSoalBerikutnya}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-ink-900 text-white font-bold text-sm hover:bg-ink-800"
              >
                {indexSoal + 1 < daftarSoal.length ? 'Soal Berikutnya' : 'Lihat Hasil'}
                <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}

        {tahap === 'selesai' && (
          <div className="bg-white rounded-2xl border border-pink-100 shadow-sm p-8 text-center">
            <PartyPopper size={36} className="text-pink-500 mx-auto mb-3" />
            <p className="text-sm text-ink-700/60 mb-1">Kerja bagus, {namaSiswa}!</p>
            <p className="text-4xl font-black text-pink-600 mb-2">{skorAkhir}</p>
            <p className="text-sm text-ink-700 mb-6">
              Benar {jumlahBenarAkhir} dari {daftarSoal.length} soal
            </p>
            {menyimpanHasil && (
              <p className="text-xs text-ink-700/40 flex items-center justify-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Menyimpan hasil...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
