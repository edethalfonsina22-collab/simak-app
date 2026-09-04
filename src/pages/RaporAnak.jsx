import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { FileBadge, Loader2, ClipboardList, Sparkles, Dumbbell, NotebookPen } from 'lucide-react'

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan Nilai', icon: ClipboardList },
  { key: 'capaian', label: 'Deskripsi Capaian', icon: NotebookPen },
  { key: 'p5', label: 'P5', icon: Sparkles },
  { key: 'ekskul', label: 'Ekstrakurikuler', icon: Dumbbell },
  { key: 'catatan', label: 'Catatan Wali Kelas', icon: NotebookPen },
]

const TAHUN_SEKARANG = new Date().getFullYear()
const DAFTAR_TAHUN_AJARAN = Array.from({ length: 5 }, (_, i) => {
  const awal = TAHUN_SEKARANG - 2 + i
  return `${awal}/${awal + 1}`
})

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

function rataRataArr(arr) {
  if (!arr || arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

export default function RaporAnak() {
  const { session } = useAuth()

  const [anakList, setAnakList] = useState([]) // siswa yang terhubung ke akun orang tua ini
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState(DAFTAR_TAHUN_AJARAN[2])
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [loading, setLoading] = useState(true)

  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [capaianList, setCapaianList] = useState([])
  const [p5List, setP5List] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [catatan, setCatatan] = useState(null)

  // Ambil daftar anak milik akun orang tua yang login, HANYA lewat
  // orang_tua_siswa (tidak ada dropdown bebas seperti di halaman Guru).
  useEffect(() => {
    async function ambilAnak() {
      if (!session?.user?.id) return
      const { data, error } = await supabase
        .from('orang_tua_siswa')
        .select('siswa_id, hubungan, siswa(id, nama_lengkap, nis, nisn, kelas_id, kelas(nama_kelas))')
        .eq('orang_tua_id', session.user.id)
        .eq('status', 'aktif')

      if (!error && data) {
        const anak = data.map((d) => ({ ...d.siswa, hubungan: d.hubungan })).filter(Boolean)
        setAnakList(anak)
        if (anak.length > 0) setSiswaId(anak[0].id)
      }
      setLoading(false)
    }
    ambilAnak()
  }, [session])

  useEffect(() => {
    if (siswaId && tahunAjaran) muatRapor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId, semester, tahunAjaran])

  async function muatRapor() {
    setLoading(true)
    const periode = rentangTanggalPeriode(tahunAjaran, semester)
    let queryPresensi = supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId)
    if (periode) {
      queryPresensi = queryPresensi.gte('tanggal', periode.mulai).lte('tanggal', periode.selesai)
    }

    const [
      { data: nilaiRows },
      { data: presensiRows },
      { data: capaianRows },
      { data: p5Rows },
      { data: ekskulRows },
      { data: catatanRows },
    ] = await Promise.all([
      supabase.from('nilai').select('mata_pelajaran, kompetensi, jenis, nilai')
        .eq('siswa_id', siswaId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase.from('capaian_mapel').select('id, mata_pelajaran, jenis, deskripsi_capaian')
        .eq('siswa_id', siswaId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
      supabase.from('rapor_p5').select('id, tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', siswaId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran).order('tema'),
      supabase.from('ekstrakurikuler_nilai').select('id, nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', siswaId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran),
      supabase.from('catatan_siswa').select('catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', siswaId).eq('semester', semester).eq('tahun_ajaran', tahunAjaran).maybeSingle(),
    ])

    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) if (rekap[p.status] !== undefined) rekap[p.status]++
    setPresensi(rekap)
    setCapaianList(capaianRows || [])
    setP5List(p5Rows || [])
    setEkskulList(ekskulRows || [])
    setCatatan(catatanRows || null)
    setLoading(false)
  }

  const siswaTerpilih = anakList.find((s) => s.id === siswaId)

  const rekapPerMapelKompetensi = {}
  for (const n of nilai) {
    if (!rekapPerMapelKompetensi[n.mata_pelajaran]) {
      rekapPerMapelKompetensi[n.mata_pelajaran] = { Pengetahuan: [], Keterampilan: [] }
    }
    const kk = n.kompetensi === 'Keterampilan' ? 'Keterampilan' : 'Pengetahuan'
    rekapPerMapelKompetensi[n.mata_pelajaran][kk].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapelKompetensi).map(([mapel, kel]) => ({
    mapel,
    rataRataPengetahuan: rataRataArr(kel.Pengetahuan),
    rataRataKeterampilan: rataRataArr(kel.Keterampilan),
  }))

  const capaianPerMapel = {}
  for (const c of capaianList) {
    if (!capaianPerMapel[c.mata_pelajaran]) capaianPerMapel[c.mata_pelajaran] = {}
    capaianPerMapel[c.mata_pelajaran][c.jenis] = c.deskripsi_capaian
  }

  if (!loading && anakList.length === 0) {
    return (
      <Layout title="Rapor Anak" subtitle="Lihat rapor anak Anda">
        <div className="card p-8 text-center text-ink-700/50">
          Akun Anda belum terhubung dengan data siswa manapun. Hubungi admin sekolah untuk menghubungkan akun Anda dengan data anak Anda.
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Rapor Anak" subtitle="Lihat nilai, capaian, P5, ekstrakurikuler & catatan wali kelas">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <FileBadge size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Rapor Anak</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {siswaTerpilih
                ? `${siswaTerpilih.nama_lengkap} · ${siswaTerpilih.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Pilih anak untuk melihat rapor'}
            </p>
          </div>
        </div>
        <FileBadge size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        <div className="grid sm:grid-cols-3 gap-3">
          {anakList.length > 1 && (
            <div>
              <label className="label-field">Pilih Anak</label>
              <select className="input-field" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
                {anakList.map((s) => (
                  <option key={s.id} value={s.id}>{s.nama_lengkap}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label-field">Semester</label>
            <select className="input-field" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          <div>
            <label className="label-field">Tahun Ajaran</label>
            <select className="input-field" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)}>
              {DAFTAR_TAHUN_AJARAN.map((ta) => <option key={ta} value={ta}>{ta}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center text-ink-700/50 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Memuat rapor...
        </div>
      ) : (
        <div className="card p-0">
          <div className="flex flex-wrap border-b border-ink-950/10 rounded-t-2xl overflow-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key ? 'text-[#7a1515] border-b-2 border-[#7a1515]' : 'text-ink-700/60 hover:text-ink-950'
                  }`}
                >
                  <Icon size={15} /> {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {activeTab === 'ringkasan' && (
              <>
                {barisMapel.length > 0 ? (
                  <table className="table-shell mb-6">
                    <thead>
                      <tr><th>Mata Pelajaran</th><th>Nilai Pengetahuan</th><th>Nilai Keterampilan</th></tr>
                    </thead>
                    <tbody>
                      {barisMapel.map((b) => (
                        <tr key={b.mapel}>
                          <td className="font-medium">{b.mapel}</td>
                          <td>{b.rataRataPengetahuan ?? '-'}</td>
                          <td>{b.rataRataKeterampilan ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-ink-700/50 mb-6">Belum ada data nilai untuk periode ini.</p>
                )}

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
              </>
            )}

            {activeTab === 'capaian' && (
              Object.keys(capaianPerMapel).length === 0 ? (
                <p className="text-sm text-ink-700/50">Belum ada deskripsi capaian untuk periode ini.</p>
              ) : (
                <div className="space-y-4">
                  {Object.entries(capaianPerMapel).map(([mapel, komp]) => (
                    <div key={mapel} className="border border-ink-950/10 rounded-lg p-4">
                      <p className="font-medium text-ink-950 mb-2">{mapel}</p>
                      {komp.Pengetahuan && (
                        <div className="mb-2">
                          <p className="text-xs font-semibold text-ink-700/60 mb-1">Pengetahuan</p>
                          <p className="text-sm text-ink-700">{komp.Pengetahuan}</p>
                        </div>
                      )}
                      {komp.Keterampilan && (
                        <div>
                          <p className="text-xs font-semibold text-ink-700/60 mb-1">Keterampilan</p>
                          <p className="text-sm text-ink-700">{komp.Keterampilan}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'p5' && (
              p5List.length === 0 ? (
                <p className="text-sm text-ink-700/50">Belum ada data P5 untuk periode ini.</p>
              ) : (
                <table className="table-shell">
                  <thead><tr><th>Tema</th><th>Dimensi</th><th>Sub-elemen</th><th>Capaian</th></tr></thead>
                  <tbody>
                    {p5List.map((p) => (
                      <tr key={p.id}>
                        <td>{p.tema}</td><td>{p.dimensi}</td><td>{p.sub_elemen}</td><td>{p.capaian}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'ekskul' && (
              ekskulList.length === 0 ? (
                <p className="text-sm text-ink-700/50">Belum ada data ekstrakurikuler untuk periode ini.</p>
              ) : (
                <div className="space-y-3">
                  {ekskulList.map((row) => (
                    <div key={row.id} className="border border-ink-950/10 rounded-lg p-3">
                      <p className="font-medium text-ink-950">{row.nama_ekstrakurikuler}</p>
                      {row.predikat && <p className="text-xs text-ink-700/60 mt-0.5">Predikat: {row.predikat}</p>}
                      {row.keterangan && <p className="text-sm text-ink-700 mt-1">{row.keterangan}</p>}
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'catatan' && (
              !catatan ? (
                <p className="text-sm text-ink-700/50">Belum ada catatan wali kelas untuk periode ini.</p>
              ) : (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-semibold text-ink-700/60 mb-1">Tinggi Badan</p>
                      <p className="text-sm text-ink-700">{catatan.tinggi_badan ? `${catatan.tinggi_badan} cm` : '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-ink-700/60 mb-1">Berat Badan</p>
                      <p className="text-sm text-ink-700">{catatan.berat_badan ? `${catatan.berat_badan} kg` : '-'}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-700/60 mb-1">Kondisi Kesehatan</p>
                    <p className="text-sm text-ink-700">{catatan.kondisi_kesehatan || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-700/60 mb-1">Catatan Wali Kelas</p>
                    <p className="text-sm text-ink-700 whitespace-pre-line">{catatan.catatan || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-700/60 mb-1">Keputusan</p>
                    <p className="text-sm text-ink-700">{catatan.keputusan || '-'}</p>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
