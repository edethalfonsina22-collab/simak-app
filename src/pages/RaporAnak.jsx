import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  FileBadge,
  Loader2,
  ClipboardList,
  NotebookPen,
  Sparkles,
  Dumbbell,
  Info,
} from 'lucide-react'

// ============================================================
// Halaman khusus ORANG TUA — read-only sepenuhnya.
// Beda dengan Rapor.jsx (punya Guru): di sini TIDAK ADA dropdown bebas
// pilih siswa, tidak ada tombol simpan/hapus/edit apa pun. Anak hanya
// diambil lewat getAnakSaya() (AuthContext), yang query-nya dibatasi ke
// tabel `orang_tua_siswa` sesuai akun orang tua yang sedang login — jadi
// orang tua tidak mungkin melihat rapor anak orang lain.
//
// Logika hitung Nilai Akhir & agregasi nilai SENGAJA disamakan persis
// dengan Rapor.jsx (punya Guru) supaya angka yang dilihat orang tua tidak
// pernah berbeda dari yang dihitung/ditetapkan wali kelas.
// ============================================================

const BOBOT_JENIS_NILAI = { Tugas: 0.2, UTS: 0.3, UAS: 0.5 }

function nilaiAkhirTertimbang(perJenis) {
  let totalNilaiBerbobot = 0
  let totalBobotTerpakai = 0
  for (const [jenis, bobot] of Object.entries(BOBOT_JENIS_NILAI)) {
    const arr = perJenis[jenis]
    if (arr && arr.length > 0) {
      const rataJenis = arr.reduce((a, b) => a + b, 0) / arr.length
      totalNilaiBerbobot += rataJenis * bobot
      totalBobotTerpakai += bobot
    }
  }
  if (totalBobotTerpakai === 0) return null
  return (totalNilaiBerbobot / totalBobotTerpakai).toFixed(1)
}

function predikatDariNilai(nilai) {
  if (nilai === '' || nilai === undefined || nilai === null) return null
  const n = Number(nilai)
  if (isNaN(n)) return null
  if (n >= 90) return 'A'
  if (n >= 75) return 'B'
  if (n >= 60) return 'C'
  return 'D'
}

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

const TAHUN_SEKARANG = new Date().getFullYear()
const DAFTAR_TAHUN_AJARAN = Array.from({ length: 5 }, (_, i) => {
  const awal = TAHUN_SEKARANG - 2 + i
  return `${awal}/${awal + 1}`
})
// Tahun ajaran berjalan (index tengah dari daftar 5 tahun di atas), dipakai
// sebagai default pertama kali halaman dibuka.
const TAHUN_AJARAN_BERJALAN = DAFTAR_TAHUN_AJARAN[2]

const KOMPETENSI_KEYS = [
  { key: 'pengetahuan', label: 'Pengetahuan', jenis: 'Pengetahuan' },
  { key: 'keterampilan', label: 'Keterampilan', jenis: 'Keterampilan' },
]

const TABS = [
  { key: 'nilai', label: 'Nilai & Kehadiran', icon: ClipboardList },
  { key: 'capaian', label: 'Deskripsi Capaian', icon: NotebookPen },
  { key: 'p5', label: 'P5', icon: Sparkles },
  { key: 'ekskul', label: 'Ekstrakurikuler', icon: Dumbbell },
  { key: 'catatan', label: 'Catatan Wali Kelas', icon: NotebookPen },
]

export default function RaporAnak() {
  const { getAnakSaya } = useAuth()

  const [anakList, setAnakList] = useState([])
  const [anakId, setAnakId] = useState('')
  const [loadingAnak, setLoadingAnak] = useState(true)

  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState(TAHUN_AJARAN_BERJALAN)
  const [activeTab, setActiveTab] = useState('nilai')
  const [loading, setLoading] = useState(false)

  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [capaianList, setCapaianList] = useState([])
  const [p5List, setP5List] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [catatan, setCatatan] = useState(null)

  // Ambil daftar anak HANYA lewat tabel orang_tua_siswa (via getAnakSaya di
  // AuthContext) — tidak ada jalur lain untuk memilih siswa.
  useEffect(() => {
    async function muatAnak() {
      setLoadingAnak(true)
      const { data } = await getAnakSaya()
      const list = data || []
      setAnakList(list)
      // Auto-pilih anak pertama yang hubungannya sudah disetujui admin.
      const pertama = list.find((a) => a.status === 'aktif')
      if (pertama) setAnakId(pertama.siswa.id)
      setLoadingAnak(false)
    }
    muatAnak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anakTerpilih = anakList.find((a) => a.siswa.id === anakId)
  const siswa = anakTerpilih?.siswa
  const anakDisetujui = anakList.filter((a) => a.status === 'aktif')

  useEffect(() => {
    if (anakId && tahunAjaran) muatRapor()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anakId, semester, tahunAjaran])

  async function muatRapor() {
    setLoading(true)
    const periode = rentangTanggalPeriode(tahunAjaran, semester)
    let queryPresensi = supabase.from('presensi_siswa').select('status').eq('siswa_id', anakId)
    if (periode) {
      queryPresensi = queryPresensi.gte('tanggal', periode.mulai).lte('tanggal', periode.selesai)
    }

    const [
      { data: nilaiRows },
      { data: presensiRows },
      { data: capaianRows },
      { data: p5Rows },
      { data: ekskulRows },
      { data: catatanRow },
    ] = await Promise.all([
      supabase
        .from('nilai')
        .select('mata_pelajaran, kompetensi, jenis, nilai')
        .eq('siswa_id', anakId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase
        .from('capaian_mapel')
        .select('mata_pelajaran, jenis, deskripsi_capaian, nilai_akhir, predikat')
        .eq('siswa_id', anakId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('rapor_p5')
        .select('id, tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', anakId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .order('tema'),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('id, nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', anakId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select('catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', anakId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .maybeSingle(),
    ])

    setNilai(nilaiRows || [])
    const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const p of presensiRows || []) {
      if (rekap[p.status] !== undefined) rekap[p.status]++
    }
    setPresensi(rekap)
    setP5List(p5Rows || [])
    setEkskulList(ekskulRows || [])
    setCatatan(catatanRow || null)

    const mapelDariNilai = [...new Set((nilaiRows || []).map((n) => n.mata_pelajaran))]
    const mapelDariCapaian = [...new Set((capaianRows || []).map((c) => c.mata_pelajaran))]
    const semuaMapel = [...new Set([...mapelDariNilai, ...mapelDariCapaian])]

    setCapaianList(
      semuaMapel.map((mapel) => ({
        mata_pelajaran: mapel,
        pengetahuan: (capaianRows || []).find((c) => c.mata_pelajaran === mapel && c.jenis === 'Pengetahuan') || {},
        keterampilan: (capaianRows || []).find((c) => c.mata_pelajaran === mapel && c.jenis === 'Keterampilan') || {},
      }))
    )

    setLoading(false)
  }

  // ---------- Agregasi nilai — logika identik dengan Rapor.jsx (Guru),
  // supaya Nilai Akhir yang tampil ke orang tua selalu sama dengan yang
  // dihitung/ditetapkan wali kelas. ----------
  const rekapPerMapelKompetensi = {}
  for (const n of nilai) {
    if (!rekapPerMapelKompetensi[n.mata_pelajaran]) {
      rekapPerMapelKompetensi[n.mata_pelajaran] = {
        Pengetahuan: { Tugas: [], UH: [], UTS: [], UAS: [] },
        Keterampilan: { Tugas: [], UH: [], UTS: [], UAS: [] },
      }
    }
    const kk = n.kompetensi === 'Keterampilan' ? 'Keterampilan' : 'Pengetahuan'
    const jj = ['Tugas', 'UH', 'UTS', 'UAS'].includes(n.jenis) ? n.jenis : 'Tugas'
    rekapPerMapelKompetensi[n.mata_pelajaran][kk][jj].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapelKompetensi).map(([mapel, kel]) => ({
    mapel,
    rataRataPengetahuan: nilaiAkhirTertimbang(kel.Pengetahuan),
    rataRataKeterampilan: nilaiAkhirTertimbang(kel.Keterampilan),
  }))

  function nilaiOtomatisUntuk(mapel, kompKey) {
    const info = barisMapel.find((b) => b.mapel === mapel)
    if (!info) return null
    return kompKey === 'keterampilan' ? info.rataRataKeterampilan : info.rataRataPengetahuan
  }

  return (
    <Layout title="Rapor Anak" subtitle="Nilai, capaian, P5, ekstrakurikuler & catatan wali kelas — khusus anak Anda">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <FileBadge size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Rapor Anak</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {siswa
                ? `${siswa.nama_lengkap} · ${siswa.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Memuat data anak...'}
            </p>
          </div>
        </div>
        <FileBadge size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        {loadingAnak ? (
          <p className="text-sm text-ink-700/50 flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Memuat data anak...
          </p>
        ) : anakList.length === 0 ? (
          <p className="text-sm text-ink-700/50">
            Akun Anda belum terhubung dengan siswa manapun. Silakan hubungi admin sekolah.
          </p>
        ) : anakDisetujui.length === 0 ? (
          <p className="text-sm text-amber-600 flex items-center gap-2">
            <Info size={15} /> Hubungan Anda dengan anak masih menunggu persetujuan admin sekolah.
          </p>
        ) : (
          <div className="grid sm:grid-cols-4 gap-3">
            {anakDisetujui.length > 1 && (
              <div className="sm:col-span-2">
                <label className="label-field">Pilih Anak</label>
                <select className="input-field" value={anakId} onChange={(e) => setAnakId(e.target.value)}>
                  {anakDisetujui.map((a) => (
                    <option key={a.siswa.id} value={a.siswa.id}>
                      {a.siswa.nama_lengkap} {a.siswa.kelas?.nama_kelas ? `(${a.siswa.kelas.nama_kelas})` : ''}
                    </option>
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
                {DAFTAR_TAHUN_AJARAN.map((ta) => (
                  <option key={ta} value={ta}>
                    {ta}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {siswa && anakDisetujui.length > 0 && (
        <div className="card p-0">
          <div className="flex flex-wrap border-b border-ink-950/10 rounded-t-2xl overflow-hidden">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'text-[#7a1515] border-b-2 border-[#7a1515]'
                      : 'text-ink-700/60 hover:text-ink-950'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {loading ? (
              <p className="text-sm text-ink-700/50 flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Memuat rapor...
              </p>
            ) : (
              <>
                {activeTab === 'nilai' && (
                  <>
                    {capaianList.length > 0 ? (
                      <div className="overflow-x-auto mb-6">
                        <table className="table-shell mb-2">
                          <thead>
                            <tr>
                              <th rowSpan={2} className="align-bottom">Mata Pelajaran</th>
                              <th colSpan={2} className="text-center">Pengetahuan</th>
                              <th colSpan={2} className="text-center border-l border-ink-950/10">Keterampilan</th>
                            </tr>
                            <tr>
                              <th className="text-center w-24">Nilai</th>
                              <th className="text-center">Predikat</th>
                              <th className="text-center w-24 border-l border-ink-950/10">Nilai</th>
                              <th className="text-center">Predikat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {capaianList.map((c, i) => (
                              <tr key={c.mata_pelajaran || `mapel-${i}`}>
                                <td className="font-medium">{c.mata_pelajaran || '-'}</td>
                                {KOMPETENSI_KEYS.map((komp) => {
                                  const entri = c[komp.key]
                                  const otomatis = nilaiOtomatisUntuk(c.mata_pelajaran, komp.key)
                                  const sudahFinal =
                                    entri.nilai_akhir !== null && entri.nilai_akhir !== undefined && entri.nilai_akhir !== ''
                                  const nilaiTampil = sudahFinal ? entri.nilai_akhir : otomatis
                                  const predikatTampil = sudahFinal ? entri.predikat : predikatDariNilai(otomatis)
                                  return (
                                    <Fragment key={komp.key}>
                                      <td className={komp.key === 'keterampilan' ? 'border-l border-ink-950/10 text-center' : 'text-center'}>
                                        {nilaiTampil ?? '-'}
                                      </td>
                                      <td className="text-center font-medium">{predikatTampil || '-'}</td>
                                    </Fragment>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
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
                  <>
                    {capaianList.length === 0 ? (
                      <p className="text-sm text-ink-700/50">Belum ada deskripsi capaian untuk periode ini.</p>
                    ) : (
                      <div className="space-y-4">
                        {capaianList.map((c, i) => (
                          <div key={c.mata_pelajaran || `capaian-${i}`} className="border border-ink-950/10 rounded-lg p-4">
                            <p className="font-display font-semibold text-ink-950 mb-3">{c.mata_pelajaran}</p>
                            {KOMPETENSI_KEYS.map((komp) => (
                              <div key={komp.key} className="mb-3 last:mb-0">
                                <p className="text-xs font-semibold text-ink-700/60 mb-1">{komp.label}</p>
                                <p className="text-sm text-ink-950">
                                  {c[komp.key]?.deskripsi_capaian || (
                                    <span className="text-ink-700/40">Belum diisi oleh wali kelas.</span>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'p5' && (
                  <>
                    {p5List.length === 0 ? (
                      <p className="text-sm text-ink-700/50">Belum ada data P5 untuk periode ini.</p>
                    ) : (
                      <div className="space-y-4">
                        {p5List.map((row) => (
                          <div key={row.id} className="border border-ink-950/10 rounded-lg p-4">
                            <p className="font-display font-semibold text-ink-950">{row.tema || '-'}</p>
                            <p className="text-xs text-ink-700/60 mt-0.5 mb-2">
                              {row.dimensi} {row.sub_elemen ? `· ${row.sub_elemen}` : ''}
                            </p>
                            <p className="text-sm text-ink-950">
                              {row.capaian || <span className="text-ink-700/40">Belum diisi.</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'ekskul' && (
                  <>
                    {ekskulList.length === 0 ? (
                      <p className="text-sm text-ink-700/50">Belum ada data ekstrakurikuler untuk periode ini.</p>
                    ) : (
                      <div className="space-y-4">
                        {ekskulList.map((row) => (
                          <div key={row.id} className="border border-ink-950/10 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <p className="font-display font-semibold text-ink-950">{row.nama_ekstrakurikuler}</p>
                              <span className="text-xs font-semibold px-2 py-1 rounded-full bg-sage-500/10 text-sage-600">
                                {row.predikat || '-'}
                              </span>
                            </div>
                            <p className="text-sm text-ink-950">
                              {row.keterangan || <span className="text-ink-700/40">Belum ada keterangan.</span>}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeTab === 'catatan' && (
                  <>
                    {!catatan ? (
                      <p className="text-sm text-ink-700/50">Belum ada catatan wali kelas untuk periode ini.</p>
                    ) : (
                      <div className="space-y-4">
                        <div className="grid sm:grid-cols-3 gap-3">
                          <div className="rounded-lg bg-ink-950/[0.03] p-3">
                            <p className="text-xs text-ink-700/60 mb-1">Tinggi Badan</p>
                            <p className="text-sm font-medium text-ink-950">
                              {catatan.tinggi_badan ? `${catatan.tinggi_badan} cm` : '-'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-ink-950/[0.03] p-3">
                            <p className="text-xs text-ink-700/60 mb-1">Berat Badan</p>
                            <p className="text-sm font-medium text-ink-950">
                              {catatan.berat_badan ? `${catatan.berat_badan} kg` : '-'}
                            </p>
                          </div>
                          <div className="rounded-lg bg-ink-950/[0.03] p-3">
                            <p className="text-xs text-ink-700/60 mb-1">Kondisi Kesehatan</p>
                            <p className="text-sm font-medium text-ink-950">{catatan.kondisi_kesehatan || '-'}</p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-700/60 mb-1">Catatan Wali Kelas</p>
                          <p className="text-sm text-ink-950">{catatan.catatan || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-ink-700/60 mb-1">Keputusan</p>
                          <p className="text-sm text-ink-950">{catatan.keputusan || '-'}</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
