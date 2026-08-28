import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient'; // sesuaikan kalau nama/lokasi file berbeda
import { useAuth } from '../lib/AuthContext';
import Layout from '../components/Layout';

// Membuat kode ujian acak 6 karakter, misal: X7K2QP
function buatKodeUjian() {
  const karakter = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O, 1/I biar tidak tertukar
  let kode = '';
  for (let i = 0; i < 6; i++) {
    kode += karakter[Math.floor(Math.random() * karakter.length)];
  }
  return kode;
}

export default function BuatUjian() {
  const { session } = useAuth();
  const guruId = session?.user?.id;

  const [daftarKelas, setDaftarKelas] = useState([]); // [{id, nama_kelas}]
  const [judul, setJudul] = useState('');
  const [mapel, setMapel] = useState('');
  const [kelasId, setKelasId] = useState('');
  const [fileExcel, setFileExcel] = useState(null);
  const [soalPreview, setSoalPreview] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | membaca | menyimpan | selesai | error
  const [pesanError, setPesanError] = useState('');
  const [ujianDibuat, setUjianDibuat] = useState(null);
  const [tersalin, setTersalin] = useState(false); // status tombol "Copy Link"

  // --- Sumber soal: upload Excel baru, atau pilih dari Bank Soal yang sudah ada ---
  const [sumberSoal, setSumberSoal] = useState('excel'); // 'excel' | 'bank'
  const [bankSoalList, setBankSoalList] = useState([]); // semua soal dari tabel bank_soal
  const [bankLoading, setBankLoading] = useState(false);
  const [mapelBankFilter, setMapelBankFilter] = useState('');
  const [idTerpilih, setIdTerpilih] = useState(new Set()); // id soal bank_soal yang dicentang

  // Ambil daftar kelas dari tabel "kelas" yang sudah ada di SIMAK
  useEffect(() => {
    async function ambilKelas() {
      const { data, error } = await supabase.from('kelas').select('id, nama_kelas');
      if (!error && data) {
        setDaftarKelas(data);
        if (data.length > 0) setKelasId(data[0].id);
      }
    }
    ambilKelas();
  }, []);

  // Ambil semua soal dari Bank Soal saat tab "Pilih dari Bank Soal" pertama kali dibuka
  useEffect(() => {
    if (sumberSoal !== 'bank' || bankSoalList.length > 0 || bankLoading) return;
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
  }, [sumberSoal, bankSoalList.length, bankLoading]);

  const daftarMapelBank = [...new Set(bankSoalList.map((s) => s.mata_pelajaran))].sort();
  const bankSoalTampil = mapelBankFilter
    ? bankSoalList.filter((s) => s.mata_pelajaran === mapelBankFilter)
    : bankSoalList;

  function toggleSoalBank(id) {
    setIdTerpilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pilihSemuaSoalBank() {
    setIdTerpilih((prev) => {
      const semuaSudahTerpilih = bankSoalTampil.every((s) => prev.has(s.id));
      if (semuaSudahTerpilih) {
        // batalkan pilihan untuk soal yang sedang ditampilkan saja
        const next = new Set(prev);
        bankSoalTampil.forEach((s) => next.delete(s.id));
        return next;
      }
      const next = new Set(prev);
      bankSoalTampil.forEach((s) => next.add(s.id));
      return next;
    });
  }

  // Menyalin soal yang dicentang dari Bank Soal ke dalam draft ujian (format sama seperti hasil baca Excel)
  function gunakanSoalTerpilih() {
    const dipilih = bankSoalList.filter((s) => idTerpilih.has(s.id));
    if (dipilih.length === 0) {
      setPesanError('Centang minimal 1 soal dari Bank Soal dulu.');
      return;
    }
    const soalTerpakai = dipilih.map((s, i) => ({
      urutan: i + 1,
      soal: s.soal,
      pilihan_a: s.pilihan_a,
      pilihan_b: s.pilihan_b,
      pilihan_c: s.pilihan_c,
      pilihan_d: s.pilihan_d,
      jawaban_benar: s.jawaban_benar,
    }));
    setSoalPreview(soalTerpakai);
    // Isi otomatis Mata Pelajaran kalau kolomnya masih kosong, biar konsisten dengan soal yang dipakai
    if (!mapel && mapelBankFilter) setMapel(mapelBankFilter);
    setPesanError('');
  }

  function bacaFileExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileExcel(file);
    setStatus('membaca');
    setPesanError('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

        const soalTerbaca = rows.map((row, i) => ({
          urutan: i + 1,
          soal: String(row['soal'] ?? row['Soal'] ?? '').trim(),
          pilihan_a: String(row['pilihan_a'] ?? row['A'] ?? '').trim(),
          pilihan_b: String(row['pilihan_b'] ?? row['B'] ?? '').trim(),
          pilihan_c: String(row['pilihan_c'] ?? row['C'] ?? '').trim(),
          pilihan_d: String(row['pilihan_d'] ?? row['D'] ?? '').trim(),
          jawaban_benar: String(row['jawaban_benar'] ?? row['jawaban'] ?? '')
            .trim()
            .toUpperCase(),
        }));

        const tidakLengkap = soalTerbaca.filter(
          (s) =>
            !s.soal ||
            !s.pilihan_a ||
            !s.pilihan_b ||
            !s.pilihan_c ||
            !s.pilihan_d ||
            !['A', 'B', 'C', 'D'].includes(s.jawaban_benar)
        );

        if (soalTerbaca.length === 0) {
          throw new Error('File Excel kosong atau format kolom tidak dikenali.');
        }
        if (tidakLengkap.length > 0) {
          throw new Error(
            `Ada ${tidakLengkap.length} baris tidak lengkap (cek kolom soal, pilihan A-D, dan jawaban_benar harus A/B/C/D).`
          );
        }

        setSoalPreview(soalTerbaca);
        setStatus('idle');
      } catch (err) {
        setPesanError(err.message);
        setSoalPreview([]);
        setStatus('error');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function simpanUjian() {
    if (!judul || !mapel || !kelasId) {
      setPesanError('Judul, mata pelajaran, dan kelas wajib diisi.');
      return;
    }
    if (soalPreview.length === 0) {
      setPesanError('Upload file Excel soal dulu.');
      return;
    }

    setStatus('menyimpan');
    setPesanError('');

    const kodeUjian = buatKodeUjian();

    const { data: ujian, error: errUjian } = await supabase
      .from('ujian')
      .insert({
        judul,
        mata_pelajaran: mapel,
        kelas_id: kelasId,
        kode_ujian: kodeUjian,
        guru_id: guruId,
        status: 'draft',
      })
      .select()
      .single();

    if (errUjian) {
      setPesanError('Gagal membuat ujian: ' + errUjian.message);
      setStatus('error');
      return;
    }

    const baris = soalPreview.map((s) => ({ ...s, ujian_id: ujian.id }));
    const { error: errSoal } = await supabase.from('soal_ujian').insert(baris);

    if (errSoal) {
      setPesanError('Ujian dibuat tapi soal gagal disimpan: ' + errSoal.message);
      setStatus('error');
      return;
    }

    setUjianDibuat(ujian);
    setStatus('selesai');
  }

  async function aktifkanUjian() {
    const { error } = await supabase
      .from('ujian')
      .update({ status: 'aktif' })
      .eq('id', ujianDibuat.id);

    if (!error) {
      setUjianDibuat({ ...ujianDibuat, status: 'aktif' });
    }
  }

  // Membangun link lengkap ke halaman siswa, contoh: https://simak-sekolah.com/ujian-online?kode=X7K2QP
  function buatLinkUjian(kode) {
    return `${window.location.origin}/ujian-online?kode=${kode}`;
  }

  async function copyLinkUjian() {
    // Sengaja HANYA menyalin link-nya saja (bukan "Link Ujian: ... Kode Ujian: XXX" digabung),
    // karena kalau teks gabungan itu ditempel langsung ke address bar, semuanya
    // ikut terbaca sebagai satu URL dan bikin kode ujian jadi salah/rusak.
    const teks = buatLinkUjian(ujianDibuat.kode_ujian);
    try {
      await navigator.clipboard.writeText(teks);
      setTersalin(true);
      setTimeout(() => setTersalin(false), 2000);
    } catch (err) {
      setPesanError('Gagal menyalin link. Salin manual: ' + teks);
    }
  }

  if (status === 'selesai' && ujianDibuat) {
    const namaKelasDibuat = daftarKelas.find((k) => k.id === ujianDibuat.kelas_id)?.nama_kelas;
    return (
      <Layout title="Buat Ujian" subtitle="Ujian baru berhasil dibuat">
        <div className="w-full max-w-xl p-6 rounded-xl border border-[#6b0f1a]/15 bg-white shadow-sm">
          <h3 className="text-lg font-semibold text-[#3b0a0a] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#d4a017]"></span>
            Ujian berhasil dibuat 🎉
          </h3>
          <p className="mt-2 text-sm text-gray-700">
            Bagikan Kode Ujian ini ke siswa kelas <strong>{namaKelasDibuat}</strong>:
          </p>
          <div className="mt-3 text-3xl font-mono font-bold tracking-widest text-[#6b0f1a] text-center bg-[#f7e6e3] rounded-lg py-3">
            {ujianDibuat.kode_ujian}
          </div>

          <p className="mt-4 text-sm text-gray-700">Atau bagikan link langsung ini ke siswa:</p>
          <div className="mt-2 flex items-stretch gap-2">
            <input
              readOnly
              value={buatLinkUjian(ujianDibuat.kode_ujian)}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-lg px-3 py-2 border border-[#6b0f1a]/15 bg-[#f7e6e3]/40 text-sm text-[#3b0a0a] font-mono truncate"
            />
            <button
              onClick={copyLinkUjian}
              className="px-4 py-2 rounded-lg bg-[#d4a017] text-[#3b0a0a] font-medium hover:bg-[#c4930f] transition-colors whitespace-nowrap"
            >
              {tersalin ? 'Tersalin! ✓' : 'Copy Link'}
            </button>
          </div>

          <p className="mt-3 text-sm text-gray-600">
            Status saat ini: <strong>{ujianDibuat.status}</strong>. Siswa baru bisa mengerjakan
            setelah Anda klik Aktifkan.
          </p>
          {ujianDibuat.status !== 'aktif' && (
            <button
              onClick={aktifkanUjian}
              className="mt-4 px-4 py-2 rounded-lg bg-[#6b0f1a] text-white font-medium hover:bg-[#7d1420] transition-colors"
            >
              Aktifkan Ujian
            </button>
          )}
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Buat Ujian" subtitle="Buat ujian online baru dari Excel atau Bank Soal">
      <div className="w-full max-w-xl space-y-4 bg-white rounded-xl border border-[#6b0f1a]/15 shadow-sm p-6">
        <h3 className="text-lg font-semibold text-[#3b0a0a] flex items-center gap-2">
          <span className="w-1.5 h-5 rounded-full bg-[#d4a017]"></span>
          Buat Ujian Baru
        </h3>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#6b0f1a]">Judul Ujian</label>
          <input
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            className="w-full rounded-lg px-3 py-2 border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
            placeholder="Ulangan Harian Bab 3"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#6b0f1a]">Mata Pelajaran</label>
          <input
            value={mapel}
            onChange={(e) => setMapel(e.target.value)}
            className="w-full rounded-lg px-3 py-2 border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
            placeholder="Matematika"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[#6b0f1a]">Kelas</label>
          <select
            value={kelasId}
            onChange={(e) => setKelasId(e.target.value)}
            className="w-full rounded-lg px-3 py-2 border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
          >
            {daftarKelas.length === 0 && <option value="">Belum ada data kelas</option>}
            {daftarKelas.map((k) => (
              <option key={k.id} value={k.id}>
                Kelas {k.nama_kelas}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-[#6b0f1a]">Sumber Soal</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSumberSoal('excel');
                setSoalPreview([]);
                setPesanError('');
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                sumberSoal === 'excel'
                  ? 'bg-[#6b0f1a] text-white'
                  : 'bg-[#6b0f1a]/5 text-[#6b0f1a] hover:bg-[#6b0f1a]/10'
              }`}
            >
              Upload Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setSumberSoal('bank');
                setSoalPreview([]);
                setPesanError('');
              }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                sumberSoal === 'bank'
                  ? 'bg-[#6b0f1a] text-white'
                  : 'bg-[#6b0f1a]/5 text-[#6b0f1a] hover:bg-[#6b0f1a]/10'
              }`}
            >
              Pilih dari Bank Soal
            </button>
          </div>
        </div>

        {sumberSoal === 'excel' && (
          <div>
            <label className="block text-sm font-medium mb-1 text-[#6b0f1a]">
              Upload Soal (Excel — kolom: soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={bacaFileExcel}
              className="w-full text-sm text-[#6b0f1a]/80 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#6b0f1a] file:text-white file:font-medium hover:file:bg-[#7d1420] file:cursor-pointer file:transition-colors"
            />
          </div>
        )}

        {sumberSoal === 'bank' && (
          <div className="space-y-3">
            {bankLoading ? (
              <p className="text-sm text-[#6b0f1a]/60">Memuat Bank Soal...</p>
            ) : bankSoalList.length === 0 ? (
              <p className="text-sm text-[#6b0f1a]/60">
                Belum ada soal di Bank Soal. Upload dulu lewat menu Bank Soal.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={mapelBankFilter}
                    onChange={(e) => setMapelBankFilter(e.target.value)}
                    className="rounded-lg px-3 py-1.5 border border-[#6b0f1a]/15 text-sm text-[#3b0a0a] outline-none"
                  >
                    <option value="">Semua Mata Pelajaran</option>
                    {daftarMapelBank.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={pilihSemuaSoalBank}
                    className="text-xs font-medium text-[#6b0f1a] underline"
                  >
                    Pilih/Batal semua ({bankSoalTampil.length} soal)
                  </button>
                </div>

                <div className="max-h-72 overflow-y-auto border border-[#6b0f1a]/15 rounded-lg divide-y divide-[#6b0f1a]/10">
                  {bankSoalTampil.map((s, i) => (
                    <label
                      key={s.id}
                      className="flex items-start gap-2 p-3 text-sm cursor-pointer hover:bg-[#f7e6e3]/40"
                    >
                      <input
                        type="checkbox"
                        checked={idTerpilih.has(s.id)}
                        onChange={() => toggleSoalBank(s.id)}
                        className="mt-1"
                      />
                      <span className="text-[#3b0a0a]">
                        {i + 1}. {s.soal}{' '}
                        <span className="text-[#6b0f1a]/50">({s.mata_pelajaran})</span>
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={gunakanSoalTerpilih}
                  className="w-full py-2 rounded-lg bg-[#d4a017] text-[#3b0a0a] font-medium hover:bg-[#c4930f] transition-colors"
                >
                  Gunakan {idTerpilih.size} Soal Terpilih
                </button>
              </>
            )}
          </div>
        )}

        {pesanError && (
          <div className="text-sm text-[#8f1f22] bg-[#6b0f1a]/5 border border-[#6b0f1a]/20 rounded-lg p-3">
            {pesanError}
          </div>
        )}

        {soalPreview.length > 0 && (
          <div className="text-sm text-[#3b0a0a] bg-[#d4a017]/10 border border-[#d4a017]/30 rounded-lg p-3">
            ✅ {soalPreview.length} soal siap dipakai ({sumberSoal === 'bank' ? 'dari Bank Soal' : 'dari Excel'}).
            Contoh soal #1: <em>{soalPreview[0].soal}</em>
          </div>
        )}

        <button
          onClick={simpanUjian}
          disabled={status === 'menyimpan'}
          className="px-4 py-2 rounded-lg bg-[#6b0f1a] text-white font-medium hover:bg-[#7d1420] transition-colors disabled:opacity-50"
        >
          {status === 'menyimpan' ? 'Menyimpan...' : 'Simpan Ujian'}
        </button>
      </div>
    </Layout>
  );
}
