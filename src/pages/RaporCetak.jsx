import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Printer, Loader2 } from 'lucide-react'

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
  return { mulai: `${tahunAwal}-07-01`, selesai: `${tahunAwal}-12-31` }
}

function formatTanggalLahir(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

// Predikat dari nilai angka — sama dengan legenda yang dipakai di Nilai.jsx
function predikatDariNilai(nilai) {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const n = Number(nilai)
  if (isNaN(n)) return null
  if (n >= 90) return 'A'
  if (n >= 75) return 'B'
  if (n >= 60) return 'C'
  return 'D'
}

function rataRataArr(arr) {
  if (!arr || arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

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
  const [p5List, setP5List] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [catatan, setCatatan] = useState(null)
  const [sekolah, setSekolah] = useState(null)
  const [logoUrl, setLogoUrl] = useState('')
  const [fotoSiswaUrl, setFotoSiswaUrl] = useState('')

  useEffect(() => {
    if (!siswaId || !semester || !tahunAjaran) {
      setLoading(false)
      return
    }
    muatSemua()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, semester, tahunAjaran])

  async function muatSemua() {
    setLoading(true)

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
      { data: p5Rows },
      { data: ekskulRows },
      { data: catatanRow },
      { data: sekolahRow },
    ] = await Promise.all([
      supabase
        .from('siswa')
        .select(
          '*, kelas(nama_kelas, wali_kelas:guru!wali_kelas_id(nama_lengkap, nip))'
        )
        .eq('id', siswaId)
        .single(),
      supabase
        .from('nilai')
        // + kompetensi, supaya nilai Pengetahuan & Keterampilan bisa dipisah
        .select('mata_pelajaran, kompetensi, jenis, nilai')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase
        .from('capaian_mapel')
        // + jenis, untuk mencocokkan deskripsi ke kolom Pengetahuan/Keterampilan
        .select('mata_pelajaran, jenis, deskripsi_capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('rapor_p5')
        .select('tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .order('tema'),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select('catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .maybeSingle(),
      supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle(),
    ])

    setSekolah(sekolahRow || null)
    if (sekolahRow?.logo_path) {
      const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(sekolahRow.logo_path)
      setLogoUrl(pub.publicUrl)
    }

    setSiswa(siswaRow || null)
    if (siswaRow?.foto_path) {
      const { data: pub } = supabase.storage.from('foto-siswa').getPublicUrl(siswaRow.foto_path)
      setFotoSiswaUrl(pub.publicUrl)
    }

    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) {
      if (rekap[p.status] !== undefined) rekap[p.status]++
    }
    setPresensi(rekap)
    setCapaianList(capaianRows || [])
    setP5List(p5Rows || [])
    setEkskulList(ekskulRows || [])
    setCatatan(catatanRow || null)
    setLoading(false)
  }

  // ---------- Rekap nilai per mapel, dipecah Pengetahuan/Keterampilan ----------
  const rekapPerMapelKompetensi = {}
  for (const n of nilai) {
    if (!rekapPerMapelKompetensi[n.mata_pelajaran]) {
      rekapPerMapelKompetensi[n.mata_pelajaran] = { Pengetahuan: [], Keterampilan: [] }
    }
    const kk = n.kompetensi === 'Keterampilan' ? 'Keterampilan' : 'Pengetahuan'
    rekapPerMapelKompetensi[n.mata_pelajaran][kk].push(n.nilai)
  }

  const semuaMapel = [
    ...new Set([
      ...Object.keys(rekapPerMapelKompetensi),
      ...capaianList.map((c) => c.mata_pelajaran),
    ]),
  ]

  const barisMapel = semuaMapel.map((mapel) => {
    const rr = rekapPerMapelKompetensi[mapel] || { Pengetahuan: [], Keterampilan: [] }
    const deskripsiPengetahuan =
      capaianList.find((c) => c.mata_pelajaran === mapel && c.jenis === 'Pengetahuan')?.deskripsi_capaian || ''
    const deskripsiKeterampilan =
      capaianList.find((c) => c.mata_pelajaran === mapel && c.jenis === 'Keterampilan')?.deskripsi_capaian || ''
    const nilaiPengetahuan = rataRataArr(rr.Pengetahuan)
    const nilaiKeterampilan = rataRataArr(rr.Keterampilan)
    return {
      mapel,
      pengetahuan: {
        nilai: nilaiPengetahuan,
        predikat: predikatDariNilai(nilaiPengetahuan),
        deskripsi: deskripsiPengetahuan,
      },
      keterampilan: {
        nilai: nilaiKeterampilan,
        predikat: predikatDariNilai(nilaiKeterampilan),
        deskripsi: deskripsiKeterampilan,
      },
    }
  })

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
          .lembar-cetak + .lembar-cetak { page-break-before: always; }
          body { background: white; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>

      <div className="no-print max-w-[800px] mx-auto mb-4 flex justify-end">
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer size={16} /> Cetak / Simpan PDF
        </button>
      </div>

      {/* ===================== HALAMAN 1: SAMPUL ===================== */}
      <div className="lembar-cetak max-w-[800px] mx-auto bg-white shadow-lg p-10 text-sm text-ink-950 flex flex-col items-center min-h-[1000px]">
        <div className="w-28 h-28 mt-10 mb-4 flex items-center justify-center">
          {logoUrl && <img src={logoUrl} alt="Logo sekolah" className="w-full h-full object-contain" />}
        </div>
        <h1 className="font-display text-2xl font-bold text-center uppercase leading-snug">
          Rapor Peserta Didik
          <br />
          Sekolah Dasar
          <br />
          ( S D )
        </h1>

        <div className="mt-24 w-full max-w-md text-center">
          <p className="text-ink-700/60 mb-1">Nama Peserta Didik :</p>
          <div className="border-2 border-ink-950 rounded px-4 py-2 font-bold text-lg uppercase">
            {siswa.nama_lengkap}
          </div>

          <p className="text-ink-700/60 mt-6 mb-1">Nomor Induk Siswa</p>
          <div className="border-2 border-ink-950 rounded px-4 py-2 font-medium">
            {siswa.nis || '\u00A0'}
          </div>
        </div>

        <div className="mt-auto pt-16 text-center">
          <p className="font-display font-bold uppercase text-sm">Kementerian Pendidikan dan Kebudayaan</p>
          <p className="font-display font-bold uppercase text-sm">Republik Indonesia</p>
        </div>
      </div>

      {/* ===================== HALAMAN 2: IDENTITAS ===================== */}
      <div className="lembar-cetak max-w-[800px] mx-auto bg-white shadow-lg p-10 text-sm text-ink-950 mt-8 print:mt-0">
        <h2 className="text-center font-display font-bold text-base uppercase mb-4">
          Identitas Sekolah
        </h2>
        <div className="grid grid-cols-[180px_10px_1fr] gap-y-1 mb-8">
          <span className="text-ink-700/70">Nama Sekolah</span><span>:</span><span className="font-medium">{sekolah?.nama_sekolah || '-'}</span>
          <span className="text-ink-700/70">NPSN</span><span>:</span><span className="font-medium">{sekolah?.npsn || '-'}</span>
          <span className="text-ink-700/70">Alamat Sekolah</span><span>:</span><span className="font-medium">{sekolah?.alamat || '-'}</span>
          <span className="text-ink-700/70">Kelurahan/Desa</span><span>:</span><span className="font-medium">{sekolah?.kelurahan_desa || '-'}</span>
          <span className="text-ink-700/70">Kecamatan</span><span>:</span><span className="font-medium">{sekolah?.kecamatan || '-'}</span>
          <span className="text-ink-700/70">Kota / Kabupaten</span><span>:</span><span className="font-medium">{sekolah?.kabupaten || '-'}</span>
          <span className="text-ink-700/70">Provinsi</span><span>:</span><span className="font-medium">{sekolah?.provinsi || '-'}</span>
          <span className="text-ink-700/70">Kode Pos</span><span>:</span><span className="font-medium">{sekolah?.kode_pos || '-'}</span>
          <span className="text-ink-700/70">No Telpon</span><span>:</span><span className="font-medium">{sekolah?.telepon || '-'}</span>
          <span className="text-ink-700/70">Website</span><span>:</span><span className="font-medium">{sekolah?.website || '-'}</span>
          <span className="text-ink-700/70">E-mail</span><span>:</span><span className="font-medium">{sekolah?.email || '-'}</span>
        </div>

        <h2 className="text-center font-display font-bold text-base uppercase mb-4">
          Identitas Peserta Didik
        </h2>
        <div className="grid grid-cols-[190px_10px_1fr] gap-y-1 mb-2">
          <span className="text-ink-700/70">1. Nama Peserta Didik</span><span>:</span><span className="font-medium">{siswa.nama_lengkap}</span>
          <span className="text-ink-700/70">2. Nomor Induk Siswa</span><span>:</span><span className="font-medium">{siswa.nis || '-'}</span>
          <span className="text-ink-700/70">3. N I S N</span><span>:</span><span className="font-medium">{siswa.nisn || '-'}</span>
          <span className="text-ink-700/70">4. Tempat, Tanggal Lahir</span><span>:</span>
          <span className="font-medium">
            {[siswa.tempat_lahir, formatTanggalLahir(siswa.tanggal_lahir)].filter(Boolean).join(', ') || '-'}
          </span>
          <span className="text-ink-700/70">5. Jenis Kelamin</span><span>:</span>
          <span className="font-medium">{siswa.jenis_kelamin === 'L' ? 'Laki-laki' : siswa.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</span>
          <span className="text-ink-700/70">6. Agama</span><span>:</span><span className="font-medium">{siswa.agama || '-'}</span>
          <span className="text-ink-700/70">7. Pendidikan Sebelumnya</span><span>:</span><span className="font-medium">{siswa.pendidikan_sebelumnya || '-'}</span>
          <span className="text-ink-700/70">8. Alamat Peserta Didik</span><span>:</span><span className="font-medium">{siswa.alamat || siswa.alamat_tinggal || '-'}</span>
        </div>

        <div className="grid grid-cols-[190px_10px_1fr] gap-y-1 mt-2">
          <span className="text-ink-700/70">9. Nama Orang Tua</span><span></span><span></span>
          <span className="text-ink-700/70 pl-4">1) Ayah</span><span>:</span><span className="font-medium">{siswa.nama_ayah || siswa.nama_orang_tua || '-'}</span>
          <span className="text-ink-700/70 pl-4">2) Ibu</span><span>:</span><span className="font-medium">{siswa.nama_ibu || '-'}</span>

          <span className="text-ink-700/70">10. Pendidikan Orang Tua</span><span></span><span></span>
          <span className="text-ink-700/70 pl-4">1) Ayah</span><span>:</span><span className="font-medium">{siswa.pendidikan_ayah || '-'}</span>
          <span className="text-ink-700/70 pl-4">2) Ibu</span><span>:</span><span className="font-medium">{siswa.pendidikan_ibu || '-'}</span>

          <span className="text-ink-700/70">11. Pekerjaan Orang Tua</span><span></span><span></span>
          <span className="text-ink-700/70 pl-4">1) Ayah</span><span>:</span><span className="font-medium">{siswa.pekerjaan_ayah || '-'}</span>
          <span className="text-ink-700/70 pl-4">2) Ibu</span><span>:</span><span className="font-medium">{siswa.pekerjaan_ibu || '-'}</span>

          <span className="text-ink-700/70">12. Alamat Orang Tua</span><span></span><span></span>
          <span className="text-ink-700/70 pl-4">1) Jalan</span><span>:</span><span className="font-medium">{siswa.alamat || '-'}</span>
          <span className="text-ink-700/70 pl-4">2) Kelurahan/Desa</span><span>:</span><span className="font-medium">{siswa.ortu_kelurahan_desa || '-'}</span>
          <span className="text-ink-700/70 pl-4">3) Kecamatan</span><span>:</span><span className="font-medium">{siswa.ortu_kecamatan || '-'}</span>
          <span className="text-ink-700/70 pl-4">4) Kabupaten/Kota</span><span>:</span><span className="font-medium">{siswa.ortu_kabupaten_kota || '-'}</span>
          <span className="text-ink-700/70 pl-4">5) Provinsi</span><span>:</span><span className="font-medium">{siswa.ortu_provinsi || '-'}</span>

          <span className="text-ink-700/70">13. Wali Peserta Didik</span><span></span><span></span>
          <span className="text-ink-700/70 pl-4">1) Nama</span><span>:</span><span className="font-medium">{siswa.nama_wali || '-'}</span>
          <span className="text-ink-700/70 pl-4">2) Pekerjaan</span><span>:</span><span className="font-medium">{siswa.pekerjaan_wali || '-'}</span>
          <span className="text-ink-700/70 pl-4">3) Alamat</span><span>:</span><span className="font-medium">{siswa.alamat_wali || '-'}</span>
        </div>

        <div className="flex justify-between items-end mt-12">
          <div className="w-24 h-32 border-2 border-ink-950 shrink-0 flex items-center justify-center overflow-hidden">
            {fotoSiswaUrl ? (
              <img src={fotoSiswaUrl} alt="Pas foto" className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] text-center text-ink-700/50 px-1">Pas Foto<br />Ukuran<br />3 X 4</span>
            )}
          </div>
          <div className="text-center">
            <p>
              {sekolah?.tempat_ttd || '.......................'},{' '}
              {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mb-1 font-semibold">Kepala Sekolah</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-ink-950/40 pt-1 inline-block px-6">
              {sekolah?.kepala_sekolah || '(.......................................)'}
            </p>
            {sekolah?.nip_kepala_sekolah && (
              <p className="text-xs text-ink-700/60">NIP. {sekolah.nip_kepala_sekolah}</p>
            )}
          </div>
        </div>
      </div>

      {/* ===================== HALAMAN 3+: LEMBAR HASIL BELAJAR ===================== */}
      <div className="lembar-cetak max-w-[800px] mx-auto bg-white shadow-lg p-10 text-sm text-ink-950 mt-8 print:mt-0">
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
          <h1 className="font-display text-xl font-semibold">LAPORAN HASIL BELAJAR SISWA</h1>
          <p className="text-ink-700/60">Semester {semester} · Tahun Ajaran {tahunAjaran}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-6">
          <p><span className="text-ink-700/60">Nama Siswa</span> : {siswa.nama_lengkap}</p>
          <p><span className="text-ink-700/60">Kelas</span> : {siswa.kelas?.nama_kelas || '-'}</p>
          <p><span className="text-ink-700/60">NIS</span> : {siswa.nis || '-'}</p>
          <p><span className="text-ink-700/60">NISN</span> : {siswa.nisn || '-'}</p>
        </div>

        <h2 className="font-display font-semibold mb-2">A. Nilai &amp; Deskripsi Capaian</h2>
        <table className="w-full border-collapse mb-6 text-[13px]">
          <thead>
            <tr>
              <th rowSpan={2} className="text-left py-1.5 pr-2 w-[4%] align-bottom border-b border-ink-950/20">No</th>
              <th rowSpan={2} className="text-left py-1.5 pr-2 w-[15%] align-bottom border-b border-ink-950/20">Mata Pelajaran</th>
              <th colSpan={3} className="text-center py-1 border-b border-ink-950/20">Pengetahuan</th>
              <th colSpan={3} className="text-center py-1 border-b border-ink-950/20 border-l-2 border-ink-950/30">Keterampilan</th>
            </tr>
            <tr className="border-b border-ink-950/20">
              <th className="text-center py-1.5 pr-2 w-[6%]">Nilai</th>
              <th className="text-center py-1.5 pr-2 w-[7%]">Predikat</th>
              <th className="text-left py-1.5 pr-2 w-[26%]">Deskripsi Capaian</th>
              <th className="text-center py-1.5 pr-2 w-[6%] border-l-2 border-ink-950/30">Nilai</th>
              <th className="text-center py-1.5 pr-2 w-[7%]">Predikat</th>
              <th className="text-left py-1.5">Deskripsi Capaian</th>
            </tr>
          </thead>
          <tbody>
            {barisMapel.map((b, i) => (
              <tr key={b.mapel} className="border-b border-ink-950/10 align-top">
                <td className="py-1.5 pr-2">{i + 1}</td>
                <td className="py-1.5 pr-2 font-medium">{b.mapel}</td>
                <td className="py-1.5 pr-2 text-center">{b.pengetahuan.nilai ?? '-'}</td>
                <td className="py-1.5 pr-2 text-center">{b.pengetahuan.predikat || '-'}</td>
                <td className="py-1.5 pr-2">{b.pengetahuan.deskripsi || '-'}</td>
                <td className="py-1.5 pr-2 text-center border-l-2 border-ink-950/30">{b.keterampilan.nilai ?? '-'}</td>
                <td className="py-1.5 pr-2 text-center">{b.keterampilan.predikat || '-'}</td>
                <td className="py-1.5">{b.keterampilan.deskripsi || '-'}</td>
              </tr>
            ))}
            {barisMapel.length === 0 && (
              <tr>
                <td colSpan={8} className="py-3 text-center text-ink-700/50">Belum ada data.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">B. Profil Pelajar Pancasila (P5)</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[20%]">Tema</th>
              <th className="text-left py-1.5 pr-2 w-[20%]">Dimensi</th>
              <th className="text-left py-1.5 pr-2 w-[25%]">Sub-elemen</th>
              <th className="text-left py-1.5">Capaian</th>
            </tr>
          </thead>
          <tbody>
            {p5List.map((p, i) => (
              <tr key={i} className="border-b border-ink-950/10 align-top">
                <td className="py-1.5 pr-2">{p.tema}</td>
                <td className="py-1.5 pr-2">{p.dimensi}</td>
                <td className="py-1.5 pr-2">{p.sub_elemen}</td>
                <td className="py-1.5">{p.capaian}</td>
              </tr>
            ))}
            {p5List.length === 0 && (
              <tr>
                <td colSpan={4} className="py-3 text-center text-ink-700/50">Belum ada data P5.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">C. Ekstrakurikuler</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[35%]">Kegiatan</th>
              <th className="text-left py-1.5 pr-2 w-[20%]">Predikat</th>
              <th className="text-left py-1.5">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {ekskulList.map((e, i) => (
              <tr key={i} className="border-b border-ink-950/10 align-top">
                <td className="py-1.5 pr-2">{e.nama_ekstrakurikuler}</td>
                <td className="py-1.5 pr-2">{e.predikat}</td>
                <td className="py-1.5">{e.keterangan || '-'}</td>
              </tr>
            ))}
            {ekskulList.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-center text-ink-700/50">Belum ada data ekstrakurikuler.</td>
              </tr>
            )}
          </tbody>
        </table>

        <h2 className="font-display font-semibold mb-2">D. Kehadiran</h2>
        <div className="grid grid-cols-4 gap-3 mb-6 text-center">
          <div><p className="text-lg font-semibold">{presensi.hadir}</p><p className="text-xs text-ink-700/60">Hadir</p></div>
          <div><p className="text-lg font-semibold">{presensi.izin}</p><p className="text-xs text-ink-700/60">Izin</p></div>
          <div><p className="text-lg font-semibold">{presensi.sakit}</p><p className="text-xs text-ink-700/60">Sakit</p></div>
          <div><p className="text-lg font-semibold">{presensi.alpa}</p><p className="text-xs text-ink-700/60">Alpa</p></div>
        </div>

        <h2 className="font-display font-semibold mb-2">E. Kondisi & Catatan Wali Kelas</h2>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 mb-2 text-sm">
          <p><span className="text-ink-700/60">Tinggi Badan</span> : {catatan?.tinggi_badan || '-'} cm</p>
          <p><span className="text-ink-700/60">Berat Badan</span> : {catatan?.berat_badan || '-'} kg</p>
          <p className="col-span-2"><span className="text-ink-700/60">Kondisi Kesehatan</span> : {catatan?.kondisi_kesehatan || '-'}</p>
        </div>
        <p className="mb-4 leading-relaxed">{catatan?.catatan || 'Belum ada catatan dari wali kelas.'}</p>

        <div className="mb-8">
          <span className="text-ink-700/60">Keputusan</span> :{' '}
          <span className="font-semibold">{catatan?.keputusan || 'Belum ditentukan'}</span>
        </div>

        <div className="grid grid-cols-3 gap-6 mt-10 text-center text-sm">
          <div>
            <p>Orang Tua/Wali</p>
            <div className="h-16" />
            <p className="font-semibold border-t border-ink-950/40 pt-1">
              {siswa?.nama_orang_tua || '(.......................................)'}
            </p>
          </div>
          <div>
            <p>Wali Kelas</p>
            <div className="h-12" />
            <p className="font-semibold border-t border-ink-950/40 pt-1">
              {siswa?.kelas?.wali_kelas?.nama_lengkap || '(.......................................)'}
            </p>
            {siswa?.kelas?.wali_kelas?.nip && (
              <p className="text-xs text-ink-700/60">NIP. {siswa.kelas.wali_kelas.nip}</p>
            )}
          </div>
          <div>
            <p>Mengetahui,<br />Kepala Sekolah</p>
            <div className="h-12" />
            <p className="font-semibold border-t border-ink-950/40 pt-1">
              {sekolah?.kepala_sekolah || '(.......................................)'}
            </p>
            {sekolah?.nip_kepala_sekolah && (
              <p className="text-xs text-ink-700/60">NIP. {sekolah.nip_kepala_sekolah}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
