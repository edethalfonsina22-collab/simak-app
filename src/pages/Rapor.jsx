import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { eksporPDF } from '../lib/exportUtils'
import { FileDown, Loader2, FileBadge } from 'lucide-react'

export default function Rapor() {
  const [siswaList, setSiswaList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, kelas(nama_kelas)')
      .order('nama_lengkap')
      .then(({ data }) => setSiswaList(data || []))
  }, [])

  async function muatRapor() {
    if (!siswaId) return
    setLoading(true)
    const [{ data: nilaiRows }, { data: presensiRows }] = await Promise.all([
      supabase
        .from('nilai')
        .select('mata_pelajaran, jenis, nilai')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId),
    ])
    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) {
      if (rekap[p.status] !== undefined) rekap[p.status]++
    }
    setPresensi(rekap)
    setLoading(false)
  }

  // Kelompokkan nilai per mata pelajaran, hitung rata-rata semua jenis (Tugas/UH/UTS/UAS)
  const rekapPerMapel = {}
  for (const n of nilai) {
    if (!rekapPerMapel[n.mata_pelajaran]) rekapPerMapel[n.mata_pelajaran] = []
    rekapPerMapel[n.mata_pelajaran].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapel).map(([mapel, nilaiArr]) => ({
    mapel,
    rataRata: (nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length).toFixed(1),
  }))

  const siswaTerpilih = siswaList.find((s) => s.id === siswaId)

  function handleCetak() {
    if (!siswaTerpilih) return
    const kolom = ['Mata Pelajaran', 'Rata-rata Nilai']
    const baris = barisMapel.map((b) => [b.mapel, b.rataRata])
    baris.push(['', ''])
    baris.push(['Kehadiran', ''])
    baris.push(['Hadir', String(presensi.hadir)])
    baris.push(['Izin', String(presensi.izin)])
    baris.push(['Sakit', String(presensi.sakit)])
    baris.push(['Alpa', String(presensi.alpa)])

    eksporPDF(
      `Rapor Siswa — ${siswaTerpilih.nama_lengkap}`,
      kolom,
      baris,
      `rapor-${siswaTerpilih.nama_lengkap.replace(/\s+/g, '-').toLowerCase()}`,
      `NIS: ${siswaTerpilih.nis || '-'} | Kelas: ${siswaTerpilih.kelas?.nama_kelas || '-'} | Semester ${semester} ${tahunAjaran}`
    )
  }

  return (
    <Layout title="Rapor Siswa" subtitle="Rekap nilai & kehadiran otomatis, siap dicetak ke PDF">
      {/* Banner merah marun — senada dengan Kelas & Nilai Siswa */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <FileBadge size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Rapor Siswa</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {siswaTerpilih
                ? `${siswaTerpilih.nama_lengkap} · ${siswaTerpilih.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Pilih siswa untuk lihat rekap rapor'}
            </p>
          </div>
        </div>
        <FileBadge size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="label-field">Pilih Siswa</label>
            <select className="input-field" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
              <option value="">-- Pilih siswa --</option>
              {siswaList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_lengkap} {s.kelas?.nama_kelas ? `(${s.kelas.nama_kelas})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Semester</label>
            <select className="input-field" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          <div>
            <label className="label-field">Tahun Ajaran</label>
            <input
              className="input-field"
              placeholder="2025/2026"
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4">
          <button className="btn-primary" onClick={muatRapor} disabled={!siswaId || loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Tampilkan Rapor
          </button>
        </div>
      </div>

      {siswaTerpilih && nilai.length >= 0 && barisMapel.length > 0 && (
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h3 className="font-display text-xl font-semibold text-ink-950">{siswaTerpilih.nama_lengkap}</h3>
              <p className="text-sm text-ink-700/60">
                NIS: {siswaTerpilih.nis || '-'} · Kelas: {siswaTerpilih.kelas?.nama_kelas || '-'} · Semester {semester} {tahunAjaran}
              </p>
            </div>
            <button className="btn-primary" onClick={handleCetak}>
              <FileDown size={16} /> Unduh PDF
            </button>
          </div>

          <table className="table-shell mb-6">
            <thead>
              <tr>
                <th>Mata Pelajaran</th>
                <th>Rata-rata Nilai</th>
              </tr>
            </thead>
            <tbody>
              {barisMapel.map((b) => (
                <tr key={b.mapel}>
                  <td className="font-medium">{b.mapel}</td>
                  <td>{b.rataRata}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 className="font-display font-semibold text-ink-950 mb-3">Rekap Kehadiran</h4>
          <div className="grid grid-cols-4 gap-3">
            <div className="rounded-lg bg-sage-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-sage-500">{presensi.hadir}</p>
              <p className="text-xs text-ink-700/60">Hadir</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-amber-600">{presensi.izin}</p>
              <p className="text-xs text-ink-700/60">Izin</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-blue-600">{presensi.sakit}</p>
              <p className="text-xs text-ink-700/60">Sakit</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-red-700">{presensi.alpa}</p>
              <p className="text-xs text-ink-700/60">Alpa</p>
            </div>
          </div>
        </div>
      )}

      {siswaTerpilih && barisMapel.length === 0 && !loading && (
        <div className="card p-6 text-center text-ink-700/50 text-sm">
          Belum ada data nilai untuk siswa ini di semester &amp; tahun ajaran yang dipilih.
        </div>
      )}
    </Layout>
  )
}
