import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Printer, Loader2 } from 'lucide-react'

/**
 * =====================================================================================
 * CATATAN PERUBAHAN & ASUMSI SKEMA DATABASE (baca sebelum deploy)
 * =====================================================================================
 * Komponen ini diubah total mengikuti format "LAPORAN HASIL BELAJAR PESERTA DIDIK"
 * jenjang SD (Kurikulum 2013): Sikap, Pengetahuan & Keterampilan terpisah (KI-3/KI-4),
 * Ekstrakurikuler, Saran, Tinggi/Berat Badan per semester, Kondisi Kesehatan, Prestasi,
 * Ketidakhadiran, Kepribadian, rekap Nilai (Jumlah/Rata-rata/Nilai Akhir), dan Keputusan.
 *
 * Beberapa data pada model baru ini BELUM ADA di skema lama, sehingga kode di bawah
 * mengasumsikan kolom/tabel tambahan berikut. Jalankan SQL ini di Supabase dulu:
 *
 *   -- 1) Kolom nilai per mapel dibedakan Pengetahuan (KI-3) & Keterampilan (KI-4).
 *   --    Kolom `jenis` pada tabel `nilai` HARUS diisi persis 'Pengetahuan' atau
 *   --    'Keterampilan' (bukan lagi nama jenis ujian seperti UH/UTS/UAS).
 *   --    Predikat akan dihitung otomatis dari nilai jika kolom predikat kosong.
 *   ALTER TABLE nilai ADD COLUMN IF NOT EXISTS predikat text;
 *
 *   -- 2) Deskripsi capaian sekarang bisa dibedakan per Pengetahuan/Keterampilan.
 *   --    Jika kolom `jenis` kosong/null, deskripsi yang sama dipakai untuk keduanya.
 *   ALTER TABLE capaian_mapel ADD COLUMN IF NOT EXISTS jenis text;
 *
 *   -- 3) Kolom tambahan pada catatan_siswa (sikap, kepribadian, saran, kesehatan rinci)
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS sikap_spiritual text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS sikap_sosial text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS perilaku text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kerajinan text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kerapian text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS saran text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kondisi_pendengaran text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kondisi_penglihatan text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kondisi_gigi text;
 *   ALTER TABLE catatan_siswa ADD COLUMN IF NOT EXISTS kondisi_lainnya text;
 *
 *   -- 4) Tabel baru untuk prestasi siswa (strukturnya sama seperti ekstrakurikuler_nilai)
 *   CREATE TABLE IF NOT EXISTS prestasi_siswa (
 *     id uuid primary key default gen_random_uuid(),
 *     siswa_id uuid references siswa(id),
 *     semester text,
 *     tahun_ajaran text,
 *     jenis_prestasi text,
 *     keterangan text
 *   );
 *
 *   -- 5) (Opsional) KKM ditampilkan di footer. Jika kosong, dipakai default 75/70.
 *   ALTER TABLE profil_sekolah ADD COLUMN IF NOT EXISTS kkm_pai_ppkn integer;
 *   ALTER TABLE profil_sekolah ADD COLUMN IF NOT EXISTS kkm_lainnya integer;
 *
 * Header sekolah (dinas pendidikan/kabupaten/kecamatan/NPSN) TIDAK diubah karena
 * sekolah Anda berstatus negeri — hanya isi/badan rapor yang diselaraskan dengan
 * model PDF yang dilampirkan.
 * =====================================================================================
 */

// PERBAIKAN: sama seperti di Rapor.jsx — menghitung rentang tanggal dari
// kombinasi tahun ajaran + semester, supaya rekap kehadiran yang tercetak
// hanya mengambil data presensi pada periode rapor yang dipilih, bukan
// seluruh riwayat presensi siswa sepanjang masa.
// Format tahunAjaran yang didukung: "2025/2026".
//   Semester Ganjil -> 1 Juli s/d 31 Desember tahun awal (2025-07-01 s/d 2025-12-31)
//   Semester Genap  -> 1 Januari s/d 30 Juni tahun akhir (2026-01-01 s/d 2026-06-30)
function rentangTanggalPeriode(tahunAjaran, semester) {
  if (!tahunAjaran) return null
  const bagian = tahunAjaran.split('/')
  if (bagian.length !== 2) return null

  const tahunAwal = parseInt(bagian[0], 10)
  const tahunAkhir = parseInt(bagian[1], 10)
  if (isNaN(tahunAwal) || isNaN(tahunAkhir)) return null

  if (semester === 'Genap') {
    return { mulai: `${tahunAkhir}-01-01`, selesai: `${tahunAkhir}-06-30` }
  }
  // Default / Ganjil
  return { mulai: `${tahunAwal}-07-01`, selesai: `${tahunAwal}-12-31` }
}

// Ekstrak angka kelas dari nama_kelas seperti "6-A", "Kelas 6", "VI-B" -> 6
function angkaKelas(namaKelas) {
  if (!namaKelas) return null
  const romawi = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 }
  const cocokAngka = namaKelas.match(/\d+/)
  if (cocokAngka) return parseInt(cocokAngka[0], 10)
  const cocokRomawi = namaKelas.match(/\b(VI|IV|I{1,3}|V)\b/i)
  if (cocokRomawi) return romawi[cocokRomawi[0].toUpperCase()]
  return null
}

const ANGKA_ROMAWI = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const ANGKA_KATA = ['', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas', 'Duabelas']

// Menghitung nomor semester kumulatif (1..12) dari kelas 1-6 dan semester Ganjil/Genap
function semesterKumulatif(kelas, semester) {
  if (!kelas) return null
  const dasar = (kelas - 1) * 2
  return dasar + (semester === 'Genap' ? 2 : 1)
}

function formatTanggalIndonesia(tanggal) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(tanggal)
}

// Predikat mengikuti skala Kurikulum 2013: interval = (100 - KKM) / 3
//   A: KKM + 2*interval s/d 100 | B: KKM + interval s/d < KKM + 2*interval
//   C: KKM s/d < KKM + interval | D: < KKM
function hitungPredikat(nilai, kkm) {
  if (nilai === null || nilai === undefined || isNaN(nilai)) return '-'
  const interval = (100 - kkm) / 3
  if (nilai >= kkm + 2 * interval) return 'A'
  if (nilai >= kkm + interval) return 'B'
  if (nilai >= kkm) return 'C'
  return 'D'
}

function kkmUntukMapel(mapel, kkmPaiPpkn, kkmLainnya) {
  const nama = (mapel || '').toLowerCase()
  if (nama.includes('agama') || nama.includes('pancasila') || nama.includes('ppkn')) return kkmPaiPpkn
  return kkmLainnya
}

// Cari keterangan berdasarkan kecocokan sebagian nama kategori (case-insensitive)
function cariKeterangan(list, keyField, namaKategori) {
  const hit = (list || []).find((item) =>
    (item[keyField] || '').toLowerCase().includes(namaKategori.toLowerCase())
  )
  return hit?.keterangan || '-'
}

const KATEGORI_EKSKUL = ['Pramuka', 'Olah Raga', 'Keagamaan', 'Seni', 'Akademik']
const KATEGORI_PRESTASI = ['Pramuka', 'Kesenian', 'Olahraga', 'Keagamaan', 'Akademik']

export default function RaporCetak() {
  const [searchParams] = useSearchParams()
  const siswaId = searchParams.get('siswaId')
  const semester = searchParams.get('semester')
  const tahunAjaran = searchParams.get('tahunAjaran')

  const [loading, setLoading] = useState(true)
  const [siswa, setSiswa] = useState(null)
  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [capaianList, setCapaianList] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [prestasiList, setPrestasiList] = useState([])
  const [catatan, setCatatan] = useState(null)
  const [tinggiBeratPerSemester, setTinggiBeratPerSemester] = useState({})
  const [sekolah, setSekolah] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')

  useEffect(() => {
    if (!siswaId || !semester || !tahunAjaran) {
      setLoading(false)
      return
    }
    muatSemua()
  }, [siswaId, semester, tahunAjaran])

  async function muatSemua() {
    setLoading(true)

    // PERBAIKAN: query presensi diberi filter rentang tanggal sesuai
    // semester & tahun ajaran yang sedang dicetak.
    const periode = rentangTanggalPeriode(tahunAjaran, semester)
    let queryPresensi = supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId)
    if (periode) {
      queryPresensi = queryPresensi.gte('tanggal', periode.mulai).lte('tanggal', periode.selesai)
    }

    const [
      { data: siswaRow },
      { data: nilaiRows },
      { data: presensiRows },
      { data: capaianRows },
      { data: ekskulRows },
      { data: prestasiRows },
      { data: catatanRow },
      { data: tinggiBeratRows },
      { data: sekolahRow },
    ] = await Promise.all([
      supabase
        .from('siswa')
        .select(
          'id, nama_lengkap, nis, nisn, nama_orang_tua, kelas(nama_kelas, wali_kelas:guru!wali_kelas_id(nama_lengkap, nip))'
        )
        .eq('id', siswaId)
        .single(),
      supabase
        .from('nilai')
        .select('mata_pelajaran, jenis, nilai, predikat')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase
        .from('capaian_mapel')
        .select('mata_pelajaran, jenis, deskripsi_capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('nama_ekstrakurikuler, keterangan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('prestasi_siswa')
        .select('jenis_prestasi, keterangan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select(
          'catatan, saran, tinggi_badan, berat_badan, kondisi_kesehatan, kondisi_pendengaran, kondisi_penglihatan, kondisi_gigi, kondisi_lainnya, sikap_spiritual, sikap_sosial, perilaku, kerajinan, kerapian, keputusan'
        )
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .maybeSingle(),
      supabase
        .from('catatan_siswa')
        .select('semester, tinggi_badan, berat_badan')
        .eq('siswa_id', siswaId)
        .eq('tahun_ajaran', tahunAjaran)
        .in('semester', ['Ganjil', 'Genap']),
      supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle(),
    ])

    setSekolah(sekolahRow || null)
    if (sekolahRow?.logo_path) {
      const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(sekolahRow.logo_path)
      setLogoUrl(pub.publicUrl)
    }

    setSiswa(siswaRow || null)
    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) {
      if (rekap[p.status] !== undefined) rekap[p.status]++
    }
    setPresensi(rekap)
    setCapaianList(capaianRows || [])
    setEkskulList(ekskulRows || [])
    setPrestasiList(prestasiRows || [])
    setCatatan(catatanRow || null)

    const tb = {}
    for (const row of tinggiBeratRows || []) {
      tb[row.semester] = { tinggi: row.tinggi_badan, berat: row.berat_badan }
    }
    setTinggiBeratPerSemester(tb)

    setLoading(false)
  }

  const kkmPaiPpkn = sekolah?.kkm_pai_ppkn || 75
  const kkmLainnya = sekolah?.kkm_lainnya || 70

  // Gabungkan nilai per mapel, dipecah Pengetahuan (KI-3) & Keterampilan (KI-4)
  const mapelSet = new Set()
  nilai.forEach((n) => mapelSet.add(n.mata_pelajaran))
  capaianList.forEach((c) => mapelSet.add(c.mata_pelajaran))

  const baseKosong = () => ({ nilai: null, predikat: '-', deskripsi: '' })
  const barisMapel = Array.from(mapelSet).map((mapel) => {
    const kkm = kkmUntukMapel(mapel, kkmPaiPpkn, kkmLainnya)

    const nilaiPengetahuan = nilai.find(
      (n) => n.mata_pelajaran === mapel && (n.jenis || '').toLowerCase() === 'pengetahuan'
    )
    const nilaiKeterampilan = nilai.find(
      (n) => n.mata_pelajaran === mapel && (n.jenis || '').toLowerCase() === 'keterampilan'
    )
    const capaianPengetahuan = capaianList.find(
      (c) => c.mata_pelajaran === mapel && (!c.jenis || c.jenis.toLowerCase() === 'pengetahuan')
    )
    const capaianKeterampilan = capaianList.find(
      (c) => c.mata_pelajaran === mapel && (c.jenis || '').toLowerCase() === 'keterampilan'
    ) || capaianPengetahuan

    const pengetahuan = nilaiPengetahuan
      ? {
          nilai: nilaiPengetahuan.nilai,
          predikat: nilaiPengetahuan.predikat || hitungPredikat(nilaiPengetahuan.nilai, kkm),
          deskripsi: capaianPengetahuan?.deskripsi_capaian || '',
        }
      : { ...baseKosong(), deskripsi: capaianPengetahuan?.deskripsi_capaian || '' }

    const keterampilan = nilaiKeterampilan
      ? {
          nilai: nilaiKeterampilan.nilai,
          predikat: nilaiKeterampilan.predikat || hitungPredikat(nilaiKeterampilan.nilai, kkm),
          deskripsi: capaianKeterampilan?.deskripsi_capaian || '',
        }
      : { ...baseKosong(), deskripsi: capaianKeterampilan?.deskripsi_capaian || '' }

    return { mapel, pengetahuan, keterampilan }
  })

  // J. Nilai — rekap KI-3 (Pengetahuan) & KI-4 (Keterampilan)
  const nilaiPengetahuanValid = barisMapel.map((b) => b.pengetahuan.nilai).filter((v) => v !== null)
  const nilaiKeterampilanValid = barisMapel.map((b) => b.keterampilan.nilai).filter((v) => v !== null)
  const jumlahKi3 = nilaiPengetahuanValid.reduce((a, b) => a + b, 0)
  const jumlahKi4 = nilaiKeterampilanValid.reduce((a, b) => a + b, 0)
  const rataKi3 = nilaiPengetahuanValid.length ? jumlahKi3 / nilaiPengetahuanValid.length : 0
  const rataKi4 = nilaiKeterampilanValid.length ? jumlahKi4 / nilaiKeterampilanValid.length : 0
  const nilaiAkhir =
    nilaiPengetahuanValid.length || nilaiKeterampilanValid.length ? Math.round((rataKi3 + rataKi4) / 2) : null

  const kelasNum = angkaKelas(siswa?.kelas?.nama_kelas)
  const semKumulatif = semesterKumulatif(kelasNum, semester)
  const tempatCetak = sekolah?.kabupaten || sekolah?.kecamatan || ''
  const tanggalCetak = formatTanggalIndonesia(new Date())

  if (!siswaId || !semester || !tahunAjaran) {
    return (
      <div className="p-10 text-center text-ink-700/60">
        Parameter siswa, semester, atau tahun ajaran tidak lengkap. Buka halaman ini dari menu Rapor.
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center gap-2 text-ink-700/60">
        <Loader2 size={18} className="animate-spin" /> Memuat rapor...
      </div>
    )
  }

  if (!siswa) {
    return <div className="p-10 text-center text-ink-700/60">Data siswa tidak ditemukan.</div>
  }

  return (
    <div className="min-h-screen bg-ink-950/5 py-8 print:bg-white print:py-0">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .lembar-cetak { box-shadow: none !important; margin: 0 !important; }
          body { background: white; }
        }
      `}</style>

      <div className="no-print max-w-[800px] mx-auto mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Cetak / Simpan PDF
        </button>
      </div>

      <div className="lembar-cetak max-w-[800px] mx-auto bg-white shadow-lg p-10 text-sm text-ink-950">
        <div className="flex items-center gap-4 mb-1.5">
          <div className="w-20 h-20 shrink-0 flex items-center justify-center">
            {logoUrl && <img src={logoUrl} alt="Logo sekolah" className="w-full h-full object-contain" />}
          </div>
          <div className="text-center flex-1">
            {sekolah?.kabupaten && (
              <p className="font-display font-bold uppercase text-sm tracking-wide">{sekolah.kabupaten}</p>
            )}
            {sekolah?.dinas_pendidikan && (
              <p className="font-display font-bold uppercase text-sm tracking-wide">{sekolah.dinas_pendidikan}</p>
            )}
            <h1 className="font-display text-2xl font-bold uppercase">{sekolah?.nama_sekolah || 'Nama Sekolah'}</h1>
            {sekolah?.kecamatan && (
              <p className="font-display font-bold uppercase text-xs tracking-wide">{sekolah.kecamatan}</p>
            )}
          </div>
          <div className="w-20 shrink-0" />
        </div>
        <div className="border-t-4 border-double border-ink-950 mb-1" />
        <div className="border-t border-ink-950 mb-4" />
        {(sekolah?.npsn || sekolah?.alamat || sekolah?.telepon || sekolah?.email) && (
          <p className="text-center text-xs text-ink-700/60 mb-4">
            {[
              sekolah?.npsn && `NPSN: ${sekolah.npsn}`,
              sekolah?.alamat,
              [sekolah?.telepon, sekolah?.email].filter(Boolean).join(' · '),
            ]
              .filter(Boolean)
              .join(' — ')}
          </p>
        )}

        <div className="text-center mb-6 border-b border-ink-950/20 pb-4">
          <h1 className="font-display text-lg font-semibold uppercase">
            Laporan Hasil Belajar Peserta Didik {semester === 'Genap' ? 'Akhir' : ''} Semester {(semester || '').toUpperCase()}
          </h1>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6">
          <p><span className="text-ink-700/60 inline-block w-32">Nama Peserta Didik</span> : {siswa.nama_lengkap}</p>
          <p><span className="text-ink-700/60 inline-block w-24">Kelas</span> : {siswa.kelas?.nama_kelas || '-'}</p>
          <p><span className="text-ink-700/60 inline-block w-32">NIS / NISN</span> : {siswa.nis || '-'} / {siswa.nisn || '-'}</p>
          <p>
            <span className="text-ink-700/60 inline-block w-24">Semester</span> : {semester}
            {semKumulatif ? ` / ${ANGKA_ROMAWI[semKumulatif]} (${ANGKA_KATA[semKumulatif]})` : ''}
          </p>
          <p><span className="text-ink-700/60 inline-block w-32">Nama Sekolah</span> : {sekolah?.nama_sekolah || '-'}</p>
          <p><span className="text-ink-700/60 inline-block w-24">Tahun Pelajaran</span> : {tahunAjaran}</p>
          <p className="col-span-2"><span className="text-ink-700/60 inline-block w-32">Alamat Sekolah</span> : {sekolah?.alamat || '-'}</p>
        </div>

        <h2 className="font-display font-semibold mb-2">A. Sikap</h2>
        <table className="w-full border-collapse mb-6 text-sm border border-ink-950/20">
          <tbody>
            <tr className="border-b border-ink-950/20 align-top">
              <td className="py-1.5 px-2 w-[22%] font-medium border-r border-ink-950/20">1. Spiritual</td>
              <td className="py-1.5 px-2">{catatan?.sikap_spiritual || '-'}</td>
            </tr>
            <tr className="align-top">
              <td className="py-1.5 px-2 font-medium border-r border-ink-950/20">2. Sosial</td>
              <td className="py-1.5 px-2">{catatan?.sikap_sosial || '-'}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">B. Pengetahuan dan Keterampilan</h2>
        <table className="w-full border-collapse mb-6 text-xs">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th rowSpan={2} className="text-left py-1.5 pr-2 w-[4%] align-bottom">No.</th>
              <th rowSpan={2} className="text-left py-1.5 pr-2 w-[18%] align-bottom">Muatan Pelajaran</th>
              <th colSpan={3} className="text-center py-1.5 border-b border-ink-950/20">Pengetahuan</th>
              <th colSpan={3} className="text-center py-1.5 border-b border-ink-950/20">Keterampilan</th>
            </tr>
            <tr className="border-b border-ink-950/20">
              <th className="text-center py-1.5 pr-1 w-[6%]">Nilai</th>
              <th className="text-center py-1.5 pr-1 w-[6%]">Predikat</th>
              <th className="text-left py-1.5">Deskripsi</th>
              <th className="text-center py-1.5 pr-1 w-[6%]">Nilai</th>
              <th className="text-center py-1.5 pr-1 w-[6%]">Predikat</th>
              <th className="text-left py-1.5">Deskripsi</th>
            </tr>
          </thead>
          <tbody>
            {barisMapel.map((b, i) => (
              <tr key={b.mapel} className="border-b border-ink-950/10 align-top">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{b.mapel}</td>
                <td className="py-1.5 pr-1 text-center font-semibold">{b.pengetahuan.nilai ?? '-'}</td>
                <td className="py-1.5 pr-1 text-center">{b.pengetahuan.predikat}</td>
                <td className="py-1.5">{b.pengetahuan.deskripsi || '-'}</td>
                <td className="py-1.5 pr-1 text-center font-semibold">{b.keterampilan.nilai ?? '-'}</td>
                <td className="py-1.5 pr-1 text-center">{b.keterampilan.predikat}</td>
                <td className="py-1.5">{b.keterampilan.deskripsi || '-'}</td>
              </tr>
            ))}
            {barisMapel.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-ink-700/50">Belum ada data nilai.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">C. Ekstrakurikuler</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[8%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[35%]">Kegiatan Ekstrakurikuler</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {KATEGORI_EKSKUL.map((kategori, i) => (
              <tr key={kategori} className="border-b border-ink-950/10">
                <td className="py-1.5 pr-2">{i + 1}.</td>
                <td className="py-1.5 pr-2">{kategori}</td>
                <td className="py-1.5">{cariKeterangan(ekskulList, 'nama_ekstrakurikuler', kategori)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">D. Saran-saran</h2>
        <div className="border border-ink-950/20 rounded p-3 mb-6 min-h-[2.5rem]">
          {catatan?.saran || catatan?.catatan || '-'}
        </div>

        <h2 className="font-display font-semibold mb-2">E. Tinggi dan Berat Badan</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[40%]">Aspek yang Dinilai</th>
              <th className="text-center py-1.5 pr-2">Semester 1</th>
              <th className="text-center py-1.5">Semester 2</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-950/10">
              <td className="py-1.5 pr-2">1.</td>
              <td className="py-1.5 pr-2">Tinggi Badan</td>
              <td className="py-1.5 pr-2 text-center">{tinggiBeratPerSemester?.Ganjil?.tinggi ?? '-'} cm</td>
              <td className="py-1.5 text-center">{tinggiBeratPerSemester?.Genap?.tinggi ?? '-'} cm</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">2.</td>
              <td className="py-1.5 pr-2">Berat Badan</td>
              <td className="py-1.5 pr-2 text-center">{tinggiBeratPerSemester?.Ganjil?.berat ?? '-'} kg</td>
              <td className="py-1.5 text-center">{tinggiBeratPerSemester?.Genap?.berat ?? '-'} kg</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">F. Kondisi Kesehatan</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[40%]">Aspek yang Dinilai</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Pendengaran', catatan?.kondisi_pendengaran],
              ['Penglihatan', catatan?.kondisi_penglihatan],
              ['Kesehatan Gigi', catatan?.kondisi_gigi],
              ['Lainnya', catatan?.kondisi_lainnya || catatan?.kondisi_kesehatan],
            ].map(([label, val], i) => (
              <tr key={label} className="border-b border-ink-950/10">
                <td className="py-1.5 pr-2">{i + 1}.</td>
                <td className="py-1.5 pr-2">{label}</td>
                <td className="py-1.5">{val || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">G. Prestasi</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[35%]">Jenis Prestasi</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {KATEGORI_PRESTASI.map((kategori, i) => (
              <tr key={kategori} className="border-b border-ink-950/10">
                <td className="py-1.5 pr-2">{i + 1}.</td>
                <td className="py-1.5 pr-2">{kategori}</td>
                <td className="py-1.5">{cariKeterangan(prestasiList, 'jenis_prestasi', kategori)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">H. Ketidakhadiran</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[40%]">Aspek yang Dinilai</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-950/10">
              <td className="py-1.5 pr-2">1.</td>
              <td className="py-1.5 pr-2">Sakit</td>
              <td className="py-1.5">{presensi.sakit}</td>
            </tr>
            <tr className="border-b border-ink-950/10">
              <td className="py-1.5 pr-2">2.</td>
              <td className="py-1.5 pr-2">Izin</td>
              <td className="py-1.5">{presensi.izin}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">3.</td>
              <td className="py-1.5 pr-2">Tanpa Keterangan</td>
              <td className="py-1.5">{presensi.alpa}</td>
            </tr>
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">I. Kepribadian</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[40%]">Aspek yang Dinilai</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Perilaku', catatan?.perilaku],
              ['Kerajinan', catatan?.kerajinan],
              ['Kerapian', catatan?.kerapian],
            ].map(([label, val], i) => (
              <tr key={label} className={i < 2 ? 'border-b border-ink-950/10' : ''}>
                <td className="py-1.5 pr-2">{i + 1}.</td>
                <td className="py-1.5 pr-2">{label}</td>
                <td className="py-1.5">{val || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">J. Nilai</h2>
        <table className="w-full border-collapse mb-8 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[10%]">No.</th>
              <th className="text-left py-1.5 pr-2 w-[20%]">Jumlah</th>
              <th className="text-center py-1.5 pr-2 w-[20%]">Rata-rata</th>
              <th className="text-center py-1.5">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-ink-950/10">
              <td className="py-1.5 pr-2" rowSpan={2}>1.</td>
              <td className="py-1.5 pr-2">KI-3 (Pengetahuan): {jumlahKi3}</td>
              <td className="py-1.5 pr-2 text-center">{rataKi3.toFixed(0)}</td>
              <td className="py-1.5 text-center font-semibold" rowSpan={2}>{nilaiAkhir ?? '-'}</td>
            </tr>
            <tr>
              <td className="py-1.5 pr-2">2.</td>
              <td className="py-1.5 pr-2">KI-4 (Keterampilan): {jumlahKi4}</td>
              <td className="py-1.5 pr-2 text-center">{rataKi4.toFixed(0)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end mb-10">
          <div className="border border-ink-950/40 rounded w-64 text-center">
            <p className="border-b border-ink-950/40 py-1.5 font-semibold">Keputusan</p>
            <p className="px-3 py-2 text-xs text-ink-700/70">Berdasarkan seluruh kompetensi, peserta didik dinyatakan :</p>
            <p className="pb-3 font-bold tracking-widest">{catatan?.keputusan || '- - - - - -'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm mb-8">
          <div>
            <p>Orang Tua/Wali</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-ink-950/40 pt-1 inline-block">
              {siswa?.nama_orang_tua || '(.......................................)'}
            </p>
          </div>
          <div>
            <p>{[tempatCetak, tanggalCetak].filter(Boolean).join(', ')}</p>
            <p>Guru Kelas {siswa.kelas?.nama_kelas || ''}</p>
            <div className="h-12" />
            <p className="font-semibold border-t border-ink-950/40 pt-1 inline-block">
              {siswa?.kelas?.wali_kelas?.nama_lengkap || '(.......................................)'}
            </p>
            {siswa?.kelas?.wali_kelas?.nip && (
              <p className="text-xs text-ink-700/60">NIP. {siswa.kelas.wali_kelas.nip}</p>
            )}
          </div>
        </div>

        <div className="text-center text-sm mb-6">
          <p>Mengetahui,<br />Kepala Sekolah</p>
          <div className="h-14" />
          <p className="font-semibold border-t border-ink-950/40 pt-1 inline-block">
            {sekolah?.kepala_sekolah || '(.......................................)'}
          </p>
          {sekolah?.nip_kepala_sekolah && (
            <p className="text-xs text-ink-700/60">NIP. {sekolah.nip_kepala_sekolah}</p>
          )}
        </div>

        <div className="border-t border-ink-950/20 pt-2 text-[10px] text-ink-700/50 flex justify-between">
          <p className="italic">{sekolah?.nama_sekolah}</p>
          <p>KKM PPKn, PAI = {kkmPaiPpkn} · KKM Mata Pelajaran Lainnya = {kkmLainnya}</p>
        </div>
      </div>
    </div>
  )
}
