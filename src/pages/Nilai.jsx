import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, BookOpenCheck, Trash2, ListChecks, Download, AlertTriangle, CheckCircle2 } from 'lucide-react'
import './Nilai.css'

const JENIS_OPTS = ['Tugas', 'UH', 'UTS', 'UAS']
// Opsi khusus untuk dropdown "Jenis" saat impor dari Ujian Online — dulu
// selalu fixed ke UTS (karena Ujian Online biasanya dipakai untuk ujian
// tengah semester), sekarang bisa dipilih supaya juga bisa dipakai untuk
// impor nilai UAS atau Tugas dari sana.
const IMPOR_UJIAN_JENIS_OPTS = ['UTS', 'UAS', 'Tugas']
const KOMPETENSI_OPTS = ['Pengetahuan', 'Keterampilan']

// Predikat dihitung otomatis dari nilai angka — sesuai legenda rapor:
// A: Sangat Baik (>=90), B: Baik (>=75), C: Cukup (>=60), D: Kurang (<60)
function predikatDariNilai(nilai) {
  if (nilai === '' || nilai === undefined || nilai === null) return null
  const n = Number(nilai)
  if (isNaN(n)) return null
  if (n >= 90) return 'A'
  if (n >= 75) return 'B'
  if (n >= 60) return 'C'
  return 'D'
}

// Warna badge predikat, senada dengan gaya badge yang sudah dipakai di halaman lain.
const WARNA_PREDIKAT = {
  A: 'bg-sage-500/15 text-sage-500',
  B: 'bg-blue-500/15 text-blue-600',
  C: 'bg-amber-500/15 text-amber-600',
  D: 'bg-red-500/15 text-red-600',
}

// Pecah kolom guru.mata_pelajaran (bisa berisi satu mapel atau beberapa
// mapel digabung koma/slash, umum untuk wali kelas SD yang mengajar semua
// mapel) menjadi daftar opsi dropdown yang rapi dan tanpa duplikat.
function pecahMapel(raw) {
  if (!raw) return []
  return [...new Set(
    raw
      .split(/[,/]+/)
      .map((m) => m.trim())
      .filter(Boolean)
  )]
}

// Tahun ajaran Indonesia berjalan dari Juli s/d Juni. Fungsi ini menghasilkan
// tahun ajaran "berjalan" (mis. "2026/2027") beserta satu tahun sebelum & sesudahnya.
function tahunAjaranOptions() {
  const now = new Date()
  const tahunMulai = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1 // Juli = index 6
  return [-1, 0, 1].map((offset) => {
    const awal = tahunMulai + offset
    return `${awal}/${awal + 1}`
  })
}

// Motif sirkuit dekoratif senada dengan Loader, Login & Kelas.
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

export default function Nilai() {
  const { profil, isAdmin } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState('input') // 'input' | 'kelola' | 'impor'
  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')
  const [siswaList, setSiswaList] = useState([])
  const [mapelOpts, setMapelOpts] = useState([])
  const [mataPelajaran, setMataPelajaran] = useState('')
  const [jenis, setJenis] = useState('UH')
  const [kompetensi, setKompetensi] = useState('Pengetahuan')
  const [semester, setSemester] = useState('Ganjil')
  const TA_OPTS = tahunAjaranOptions()
  const [tahunAjaran, setTahunAjaran] = useState(TA_OPTS[1]) // tahun ajaran berjalan
  const [nilaiMap, setNilaiMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // --- state untuk tab "Kelola Nilai" (lihat & hapus) ---
  const [kelolaData, setKelolaData] = useState([])
  const [kelolaLoading, setKelolaLoading] = useState(false)
  const [kelolaFilterMapel, setKelolaFilterMapel] = useState('')

  // --- state untuk tab "Impor Otomatis" (baca nilai dari Ujian Online & Kuis Seru) ---
  const [importSumber, setImportSumber] = useState('ujian') // 'ujian' | 'kuis'
  const [daftarImpor, setDaftarImpor] = useState([]) // daftar ujian/kuis yang bisa dipilih
  const [importSelectedId, setImportSelectedId] = useState('')
  const [importKompetensi, setImportKompetensi] = useState('Pengetahuan')
  const [importJenisKuis, setImportJenisKuis] = useState('Tugas') // jenis untuk Kuis Seru
  // Jenis untuk Ujian Online — dulu selalu fixed "UTS" (lihat komentar di
  // IMPOR_UJIAN_JENIS_OPTS di atas), sekarang jadi dropdown yang bisa dipilih.
  const [importJenisUjian, setImportJenisUjian] = useState('UTS')
  // Mata pelajaran untuk impor dari Ujian Online — diisi otomatis kalau
  // judul/mata_pelajaran ujian berhasil terbaca dari tabel "ujian", tapi
  // tetap bisa diedit manual. Ini sengaja dipisah dari data ujian supaya
  // proses impor TETAP bisa jalan walau tabel "ujian" gagal terbaca (mis.
  // karena RLS) — karena sumber utama nilai sekarang murni dari hasil_ujian.
  const [mapelImporUjian, setMapelImporUjian] = useState('')
  const [importPreview, setImportPreview] = useState([])
  const [importLoading, setImportLoading] = useState(false)
  const [importSaving, setImportSaving] = useState(false)

  // Admin: semua kelas. Guru: cuma kelas yang dia jadi wali kelasnya.
  // (Keamanannya tetap ditegakkan oleh RLS tabel kelas — filter ini
  // murni supaya dropdown langsung tepat tanpa nunggu RLS "diam-diam"
  // mengosongkan hasil untuk kelas yang bukan miliknya.)
  useEffect(() => {
    if (profil === undefined) return // tunggu profil selesai dimuat
    let query = supabase.from('kelas').select('id, nama_kelas').order('nama_kelas')
    if (!isAdmin) {
      query = query.eq('wali_kelas_id', profil?.guru_id || null)
    }
    query.then(({ data }) => {
      setKelasList(data || [])
      if (data?.length) setKelasId(data[0].id)
    })
  }, [isAdmin, profil])

  // Ambil daftar mapel dari kolom guru.mata_pelajaran milik guru yang login.
  // Dipecah jadi beberapa opsi kalau berisi lebih dari satu mapel (dipisah koma/slash).
  useEffect(() => {
    if (profil === undefined) return
    if (!profil?.guru_id) {
      setMapelOpts([])
      return
    }
    supabase.from('guru').select('mata_pelajaran').eq('id', profil.guru_id).single()
      .then(({ data }) => {
        const opts = pecahMapel(data?.mata_pelajaran)
        setMapelOpts(opts)
        setMataPelajaran((prev) => (opts.includes(prev) ? prev : opts[0] || ''))
      })
  }, [profil])

  useEffect(() => {
    if (kelasId) loadSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelasId])

  // Muat ulang nilai yang sudah ada begitu mapel/kelas/siswa siap (dulu ini
  // dipicu lewat onBlur input teks; sekarang mapel berupa dropdown jadi
  // dipicu langsung lewat effect saat nilainya berubah).
  useEffect(() => {
    if (activeSubTab === 'input' && mataPelajaran && siswaList.length > 0) {
      loadExisting()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, mataPelajaran, siswaList, jenis, kompetensi, semester, tahunAjaran])

  // Muat ulang daftar nilai untuk tab "Kelola Nilai" setiap kali tab itu
  // aktif, atau filter (kelas/semester/tahun ajaran) berubah.
  useEffect(() => {
    if (activeSubTab === 'kelola' && siswaList.length > 0 && tahunAjaran) {
      loadKelolaData()
    }
    if (activeSubTab === 'kelola' && (siswaList.length === 0 || !tahunAjaran)) {
      setKelolaData([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, siswaList, semester, tahunAjaran])

  async function loadSiswa() {
    setLoading(true)
    const { data } = await supabase.from('siswa').select('id, nama_lengkap, nis').eq('kelas_id', kelasId).eq('status', 'aktif').order('nama_lengkap')
    setSiswaList(data || [])
    setLoading(false)
  }

  async function loadExisting() {
    const mapel = mataPelajaran
    if (!mapel || !kelasId) return
    const { data } = await supabase.from('nilai').select('siswa_id, nilai')
      .eq('mata_pelajaran', mapel).eq('jenis', jenis).eq('kompetensi', kompetensi)
      .eq('semester', semester).eq('tahun_ajaran', tahunAjaran)
      .in('siswa_id', siswaList.map((s) => s.id))
    const map = {}
    ;(data || []).forEach((d) => { map[d.siswa_id] = d.nilai })
    setNilaiMap(map)
    setSaved(false)
  }

  async function handleSave() {
    const mapel = mataPelajaran
    if (!mapel) return alert('Pilih mata pelajaran terlebih dahulu.')
    setSaving(true)
    const rows = siswaList
      .filter((s) => nilaiMap[s.id] !== undefined && nilaiMap[s.id] !== '')
      .map((s) => ({
        siswa_id: s.id,
        mata_pelajaran: mapel,
        jenis,
        kompetensi,
        semester,
        tahun_ajaran: tahunAjaran,
        nilai: Number(nilaiMap[s.id]),
        predikat: predikatDariNilai(nilaiMap[s.id]),
        diisi_oleh: profil?.guru_id || null,
      }))
    const { error } = await supabase.from('nilai').upsert(rows, { onConflict: 'siswa_id,mata_pelajaran,jenis,kompetensi,semester,tahun_ajaran' })
    setSaving(false)
    if (!error) {
      setSaved(true)
      if (activeSubTab === 'kelola') loadKelolaData()
    } else {
      alert('Gagal menyimpan nilai: ' + error.message)
    }
  }

  // --- fungsi untuk tab "Kelola Nilai" ---

  async function loadKelolaData() {
    setKelolaLoading(true)
    const { data, error } = await supabase
      .from('nilai')
      .select('id, siswa_id, mata_pelajaran, jenis, kompetensi, nilai, predikat, siswa:siswa_id ( nama_lengkap )')
      .in('siswa_id', siswaList.map((s) => s.id))
      .eq('semester', semester)
      .eq('tahun_ajaran', tahunAjaran)
      .order('mata_pelajaran')
      .order('nama_lengkap', { foreignTable: 'siswa' })
    if (error) {
      alert('Gagal memuat daftar nilai: ' + error.message)
      setKelolaData([])
    } else {
      setKelolaData(data || [])
    }
    setKelolaLoading(false)
  }

  async function hapusNilai(row) {
    const namaSiswa = row.siswa?.nama_lengkap || 'siswa ini'
    const ok = confirm(
      `Hapus nilai ${row.mata_pelajaran} (${row.jenis} · ${row.kompetensi}) milik ${namaSiswa}? Tindakan ini tidak bisa dibatalkan.`
    )
    if (!ok) return
    const { data, error } = await supabase.from('nilai').delete().eq('id', row.id).select()
    if (error) {
      alert('Gagal menghapus nilai: ' + error.message)
      return
    }
    if (!data || data.length === 0) {
      // Tidak ada error tapi tidak ada baris terhapus — biasanya berarti
      // kebijakan RLS tabel nilai belum mengizinkan DELETE untuk user ini.
      alert('Nilai tidak terhapus — kemungkinan kebijakan RLS pada tabel nilai belum mengizinkan DELETE.')
      return
    }
    setKelolaData((prev) => prev.filter((d) => d.id !== row.id))
  }

  const kelasAktif = kelasList.find((k) => k.id === kelasId)

  // --- fungsi untuk tab "Impor Otomatis" ---

  // Muat ulang daftar ujian/kuis begitu kelas, sumber (Ujian Online/Kuis
  // Seru), atau daftar siswa aktif kelas ini berganti. "siswaList.length"
  // sengaja ditambahkan sebagai dependency karena loadDaftarUjian sekarang
  // butuh siswaList untuk mencocokkan NIS (lihat komentar di dalamnya).
  useEffect(() => {
    if (activeSubTab !== 'impor' || !kelasId) return
    setImportSelectedId('')
    setImportPreview([])
    setMapelImporUjian('')
    if (importSumber === 'ujian') loadDaftarUjian()
    else loadDaftarKuis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubTab, importSumber, kelasId, kelasAktif?.nama_kelas, siswaList.length])

  // Sumber daftar ujian yang bisa diimpor SEKARANG diambil langsung dari
  // tabel hasil_ujian (dicocokkan lewat NIS siswa aktif di kelas ini) —
  // BUKAN lagi dari tabel "ujian" yang difilter kelas_id + guru_id.
  //
  // Alasan: guru_id di tabel "ujian" sempat tersimpan tidak konsisten
  // (auth.uid() vs guru.id), dan kebijakan RLS tabel "ujian" mungkin
  // membatasi guru hanya melihat baris miliknya sendiri berdasarkan salah
  // satu dari dua nilai itu — sehingga ujian yang baru dibuat guru bisa
  // "hilang" dari daftar impor walau hasil siswanya sudah masuk sempurna
  // ke hasil_ujian (halaman Hasil Ujian yang terpisah terbukti tetap bisa
  // menampilkannya). Dengan sumber dari hasil_ujian, daftar impor jadi
  // otomatis sinkron dengan apa pun yang tampil di halaman Hasil Ujian.
  //
  // Info judul & mata_pelajaran TETAP butuh baca ke tabel "ujian" (karena
  // hasil_ujian tidak menyimpannya sendiri), tapi ini sekadar pelengkap
  // tampilan: kalau gagal terbaca, judul di-fallback ke label generik dan
  // mata pelajaran dikosongkan supaya guru mengisinya manual lewat kotak
  // "Mata Pelajaran" — impor tetap bisa jalan tanpa ini.
  async function loadDaftarUjian() {
    setImportLoading(true)

    if (siswaList.length === 0) {
      setDaftarImpor([])
      setImportLoading(false)
      return
    }

    const nisAktif = siswaList.map((s) => (s.nis || '').trim()).filter(Boolean)
    if (nisAktif.length === 0) {
      setDaftarImpor([])
      setImportLoading(false)
      return
    }

    const { data: hasilData, error: errHasil } = await supabase
      .from('hasil_ujian')
      .select('ujian_id')
      .in('nis_siswa', nisAktif)

    if (errHasil) {
      alert('Gagal memuat daftar hasil ujian: ' + errHasil.message)
      setDaftarImpor([])
      setImportLoading(false)
      return
    }

    const idUjianUnik = [...new Set((hasilData || []).map((h) => h.ujian_id).filter(Boolean))]
    if (idUjianUnik.length === 0) {
      setDaftarImpor([])
      setImportLoading(false)
      return
    }

    // Baca info tambahan (judul, mata pelajaran, waktu dibuat) — kalau
    // gagal/kosong (mis. terhalang RLS), tetap lanjut dengan data seadanya.
    const { data: ujianData } = await supabase
      .from('ujian')
      .select('id, judul, mata_pelajaran, created_at')
      .in('id', idUjianUnik)

    const daftar = idUjianUnik
      .map((id) => {
        const info = (ujianData || []).find((u) => u.id === id)
        return {
          id,
          judul: info?.judul || `Ujian (kode internal ${id.slice(0, 8)})`,
          mata_pelajaran: info?.mata_pelajaran || '',
          created_at: info?.created_at || null,
        }
      })
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))

    setDaftarImpor(daftar)
    setImportLoading(false)
  }

  // Kuis Seru cuma menyimpan nama kelas sebagai teks (bukan kelas_id), dan
  // bisa ada beberapa kelas dengan nama sama (mis. beberapa kelas "1").
  // Supaya tidak salah sasaran, kita cocokkan berdasarkan nama kelas
  // SEKALIGUS guru pembuat kuisnya (asumsi: guru cuma bikin kuis untuk
  // kelas yang dia ajar/wali-i sendiri).
  async function loadDaftarKuis() {
    if (!kelasAktif) { setDaftarImpor([]); return }
    setImportLoading(true)
    let q = supabase.from('kuis_seru').select('id, judul, mata_pelajaran, kelas, guru_id, dibuat_pada')
      .eq('kelas', kelasAktif.nama_kelas).order('dibuat_pada', { ascending: false })
    if (!isAdmin) q = q.eq('guru_id', profil?.guru_id || null)
    const { data } = await q
    setDaftarImpor(data || [])
    setImportLoading(false)
  }

  async function pilihImporRecord(id) {
    setImportSelectedId(id)
    setImportPreview([])
    setMapelImporUjian('')
    if (!id) return
    setImportLoading(true)
    if (importSumber === 'ujian') {
      // Isi awal kotak Mata Pelajaran dari data ujian kalau berhasil terbaca
      const rec = daftarImpor.find((r) => r.id === id)
      setMapelImporUjian(rec?.mata_pelajaran || '')
      await muatPreviewUjian(id)
    } else {
      await muatPreviewKuis(id)
    }
    setImportLoading(false)
  }

  async function muatPreviewUjian(ujianId) {
    const { data } = await supabase.from('hasil_ujian').select('id, nis_siswa, nama_siswa, skor').eq('ujian_id', ujianId)
    const rows = (data || []).map((h) => {
      const siswa = siswaList.find((s) => (s.nis || '').trim() === (h.nis_siswa || '').trim())
      return {
        key: h.id,
        namaAsal: h.nama_siswa,
        skor: h.skor,
        siswaId: siswa?.id || '',
        status: siswa ? 'cocok' : 'tidak_cocok', // tidak_cocok: NIS tidak ditemukan di kelas aktif ini
        termasuk: !!siswa,
      }
    })
    setImportPreview(rows)
  }

  async function muatPreviewKuis(kuisId) {
    const { data } = await supabase.from('hasil_kuis_seru').select('id, nama_siswa, jumlah_benar, jumlah_soal').eq('kuis_id', kuisId)
    const rows = (data || []).map((h) => {
      const namaBersih = (h.nama_siswa || '').trim().toLowerCase()
      const cocok = siswaList.filter((s) => s.nama_lengkap.trim().toLowerCase() === namaBersih)
      const skor = h.jumlah_soal > 0 ? Math.round((h.jumlah_benar / h.jumlah_soal) * 1000) / 10 : null
      return {
        key: h.id,
        namaAsal: h.nama_siswa,
        skor,
        siswaId: cocok.length === 1 ? cocok[0].id : '',
        // ambigu: ada >1 siswa dengan nama sama persis di kelas ini — perlu dipilih manual
        status: cocok.length === 1 ? 'cocok' : cocok.length === 0 ? 'tidak_cocok' : 'ambigu',
        termasuk: cocok.length === 1 && skor !== null,
      }
    })
    setImportPreview(rows)
  }

  function toggleTermasuk(idx) {
    setImportPreview((prev) => prev.map((r, i) => (i === idx ? { ...r, termasuk: !r.termasuk } : r)))
  }

  function pilihSiswaTujuan(idx, siswaId) {
    setImportPreview((prev) => prev.map((r, i) => (i === idx ? { ...r, siswaId, termasuk: !!siswaId } : r)))
  }

  async function handleImport() {
    const rec = daftarImpor.find((r) => r.id === importSelectedId)
    if (!rec) return
    // Jenis nilai yang dipakai untuk impor ini — sekarang dua-duanya
    // (Ujian Online maupun Kuis Seru) dipilih lewat dropdown, tidak ada
    // lagi yang di-fixed ke satu jenis tertentu.
    const jenisAkhir = importSumber === 'ujian' ? importJenisUjian : importJenisKuis
    // Mata pelajaran: untuk Ujian Online dipakai dari kotak yang bisa
    // diedit manual (mapelImporUjian), bukan langsung dari rec.mata_pelajaran
    // — supaya impor tetap bisa jalan walau info ujian gagal terbaca dari
    // tabel "ujian". Untuk Kuis Seru tetap dari data kuisnya seperti semula.
    const mapelAkhir = importSumber === 'ujian' ? mapelImporUjian.trim() : rec.mata_pelajaran
    if (!mapelAkhir) {
      return alert('Isi dulu Mata Pelajaran untuk ujian ini sebelum diimpor.')
    }
    const baris = importPreview
      .filter((r) => r.termasuk && r.siswaId && r.skor !== null && r.skor !== undefined)
      .map((r) => ({
        siswa_id: r.siswaId,
        mata_pelajaran: mapelAkhir,
        jenis: jenisAkhir,
        kompetensi: importKompetensi,
        semester,
        tahun_ajaran: tahunAjaran,
        nilai: Number(r.skor),
        predikat: predikatDariNilai(r.skor),
        diisi_oleh: profil?.guru_id || null,
      }))
    if (baris.length === 0) return alert('Tidak ada baris nilai yang bisa diimpor. Cek kolom "Termasuk" dan kecocokan siswanya.')
    setImportSaving(true)
    const { error } = await supabase.from('nilai').upsert(baris, { onConflict: 'siswa_id,mata_pelajaran,jenis,kompetensi,semester,tahun_ajaran' })
    setImportSaving(false)
    if (error) {
      alert('Gagal mengimpor nilai: ' + error.message)
    } else {
      alert(`Berhasil mengimpor ${baris.length} nilai ke tabel Nilai (jenis: ${jenisAkhir}, mapel: ${mapelAkhir}).`)
      if (activeSubTab === 'kelola') loadKelolaData()
    }
  }

  const recordTerpilih = daftarImpor.find((r) => r.id === importSelectedId)
  const jenisImporTerpilih = importSumber === 'ujian' ? importJenisUjian : importJenisKuis

  const kelolaDataTersaring = kelolaFilterMapel.trim()
    ? kelolaData.filter((d) => d.mata_pelajaran.toLowerCase().includes(kelolaFilterMapel.trim().toLowerCase()))
    : kelolaData

  return (
    <Layout title="Nilai Siswa" subtitle="Input nilai per kelas dan mata pelajaran">
      {/* Banner — tema sirkuit neon, senada dengan Login & Kelas */}
      <div className="relative overflow-hidden rounded-2xl nilai-banner p-6 mb-6">
        <CircuitBackdrop patternId="pola-nilai" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full nilai-banner-icon flex items-center justify-center shrink-0">
            <BookOpenCheck size={20} />
          </div>
          <div>
            <p className="font-display font-semibold text-lg nilai-banner-title">Nilai Siswa</p>
            <p className="text-sm nilai-banner-subtitle mt-0.5">
              {kelasAktif ? `Kelas ${kelasAktif.nama_kelas} · ${siswaList.length} siswa aktif` : 'Pilih kelas untuk mulai input nilai'}
            </p>
          </div>
        </div>
      </div>

      {/* Tab: Input Nilai vs Kelola Nilai (lihat & hapus) */}
      <div className="flex items-center gap-2 mb-5">
        <button
          onClick={() => setActiveSubTab('input')}
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'input' ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <Save size={14} /> Input Nilai
        </button>
        <button
          onClick={() => setActiveSubTab('kelola')}
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'kelola' ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <ListChecks size={14} /> Lihat &amp; Hapus Nilai
        </button>
        <button
          onClick={() => setActiveSubTab('impor')}
          className={`px-3 py-1.5 rounded-lg border text-sm font-medium flex items-center gap-1.5 transition-colors ${
            activeSubTab === 'impor' ? 'bg-sage-500 text-white border-sage-500' : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <Download size={14} /> Impor dari Ujian &amp; Kuis
        </button>
      </div>

      <div className="nilai-card p-5 mb-5 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="nilai-label">Kelas</label>
          <select className="nilai-input" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        {activeSubTab === 'input' && (
          <div>
            <label className="nilai-label">Mata Pelajaran</label>
            <select
              className="nilai-input"
              value={mataPelajaran}
              onChange={(e) => setMataPelajaran(e.target.value)}
              disabled={mapelOpts.length === 0}
            >
              {mapelOpts.length === 0 && <option value="">Belum ada mapel di profil guru</option>}
              {mapelOpts.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'input' && (
          <div>
            <label className="nilai-label">Jenis</label>
            <select className="nilai-input" value={jenis} onChange={(e) => setJenis(e.target.value)}>
              {JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'input' && (
          <div>
            <label className="nilai-label">Kompetensi</label>
            <select className="nilai-input" value={kompetensi} onChange={(e) => setKompetensi(e.target.value)}>
              {KOMPETENSI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'kelola' && (
          <div className="md:col-span-2">
            <label className="nilai-label">Cari Mata Pelajaran</label>
            <input className="nilai-input" value={kelolaFilterMapel} onChange={(e) => setKelolaFilterMapel(e.target.value)} placeholder="Ketik untuk menyaring..." />
          </div>
        )}
        {activeSubTab === 'impor' && (
          <div>
            <label className="nilai-label">Sumber</label>
            <select className="nilai-input" value={importSumber} onChange={(e) => setImportSumber(e.target.value)}>
              <option value="ujian">Ujian Online</option>
              <option value="kuis">Kuis Seru</option>
            </select>
          </div>
        )}
        {activeSubTab === 'impor' && (
          <div>
            <label className="nilai-label">Kompetensi</label>
            <select className="nilai-input" value={importKompetensi} onChange={(e) => setImportKompetensi(e.target.value)}>
              {KOMPETENSI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'impor' && importSumber === 'kuis' && (
          <div>
            <label className="nilai-label">Jenis</label>
            <select className="nilai-input" value={importJenisKuis} onChange={(e) => setImportJenisKuis(e.target.value)}>
              {JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'impor' && importSumber === 'ujian' && (
          <div>
            <label className="nilai-label">Jenis</label>
            <select className="nilai-input" value={importJenisUjian} onChange={(e) => setImportJenisUjian(e.target.value)}>
              {IMPOR_UJIAN_JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'impor' && importSumber === 'ujian' && (
          <div>
            <label className="nilai-label">Mata Pelajaran</label>
            <input
              className="nilai-input"
              value={mapelImporUjian}
              onChange={(e) => setMapelImporUjian(e.target.value)}
              placeholder={recordTerpilih ? 'Isi manual kalau kosong' : 'Pilih ujian dulu'}
              disabled={!importSelectedId}
            />
          </div>
        )}
        <div>
          <label className="nilai-label">Semester</label>
          <select className="nilai-input" value={semester} onChange={(e) => setSemester(e.target.value)}>
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
        </div>
        <div>
          <label className="nilai-label">Tahun Ajaran</label>
          <select className="nilai-input" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)}>
            {TA_OPTS.map((ta) => <option key={ta} value={ta}>{ta}</option>)}
          </select>
        </div>
      </div>

      {activeSubTab === 'input' && (
        <>
          <div className="nilai-card overflow-x-auto">
            <table className="nilai-table">
              <thead><tr><th>Nama Siswa</th><th className="w-40">Nilai (0–100)</th><th className="w-32">Predikat</th></tr></thead>
              <tbody>
                {loading && <tr><td colSpan={3} className="text-center py-8 nilai-muted">Memuat...</td></tr>}
                {!loading && siswaList.length === 0 && <tr><td colSpan={3} className="text-center py-8 nilai-muted">Belum ada siswa aktif di kelas ini.</td></tr>}
                {siswaList.map((s) => {
                  const predikat = predikatDariNilai(nilaiMap[s.id])
                  return (
                    <tr key={s.id}>
                      <td className="font-medium">{s.nama_lengkap}</td>
                      <td>
                        <input type="number" min={0} max={100} className="nilai-input"
                          value={nilaiMap[s.id] ?? ''}
                          onChange={(e) => setNilaiMap({ ...nilaiMap, [s.id]: e.target.value })} />
                      </td>
                      <td>
                        {predikat ? (
                          <span className={`badge ${WARNA_PREDIKAT[predikat]}`}>{predikat}</span>
                        ) : (
                          <span className="text-xs nilai-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {siswaList.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="nilai-btn-primary">
                {saving ? <Loader2 size={16} className="nilai-spin" /> : <Save size={16} />}
                Simpan Nilai
              </button>
              {saved && <span className="text-sm nilai-saved">Tersimpan.</span>}
            </div>
          )}
        </>
      )}

      {activeSubTab === 'kelola' && (
        <div className="nilai-card overflow-x-auto">
          <table className="nilai-table">
            <thead>
              <tr>
                <th>Nama Siswa</th>
                <th>Mata Pelajaran</th>
                <th className="w-24">Jenis</th>
                <th className="w-32">Kompetensi</th>
                <th className="w-24">Nilai</th>
                <th className="w-24">Predikat</th>
                <th className="w-20">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {kelolaLoading && (
                <tr><td colSpan={7} className="text-center py-8 nilai-muted">Memuat...</td></tr>
              )}
              {!kelolaLoading && !tahunAjaran && (
                <tr><td colSpan={7} className="text-center py-8 nilai-muted">Isi Tahun Ajaran dulu untuk melihat daftar nilai.</td></tr>
              )}
              {!kelolaLoading && tahunAjaran && kelolaDataTersaring.length === 0 && (
                <tr><td colSpan={7} className="text-center py-8 nilai-muted">Belum ada nilai tersimpan untuk kelas, semester &amp; tahun ajaran ini.</td></tr>
              )}
              {!kelolaLoading && kelolaDataTersaring.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.siswa?.nama_lengkap || '—'}</td>
                  <td>{row.mata_pelajaran}</td>
                  <td>{row.jenis}</td>
                  <td>{row.kompetensi}</td>
                  <td>{row.nilai}</td>
                  <td>
                    {row.predikat ? (
                      <span className={`badge ${WARNA_PREDIKAT[row.predikat]}`}>{row.predikat}</span>
                    ) : (
                      <span className="text-xs nilai-muted">—</span>
                    )}
                  </td>
                  <td>
                    <button
                      onClick={() => hapusNilai(row)}
                      title="Hapus nilai ini"
                      className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeSubTab === 'impor' && (
        <>
          <div className="nilai-card p-5 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="nilai-label">{importSumber === 'ujian' ? 'Pilih Ujian Online' : 'Pilih Kuis Seru'}</label>
              <select
                className="nilai-input"
                value={importSelectedId}
                onChange={(e) => pilihImporRecord(e.target.value)}
                disabled={daftarImpor.length === 0}
              >
                <option value="">
                  {daftarImpor.length === 0
                    ? `Belum ada hasil ${importSumber === 'ujian' ? 'Ujian Online' : 'Kuis Seru'} untuk siswa di kelas ini`
                    : '— pilih —'}
                </option>
                {daftarImpor.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.judul}{r.mata_pelajaran ? ` (${r.mata_pelajaran})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-sm nilai-muted self-end pb-2">
              Nilai akan disimpan sebagai jenis <b>{jenisImporTerpilih}</b> untuk <b>Semester {semester}</b>, tahun ajaran <b>{tahunAjaran}</b>
              {importSumber === 'ujian'
                ? (mapelImporUjian && <> · mapel <b>{mapelImporUjian}</b></>)
                : (recordTerpilih && <> · mapel <b>{recordTerpilih.mata_pelajaran}</b></>)}
              .
            </div>
          </div>

          <div className="nilai-card overflow-x-auto">
            <table className="nilai-table">
              <thead>
                <tr>
                  <th className="w-10">Termasuk</th>
                  <th>Nama (dari {importSumber === 'ujian' ? 'Ujian Online' : 'Kuis Seru'})</th>
                  <th className="w-56">Siswa Tujuan</th>
                  <th className="w-24">Skor</th>
                  <th className="w-40">Status</th>
                </tr>
              </thead>
              <tbody>
                {importLoading && <tr><td colSpan={5} className="text-center py-8 nilai-muted">Memuat...</td></tr>}
                {!importLoading && !importSelectedId && (
                  <tr><td colSpan={5} className="text-center py-8 nilai-muted">Pilih {importSumber === 'ujian' ? 'ujian' : 'kuis'} di atas untuk melihat preview nilai.</td></tr>
                )}
                {!importLoading && importSelectedId && importPreview.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 nilai-muted">Belum ada siswa yang mengerjakan.</td></tr>
                )}
                {!importLoading && importPreview.map((row, idx) => (
                  <tr key={row.key}>
                    <td>
                      <input type="checkbox" checked={row.termasuk} onChange={() => toggleTermasuk(idx)} disabled={!row.siswaId} />
                    </td>
                    <td className="font-medium">{row.namaAsal}</td>
                    <td>
                      {row.status === 'cocok' ? (
                        <span>{siswaList.find((s) => s.id === row.siswaId)?.nama_lengkap}</span>
                      ) : (
                        <select className="nilai-input" value={row.siswaId} onChange={(e) => pilihSiswaTujuan(idx, e.target.value)}>
                          <option value="">— pilih siswa —</option>
                          {siswaList.map((s) => <option key={s.id} value={s.id}>{s.nama_lengkap}</option>)}
                        </select>
                      )}
                    </td>
                    <td>{row.skor ?? '—'}</td>
                    <td>
                      {row.status === 'cocok' && (
                        <span className="text-xs flex items-center gap-1 text-sage-600"><CheckCircle2 size={14} /> Cocok otomatis</span>
                      )}
                      {row.status === 'tidak_cocok' && (
                        <span className="text-xs flex items-center gap-1 text-amber-600"><AlertTriangle size={14} /> Tidak ditemukan, pilih manual</span>
                      )}
                      {row.status === 'ambigu' && (
                        <span className="text-xs flex items-center gap-1 text-red-600"><AlertTriangle size={14} /> Nama ganda di kelas ini</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {importPreview.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <button onClick={handleImport} disabled={importSaving} className="nilai-btn-primary">
                {importSaving ? <Loader2 size={16} className="nilai-spin" /> : <Download size={16} />}
                Impor {importPreview.filter((r) => r.termasuk && r.siswaId).length} Nilai
              </button>
            </div>
          )}
        </>
      )}
    </Layout>
  )
}
