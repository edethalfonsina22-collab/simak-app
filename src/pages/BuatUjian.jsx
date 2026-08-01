import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient'; // sesuaikan kalau nama/lokasi file berbeda
import { useAuth } from '../lib/AuthContext';

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

  const [daftarKelas, setDaftarKelas] = useState([]);
  const [judul, setJudul] = useState('');
  const [mapel, setMapel] = useState('');
  const [kelas, setKelas] = useState('');
  const [fileExcel, setFileExcel] = useState(null);
  const [soalPreview, setSoalPreview] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | membaca | menyimpan | selesai | error
  const [pesanError, setPesanError] = useState('');
  const [ujianDibuat, setUjianDibuat] = useState(null);

  // Ambil daftar kelas dari tabel "kelas" yang sudah ada di SIMAK
  useEffect(() => {
    async function ambilKelas() {
      const { data, error } = await supabase.from('kelas').select('nama_kelas');
      if (!error && data) {
        const daftar = data.map((k) => k.nama_kelas);
        setDaftarKelas(daftar);
        if (daftar.length > 0) setKelas(daftar[0]);
      }
    }
    ambilKelas();
  }, []);

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
    if (!judul || !mapel || !kelas) {
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
        kelas,
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

  if (status === 'selesai' && ujianDibuat) {
    return (
      <div className="p-6 rounded-xl border border-green-200 bg-green-50">
        <h3 className="text-lg font-semibold text-green-800">Ujian berhasil dibuat 🎉</h3>
        <p className="mt-2 text-sm text-gray-700">
          Bagikan Kode Ujian ini ke siswa kelas <strong>{ujianDibuat.kelas}</strong>:
        </p>
        <div className="mt-3 text-3xl font-mono font-bold tracking-widest text-green-700">
          {ujianDibuat.kode_ujian}
        </div>
        <p className="mt-3 text-sm text-gray-600">
          Status saat ini: <strong>{ujianDibuat.status}</strong>. Siswa baru bisa mengerjakan
          setelah Anda klik Aktifkan.
        </p>
        {ujianDibuat.status !== 'aktif' && (
          <button
            onClick={aktifkanUjian}
            className="mt-4 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700"
          >
            Aktifkan Ujian
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-4">
      <h3 className="text-lg font-semibold">Buat Ujian Baru</h3>

      <div>
        <label className="block text-sm font-medium mb-1">Judul Ujian</label>
        <input
          value={judul}
          onChange={(e) => setJudul(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Ulangan Harian Bab 3"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Mata Pelajaran</label>
        <input
          value={mapel}
          onChange={(e) => setMapel(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
          placeholder="Matematika"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Kelas</label>
        <select
          value={kelas}
          onChange={(e) => setKelas(e.target.value)}
          className="w-full border rounded-lg px-3 py-2"
        >
          {daftarKelas.length === 0 && <option value="">Belum ada data kelas</option>}
          {daftarKelas.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">
          Upload Soal (Excel — kolom: soal, pilihan_a, pilihan_b, pilihan_c, pilihan_d, jawaban_benar)
        </label>
        <input type="file" accept=".xlsx,.xls" onChange={bacaFileExcel} className="w-full" />
      </div>

      {pesanError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
          {pesanError}
        </div>
      )}

      {soalPreview.length > 0 && (
        <div className="text-sm text-gray-700 bg-gray-50 border rounded-lg p-3">
          ✅ {soalPreview.length} soal terbaca dari Excel. Contoh soal #1:{' '}
          <em>{soalPreview[0].soal}</em>
        </div>
      )}

      <button
        onClick={simpanUjian}
        disabled={status === 'menyimpan'}
        className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {status === 'menyimpan' ? 'Menyimpan...' : 'Simpan Ujian'}
      </button>
    </div>
  );
}
