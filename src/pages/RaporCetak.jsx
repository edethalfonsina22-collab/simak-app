import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Printer, Loader2 } from 'lucide-react'

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

  useEffect(() => {
    if (!siswaId || !semester || !tahunAjaran) {
      setLoading(false)
      return
    }
    muatSemua()
  }, [siswaId, semester, tahunAjaran])

  async function muatSemua() {
    setLoading(true)
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
          'id, nama_lengkap, nis, nisn, nama_orang_tua, kelas(nama_kelas, wali_kelas:guru!wali_kelas_id(nama_lengkap, nip))'
        )
        .eq('id', siswaId)
        .single(),
      supabase
        .from('nilai')
        .select('mata_pelajaran, jenis, nilai')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId),
      supabase
        .from('capaian_mapel')
        .select('mata_pelajaran, deskripsi_capaian')
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

  const rekapPerMapel = {}
  for (const n of nilai) {
    if (!rekapPerMapel[n.mata_pelajaran]) rekapPerMapel[n.mata_pelajaran] = []
    rekapPerMapel[n.mata_pelajaran].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapel).map(([mapel, arr]) => ({
    mapel,
    rataRata: (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1),
    deskripsi: capaianList.find((c) => c.mata_pelajaran === mapel)?.deskripsi_capaian || '',
  }))
  // Mapel yang punya deskripsi tapi belum punya nilai angka
  for (const c of capaianList) {
    if (!barisMapel.find((b) => b.mapel === c.mata_pelajaran)) {
      barisMapel.push({ mapel: c.mata_pelajaran, rataRata: '-', deskripsi: c.deskripsi_capaian })
    }
  }

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
        <div className="flex items-center gap-4 mb-4 pb-4 border-b-2 border-ink-950/70">
          <div className="w-16 h-16 shrink-0 flex items-center justify-center">
            {logoUrl && <img src={logoUrl} alt="Logo sekolah" className="w-full h-full object-contain" />}
          </div>
          <div className="text-center flex-1">
            <h1 className="font-display text-lg font-bold uppercase">{sekolah?.nama_sekolah || 'Nama Sekolah'}</h1>
            {sekolah?.npsn && <p className="text-xs text-ink-700/60">NPSN: {sekolah.npsn}</p>}
            {sekolah?.alamat && <p className="text-xs text-ink-700/60">{sekolah.alamat}</p>}
            {(sekolah?.telepon || sekolah?.email) && (
              <p className="text-xs text-ink-700/60">
                {[sekolah?.telepon, sekolah?.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="w-16 shrink-0" />
        </div>

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

        <h2 className="font-display font-semibold mb-2">A. Nilai & Deskripsi Capaian</h2>
        <table className="w-full border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b border-ink-950/20">
              <th className="text-left py-1.5 pr-2 w-[26%]">Mata Pelajaran</th>
              <th className="text-center py-1.5 pr-2 w-[10%]">Nilai</th>
              <th className="text-left py-1.5">Deskripsi Capaian</th>
            </tr>
          </thead>
          <tbody>
            {barisMapel.map((b) => (
              <tr key={b.mapel} className="border-b border-ink-950/10 align-top">
                <td className="py-1.5 pr-2 font-medium">{b.mapel}</td>
                <td className="py-1.5 pr-2 text-center">{b.rataRata}</td>
                <td className="py-1.5">{b.deskripsi || '-'}</td>
              </tr>
            ))}
            {barisMapel.length === 0 && (
              <tr>
                <td colSpan={3} className="py-3 text-center text-ink-700/50">Belum ada data.</td>
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
