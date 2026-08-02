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
  Wand2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

// --- Template deskripsi capaian siap pakai ---
// Guru tinggal pilih predikat, teks otomatis terisi (nama siswa & mapel disesuaikan), lalu bisa diedit manual.
const TEMPLATE_CAPAIAN = {
  'Sangat Baik': (nama, mapel) =>
    `${nama} menunjukkan penguasaan yang sangat baik pada mata pelajaran ${mapel}. Mampu memahami konsep dengan cepat, aktif dalam pembelajaran, dan menerapkannya secara konsisten dalam berbagai latihan dan tugas.`,
  Baik: (nama, mapel) =>
    `${nama} menunjukkan pemahaman yang baik pada mata pelajaran ${mapel}. Mengikuti pembelajaran dengan cukup baik, meski masih memerlukan sedikit penguatan pada beberapa bagian materi.`,
  Cukup: (nama, mapel) =>
    `${nama} menunjukkan pemahaman yang cukup pada mata pelajaran ${mapel}. Perlu bimbingan lebih lanjut agar penguasaan materi dapat semakin optimal.`,
  'Perlu Bimbingan': (nama, mapel) =>
    `${nama} masih memerlukan bimbingan intensif pada mata pelajaran ${mapel}. Diperlukan pendampingan lebih agar dapat memahami konsep-konsep dasar dengan baik.`,
}
const OPSI_TEMPLATE = Object.keys(TEMPLATE_CAPAIAN)

// --- Template capaian P5 siap pakai (istilah standar Kurikulum Merdeka) ---
const TEMPLATE_P5 = {
  BB: (nama, dimensi) =>
    `${nama} belum menunjukkan perkembangan yang konsisten pada dimensi ${dimensi}. Diperlukan pendampingan dan stimulasi lebih lanjut agar dapat berkembang secara optimal.`,
  MB: (nama, dimensi) =>
    `${nama} mulai menunjukkan perkembangan pada dimensi ${dimensi}, namun masih memerlukan bimbingan agar sikap dan keterampilan tersebut menjadi lebih konsisten.`,
  BSH: (nama, dimensi) =>
    `${nama} berkembang sesuai harapan pada dimensi ${dimensi}, mampu menunjukkan sikap dan keterampilan yang diharapkan secara konsisten dalam kegiatan sehari-hari.`,
  SB: (nama, dimensi) =>
    `${nama} sangat berkembang pada dimensi ${dimensi}, mampu menunjukkan sikap dan keterampilan yang diharapkan secara mandiri, bahkan dapat menjadi teladan bagi teman-temannya.`,
}
const OPSI_TEMPLATE_P5 = Object.keys(TEMPLATE_P5)
const LABEL_TEMPLATE_P5 = {
  BB: 'BB — Belum Berkembang',
  MB: 'MB — Mulai Berkembang',
  BSH: 'BSH — Berkembang Sesuai Harapan',
  SB: 'SB — Sangat Berkembang',
}

// --- Template keterangan ekstrakurikuler siap pakai ---
const TEMPLATE_EKSKUL = {
  'Sangat Baik': (nama, ekskul) =>
    `${nama} menunjukkan keaktifan dan capaian yang sangat baik dalam kegiatan ${ekskul}. Antusias mengikuti setiap kegiatan dan mampu menunjukkan hasil yang optimal.`,
  Baik: (nama, ekskul) =>
    `${nama} menunjukkan keaktifan yang baik dalam kegiatan ${ekskul}, mengikuti kegiatan dengan cukup baik dan menunjukkan perkembangan kemampuan.`,
  Cukup: (nama, ekskul) =>
    `${nama} mengikuti kegiatan ${ekskul} dengan cukup baik, namun keikutsertaan dan capaiannya masih perlu ditingkatkan.`,
  'Perlu Bimbingan': (nama, ekskul) =>
    `${nama} masih memerlukan motivasi dan bimbingan lebih lanjut agar dapat lebih aktif dan berkembang dalam kegiatan ${ekskul}.`,
}
const OPSI_TEMPLATE_EKSKUL = Object.keys(TEMPLATE_EKSKUL)

// --- Template catatan wali kelas siap pakai ---
const TEMPLATE_CATATAN = {
  'Perkembangan Baik': (nama) =>
    `${nama} menunjukkan perkembangan yang baik secara akademik maupun sikap selama semester ini. Diharapkan dapat mempertahankan dan terus meningkatkan semangat belajarnya.`,
  'Aktif dan Berprestasi': (nama) =>
    `${nama} merupakan siswa yang aktif dan berprestasi, baik dalam kegiatan akademik maupun non-akademik. Diharapkan dapat terus menjadi teladan bagi teman-temannya.`,
  'Perlu Peningkatan Kedisiplinan': (nama) =>
    `${nama} perlu meningkatkan kedisiplinan, terutama dalam hal kehadiran dan ketepatan mengumpulkan tugas. Dukungan dan pemantauan dari orang tua di rumah sangat diharapkan.`,
  'Perlu Perhatian Khusus': (nama) =>
    `${nama} memerlukan perhatian khusus dari orang tua dan guru terkait perkembangan belajarnya. Kerja sama antara sekolah dan keluarga sangat diperlukan untuk mendukung perkembangan ${nama}.`,
}
const OPSI_TEMPLATE_CATATAN = Object.keys(TEMPLATE_CATATAN)

export default function Rapor() {
  const navigate = useNavigate()

  const [siswaList, setSiswaList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ringkasan (nilai angka + presensi) — tetap dari tabel nilai & presensi_siswa
  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })

  // Deskripsi capaian per mapel — tabel capaian_mapel
  const [capaianList, setCapaianList] = useState([]) // [{id, mata_pelajaran, deskripsi_capaian, terkunci}]

  // P5 — tabel rapor_p5
  const [p5List, setP5List] = useState([]) // [{id, tema, dimensi, sub_elemen, capaian}]

  // Ekstrakurikuler — tabel ekstrakurikuler_nilai
  const [ekskulList, setEkskulList] = useState([]) // [{id, nama_ekstrakurikuler, predikat, keterangan}]

  // Catatan wali kelas — tabel catatan_siswa
  const [catatan, setCatatan] = useState(CATATAN_KOSONG)

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
      supabase.from('presensi_siswa').select('status').eq('siswa_id', siswaId),
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

    // Gabungkan mapel dari nilai dengan mapel yang sudah punya deskripsi capaian,
    // supaya guru bisa isi deskripsi walau belum ada nilai angkanya.
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
          terkunci: mapelDariNilai.includes(mapel), // nama mapel dari tabel nilai, tidak diedit di sini
        }
      })
    )

    setLoading(false)
  }

  const siswaTerpilih = siswaList.find((s) => s.id === siswaId)

  // ---------- Ringkasan nilai ----------
  const rekapPerMapel = {}
  for (const n of nilai) {
    if (!rekapPerMapel[n.mata_pelajaran]) rekapPerMapel[n.mata_pelajaran] = []
    rekapPerMapel[n.mata_pelajaran].push(n.nilai)
  }
  const barisMapel = Object.entries(rekapPerMapel).map(([mapel, nilaiArr]) => ({
    mapel,
    rataRata: (nilaiArr.reduce((a, b) => a + b, 0) / nilaiArr.length).toFixed(1),
  }))

  // ---------- Deskripsi capaian ----------
  function ubahBarisCapaian(index, field, value) {
    setCapaianList((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }

  function terapkanTemplate(index, predikat) {
    if (!predikat) return
    const c = capaianList[index]
    const namaSiswa = siswaTerpilih?.nama_lengkap || 'Siswa ini'
    const namaMapel = c.mata_pelajaran?.trim() || 'mata pelajaran ini'
    const teks = TEMPLATE_CAPAIAN[predikat](namaSiswa, namaMapel)
    ubahBarisCapaian(index, 'deskripsi_capaian', teks)
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

    for (const c of capaianList) {
      if (!c.mata_pelajaran.trim()) continue
      if (c.id) {
        await supabase
          .from('capaian_mapel')
          .update({
            mata_pelajaran: c.mata_pelajaran,
            deskripsi_capaian: c.deskripsi_capaian,
            diisi_oleh: user?.id,
          })
          .eq('id', c.id)
      } else if (c.deskripsi_capaian.trim()) {
        await supabase.from('capaian_mapel').insert({
          siswa_id: siswaId,
          mata_pelajaran: c.mata_pelajaran,
          semester,
          tahun_ajaran: tahunAjaran,
          deskripsi_capaian: c.deskripsi_capaian,
          diisi_oleh: user?.id,
        })
      }
    }
    await muatRapor()
    setSaving(false)
  }

  // ---------- P5 ----------
  function ubahBarisP5(index, field, value) {
    setP5List((prev) => prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)))
  }

  function terapkanTemplateP5(index, level) {
    if (!level) return
    const p = p5List[index]
    const namaSiswa = siswaTerpilih?.nama_lengkap || 'Siswa ini'
    const dimensi = p.dimensi?.trim() || 'dimensi ini'
    const teks = TEMPLATE_P5[level](namaSiswa, dimensi)
    ubahBarisP5(index, 'capaian', teks)
  }

  function tambahBarisP5() {
    setP5List((prev) => [
      ...prev,
      { id: null, tema: '', dimensi: '', sub_elemen: '', capaian: '' },
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
    for (const p of p5List) {
      if (!p.tema.trim() && !p.dimensi.trim()) continue
      if (p.id) {
        await supabase
          .from('rapor_p5')
          .update({ tema: p.tema, dimensi: p.dimensi, sub_elemen: p.sub_elemen, capaian: p.capaian })
          .eq('id', p.id)
      } else {
        await supabase.from('rapor_p5').insert({
          siswa_id: siswaId,
          semester,
          tahun_ajaran: tahunAjaran,
          tema: p.tema,
          dimensi: p.dimensi,
          sub_elemen: p.sub_elemen,
          capaian: p.capaian,
        })
      }
    }
    await muatRapor()
    setSaving(false)
  }

  // ---------- Ekstrakurikuler ----------
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

  function terapkanTemplateEkskul(index, predikat) {
    if (!predikat) return
    const row = ekskulList[index]
    const namaSiswa = siswaTerpilih?.nama_lengkap || 'Siswa ini'
    const namaEkskul = row.nama_ekstrakurikuler?.trim() || 'kegiatan ini'
    const teks = TEMPLATE_EKSKUL[predikat](namaSiswa, namaEkskul)
    ubahBarisEkskul(index, 'predikat', predikat)
    ubahBarisEkskul(index, 'keterangan', teks)
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
    for (const row of ekskulList) {
      if (!row.nama_ekstrakurikuler.trim()) continue
      if (row.id) {
        await supabase
          .from('ekstrakurikuler_nilai')
          .update({
            nama_ekstrakurikuler: row.nama_ekstrakurikuler,
            predikat: row.predikat,
            keterangan: row.keterangan,
          })
          .eq('id', row.id)
      } else {
        await supabase.from('ekstrakurikuler_nilai').insert({
          siswa_id: siswaId,
          semester,
          tahun_ajaran: tahunAjaran,
          nama_ekstrakurikuler: row.nama_ekstrakurikuler,
          predikat: row.predikat,
          keterangan: row.keterangan,
        })
      }
    }
    await muatRapor()
    setSaving(false)
  }

  // ---------- Catatan wali kelas ----------
  function ubahCatatan(field, value) {
    setCatatan((prev) => ({ ...prev, [field]: value }))
  }

  function terapkanTemplateCatatan(kategori) {
    if (!kategori) return
    const namaSiswa = siswaTerpilih?.nama_lengkap || 'Siswa ini'
    const teks = TEMPLATE_CATATAN[kategori](namaSiswa)
    ubahCatatan('catatan', teks)
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
    if (catatan.id) {
      await supabase.from('catatan_siswa').update(payload).eq('id', catatan.id)
    } else {
      await supabase.from('catatan_siswa').insert(payload)
    }
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
                : 'Pilih siswa untuk lihat & isi rapor'}
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
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={muatRapor} disabled={!siswaId || !tahunAjaran || loading}>
            {loading && <Loader2 size={16} className="animate-spin" />}
            Tampilkan Rapor
          </button>
          {siswaTerpilih && (
            <button className="btn-secondary" onClick={bukaCetak}>
              <Printer size={16} /> Buka Halaman Cetak
            </button>
          )}
        </div>
      </div>

      {siswaTerpilih && (
        <div className="card p-0 overflow-hidden">
          <div className="flex flex-wrap border-b border-ink-950/10">
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
            {activeTab === 'ringkasan' && (
              <>
                {barisMapel.length > 0 ? (
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
                {capaianList.length === 0 && (
                  <p className="text-sm text-ink-700/50 mb-4">
                    Belum ada mata pelajaran. Klik &quot;Tambah Mapel&quot; untuk mulai isi deskripsi capaian.
                  </p>
                )}
                <div className="space-y-4">
                  {capaianList.map((c, i) => (
                    <div key={c.id || `baru-${i}`} className="border border-ink-950/10 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        {c.terkunci ? (
                          <label className="label-field">{c.mata_pelajaran}</label>
                        ) : (
                          <input
                            className="input-field"
                            placeholder="Nama mata pelajaran"
                            value={c.mata_pelajaran}
                            onChange={(e) => ubahBarisCapaian(i, 'mata_pelajaran', e.target.value)}
                          />
                        )}
                        <button
                          className="btn-secondary !px-3 shrink-0"
                          onClick={() => hapusBarisCapaian(i)}
                          title="Hapus mapel ini"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 size={14} className="text-ink-700/40 shrink-0" />
                        <select
                          className="input-field !py-1.5 text-sm w-auto"
                          defaultValue=""
                          onChange={(e) => {
                            terapkanTemplate(i, e.target.value)
                            e.target.value = ''
                          }}
                        >
                          <option value="">Isi dari template...</option>
                          {OPSI_TEMPLATE.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>

                      <textarea
                        className="input-field min-h-[80px]"
                        placeholder="Deskripsi capaian pembelajaran..."
                        value={c.deskripsi_capaian}
                        onChange={(e) => ubahBarisCapaian(i, 'deskripsi_capaian', e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisCapaian}>
                    <Plus size={16} /> Tambah Mapel
                  </button>
                  <button className="btn-primary" onClick={simpanCapaian} disabled={saving}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} /> Simpan Deskripsi Capaian
                  </button>
                </div>
              </>
            )}

            {activeTab === 'p5' && (
              <>
                <div className="space-y-3">
                  {p5List.map((p, i) => (
                    <div key={p.id || `baru-${i}`} className="border border-ink-950/10 rounded-lg p-3">
                      <div className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-2">
                        <input
                          className="input-field"
                          placeholder="Tema"
                          value={p.tema}
                          onChange={(e) => ubahBarisP5(i, 'tema', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Dimensi"
                          value={p.dimensi}
                          onChange={(e) => ubahBarisP5(i, 'dimensi', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Sub-elemen"
                          value={p.sub_elemen}
                          onChange={(e) => ubahBarisP5(i, 'sub_elemen', e.target.value)}
                        />
                        <button
                          className="btn-secondary !px-3"
                          onClick={() => hapusBarisP5(i)}
                          title="Hapus baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 size={14} className="text-ink-700/40 shrink-0" />
                        <select
                          className="input-field !py-1.5 text-sm w-auto"
                          defaultValue=""
                          onChange={(e) => {
                            terapkanTemplateP5(i, e.target.value)
                            e.target.value = ''
                          }}
                        >
                          <option value="">Isi dari template...</option>
                          {OPSI_TEMPLATE_P5.map((opt) => (
                            <option key={opt} value={opt}>
                              {LABEL_TEMPLATE_P5[opt]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        className="input-field min-h-[60px]"
                        placeholder="Deskripsi capaian P5..."
                        value={p.capaian}
                        onChange={(e) => ubahBarisP5(i, 'capaian', e.target.value)}
                      />
                    </div>
                  ))}
                  {p5List.length === 0 && (
                    <p className="text-sm text-ink-700/50">Belum ada data P5 untuk periode ini.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisP5}>
                    <Plus size={16} /> Tambah Baris P5
                  </button>
                  <button className="btn-primary" onClick={simpanP5} disabled={saving}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} /> Simpan P5
                  </button>
                </div>
              </>
            )}

            {activeTab === 'ekskul' && (
              <>
                <div className="space-y-3">
                  {ekskulList.map((row, i) => (
                    <div key={row.id || `baru-${i}`} className="border border-ink-950/10 rounded-lg p-3">
                      <div className="grid sm:grid-cols-[2fr_1fr_2fr_auto] gap-3 items-start mb-2">
                        <input
                          className="input-field"
                          placeholder="Nama ekstrakurikuler"
                          value={row.nama_ekstrakurikuler}
                          onChange={(e) => ubahBarisEkskul(i, 'nama_ekstrakurikuler', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Predikat"
                          value={row.predikat}
                          onChange={(e) => ubahBarisEkskul(i, 'predikat', e.target.value)}
                        />
                        <input
                          className="input-field"
                          placeholder="Keterangan"
                          value={row.keterangan}
                          onChange={(e) => ubahBarisEkskul(i, 'keterangan', e.target.value)}
                        />
                        <button
                          className="btn-secondary !px-3"
                          onClick={() => hapusBarisEkskul(i)}
                          title="Hapus baris"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wand2 size={14} className="text-ink-700/40 shrink-0" />
                        <select
                          className="input-field !py-1.5 text-sm w-auto"
                          defaultValue=""
                          onChange={(e) => {
                            terapkanTemplateEkskul(i, e.target.value)
                            e.target.value = ''
                          }}
                        >
                          <option value="">Isi predikat & keterangan dari template...</option>
                          {OPSI_TEMPLATE_EKSKUL.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisEkskul}>
                    <Plus size={16} /> Tambah Baris
                  </button>
                  <button className="btn-primary" onClick={simpanEkskul} disabled={saving}>
                    {saving && <Loader2 size={16} className="animate-spin" />}
                    <Save size={16} /> Simpan Ekstrakurikuler
                  </button>
                </div>
              </>
            )}

            {activeTab === 'catatan' && (
              <>
                <div className="grid sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="label-field">Tinggi Badan (cm)</label>
                    <input
                      className="input-field"
                      value={catatan.tinggi_badan}
                      onChange={(e) => ubahCatatan('tinggi_badan', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-field">Berat Badan (kg)</label>
                    <input
                      className="input-field"
                      value={catatan.berat_badan}
                      onChange={(e) => ubahCatatan('berat_badan', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="label-field">Kondisi Kesehatan</label>
                  <input
                    className="input-field"
                    placeholder="mis. Baik / perlu perhatian pada..."
                    value={catatan.kondisi_kesehatan}
                    onChange={(e) => ubahCatatan('kondisi_kesehatan', e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="label-field">Keputusan</label>
                  <select
                    className="input-field"
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
                  <label className="label-field">Catatan Wali Kelas</label>
                  <div className="flex items-center gap-2 mb-2">
                    <Wand2 size={14} className="text-ink-700/40 shrink-0" />
                    <select
                      className="input-field !py-1.5 text-sm w-auto"
                      defaultValue=""
                      onChange={(e) => {
                        terapkanTemplateCatatan(e.target.value)
                        e.target.value = ''
                      }}
                    >
                      <option value="">Isi dari template...</option>
                      {OPSI_TEMPLATE_CATATAN.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <textarea
                    className="input-field min-h-[100px]"
                    placeholder="Catatan perkembangan siswa dari wali kelas..."
                    value={catatan.catatan}
                    onChange={(e) => ubahCatatan('catatan', e.target.value)}
                  />
                </div>
                <button className="btn-primary" onClick={simpanCatatan} disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
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
