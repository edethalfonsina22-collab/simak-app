import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, BookOpenCheck } from 'lucide-react'
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

  async function loadSiswa() {
    setLoading(true)
    const { data } = await supabase.from('siswa').select('id, nama_lengkap').eq('kelas_id', kelasId).eq('status', 'aktif').order('nama_lengkap')
    setSiswaList(data || [])
    setLoading(false)
  }

  async function loadExisting() {
    if (!mataPelajaran || !kelasId) return
    const { data } = await supabase.from('nilai').select('siswa_id, nilai')
      .eq('mata_pelajaran', mataPelajaran).eq('jenis', jenis).eq('kompetensi', kompetensi)
      .eq('semester', semester).eq('tahun_ajaran', tahunAjaran)
      .in('siswa_id', siswaList.map((s) => s.id))
    const map = {}
    ;(data || []).forEach((d) => { map[d.siswa_id] = d.nilai })
    setNilaiMap(map)
    setSaved(false)
  }

  async function handleSave() {
    if (!mataPelajaran) return alert('Isi nama mata pelajaran terlebih dahulu.')
    setSaving(true)
    const rows = siswaList
      .filter((s) => nilaiMap[s.id] !== undefined && nilaiMap[s.id] !== '')
      .map((s) => ({
        siswa_id: s.id,
        mata_pelajaran: mataPelajaran,
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
    if (!error) setSaved(true)
    else alert('Gagal menyimpan nilai: ' + error.message)
  }

  const kelasAktif = kelasList.find((k) => k.id === kelasId)

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

      <div className="nilai-card p-5 mb-5 grid grid-cols-2 md:grid-cols-6 gap-3">
        <div>
          <label className="nilai-label">Kelas</label>
          <select className="nilai-input" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        <div>
          <label className="nilai-label">Mata Pelajaran</label>
          <input className="nilai-input" value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} onBlur={loadExisting} placeholder="Matematika" />
        </div>
        <div>
          <label className="nilai-label">Jenis</label>
          <select className="nilai-input" value={jenis} onChange={(e) => { setJenis(e.target.value); setTimeout(loadExisting, 0) }}>
            {JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="nilai-label">Kompetensi</label>
          <select className="nilai-input" value={kompetensi} onChange={(e) => { setKompetensi(e.target.value); setTimeout(loadExisting, 0) }}>
            {KOMPETENSI_OPTS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="nilai-label">Semester</label>
          <select className="nilai-input" value={semester} onChange={(e) => { setSemester(e.target.value); setTimeout(loadExisting, 0) }}>
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
        </div>
        <div>
          <label className="nilai-label">Tahun Ajaran</label>
          <input className="nilai-input" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} onBlur={loadExisting} placeholder="2026/2027" />
        </div>
      </div>

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
    </Layout>
  )
}
