import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react'

const emptyForm = { nama_kelas: '', tingkat: '', wali_kelas_id: '', tahun_ajaran: '' }

function fotoWaliUrl(path) {
  if (!path) return null
  return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
}

export default function Kelas() {
  const [data, setData] = useState([])
  const [guruList, setGuruList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: kelas }, { data: guru }, { data: siswaCounts }] = await Promise.all([
      supabase.from('kelas').select('*, guru(nama_lengkap, foto_profil_path)').order('nama_kelas'),
      supabase.from('guru').select('id, nama_lengkap').order('nama_lengkap'),
      supabase.from('siswa').select('kelas_id'),
    ])
    const counts = {}
    ;(siswaCounts || []).forEach((s) => { if (s.kelas_id) counts[s.kelas_id] = (counts[s.kelas_id] || 0) + 1 })
    setData((kelas || []).map((k) => ({ ...k, jumlah_siswa: counts[k.id] || 0 })))
    setGuruList(guru || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function openAdd() { setForm(emptyForm); setEditingId(null); setShowForm(true) }
  function openEdit(row) { setForm({ ...emptyForm, ...row, wali_kelas_id: row.wali_kelas_id || '' }); setEditingId(row.id); setShowForm(true) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, wali_kelas_id: form.wali_kelas_id || null }
    delete payload.guru
    delete payload.jumlah_siswa
    const { error } = editingId
      ? await supabase.from('kelas').update(payload).eq('id', editingId)
      : await supabase.from('kelas').insert(payload)
    setSaving(false)
    if (!error) { setShowForm(false); loadData() }
    else alert('Gagal menyimpan: ' + error.message)
  }

  async function handleDelete(id) {
    if (!confirm('Hapus kelas ini? Siswa di kelas ini tidak akan terhapus, hanya keluar dari kelas.')) return
    const { error } = await supabase.from('kelas').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  return (
    <Layout title="Kelas" subtitle={`${data.length} kelas`} actions={
      <button className="btn-primary" onClick={openAdd}><Plus size={16} /> Tambah Kelas</button>
    }>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && <p className="text-ink-700/50 text-sm">Memuat data...</p>}
        {!loading && data.length === 0 && <p className="text-ink-700/50 text-sm">Belum ada kelas. Tambahkan kelas pertama Anda.</p>}
        {data.map((k) => (
          <div
            key={k.id}
            className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-red-900 to-red-950 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg"
          >
            {/* Dekorasi lingkaran samar, senada gaya kartu identitas Profil Saya */}
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            <div className="absolute -bottom-10 -left-4 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

            <div className="relative flex items-start justify-between">
              <div>
                <p className="font-display text-lg font-semibold text-white">{k.nama_kelas}</p>
                <p className="text-xs text-red-200/70 mt-0.5">Tingkat {k.tingkat} · {k.tahun_ajaran}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(k)} className="p-1.5 hover:bg-white/10 rounded-lg text-white/60"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(k.id)} className="p-1.5 hover:bg-white/10 rounded-lg text-red-200/80"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="relative mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-white/10 ring-1 ring-white/20 overflow-hidden flex items-center justify-center shrink-0">
                  {fotoWaliUrl(k.guru?.foto_profil_path) ? (
                    <img src={fotoWaliUrl(k.guru.foto_profil_path)} alt={k.guru?.nama_lengkap || 'Wali kelas'} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-white/70">{k.guru?.nama_lengkap?.[0] || '?'}</span>
                  )}
                </div>
                <span className="text-red-100/70">Wali: {k.guru?.nama_lengkap || '—'}</span>
              </div>
              <span className="badge bg-brass-400/20 text-brass-300">{k.jumlah_siswa} siswa</span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-md p-6 relative">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"><X size={20} /></button>
            <h2 className="font-display text-xl font-semibold mb-4">{editingId ? 'Ubah Kelas' : 'Tambah Kelas'}</h2>
            <div className="space-y-3">
              <div>
                <label className="eyebrow mb-1.5 block">Nama Kelas</label>
                <input required className="input-field" placeholder="Contoh: VII-A" value={form.nama_kelas} onChange={(e) => setForm({ ...form, nama_kelas: e.target.value })} />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Tingkat</label>
                <input className="input-field" placeholder="Contoh: VII" value={form.tingkat} onChange={(e) => setForm({ ...form, tingkat: e.target.value })} />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Wali Kelas</label>
                <select className="input-field" value={form.wali_kelas_id} onChange={(e) => setForm({ ...form, wali_kelas_id: e.target.value })}>
                  <option value="">— Belum ditentukan —</option>
                  {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                </select>
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Tahun Ajaran</label>
                <input className="input-field" placeholder="Contoh: 2026/2027" value={form.tahun_ajaran} onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving && <Loader2 size={16} className="animate-spin" />} Simpan</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}
