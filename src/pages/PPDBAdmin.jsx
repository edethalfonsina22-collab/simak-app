import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Check, X, Loader2, Copy } from 'lucide-react'

const TAB = [
  { value: 'menunggu', label: 'Menunggu' },
  { value: 'diterima', label: 'Diterima' },
  { value: 'ditolak', label: 'Ditolak' },
]

function formatTanggal(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function PPDBAdmin() {
  const [tab, setTab] = useState('menunggu')
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [prosesId, setProsesId] = useState(null)

  async function muatData() {
    setLoading(true)
    const { data: rows } = await supabase
      .from('ppdb_pendaftar')
      .select('*')
      .eq('status', tab)
      .order('dibuat_pada', { ascending: false })
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    muatData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function terima(pendaftar) {
    if (!confirm(`Terima ${pendaftar.nama_lengkap} dan tambahkan ke Data Siswa?`)) return
    setProsesId(pendaftar.id)

    // 1. Masukkan ke tabel siswa
    const { error: errSiswa } = await supabase.from('siswa').insert({
      nama_lengkap: pendaftar.nama_lengkap,
      jenis_kelamin: pendaftar.jenis_kelamin,
      tempat_lahir: pendaftar.tempat_lahir,
      tanggal_lahir: pendaftar.tanggal_lahir,
      alamat: pendaftar.alamat,
      nama_orang_tua: pendaftar.nama_ayah || pendaftar.nama_ibu,
      no_hp_orang_tua: pendaftar.no_hp_orang_tua,
      nik: pendaftar.nik_siswa,
      nomor_kk: pendaftar.nomor_kk,
      status: 'aktif',
    })

    if (errSiswa) {
      alert('Gagal menambahkan ke Data Siswa: ' + errSiswa.message)
      setProsesId(null)
      return
    }

    // 2. Tandai status pendaftaran sebagai diterima
    const { error: errUpdate } = await supabase
      .from('ppdb_pendaftar')
      .update({ status: 'diterima' })
      .eq('id', pendaftar.id)

    setProsesId(null)
    if (errUpdate) {
      alert('Data siswa berhasil ditambahkan, tapi gagal update status pendaftaran: ' + errUpdate.message)
    }
    muatData()
  }

  async function tolak(pendaftar) {
    if (!confirm(`Tolak pendaftaran ${pendaftar.nama_lengkap}?`)) return
    setProsesId(pendaftar.id)
    const { error } = await supabase.from('ppdb_pendaftar').update({ status: 'ditolak' }).eq('id', pendaftar.id)
    setProsesId(null)
    if (!error) muatData()
    else alert('Gagal: ' + error.message)
  }

  const linkPublik = `${window.location.origin}/ppdb`

  function salinLink() {
    navigator.clipboard.writeText(linkPublik)
    alert('Link pendaftaran disalin: ' + linkPublik)
  }

  return (
    <Layout
      title="PPDB — Pendaftaran Siswa Baru"
      subtitle="Kelola calon siswa yang mendaftar lewat formulir online"
      actions={
        <button className="btn-secondary" onClick={salinLink}>
          <Copy size={16} /> Salin Link Pendaftaran
        </button>
      }
    >
      <div className="card p-4 mb-4">
        <p className="text-sm text-ink-700/60">
          Bagikan link ini ke calon orang tua siswa untuk mendaftar secara online:
        </p>
        <p className="text-sm font-medium text-ink-950 mt-1 break-all">{linkPublik}</p>
      </div>

      <div className="flex gap-2 mb-4">
        {TAB.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.value ? 'bg-ink-950 text-paper' : 'bg-white text-ink-700/60 hover:bg-ink-900/5'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama Calon Siswa</th>
              <th>Tanggal Lahir</th>
              <th>Orang Tua</th>
              <th>No. HP</th>
              <th>Tanggal Daftar</th>
              {tab === 'menunggu' && <th></th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
            {!loading && data.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-ink-700/50">Tidak ada pendaftar di status ini.</td></tr>
            )}
            {data.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.nama_lengkap}</td>
                <td>{formatTanggal(d.tanggal_lahir)}</td>
                <td>{d.nama_ayah || d.nama_ibu || '-'}</td>
                <td>{d.no_hp_orang_tua}</td>
                <td>{formatTanggal(d.dibuat_pada)}</td>
                {tab === 'menunggu' && (
                  <td>
                    <div className="flex items-center gap-1 justify-end">
                      <button
                        className="icon-btn text-sage-500"
                        onClick={() => terima(d)}
                        disabled={prosesId === d.id}
                        title="Terima"
                      >
                        {prosesId === d.id ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      </button>
                      <button
                        className="icon-btn text-red-600"
                        onClick={() => tolak(d)}
                        disabled={prosesId === d.id}
                        title="Tolak"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
