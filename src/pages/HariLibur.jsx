import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { CalendarOff, Plus, Trash2, Loader2 } from 'lucide-react'

export default function HariLibur() {
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tanggal, setTanggal] = useState('')
  const [keterangan, setKeterangan] = useState('')

  async function muatData() {
    setLoading(true)
    const { data } = await supabase.from('hari_libur').select('*').order('tanggal')
    setDaftar(data || [])
    setLoading(false)
  }

  useEffect(() => {
    muatData()
  }, [])

  async function tambahLibur(e) {
    e.preventDefault()
    if (!tanggal) return
    setSaving(true)
    const { error } = await supabase
      .from('hari_libur')
      .upsert({ tanggal, keterangan: keterangan || 'Libur' }, { onConflict: 'tanggal' })
    setSaving(false)
    if (error) {
      alert('Gagal menyimpan: ' + error.message)
      return
    }
    setTanggal('')
    setKeterangan('')
    muatData()
  }

  async function hapusLibur(id) {
    if (!confirm('Hapus tanggal libur ini?')) return
    const { error } = await supabase.from('hari_libur').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    muatData()
  }

  return (
    <Layout
      title="Hari Libur"
      subtitle="Tanggal libur nasional/sekolah — otomatis ditandai merah di Daftar Hadir Guru"
    >
      <form onSubmit={tambahLibur} className="card p-5 mb-5">
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="label-field">Tanggal</label>
            <input
              type="date"
              className="input-field"
              value={tanggal}
              onChange={(e) => setTanggal(e.target.value)}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="label-field">Keterangan</label>
            <input
              type="text"
              className="input-field"
              placeholder="contoh: Tahun Baru Islam 1 Muharam"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
            />
          </div>
        </div>
        <button className="btn-primary mt-4" disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Tambah Hari Libur
        </button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Tanggal</th>
              <th>Keterangan</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={3} className="text-center py-8 text-ink-700/50">Memuat...</td></tr>
            )}
            {!loading && daftar.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-8 text-ink-700/50">
                  <CalendarOff size={20} className="mx-auto mb-2 text-ink-700/30" />
                  Belum ada tanggal libur yang didaftarkan. Hari Minggu tetap otomatis ditandai
                  tanpa perlu didaftarkan di sini.
                </td>
              </tr>
            )}
            {daftar.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">
                  {new Date(d.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </td>
                <td>{d.keterangan}</td>
                <td className="text-right">
                  <button onClick={() => hapusLibur(d.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
