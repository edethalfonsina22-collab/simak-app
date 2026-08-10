import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, BookOpenCheck, Trash2, ListChecks } from 'lucide-react'
import './Nilai.css'

const JENIS_OPTS = ['Tugas', 'UH', 'UTS', 'UAS']
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
  const { profil } = useAuth()
  const [activeSubTab, setActiveSubTab] = useState('input') // 'input' | 'kelola'
  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')
  const [siswaList, setSiswaList] = useState([])
  const [mataPelajaran, setMataPelajaran] = useState('')
  const [jenis, setJenis] = useState('UH')
  const [kompetensi, setKompetensi] = useState('Pengetahuan')
  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState('')
  const [nilaiMap, setNilaiMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // --- state untuk tab "Kelola Nilai" (lihat & hapus) ---
  const [kelolaData, setKelolaData] = useState([])
  const [kelolaLoading, setKelolaLoading] = useState(false)
  const [kelolaFilterMapel, setKelolaFilterMapel] = useState('')

  useEffect(() => {
    supabase.from('kelas').select('id, nama_kelas').order('nama_kelas').then(({ data }) => {
      setKelasList(data || [])
      if (data?.length) setKelasId(data[0].id)
    })
  }, [])

  useEffect(() => {
    if (kelasId) loadSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelasId])

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
    const { data } = await supabase.from('siswa').select('id, nama_lengkap').eq('kelas_id', kelasId).eq('status', 'aktif').order('nama_lengkap')
    setSiswaList(data || [])
    setLoading(false)
  }

  // Ambil versi mata pelajaran yang sudah dirapikan (tanpa spasi di awal/akhir,
  // spasi ganda dirapatkan) — dipakai konsisten baik saat mencari data lama
  // maupun saat menyimpan, supaya "Matematika", "Matematika " dan " Matematika"
  // selalu dianggap satu mapel yang sama, bukan tiga baris terpisah.
  function mapelBersih() {
    return mataPelajaran.trim().replace(/\s+/g, ' ')
  }

  async function loadExisting() {
    const mapel = mapelBersih()
    if (mapel !== mataPelajaran) setMataPelajaran(mapel)
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
    const mapel = mapelBersih()
    if (!mapel) return alert('Isi nama mata pelajaran terlebih dahulu.')
    setMataPelajaran(mapel)
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
            <input className="nilai-input" value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} onBlur={loadExisting} placeholder="Matematika" />
          </div>
        )}
        {activeSubTab === 'input' && (
          <div>
            <label className="nilai-label">Jenis</label>
            <select className="nilai-input" value={jenis} onChange={(e) => { setJenis(e.target.value); setTimeout(loadExisting, 0) }}>
              {JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
            </select>
          </div>
        )}
        {activeSubTab === 'input' && (
          <div>
            <label className="nilai-label">Kompetensi</label>
            <select className="nilai-input" value={kompetensi} onChange={(e) => { setKompetensi(e.target.value); setTimeout(loadExisting, 0) }}>
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
        <div>
          <label className="nilai-label">Semester</label>
          <select className="nilai-input" value={semester} onChange={(e) => { setSemester(e.target.value); if (activeSubTab === 'input') setTimeout(loadExisting, 0) }}>
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
        </div>
        <div>
          <label className="nilai-label">Tahun Ajaran</label>
          <input className="nilai-input" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} onBlur={() => { if (activeSubTab === 'input') loadExisting(); else loadKelolaData() }} placeholder="2026/2027" />
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
    </Layout>
  )
}
