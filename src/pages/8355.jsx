import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { ambilProfilUntukCetak, bukaCetak8355, KOLOM_8355 } from '../lib/printTemplate'
import { Search, Printer, Loader2, Users } from 'lucide-react'

// Halaman "8355" — Daftar Calon Peserta Ujian, format resmi Dapodik lengkap
// dengan kop surat pemerintahan (Kabupaten/Dinas/Kecamatan) dan seluruh
// kolom biodata peserta.
export default function Halaman8355() {
  const [data, setData] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [mencetak, setMencetak] = useState(false)
  const [search, setSearch] = useState('')
  const [kelasId, setKelasId] = useState('')

  async function loadData() {
    setLoading(true)
    const [{ data: siswa }, { data: kelas }] = await Promise.all([
      supabase.from('siswa').select('*, kelas(nama_kelas)').order('nama_lengkap'),
      supabase.from('kelas').select('id, nama_kelas').order('nama_kelas'),
    ])
    setData(siswa || [])
    setKelasList(kelas || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const filtered = useMemo(() => {
    return data.filter((s) => {
      const cocokCari = `${s.nama_lengkap} ${s.nis} ${s.nisn} ${s.nik}`.toLowerCase().includes(search.toLowerCase())
      const cocokKelas = !kelasId || String(s.kelas_id) === String(kelasId)
      return cocokCari && cocokKelas
    })
  }, [data, search, kelasId])

  async function handleCetak() {
    setMencetak(true)
    try {
      const profil = await ambilProfilUntukCetak()
      bukaCetak8355({
        profil,
        siswaList: filtered,
        tahunPelajaran: '2025 / 2026',
      })
    } finally {
      setMencetak(false)
    }
  }

  return (
    <Layout
      title="Formulir 8355"
      subtitle="Daftar Calon Peserta Ujian — format resmi dengan kop surat sekolah"
      actions={
        <button className="btn-primary" onClick={handleCetak} disabled={mencetak || loading}>
          {mencetak ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Cetak / Unduh PDF
        </button>
      }
    >
      <div className="card p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            className="input-field pl-9 w-full"
            placeholder="Cari nama, NIS, NISN, atau NIK..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="input-field sm:w-56" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
          <option value="">Semua Kelas</option>
          {kelasList.map((k) => (
            <option key={k.id} value={k.id}>
              {k.nama_kelas}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1.5 text-sm text-ink-700/60 whitespace-nowrap">
          <Users size={15} /> {filtered.length} siswa
        </span>
      </div>

      <div className="card relative overflow-hidden overflow-x-auto">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <table className="table-shell text-xs whitespace-nowrap">
          <thead>
            <tr>
              {KOLOM_8355.map(([label]) => (
                <th key={label}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={KOLOM_8355.length} className="text-center py-8 text-ink-700/50">
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={KOLOM_8355.length} className="text-center py-8 text-ink-700/50">
                  Tidak ada data siswa yang cocok.
                </td>
              </tr>
            )}
            {filtered.map((s, i) => (
              <tr key={s.id}>
                {KOLOM_8355.map(([label, get]) => {
                  const val = get(s, i)
                  return (
                    <td key={label} className={label === 'Nama Peserta' ? 'font-medium' : ''}>
                      {val === '' || val === null || val === undefined ? '—' : val}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
