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
  BookOpen,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

// Template khusus untuk kolom Keterampilan (KI-4) — fokus pada praktik/unjuk
// kerja, bukan pemahaman konsep seperti TEMPLATE_DESKRIPSI (Pengetahuan).
const TEMPLATE_DESKRIPSI_KETERAMPILAN = [
  {
    kategori: 'Sangat Baik',
    teks: (mapel) =>
      `Ananda menunjukkan keterampilan yang sangat baik dalam mempraktikkan materi ${mapel}, mampu menyelesaikan tugas praktik/unjuk kerja dengan sangat terampil, kreatif, dan tepat waktu.`,
  },
  {
    kategori: 'Baik',
    teks: (mapel) =>
      `Ananda menunjukkan keterampilan yang baik dalam mempraktikkan materi ${mapel}, mampu menyelesaikan sebagian besar tugas praktik/unjuk kerja dengan baik dan tepat waktu.`,
  },
  {
    kategori: 'Cukup',
    teks: (mapel) =>
      `Ananda menunjukkan keterampilan yang cukup dalam mempraktikkan materi ${mapel}. Dengan latihan dan bimbingan lebih lanjut, ananda diharapkan dapat lebih terampil dalam praktik.`,
  },
  {
    kategori: 'Perlu Bimbingan',
    teks: (mapel) =>
      `Ananda masih memerlukan bimbingan lebih lanjut dalam mempraktikkan keterampilan pada mata pelajaran ${mapel}. Diperlukan latihan dan pendampingan yang lebih intensif.`,
  },
]

// Template rekomendasi berbasis Kompetensi Dasar (KD) — dipakai saat guru
// memilih salah satu KD dari Bank KD. `materi` di sini adalah teks KD
// (opsional diawali kode KD), bukan nama mata pelajaran.
const TEMPLATE_KD_PENGETAHUAN = [
  {
    kategori: 'Sangat Baik',
    teks: (materi) =>
      `Ananda menunjukkan penguasaan yang sangat baik terhadap materi ${materi}, mampu memahami dan menjelaskannya dengan tepat serta menerapkannya dalam kehidupan sehari-hari.`,
  },
  {
    kategori: 'Baik',
    teks: (materi) =>
      `Ananda menunjukkan pemahaman yang baik terhadap materi ${materi}, mampu menjelaskan dan mengaitkannya dengan baik dalam pembelajaran.`,
  },
  {
    kategori: 'Cukup',
    teks: (materi) =>
      `Ananda menunjukkan pemahaman yang cukup terhadap materi ${materi}. Dengan bimbingan lebih lanjut, ananda diharapkan dapat lebih memahami materi ini.`,
  },
  {
    kategori: 'Perlu Bimbingan',
    teks: (materi) =>
      `Ananda masih memerlukan bimbingan lebih lanjut untuk memahami materi ${materi}. Diperlukan pendampingan yang lebih intensif.`,
  },
]

const TEMPLATE_KD_KETERAMPILAN = [
  {
    kategori: 'Sangat Baik',
    teks: (materi) =>
      `Ananda menunjukkan keterampilan yang sangat baik dalam mempraktikkan ${materi}, mampu melakukannya secara mandiri, tepat, dan konsisten.`,
  },
  {
    kategori: 'Baik',
    teks: (materi) =>
      `Ananda menunjukkan keterampilan yang baik dalam mempraktikkan ${materi}, mampu melakukannya dengan baik meski sesekali masih perlu arahan.`,
  },
  {
    kategori: 'Cukup',
    teks: (materi) =>
      `Ananda menunjukkan keterampilan yang cukup dalam mempraktikkan ${materi}. Dengan latihan lebih lanjut, ananda diharapkan dapat lebih terampil.`,
  },
  {
    kategori: 'Perlu Bimbingan',
    teks: (materi) =>
      `Ananda masih memerlukan bimbingan lebih lanjut dalam mempraktikkan ${materi}. Diperlukan latihan dan pendampingan yang lebih intensif.`,
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

// Dua jenis kompetensi yang dipakai untuk memecah baik nilai maupun deskripsi
// capaian. `jenis` adalah nilai yang disimpan ke kolom capaian_mapel.jenis.
const KOMPETENSI_KEYS = [
  { key: 'pengetahuan', label: 'Pengetahuan', jenis: 'Pengetahuan' },
  { key: 'keterampilan', label: 'Keterampilan', jenis: 'Keterampilan' },
]

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

// Rata-rata sederhana dari sebuah array nilai angka. null jika kosong.
function rataRataArr(arr) {
  if (!arr || arr.length === 0) return null
  return (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
}

// Dropdown Tahun Ajaran otomatis: 2 tahun ke belakang s.d. 2 tahun ke depan
// dari tahun berjalan, jadi tidak perlu diketik manual dan selalu relevan.
const TAHUN_SEKARANG = new Date().getFullYear()
const DAFTAR_TAHUN_AJARAN = Array.from({ length: 5 }, (_, i) => {
  const awal = TAHUN_SEKARANG - 2 + i
  return `${awal}/${awal + 1}`
})

export default function Rapor() {
  const navigate = useNavigate()

  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')

  const [siswaList, setSiswaList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [activeTab, setActiveTab] = useState('ringkasan')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // Ringkasan (nilai angka + presensi) — sekarang menyimpan kompetensi juga,
  // supaya rata-rata bisa dipecah per Pengetahuan/Keterampilan.
  const [nilai, setNilai] = useState([])
  const [presensi, setPresensi] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })

  // Deskripsi capaian per mapel — tabel capaian_mapel, kini 1 baris per
  // (mapel, jenis) di mana jenis = 'Pengetahuan' atau 'Keterampilan'.
  // capaianList di state React tetap 1 baris per mapel, tapi menyimpan
  // dua sub-objek: pengetahuan & keterampilan.
  const [capaianList, setCapaianList] = useState([])

  // P5 — tabel rapor_p5
  const [p5List, setP5List] = useState([])

  // Ekstrakurikuler — tabel ekstrakurikuler_nilai
  const [ekskulList, setEkskulList] = useState([])

  // Catatan wali kelas — tabel catatan_siswa
  const [catatan, setCatatan] = useState(CATATAN_KOSONG)

  // Dropdown rekomendasi deskripsi capaian — key format "index:kompetensiKey"
  const [rekomendasiTerbuka, setRekomendasiTerbuka] = useState(null)
  const [rekomendasiEkskulTerbuka, setRekomendasiEkskulTerbuka] = useState(null)
  const [rekomendasiCatatanTerbuka, setRekomendasiCatatanTerbuka] = useState(false)

  // Bank Kompetensi Dasar (KD) — dropdown "Bank KD" per (mapel, jenis).
  // kdTerbuka pakai format kunci yang sama dengan rekomendasiTerbuka:
  // "index:kompetensiKey". kdList berisi daftar KD untuk dropdown yang
  // sedang terbuka saja (dimuat ulang setiap dropdown dibuka).
  const [kdTerbuka, setKdTerbuka] = useState(null)
  const [kdList, setKdList] = useState([])
  const [kdLoading, setKdLoading] = useState(false)
  const [kdBaru, setKdBaru] = useState({ kode: '', teks: '' })

  useEffect(() => {
    supabase
      .from('kelas')
      .select('id, nama_kelas')
      .order('nama_kelas')
      .then(({ data }) => setKelasList(data || []))
  }, [])

  useEffect(() => {
    supabase
      .from('siswa')
      // + kelas_id, supaya daftar siswa bisa difilter otomatis per kelas
      .select('id, nama_lengkap, nis, kelas_id, kelas(nama_kelas)')
      .order('nama_lengkap')
      .then(({ data }) => setSiswaList(data || []))
  }, [])

  async function muatRapor(idOverride) {
    const idSiswa = idOverride || siswaId
    if (!idSiswa || !tahunAjaran) return
    setLoading(true)

    const periode = rentangTanggalPeriode(tahunAjaran, semester)
    let queryPresensi = supabase.from('presensi_siswa').select('status').eq('siswa_id', idSiswa)
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
        // + kompetensi, supaya rata-rata bisa dipecah Pengetahuan/Keterampilan
        .select('mata_pelajaran, kompetensi, jenis, nilai')
        .eq('siswa_id', idSiswa)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      queryPresensi,
      supabase
        .from('capaian_mapel')
        // + jenis, untuk memisahkan baris Pengetahuan vs Keterampilan
        .select('id, mata_pelajaran, jenis, deskripsi_capaian')
        .eq('siswa_id', idSiswa)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('rapor_p5')
        .select('id, tema, dimensi, sub_elemen, capaian')
        .eq('siswa_id', idSiswa)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran)
        .order('tema'),
      supabase
        .from('ekstrakurikuler_nilai')
        .select('id, nama_ekstrakurikuler, predikat, keterangan')
        .eq('siswa_id', idSiswa)
        .eq('semester', semester)
        .eq('tahun_ajaran', tahunAjaran),
      supabase
        .from('catatan_siswa')
        .select('id, catatan, tinggi_badan, berat_badan, kondisi_kesehatan, keputusan')
        .eq('siswa_id', idSiswa)
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

    // Gabungkan mapel dari nilai dengan mapel yang sudah punya deskripsi capaian
    const mapelDariNilai = [...new Set((nilaiRows || []).map((n) => n.mata_pelajaran))]
    const mapelDariCapaian = [...new Set((capaianRows || []).map((c) => c.mata_pelajaran))]
    const semuaMapel = [...new Set([...mapelDariNilai, ...mapelDariCapaian])]

    setCapaianList(
      semuaMapel.map((mapel) => {
        const pengetahuan = (capaianRows || []).find(
          (c) => c.mata_pelajaran === mapel && c.jenis === 'Pengetahuan'
        )
        const keterampilan = (capaianRows || []).find(
          (c) => c.mata_pelajaran === mapel && c.jenis === 'Keterampilan'
        )
        return {
          mata_pelajaran: mapel,
          terkunci: mapelDariNilai.includes(mapel),
          pengetahuan: { id: pengetahuan?.id || null, deskripsi_capaian: pengetahuan?.deskripsi_capaian || '' },
          keterampilan: { id: keterampilan?.id || null, deskripsi_capaian: keterampilan?.deskripsi_capaian || '' },
        }
      })
    )

    setLoading(false)
  }

  const siswaTerpilih = siswaList.find((s) => s.id === siswaId)

  // Daftar siswa yang tampil di dropdown & tabel — otomatis terfilter kalau
  // sebuah kelas dipilih, kalau tidak tampilkan semua siswa.
  const siswaTerfilter = kelasId ? siswaList.filter((s) => s.kelas_id === kelasId) : siswaList

  // ---------- Ringkasan nilai — kini dipecah per kompetensi ----------
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

  // ---------- Deskripsi capaian (per kompetensi) ----------
  function ubahBarisCapaian(index, kompKey, value) {
    setCapaianList((prev) =>
      prev.map((c, i) =>
        i === index ? { ...c, [kompKey]: { ...c[kompKey], deskripsi_capaian: value } } : c
      )
    )
  }

  function ubahMapelCapaian(index, value) {
    setCapaianList((prev) => prev.map((c, i) => (i === index ? { ...c, mata_pelajaran: value } : c)))
  }

  function pilihRekomendasi(index, kompKey, template) {
    const mapel = capaianList[index].mata_pelajaran || 'mata pelajaran ini'
    ubahBarisCapaian(index, kompKey, template.teks(mapel))
    setRekomendasiTerbuka(null)
  }

  // ---------- Bank Kompetensi Dasar (KD) ----------
  async function muatKD(mapel, jenisKD) {
    if (!mapel || !siswaTerpilih?.kelas_id) {
      setKdList([])
      return
    }
    setKdLoading(true)
    const { data, error } = await supabase
      .from('kompetensi_dasar')
      .select('id, kode, teks')
      .eq('kelas_id', siswaTerpilih.kelas_id)
      .eq('mata_pelajaran', mapel)
      .eq('jenis', jenisKD)
      .order('kode')
    if (error) {
      console.error(error)
      setKdList([])
    } else {
      setKdList(data || [])
    }
    setKdLoading(false)
  }

  function bukaBankKD(index, kompKey) {
    const kunci = `${index}:${kompKey}`
    if (kdTerbuka === kunci) {
      setKdTerbuka(null)
      return
    }
    setRekomendasiTerbuka(null)
    setKdTerbuka(kunci)
    setKdBaru({ kode: '', teks: '' })
    const mapel = capaianList[index].mata_pelajaran
    const jenisKD = KOMPETENSI_KEYS.find((k) => k.key === kompKey).jenis
    muatKD(mapel, jenisKD)
  }

  function pilihKD(index, kompKey, kd) {
    const templates = kompKey === 'keterampilan' ? TEMPLATE_KD_KETERAMPILAN : TEMPLATE_KD_PENGETAHUAN
    const mapelInfo = barisMapel.find((b) => b.mapel === capaianList[index].mata_pelajaran)
    const rataRata = kompKey === 'keterampilan' ? mapelInfo?.rataRataKeterampilan : mapelInfo?.rataRataPengetahuan
    const kategori = kategoriDariNilai(rataRata) || 'Baik'
    const tpl = templates.find((t) => t.kategori === kategori) || templates[1]
    const materiText = kd.kode ? `${kd.kode} ${kd.teks}` : kd.teks
    ubahBarisCapaian(index, kompKey, tpl.teks(materiText))
    setKdTerbuka(null)
  }

  async function tambahKDBaru(index, kompKey) {
    if (!kdBaru.teks.trim()) return
    const mapel = capaianList[index].mata_pelajaran
    if (!mapel) {
      alert('Isi nama mata pelajaran terlebih dahulu.')
      return
    }
    if (!siswaTerpilih?.kelas_id) {
      alert('Siswa ini belum terhubung ke kelas manapun.')
      return
    }
    const jenisKD = KOMPETENSI_KEYS.find((k) => k.key === kompKey).jenis
    const { data, error } = await supabase
      .from('kompetensi_dasar')
      .insert({
        kelas_id: siswaTerpilih.kelas_id,
        mata_pelajaran: mapel,
        jenis: jenisKD,
        kode: kdBaru.kode,
        teks: kdBaru.teks,
      })
      .select()
      .single()
    if (error) {
      alert('Gagal menambah KD: ' + error.message)
      return
    }
    setKdList((prev) => [...prev, data])
    setKdBaru({ kode: '', teks: '' })
  }

  async function hapusKD(kdId) {
    const konfirmasi = window.confirm('Hapus KD ini dari Bank KD? Berlaku untuk seluruh kelas ini.')
    if (!konfirmasi) return
    const { error } = await supabase.from('kompetensi_dasar').delete().eq('id', kdId)
    if (error) {
      alert('Gagal menghapus KD: ' + error.message)
      return
    }
    setKdList((prev) => prev.filter((k) => k.id !== kdId))
  }

  function tambahBarisCapaian() {
    setCapaianList((prev) => [
      ...prev,
      {
        mata_pelajaran: '',
        terkunci: false,
        pengetahuan: { id: null, deskripsi_capaian: '' },
        keterampilan: { id: null, deskripsi_capaian: '' },
      },
    ])
  }

  async function hapusBarisCapaian(index) {
    const row = capaianList[index]
    const ids = [row.pengetahuan?.id, row.keterampilan?.id].filter(Boolean)
    if (ids.length) {
      await supabase.from('capaian_mapel').delete().in('id', ids)
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
      for (const komp of KOMPETENSI_KEYS) {
        const entri = c[komp.key]
        if (entri.id) {
          const { data, error } = await supabase
            .from('capaian_mapel')
            .update({
              mata_pelajaran: c.mata_pelajaran,
              deskripsi_capaian: entri.deskripsi_capaian,
              diisi_oleh: user?.id,
            })
            .eq('id', entri.id)
            .select()
          if (error) {
            gagal.push(error.message)
          } else if (!data || data.length === 0) {
            // Tidak ada error, tapi tidak ada baris ter-update — biasanya ini
            // berarti kebijakan RLS Supabase menolak UPDATE ini secara diam-
            // diam. Tandai sebagai gagal supaya guru tahu, bukan seolah-olah
            // tersimpan padahal database tidak berubah.
            gagal.push(
              `${c.mata_pelajaran} (${komp.label}): tidak tersimpan — kemungkinan kebijakan RLS pada tabel capaian_mapel belum mengizinkan UPDATE.`
            )
          }
        } else if (entri.deskripsi_capaian.trim()) {
          const { data, error } = await supabase
            .from('capaian_mapel')
            .insert({
              siswa_id: siswaId,
              mata_pelajaran: c.mata_pelajaran,
              jenis: komp.jenis,
              semester,
              tahun_ajaran: tahunAjaran,
              deskripsi_capaian: entri.deskripsi_capaian,
              diisi_oleh: user?.id,
            })
            .select()
          if (error) {
            gagal.push(error.message)
          } else if (!data || data.length === 0) {
            gagal.push(
              `${c.mata_pelajaran} (${komp.label}): tidak tersimpan — kemungkinan kebijakan RLS pada tabel capaian_mapel belum mengizinkan INSERT.`
            )
          }
        }
      }
    }
    if (gagal.length) alert('Gagal menyimpan sebagian deskripsi capaian:\n' + [...new Set(gagal)].join('\n'))
    await muatRapor()
    setSaving(false)
  }

  // ---------- P5 ----------
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

  // ---------- Catatan wali kelas ----------
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
        <div className="grid sm:grid-cols-5 gap-3">
          <div>
            <label className="label-field">Pilih Kelas</label>
            <select
              className="input-field"
              value={kelasId}
              onChange={(e) => {
                setKelasId(e.target.value)
                setSiswaId('')
              }}
            >
              <option value="">-- Semua kelas --</option>
              {kelasList.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nama_kelas}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Pilih Siswa</label>
            <select className="input-field" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
              <option value="">-- Pilih siswa --</option>
              {siswaTerfilter.map((s) => (
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
            <select className="input-field" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)}>
              <option value="">-- Pilih tahun ajaran --</option>
              {DAFTAR_TAHUN_AJARAN.map((ta) => (
                <option key={ta} value={ta}>
                  {ta}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn-primary" onClick={() => muatRapor()} disabled={!siswaId || !tahunAjaran || loading}>
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

      {kelasId && (
        <div className="card p-5 mb-5">
          <h4 className="font-display font-semibold text-ink-950 mb-3">
            Daftar Siswa · {kelasList.find((k) => k.id === kelasId)?.nama_kelas || ''}
          </h4>
          {siswaTerfilter.length > 0 ? (
            <table className="table-shell">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NIS</th>
                </tr>
              </thead>
              <tbody>
                {siswaTerfilter.map((s) => (
                  <tr key={s.id}>
                    <td className="font-medium">{s.nama_lengkap}</td>
                    <td>{s.nis || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-ink-700/50">Belum ada siswa di kelas ini.</p>
          )}
        </div>
      )}

      {siswaTerpilih && (
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
            {activeTab === 'ringkasan' && (
              <>
                {barisMapel.length > 0 ? (
                  <table className="table-shell mb-6">
                    <thead>
                      <tr>
                        <th>Mata Pelajaran</th>
                        <th>Nilai Pengetahuan</th>
                        <th>Nilai Keterampilan</th>
                      </tr>
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
              <>
                {capaianList.length === 0 && (
                  <p className="text-sm text-ink-700/50 mb-4">
                    Belum ada mata pelajaran. Klik &quot;Tambah Mapel&quot; untuk mulai isi deskripsi capaian.
                  </p>
                )}
                <div className="space-y-4">
                  {capaianList.map((c, i) => {
                    const mapelInfo = barisMapel.find((b) => b.mapel === c.mata_pelajaran)
                    return (
                      <div
                        key={c.pengetahuan.id || c.keterampilan.id || `baru-${i}`}
                        className="border border-ink-950/10 rounded-lg p-3"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          {c.terkunci ? (
                            <label className="label-field">{c.mata_pelajaran}</label>
                          ) : (
                            <input
                              className="input-field"
                              placeholder="Nama mata pelajaran"
                              value={c.mata_pelajaran}
                              onChange={(e) => ubahMapelCapaian(i, e.target.value)}
                            />
                          )}
                          <button
                            className="btn-secondary !px-3"
                            onClick={() => hapusBarisCapaian(i)}
                            title="Hapus mapel ini"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>

                        {KOMPETENSI_KEYS.map((komp) => {
                          const entri = c[komp.key]
                          const rataRata =
                            komp.key === 'pengetahuan'
                              ? mapelInfo?.rataRataPengetahuan
                              : mapelInfo?.rataRataKeterampilan
                          const rekomendasiKategori = kategoriDariNilai(rataRata)
                          const kunciDropdown = `${i}:${komp.key}`
                          return (
                            <div key={komp.key} className="mb-3 last:mb-0">
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-semibold text-ink-700/70">
                                  {komp.label}
                                  {rataRata !== undefined && rataRata !== null && (
                                    <span className="text-ink-700/40 font-normal"> · rata-rata {rataRata}</span>
                                  )}
                                </label>
                                <div className="flex items-center gap-2">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="btn-secondary !px-3 !py-1 text-xs"
                                      onClick={() => bukaBankKD(i, komp.key)}
                                      title={`Ambil dari Bank KD ${komp.label}`}
                                    >
                                      <BookOpen size={13} /> Bank KD
                                    </button>
                                    {kdTerbuka === kunciDropdown && (
                                      <div className="absolute right-0 bottom-full z-10 mb-2 w-80 max-h-80 overflow-y-auto rounded-lg border border-ink-950/10 bg-white shadow-lg p-2">
                                        {!c.mata_pelajaran.trim() ? (
                                          <p className="text-xs text-ink-700/50 p-2">
                                            Isi nama mata pelajaran terlebih dahulu.
                                          </p>
                                        ) : kdLoading ? (
                                          <p className="text-xs text-ink-700/50 p-2 flex items-center gap-2">
                                            <Loader2 size={13} className="animate-spin" /> Memuat KD...
                                          </p>
                                        ) : (
                                          <>
                                            {kdList.length === 0 && (
                                              <p className="text-xs text-ink-700/50 p-2">
                                                Belum ada KD untuk {c.mata_pelajaran} ({komp.label}) di kelas ini.
                                                Tambahkan di bawah.
                                              </p>
                                            )}
                                            {kdList.map((kd) => (
                                              <div
                                                key={kd.id}
                                                className="flex items-start gap-1 group rounded-md hover:bg-ink-950/5"
                                              >
                                                <button
                                                  type="button"
                                                  onClick={() => pilihKD(i, komp.key, kd)}
                                                  className="flex-1 text-left px-2.5 py-2 text-sm"
                                                >
                                                  <span className="font-medium text-ink-950">
                                                    {kd.kode ? `${kd.kode} · ` : ''}
                                                    {kd.teks}
                                                  </span>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => hapusKD(kd.id)}
                                                  className="opacity-0 group-hover:opacity-100 px-2 py-2 text-ink-700/40 hover:text-red-700"
                                                  title="Hapus KD ini"
                                                >
                                                  <Trash2 size={13} />
                                                </button>
                                              </div>
                                            ))}
                                            <div className="border-t border-ink-950/10 mt-2 pt-2 space-y-1.5">
                                              <p className="text-[11px] font-semibold text-ink-700/60 px-1">
                                                Tambah KD baru
                                              </p>
                                              <input
                                                className="input-field !py-1.5 text-xs"
                                                placeholder="Kode (mis. 3.1)"
                                                value={kdBaru.kode}
                                                onChange={(e) =>
                                                  setKdBaru((prev) => ({ ...prev, kode: e.target.value }))
                                                }
                                              />
                                              <textarea
                                                className="input-field !py-1.5 text-xs min-h-[50px]"
                                                placeholder="Teks KD / materi..."
                                                value={kdBaru.teks}
                                                onChange={(e) =>
                                                  setKdBaru((prev) => ({ ...prev, teks: e.target.value }))
                                                }
                                              />
                                              <button
                                                type="button"
                                                className="btn-secondary !py-1 text-xs w-full justify-center"
                                                onClick={() => tambahKDBaru(i, komp.key)}
                                              >
                                                <Plus size={13} /> Simpan KD
                                              </button>
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="relative">
                                    <button
                                      type="button"
                                      className="btn-secondary !px-3 !py-1 text-xs"
                                      onClick={() => {
                                        setKdTerbuka(null)
                                        setRekomendasiTerbuka(
                                          rekomendasiTerbuka === kunciDropdown ? null : kunciDropdown
                                        )
                                      }}
                                      title={`Lihat rekomendasi deskripsi ${komp.label}`}
                                    >
                                      <Lightbulb size={13} /> Rekomendasi
                                    </button>
                                    {rekomendasiTerbuka === kunciDropdown && (
                                      <div className="absolute right-0 bottom-full z-10 mb-2 w-72 max-h-72 overflow-y-auto rounded-lg border border-ink-950/10 bg-white shadow-lg p-2">
                                        {(komp.key === 'keterampilan'
                                          ? TEMPLATE_DESKRIPSI_KETERAMPILAN
                                          : TEMPLATE_DESKRIPSI
                                        ).map((tpl) => (
                                          <button
                                            key={tpl.kategori}
                                            type="button"
                                            onClick={() => pilihRekomendasi(i, komp.key, tpl)}
                                            className="w-full text-left px-2.5 py-2 rounded-md hover:bg-ink-950/5 text-sm"
                                          >
                                            <span className="font-medium text-ink-950 flex items-center gap-1.5">
                                              {tpl.kategori}
                                              {rekomendasiKategori === tpl.kategori && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sage-500/15 text-sage-500">
                                                  disarankan
                                                </span>
                                              )}
                                            </span>
                                            <span className="block text-xs text-ink-700/50 mt-0.5 line-clamp-2">
                                              {tpl.teks(c.mata_pelajaran || 'mapel ini')}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <textarea
                                className="input-field min-h-[70px]"
                                placeholder={`Deskripsi capaian ${komp.label.toLowerCase()}...`}
                                value={entri.deskripsi_capaian}
                                onChange={(e) => ubahBarisCapaian(i, komp.key, e.target.value)}
                              />
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
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
                {p5List.length === 0 && (
                  <p className="text-sm text-ink-700/50 mb-4">
                    Belum ada data P5. Klik &quot;Tambah Tema P5&quot; untuk mulai isi.
                  </p>
                )}
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
                          title="Hapus baris P5 ini"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-ink-700/70 mb-1 block">Capaian</label>
                        <select
                          className="input-field"
                          value={p.capaian}
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
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisP5}>
                    <Plus size={16} /> Tambah Tema P5
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
                {ekskulList.length === 0 && (
                  <p className="text-sm text-ink-700/50 mb-4">
                    Belum ada data ekstrakurikuler. Klik &quot;Tambah Ekstrakurikuler&quot; untuk mulai isi.
                  </p>
                )}
                <div className="space-y-4">
                  {ekskulList.map((row, i) => (
                    <div key={row.id || `baru-${i}`} className="border border-ink-950/10 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <input
                          className="input-field"
                          placeholder="Nama ekstrakurikuler"
                          value={row.nama_ekstrakurikuler}
                          onChange={(e) => ubahBarisEkskul(i, 'nama_ekstrakurikuler', e.target.value)}
                        />
                        <button
                          className="btn-secondary !px-3"
                          onClick={() => hapusBarisEkskul(i)}
                          title="Hapus ekstrakurikuler ini"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mb-3">
                        <label className="text-xs font-semibold text-ink-700/70 mb-1 block">Predikat</label>
                        <input
                          className="input-field"
                          placeholder="mis. Sangat Baik"
                          value={row.predikat}
                          onChange={(e) => ubahBarisEkskul(i, 'predikat', e.target.value)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-ink-700/70">Keterangan</label>
                          <div className="relative">
                            <button
                              type="button"
                              className="btn-secondary !px-3 !py-1 text-xs"
                              onClick={() =>
                                setRekomendasiEkskulTerbuka(rekomendasiEkskulTerbuka === i ? null : i)
                              }
                              title="Lihat rekomendasi keterangan"
                            >
                              <Lightbulb size={13} /> Rekomendasi
                            </button>
                            {rekomendasiEkskulTerbuka === i && (
                              <div className="absolute right-0 bottom-full z-10 mb-2 w-72 max-h-72 overflow-y-auto rounded-lg border border-ink-950/10 bg-white shadow-lg p-2">
                                {TEMPLATE_EKSKUL.map((tpl) => (
                                  <button
                                    key={tpl.kategori}
                                    type="button"
                                    onClick={() => pilihRekomendasiEkskul(i, tpl)}
                                    className="w-full text-left px-2.5 py-2 rounded-md hover:bg-ink-950/5 text-sm"
                                  >
                                    <span className="font-medium text-ink-950">{tpl.kategori}</span>
                                    <span className="block text-xs text-ink-700/50 mt-0.5 line-clamp-2">
                                      {tpl.teks(row.nama_ekstrakurikuler || 'ini')}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <textarea
                          className="input-field min-h-[70px]"
                          placeholder="Keterangan..."
                          value={row.keterangan}
                          onChange={(e) => ubahBarisEkskul(i, 'keterangan', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-4">
                  <button className="btn-secondary" onClick={tambahBarisEkskul}>
                    <Plus size={16} /> Tambah Ekstrakurikuler
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
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="label-field">Tinggi Badan (cm)</label>
                    <input
                      className="input-field"
                      type="number"
                      value={catatan.tinggi_badan}
                      onChange={(e) => ubahCatatan('tinggi_badan', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label-field">Berat Badan (kg)</label>
                    <input
                      className="input-field"
                      type="number"
                      value={catatan.berat_badan}
                      onChange={(e) => ubahCatatan('berat_badan', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <label className="label-field">Kondisi Kesehatan</label>
                  <input
                    className="input-field"
                    value={catatan.kondisi_kesehatan}
                    onChange={(e) => ubahCatatan('kondisi_kesehatan', e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-1">
                    <label className="label-field !mb-0">Catatan Wali Kelas</label>
                    <div className="relative">
                      <button
                        type="button"
                        className="btn-secondary !px-3 !py-1 text-xs"
                        onClick={() => setRekomendasiCatatanTerbuka(!rekomendasiCatatanTerbuka)}
                        title="Lihat rekomendasi catatan"
                      >
                        <Lightbulb size={13} /> Rekomendasi
                      </button>
                      {rekomendasiCatatanTerbuka && (
                        <div className="absolute right-0 bottom-full z-10 mb-2 w-72 max-h-72 overflow-y-auto rounded-lg border border-ink-950/10 bg-white shadow-lg p-2">
                          {TEMPLATE_CATATAN.map((tpl) => (
                            <button
                              key={tpl.kategori}
                              type="button"
                              onClick={() => pilihRekomendasiCatatan(tpl)}
                              className="w-full text-left px-2.5 py-2 rounded-md hover:bg-ink-950/5 text-sm"
                            >
                              <span className="font-medium text-ink-950">{tpl.kategori}</span>
                              <span className="block text-xs text-ink-700/50 mt-0.5 line-clamp-2">
                                {tpl.teks()}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <textarea
                    className="input-field min-h-[100px]"
                    value={catatan.catatan}
                    onChange={(e) => ubahCatatan('catatan', e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <label className="label-field">Keputusan</label>
                  <input
                    className="input-field"
                    placeholder="mis. Naik ke kelas berikutnya"
                    value={catatan.keputusan}
                    onChange={(e) => ubahCatatan('keputusan', e.target.value)}
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
