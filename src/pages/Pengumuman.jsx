import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Plus, Trash2, X, Loader2 } from 'lucide-react'

export default function Pengumuman() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [judul, setJudul] = useState('')
  const [isi, setIsi] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data } = await supabase.from('pengumuman').select('*').order('dibuat_pada', { ascending: false })
    setData(data || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('pengumuman').insert({ judul, isi })
    setSaving(false)
    if (!error) { setShowForm(false); setJudul(''); setIsi(''); loadData() }
    else alert('Gagal menyimpan: ' + error.message)
  }

  async function handleDelete(id) {
    if (!confirm('Hapus pengumuman ini?')) return
    const { error } = await supabase.from('pengumuman').delete().eq('id', id)
    if (!error) loadData()
  }

  return (
    <Layout title="Pengumuman" subtitle="Informasi untuk seluruh warga sekolah" actions={
      <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Buat Pengumuman</button>
    }>
      <div className="space-y-4">
        {loading && <p className="text-sm text-ink-700/50">Memuat data...</p>}
        {!loading && data.length === 0 && <p className="text-sm text-ink-700/50">Belum ada pengumuman.</p>}
        {data.map((p) => (
          <div key={p.id} className="card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-lg font-semibold text-ink-950">{p.judul}</p>
                <p className="text-xs text-ink-700/40 mt-0.5">{new Date(p.dibuat_pada).toLocaleString('id-ID')}</p>
              </div>
              <button onClick={() => handleDelete(p.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600/70 shrink-0"><Trash2 size={15} /></button>
            </div>
            <p className="text-sm text-ink-900/80 mt-3 whitespace-pre-wrap">{p.isi}</p>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-lg p-6 relative">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"><X size={20} /></button>
            <h2 className="font-display text-xl font-semibold mb-4">Buat Pengumuman</h2>
            <div className="space-y-3">
              <div>
                <label className="eyebrow mb-1.5 block">Judul</label>
                <input required className="input-field" value={judul} onChange={(e) => setJudul(e.target.value)} />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Isi</label>
                <textarea required rows={5} className="input-field" value={isi} onChange={(e) => setIsi(e.target.value)} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving && <Loader2 size={16} className="animate-spin" />} Terbitkan</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}
