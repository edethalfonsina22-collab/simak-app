import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import {
  FileBadge,
  Loader2,
  Save,
  Plus,
  Trash2,
  ClipboardList,
  Sparkles,
  Dumbbell,
  NotebookPen,
  Printer,
  Lightbulb,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './Rapor.css'

const TEMPLATE_DESKRIPSI = [
  {
    kategori: 'Sangat Baik',
    teks: (mapel) =>
      `Ananda menunjukkan penguasaan yang sangat baik pada mata pelajaran ${mapel}, mampu memahami dan menerapkan konsep dengan tepat, serta menunjukkan inisiatif dan rasa ingin tahu yang tinggi dalam pembelajaran.`,
  },
  {
    kategori: 'Baik',
    teks: (mapel) =>
      `Ananda menunjukkan pemahaman yang baik pada mata pelajaran ${mapel}, mampu mengikuti pembelajaran dengan baik dan menyelesaikan sebagian besar tugas dengan tepat waktu.`,
  },
  {
    kategori: 'Cukup',
    teks: (mapel) =>
      `Ananda menunjukkan pemahaman yang cukup pada mata pelajaran ${mapel}. Dengan bimbingan dan latihan lebih lanjut, ananda diharapkan dapat meningkatkan pemahamannya.`,
  },
  {
    kategori: 'Perlu Bimbingan',
    teks: (mapel) =>
      `Ananda masih memerlukan bimbingan lebih lanjut pada mata pelajaran ${mapel} untuk dapat memahami materi secara optimal. Diperlukan perhatian dan pendampingan yang lebih intensif.`,
  },
]

function kategoriDariNilai(rataRata) {
  if (rataRata === undefined || rataRata === null || isNaN(rataRata)) return null
  const n = Number(rataRata)
  if (n >= 90) return 'Sangat Baik'
  if (n >= 75) return 'Baik'
  if (n >= 60) return 'Cukup'
  return 'Perlu Bimbingan'
}

const OPSI_CAPAIAN_P5 = ['Belum Berkembang', 'Mulai Berkembang', 'Berkembang Sesuai Harapan', 'Sangat Berkembang']

const TEMPLATE_EKSKUL = [
  {
    kategori: 'Sangat Baik',
    teks: (nama) =>
      `Ananda menunjukkan minat dan keaktifan yang sangat baik dalam kegiatan ${nama}, serta mampu menguasai keterampilan yang diajarkan dengan sangat baik.`,
  },
  {
    kategori: 'Baik',
    teks: (nama) =>
      `Ananda menunjukkan keaktifan yang baik dalam kegiatan ${nama} dan mampu mengikuti setiap kegiatan dengan cukup baik.`,
  },
  {
    kategori: 'Cukup',
    teks: (nama) =>
      `Ananda cukup aktif mengikuti kegiatan ${nama}, namun masih perlu meningkatkan konsistensi keikutsertaan.`,
  },
  {
    kategori: 'Perlu Peningkatan',
    teks: (nama) =>
      `Ananda perlu meningkatkan minat dan keaktifan dalam mengikuti kegiatan ${nama} agar dapat mengembangkan potensi diri secara optimal.`,
  },
]

const TEMPLATE_CATATAN = [
  {
    kategori: 'Sangat Baik',
    teks: () =>
      `Ananda menunjukkan perkembangan sikap dan perilaku yang sangat baik selama semester ini, aktif, disiplin, dan mampu bekerja sama dengan baik bersama teman-teman.`,
  },
  {
    kategori: 'Baik',
    teks: () =>
      `Ananda menunjukkan perkembangan sikap dan perilaku yang baik selama semester ini, cukup disiplin dan mampu mengikuti kegiatan pembelajaran dengan baik.`,
  },
  {
    kategori: 'Cukup',
    teks: () =>
      `Ananda menunjukkan perkembangan sikap dan perilaku yang cukup baik selama semester ini. Diperlukan motivasi lebih lanjut agar ananda dapat lebih berkembang.`,
  },
  {
    kategori: 'Perlu Perhatian Khusus',
    teks: () =>
      `Ananda memerlukan perhatian khusus dari orang tua dan sekolah terkait sikap dan kedisiplinan selama semester ini, agar dapat mengikuti pembelajaran dengan lebih optimal.`,
  },
]

const TABS = [
  { key: 'ringkasan', label: 'Ringkasan Nilai', icon: ClipboardList },
  { key: 'capaian', label: 'Deskripsi Capaian', icon: NotebookPen },
  { key: 'p5', label: 'P5', icon: Sparkles },
  { key: 'ekskul', label: 'Ekstrakurikuler', icon: Dumbbell },
  { key: 'catatan', label: 'Catatan Wali Kelas', icon: NotebookPen },
]

const CATATAN_KOSONG = {
  id: null,
  catatan: '',
  tinggi_badan: '',
  berat_badan: '',
  kondisi_kesehatan: '',
  keputusan: '',
}

// Menghitung rentang tanggal dari kombinasi tahun ajaran + semester, supaya rekap
// presensi di rapor hanya mengambil data pada periode yang sedang dipilih.
// Format tahunAjaran yang didukung: "2025/2026".
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

// Motif sirkuit dekoratif senada dengan Loader, Login, Kelas & Nilai.
function CircuitBackdrop({ patternId }) {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-40 pointer-events-none" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#2DD4EE" strokeWidth="1" opacity="0.5">
            <path d="M0 30 H40 V60 H90" />
            <path d="M120 90 H80 V50 H30" />
            <path d="M60 0 V25 H100 V70" />
            <path d="M0 100 H35 V120" />
          </g>
          <g fill="#2DD4EE">
            <circle cx="40" cy="30" r="2" opacity="0.6" />
            <circle cx="90" cy="60" r="2" opacity="0.6" />
            <circle cx="80" cy="90" r="2" opacity="0.6" />
            <circle cx="30" cy="50" r="2" opacity="0.6" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

export default function Rapor() {
  const navigate = useNavigate()

  const [siswaList, setSiswaList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [capaianList, setCapaianList] = useState([])
  const [p5List, setP5List] = useState([])
  const [ekskulList, setEkskulList] = useState([])
  const [catatan, setCatatan] = useState(CATATAN_KOSONG)

  const [rekomendasiTerbuka, setRekomendasiTerbuka] = useState(null)
  const [rekomendasiEkskulTerbuka, setRekomendasiEkskulTerbuka] = useState(null)
  const [rekomendasiCatatanTerbuka, setRekomendasiCatatanTerbuka] = useState(false)

  useEffect(() => {
    supabase
      .from('siswa')
      .select('id, nama_lengkap, nis, kelas(nama_kelas)')
      .order('nama_lengkap')
      .then(({ data }) => setSiswaList(data || []))
  }, [])

  async function muatRapor() {
    if (!siswaId || !tahunAjaran) return
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
      supabase
        .from('nilai')
        .select('mata_pelajaran, jenis, nilai')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase
        .from('capaian_mapel')
        .select('id, mata_pelajaran, deskripsi_capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('rapor_p5')
        .select('id, tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .order('tema'),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('id, nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', siswaId)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select('id, catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', siswaId)
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
    setCatatan(catatanRows || CATATAN_KOSONG)

    const mapelDariNilai = [...new Set((nilaiRows || []).map((n) => n.mata_pelajaran))]
    const mapelDariCapaian = (capaianRows || []).map((c) => c.mata_pelajaran)
    const semuaMapel = [...new Set([...mapelDariNilai, ...mapelDariCapaian])]
    setCapaianList(
      semuaMapel.map((mapel) => {
        const existing = (capaianRows || []).find((c) => c.mata_pelajaran === mapel)
        return {
          id: existing?.id || null,
          mata_pelajaran: mapel,
          deskripsi_capaian: existing?.deskripsi_capaian || '',
          terkunci: mapelDariNilai.includes(mapel),
        }
      })
    )

    setLoading(false)
  }

  const siswaTerpilih = siswaList.find((s) => s.id === siswaId)

  const rekapPerMapel = {}
  for (const n of nilai) {
    if (!rekapPerMapel[n.mata_pelajaran]) rekapPerMapel[n.mata_pelajaran] = []
    rekapPerMapel[n.mata_pelajaran].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapel).map(([mapel, nilaiArr]) => ({
    mapel,
    rataRata: (nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length).toFixed(1),
  }))

  function ubahBarisCapaian(index, field, value) {
    setCapaianList((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  function pilihRekomendasi(index, template) {
    const mapel = capaianList[index].mata_pelajaran || 'mata pelajaran ini'
    ubahBarisCapaian(index, 'deskripsi_capaian', template.teks(mapel))
    setRekomendasiTerbuka(null)
  }

  function tambahBarisCapaian() {
    setCapaianList((prev) => [
      ...prev,
      { id: null, mata_pelajaran: '', deskripsi_capaian: '', terkunci: false },
    ])
  }

  async function hapusBarisCapaian(index) {
    const row = capaianList[index]
    if (row.id) {
      await supabase.from('capaian_mapel').delete().eq('id', row.id)
    }
    setCapaianList((prev) => prev.filter((_, i) => i !== index))
  }

  async function simpanCapaian() {
    setSaving(true)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    let gagal = []
    for (const c of capaianList) {
      if (!c.mata_pelajaran.trim()) continue
      if (c.id) {
        const { error } = await supabase
          .from('capaian_mapel')
          .update({
            mata_pelajaran: c.mata_pelajaran,
            deskripsi_capaian: c.deskripsi_capaian,
            diisi_oleh: user?.id,
          })
          .eq('id', c.id)
        if (error) gagal.push(error.message)
      } else if (c.deskripsi_capaian.trim()) {
        const { error } = await supabase.from('capaian_mapel').insert({
          siswa_id: siswaId,
          mata_pelajaran: c.mata_pelajaran,
          semester,
          tahun_ajaran: tahunAjaran,
          deskripsi_capaian: c.deskripsi_capaian,
          diisi_oleh: user?.id,
        })
        if (error) gagal.push(error.message)
      }
    }
    if (gagal.length) alert('Gagal menyimpan sebagian deskripsi capaian:\n' + [...new Set(gagal)].join('\n'))
    await muatRapor()
    setSaving(false)
  }

  function ubahBarisP5(index, field, value) {
    setP5List((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  function tambahBarisP5() {
    setP5List((prev) => [
      ...prev,
      { id: null, tema: '', dimensi: '', sub_elemen: '', capaian: OPSI_CAPAIAN_P5[0] },
    ])
  }

  async function hapusBarisP5(index) {
    const row = p5List[index]
    if (row.id) {
      await supabase.from('rapor_p5').delete().eq('id', row.id)
    }
    setP5List((prev) => prev.filter((_, i) => i !== index))
  }

  async function simpanP5() {
    setSaving(true)
    let gagal = []
    for (const p of p5List) {
      if (!p.tema.trim() && !p.dimensi.trim()) continue
      if (p.id) {
        const { error } = await supabase
          .from('rapor_p5')
          .update({ tema: p.tema, dimensi: p.dimensi, sub_elemen: p.sub_elemen, capaian: p.capaian })
          .eq('id', p.id)
        if (error) gagal.push(error.message)
      } else {
        const { error } = await supabase.from('rapor_p5').insert({
          siswa_id: siswaId,
          semester,
          tahun_ajaran: tahunAjaran,
          tema: p.tema,
          dimensi: p.dimensi,
          sub_elemen: p.sub_elemen,
          capaian: p.capaian,
        })
        if (error) gagal.push(error.message)
      }
    }
    if (gagal.length) alert('Gagal menyimpan sebagian data P5:\n' + [...new Set(gagal)].join('\n'))
    await muatRapor()
    setSaving(false)
  }

  function tambahBarisEkskul() {
    setEkskulList((prev) => [
      ...prev,
      { id: null, nama_ekstrakurikuler: '', predikat: '', keterangan: '' },
    ])
  }

  function ubahBarisEkskul(index, field, value) {
    setEkskulList((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    )
  }

  function pilihRekomendasiEkskul(index, template) {
    const nama = ekskulList[index].nama_ekstrakurikuler || 'ini'
    ubahBarisEkskul(index, 'keterangan', template.teks(nama))
    setRekomendasiEkskulTerbuka(null)
  }

  async function hapusBarisEkskul(index) {
    const row = ekskulList[index]
    if (row.id) {
      await supabase.from('ekstrakurikuler_nilai').delete().eq('id', row.id)
    }
    setEkskulList((prev) => prev.filter((_, i) => i !== index))
  }

  async function simpanEkskul() {
    setSaving(true)
    let gagal = []
    for (const row of ekskulList) {
      if (!row.nama_ekstrakurikuler.trim()) continue
      if (row.id) {
        const { error } = await supabase
          .from('ekstrakurikuler_nilai')
          .update({
            nama_ekstrakurikuler: row.nama_ekstrakurikuler,
            predikat: row.predikat,
            keterangan: row.keterangan,
          })
          .eq('id', row.id)
        if (error) gagal.push(error.message)
      } else {
        const { error } = await supabase.from('ekstrakurikuler_nilai').insert({
          siswa_id: siswaId,
          semester,
          tahun_ajaran: tahunAjaran,
          nama_ekstrakurikuler: row.nama_ekstrakurikuler,
          predikat: row.predikat,
          keterangan: row.keterangan,
        })
        if (error) gagal.push(error.message)
      }
    }
    if (gagal.length) alert('Gagal menyimpan sebagian data Ekstrakurikuler:\n' + [...new Set(gagal)].join('\n'))
    await muatRapor()
    setSaving(false)
  }

  function ubahCatatan(field, value) {
    setCatatan((prev) => ({ ...prev, [field]: value }))
  }

  function pilihRekomendasiCatatan(template) {
    ubahCatatan('catatan', template.teks())
    setRekomendasiCatatanTerbuka(false)
  }

  async function simpanCatatan() {
    setSaving(true)
    const payload = {
      siswa_id: siswaId,
      semester,
      tahun_ajaran: tahunAjaran,
      catatan: catatan.catatan,
      tinggi_badan: catatan.tinggi_badan,
      berat_badan: catatan.berat_badan,
      kondisi_kesehatan: catatan.kondisi_kesehatan,
      keputusan: catatan.keputusan,
    }
    const { error } = catatan.id
      ? await supabase.from('catatan_siswa').update(payload).eq('id', catatan.id)
      : await supabase.from('catatan_siswa').insert(payload)
    if (error) alert('Gagal menyimpan catatan wali kelas:\n' + error.message)
    await muatRapor()
    setSaving(false)
  }

  function bukaCetak() {
    if (!siswaId || !tahunAjaran) return
    const params = new URLSearchParams({ siswaId, semester, tahunAjaran })
    navigate(`/rapor/cetak?${params.toString()}`)
  }

  return (
    <Layout title="Rapor Siswa" subtitle="Kelola nilai, deskripsi capaian, P5, ekstrakurikuler & catatan wali kelas">
      <div className="relative overflow-hidden rounded-2xl rapor-banner p-6 mb-6">
        <CircuitBackdrop patternId="pola-rapor" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full rapor-banner-icon flex items-center justify-center shrink-0">
            <FileBadge size={20} />
          </div>
          <div>
            <p className="font-display font-semibold text-lg rapor-banner-title">Rapor Siswa</p>
            <p className="text-sm rapor-banner-subtitle mt-0.5">
              {siswaTerpilih
                ? `${siswaTerpilih.nama_lengkap} · ${siswaTerpilih.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Pilih siswa untuk lihat & isi rapor'}
            </p>
          </div>
        </div>
      </div>

      <div className="rapor-card p-5 mb-5">
        <div className="grid sm:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="rapor-label">Pilih Siswa</label>
            <select className="rapor-input" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
              <option value="">-- Pilih siswa --</option>
              {siswaList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nama_lengkap} {s.kelas?.nama_kelas ? `(${s.kelas.nama_kelas})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="rapor-label">Semester</label>
            <select className="rapor-input" value={semester} onChange={(e) => setSemester(e.target.value)}>
              <option value="Ganjil">Ganjil</option>
              <option value="Genap">Genap</option>
            </select>
          </div>
          <div>
            <label className="rapor-label">Tahun Ajaran</label>
            <input
              className="rapor-input"
              placeholder="2025/2026"
              value={tahunAjaran}
              onChange={(e) => setTahunAjaran(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="rapor-btn-primary" onClick={muatRapor} disabled={!siswaId || !tahunAjaran || loading}>
            {loading && <Loader2 size={16} className="rapor-spin" />}
            Tampilkan Rapor
          </button>
          {siswaTerpilih && (
            <button className="rapor-btn-secondary" onClick={bukaCetak}>
              <Printer size={16} /> Buka Halaman Cetak
            </button>
          )}
        </div>
      </div>

      {siswaTerpilih && (
        <div className="rapor-card p-0">
          <div className="flex flex-wrap rapor-tabs">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rapor-tab ${activeTab === tab.key ? 'rapor-tab-active' : ''}`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="p-6">
            {activeTab === 'ringkasan' && (
              <>
                {barisMapel.length > 0 ? (
                  <table className="rapor-table mb-6">
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
                ) : (
                  <p className="text-sm rapor-muted mb-6">Belum ada data nilai untuk periode ini.</p>
                )}

                <h4 className="font-display font-semibold rapor-banner-title mb-3">Rekap Kehadiran</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="rapor-rekap-card rapor-rekap-hadir">
                    <p className="text-2xl font-display font-semibold">{presensi.hadir}</p>
                    <p className="text-xs">Hadir</p>
                  </div>
                  <div className="rapor-rekap-card rapor-rekap-izin">
                    <p className="text-2xl font-display font-semibold">{presensi.izin}</p>
                    <p className="text-xs">Izin</p>
                  </div>
                  <div className="rapor-rekap-card rapor-rekap-sakit">
                    <p className="text-2xl font-display font-semibold">{presensi.sakit}</p>
                    <p className="text-xs">Sakit</p>
                  </div>
                  <div className="rapor-rekap-card rapor-rekap-alpa">
                    <p className="text-2xl font-display font-semibold">{presensi.alpa}</p>
                    <p className="text-xs">Alpa</p>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'capaian' && (
              <>
                {capaianList.length === 0 && (
                  <p className="text-sm rapor-muted mb-4">
                    Belum ada mata pelajaran. Klik &quot;Tambah Mapel&quot; untuk mulai isi deskripsi capaian.
                  </p>
                )}
                <div className="space-y-4">
                  {capaianList.map((c, i) => {
                    const mapelInfo = barisMapel.find((b) => b.mapel === c.mata_pelajaran)
                    const rekomendasiKategori = kategoriDariNilai(mapelInfo?.rataRata)
                    return (
                      <div key={c.id || `baru-${i}`} className="rapor-subcard">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          {c.terkunci ? (
                            <label className="rapor-label !mb-0">{c.mata_pelajaran}</label>
                          ) : (
                            <input
                              className="rapor-input"
                              placeholder="Nama mata pelajaran"
                              value={c.mata_pelajaran}
                              onChange={(e) => ubahBarisCapaian(i, 'mata_pelajaran', e.target.value)}
                            />
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="relative">
                              <button
                                type="button"
                                className="rapor-btn-secondary !px-3"
                                onClick={() =>
                                  setRekomendasiTerbuka(rekomendasiTerbuka === i ? null : i)
                                }
                                title="Lihat rekomendasi deskripsi"
                              >
                                <Lightbulb size={15} /> Rekomendasi
                              </button>
                              {rekomendasiTerbuka === i && (
                                <div className="rapor-dropdown">
                                  {TEMPLATE_DESKRIPSI.map((tpl) => (
                                    <button
                                      key={tpl.kategori}
                                      type="button"
                                      onClick={() => pilihRekomendasi(i, tpl)}
                                      className="rapor-dropdown-item"
                                    >
                                      <span className="rapor-dropdown-title">
                                        {tpl.kategori}
                                        {rekomendasiKategori === tpl.kategori && (
                                          <span className="rapor-badge-recommend">disarankan</span>
                                        )}
                                      </span>
                                      <span className="rapor-dropdown-preview">
                                        {tpl.teks(c.mata_pelajaran || 'mapel ini')}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button
                              className="rapor-btn-secondary !px-3"
                              onClick={() => hapusBarisCapaian(i)}
                              title="Hapus mapel ini"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                        <textarea
                          className="rapor-input min-h-[80px]"
                          placeholder="Deskripsi capaian pembelajaran..."
                          value={c.deskripsi_capaian}
                          onChange={(e) => ubahBarisCapaian(i, 'deskripsi_capaian', e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="rapor-btn-secondary" onClick={tambahBarisCapaian}>
                    <Plus size={16} /> Tambah Mapel
                  </button>
                  <button className="rapor-btn-primary" onClick={simpanCapaian} disabled={saving}>
                    {saving && <Loader2 size={16} className="rapor-spin" />}
                    <Save size={16} /> Simpan Deskripsi Capaian
                  </button>
                </div>
              </>
            )}

            {activeTab === 'p5' && (
              <>
                <div className="space-y-3">
                  {p5List.map((p, i) => (
                    <div key={p.id || `baru-${i}`} className="rapor-subcard">
                      <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-2">
                        <input
                          className="rapor-input"
                          placeholder="Tema"
                          value={p.tema}
                          onChange={(e) => ubahBarisP5(i, 'tema', e.target.value)}
                        />
                        <input
                          className="rapor-input"
                          placeholder="Dimensi"
                          value={p.dimensi}
                          onChange={(e) => ubahBarisP5(i, 'dimensi', e.target.value)}
                        />
                        <input
                          className="rapor-input"
                          placeholder="Sub-elemen"
                          value={p.sub_elemen}
                          onChange={(e) => ubahBarisP5(i, 'sub_elemen', e.target.value)}
                        />
                        <button
                          className="rapor-btn-secondary !px-3"
                          onClick={() => hapusBarisP5(i)}
                          title="Hapus baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div>
                        <label className="rapor-label">Capaian</label>
                        <select
                          className="rapor-input"
                          value={p.capaian || OPSI_CAPAIAN_P5[0]}
                          onChange={(e) => ubahBarisP5(i, 'capaian', e.target.value)}
                        >
                          {OPSI_CAPAIAN_P5.map((opsi) => (
                            <option key={opsi} value={opsi}>
                              {opsi}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                  {p5List.length === 0 && (
                    <p className="text-sm rapor-muted">Belum ada data P5 untuk periode ini.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="rapor-btn-secondary" onClick={tambahBarisP5}>
                    <Plus size={16} /> Tambah Baris P5
                  </button>
                  <button className="rapor-btn-primary" onClick={simpanP5} disabled={saving}>
                    {saving && <Loader2 size={16} className="rapor-spin" />}
                    <Save size={16} /> Simpan P5
                  </button>
                </div>
              </>
            )}

            {activeTab === 'ekskul' && (
              <>
                <div className="space-y-3">
                  {ekskulList.map((row, i) => (
                    <div key={row.id || `baru-${i}`} className="grid sm:grid-cols-[2fr_1fr_2fr_auto_auto] gap-3 items-start">
                      <input
                        className="rapor-input"
                        placeholder="Nama ekstrakurikuler"
                        value={row.nama_ekstrakurikuler}
                        onChange={(e) => ubahBarisEkskul(i, 'nama_ekstrakurikuler', e.target.value)}
                      />
                      <input
                        className="rapor-input"
                        placeholder="Predikat"
                        value={row.predikat}
                        onChange={(e) => ubahBarisEkskul(i, 'predikat', e.target.value)}
                      />
                      <input
                        className="rapor-input"
                        placeholder="Keterangan"
                        value={row.keterangan}
                        onChange={(e) => ubahBarisEkskul(i, 'keterangan', e.target.value)}
                      />
                      <div className="relative shrink-0">
                        <button
                          type="button"
                          className="rapor-btn-secondary !px-3"
                          onClick={() =>
                            setRekomendasiEkskulTerbuka(rekomendasiEkskulTerbuka === i ? null : i)
                          }
                          title="Lihat rekomendasi keterangan"
                        >
                          <Lightbulb size={15} />
                        </button>
                        {rekomendasiEkskulTerbuka === i && (
                          <div className="rapor-dropdown">
                            {TEMPLATE_EKSKUL.map((tpl) => (
                              <button
                                key={tpl.kategori}
                                type="button"
                                onClick={() => pilihRekomendasiEkskul(i, tpl)}
                                className="rapor-dropdown-item"
                              >
                                <span className="rapor-dropdown-title">{tpl.kategori}</span>
                                <span className="rapor-dropdown-preview">
                                  {tpl.teks(row.nama_ekstrakurikuler || 'ini')}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        className="rapor-btn-secondary !px-3"
                        onClick={() => hapusBarisEkskul(i)}
                        title="Hapus baris"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="rapor-btn-secondary" onClick={tambahBarisEkskul}>
                    <Plus size={16} /> Tambah Baris
                  </button>
                  <button className="rapor-btn-primary" onClick={simpanEkskul} disabled={saving}>
                    {saving && <Loader2 size={16} className="rapor-spin" />}
                    <Save size={16} /> Simpan Ekstrakurikuler
                  </button>
                </div>
              </>
            )}

            {activeTab === 'catatan' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="rapor-label">Tinggi Badan (cm)</label>
                    <input
                      className="rapor-input"
                      value={catatan.tinggi_badan}
                      onChange={(e) => ubahCatatan('tinggi_badan', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="rapor-label">Berat Badan (kg)</label>
                    <input
                      className="rapor-input"
                      value={catatan.berat_badan}
                      onChange={(e) => ubahCatatan('berat_badan', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="rapor-label">Kondisi Kesehatan</label>
                  <input
                    className="rapor-input"
                    placeholder="mis. Baik / perlu perhatian pada..."
                    value={catatan.kondisi_kesehatan}
                    onChange={(e) => ubahCatatan('kondisi_kesehatan', e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="rapor-label">Keputusan</label>
                  <select
                    className="rapor-input"
                    value={catatan.keputusan}
                    onChange={(e) => ubahCatatan('keputusan', e.target.value)}
                  >
                    <option value="">-- Belum ditentukan --</option>
                    <option value="Naik Kelas">Naik Kelas</option>
                    <option value="Tinggal Kelas">Tinggal Kelas</option>
                    <option value="Lulus">Lulus</option>
                  </select>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="rapor-label !mb-0">Catatan Wali Kelas</label>
                    <div className="relative">
                      <button
                        type="button"
                        className="rapor-btn-secondary !px-3"
                        onClick={() => setRekomendasiCatatanTerbuka((v) => !v)}
                        title="Lihat rekomendasi catatan"
                      >
                        <Lightbulb size={15} /> Rekomendasi
                      </button>
                      {rekomendasiCatatanTerbuka && (
                        <div className="rapor-dropdown">
                          {TEMPLATE_CATATAN.map((tpl) => (
                            <button
                              key={tpl.kategori}
                              type="button"
                              onClick={() => pilihRekomendasiCatatan(tpl)}
                              className="rapor-dropdown-item"
                            >
                              <span className="rapor-dropdown-title">{tpl.kategori}</span>
                              <span className="rapor-dropdown-preview">{tpl.teks()}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="rapor-input min-h-[100px]"
                    placeholder="Catatan perkembangan siswa dari wali kelas..."
                    value={catatan.catatan}
                    onChange={(e) => ubahCatatan('catatan', e.target.value)}
                  />
                </div>
                <button className="rapor-btn-primary" onClick={simpanCatatan} disabled={saving}>
                  {saving && <Loader2 size={16} className="rapor-spin" />}
                  <Save size={16} /> Simpan Catatan
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </Layout>
  )
}
