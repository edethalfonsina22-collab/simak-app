import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, BookOpenCheck } from 'lucide-react'

const JENIS_OPTS = ['Tugas', 'UH', 'UTS', 'UAS']

// Motif dekoratif garis tipis (quatrefoil + titik permata), senada dengan pola pada banner Dasbor.
// Dibuat sebagai SVG <pattern> asli (bukan gambar/foto) agar ringan dan bebas hak cipta.
function PolaDekoratif({ patternId }) {
  return (
    <svg className="absolute inset-0 w-full h-full opacity-[0.12] pointer-events-none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <pattern id={patternId} width="72" height="72" patternUnits="userSpaceOnUse">
          <g stroke="#D9A441" strokeWidth="1" fill="none">
            <circle cx="18" cy="18" r="11" />
            <circle cx="36" cy="18" r="11" />
            <circle cx="18" cy="36" r="11" />
            <circle cx="36" cy="36" r="11" />
          </g>
          <circle cx="60" cy="60" r="1.6" fill="#D9A441" />
          <circle cx="8" cy="60" r="1.6" fill="#D9A441" />
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
      .eq('mata_pelajaran', mataPelajaran).eq('jenis', jenis).eq('semester', semester).eq('tahun_ajaran', tahunAjaran)
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
        semester,
        tahun_ajaran: tahunAjaran,
        nilai: Number(nilaiMap[s.id]),
        diisi_oleh: profil?.guru_id || null,
      }))
    const { error } = await supabase.from('nilai').upsert(rows, { onConflict: 'siswa_id,mata_pelajaran,jenis,semester,tahun_ajaran' })
    setSaving(false)
    if (!error) setSaved(true)
    else alert('Gagal menyimpan nilai: ' + error.message)
  }

  const kelasAktif = kelasList.find((k) => k.id === kelasId)

  return (
    <Layout title="Nilai Siswa" subtitle="Input nilai per kelas dan mata pelajaran">
      {/* Banner sambutan — tema biru navy dengan motif dekoratif, senada dengan banner Dasbor */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 to-blue-950 p-6 mb-6">
        <PolaDekoratif patternId="pola-nilai" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <BookOpenCheck size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Nilai Siswa</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {kelasAktif ? `Kelas ${kelasAktif.nama_kelas} · ${siswaList.length} siswa aktif` : 'Pilih kelas untuk mulai input nilai'}
            </p>
          </div>
        </div>
      </div>

      <div className="card p-5 mb-5 grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="eyebrow mb-1.5 block">Kelas</label>
          <select className="input-field" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        </div>
        <div>
          <label className="eyebrow mb-1.5 block">Mata Pelajaran</label>
          <input className="input-field" value={mataPelajaran} onChange={(e) => setMataPelajaran(e.target.value)} onBlur={loadExisting} placeholder="Matematika" />
        </div>
        <div>
          <label className="eyebrow mb-1.5 block">Jenis</label>
          <select className="input-field" value={jenis} onChange={(e) => { setJenis(e.target.value); setTimeout(loadExisting, 0) }}>
            {JENIS_OPTS.map((j) => <option key={j} value={j}>{j}</option>)}
          </select>
        </div>
        <div>
          <label className="eyebrow mb-1.5 block">Semester</label>
          <select className="input-field" value={semester} onChange={(e) => { setSemester(e.target.value); setTimeout(loadExisting, 0) }}>
            <option>Ganjil</option>
            <option>Genap</option>
          </select>
        </div>
        <div>
          <label className="eyebrow mb-1.5 block">Tahun Ajaran</label>
          <input className="input-field" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)} onBlur={loadExisting} placeholder="2026/2027" />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead><tr><th>Nama Siswa</th><th className="w-40">Nilai (0–100)</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Memuat...</td></tr>}
            {!loading && siswaList.length === 0 && <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Belum ada siswa aktif di kelas ini.</td></tr>}
            {siswaList.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.nama_lengkap}</td>
                <td>
                  <input type="number" min={0} max={100} className="input-field"
                    value={nilaiMap[s.id] ?? ''}
                    onChange={(e) => setNilaiMap({ ...nilaiMap, [s.id]: e.target.value })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {siswaList.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Nilai
          </button>
          {saved && <span className="text-sm text-sage-500">Tersimpan.</span>}
        </div>
      )}
    </Layout>
  )
}
