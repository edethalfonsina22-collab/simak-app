import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { ambilProfilUntukCetak, bukaCetakTabel } from '../lib/printTemplate'
import { Search, Printer, Loader2, Users } from 'lucide-react'

function formatTanggalLahir(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

function tempatTanggalLahir(s) {
  const tempat = s.tempat_lahir?.trim()
  const tanggal = formatTanggalLahir(s.tanggal_lahir)
  if (tempat && tanggal) return `${tempat}, ${tanggal}`
  if (tempat) return tempat
  if (tanggal) return tanggal
  return '—'
}

// Halaman "8355" — halaman tersendiri untuk melihat & mencetak Data Siswa
// lengkap dengan kop surat sekolah (logo, alamat, tanda tangan kepala
// sekolah), terpisah dari halaman Data Siswa (CRUD) supaya lebih rapi.
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

  const namaKelasTerpilih = kelasList.find((k) => String(k.id) === String(kelasId))?.nama_kelas

  async function handleCetak() {
    setMencetak(true)
    try {
      const profil = await ambilProfilUntukCetak()
      const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

      bukaCetakTabel({
        profil,
        judul: 'Data Siswa',
        subJudul: [
          namaKelasTerpilih ? `Kelas ${namaKelasTerpilih}` : null,
          `Dicetak pada ${tanggal}`,
          `Total ${filtered.length} siswa`,
        ]
          .filter(Boolean)
          .join(' · '),
        orientasi: 'landscape',
        kolom: ['No', 'Nama Lengkap', 'NIS', 'NISN', 'NIK', 'Kelas', 'Jenis Kelamin', 'Agama', 'Status'],
        baris: filtered.map((s, i) => [
          i + 1,
          s.nama_lengkap,
          s.nis,
          s.nisn,
          s.nik,
          s.kelas?.nama_kelas,
          s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan',
          s.agama,
          s.status,
        ]),
        tandaTangan: { jabatan: 'Kepala Sekolah' },
      })
    } finally {
      setMencetak(false)
    }
  }

  return (
    <Layout
      title="Cetak Data Siswa"
      subtitle="Lihat dan cetak Data Siswa lengkap dengan kop surat sekolah"
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
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama Lengkap</th>
              <th>NIS</th>
              <th>NISN</th>
              <th>NIK</th>
              <th>Tempat, Tanggal Lahir</th>
              <th>Kelas</th>
              <th>Jenis Kelamin</th>
              <th>Agama</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-ink-700/50">
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-8 text-ink-700/50">
                  Tidak ada data siswa yang cocok.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.nama_lengkap}</td>
                <td className="font-mono text-xs">{s.nis || '—'}</td>
                <td className="font-mono text-xs">{s.nisn || '—'}</td>
                <td className="font-mono text-xs">{s.nik || '—'}</td>
                <td className="text-xs whitespace-nowrap">{tempatTanggalLahir(s)}</td>
                <td>{s.kelas?.nama_kelas || '—'}</td>
                <td>{s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                <td>{s.agama || '—'}</td>
                <td>
                  <span className={`badge ${s.status === 'aktif' ? 'bg-sage-500/15 text-sage-500' : 'bg-ink-900/10 text-ink-700'}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
