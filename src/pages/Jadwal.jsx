import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Plus, Trash2, X, Loader2 } from 'lucide-react'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu']
const emptyForm = { kelas_id: '', mata_pelajaran: '', guru_id: '', hari: 'Senin', jam_mulai: '', jam_selesai: '' }

export default function Jadwal() {
  const [data, setData] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [guruList, setGuruList] = useState([])
  const [filterKelas, setFilterKelas] = useState('')
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const [{ data: jadwal }, { data: kelas }, { data: guru }] = await Promise.all([
      supabase.from('jadwal').select('*, kelas(nama_kelas), guru(nama_lengkap)').order('hari').order('jam_mulai'),
      supabase.from('kelas').select('id, nama_kelas').order('nama_kelas'),
      supabase.from('guru').select('id, nama_lengkap').order('nama_lengkap'),
    ])
    setData(jadwal || [])
    setKelasList(kelas || [])
    setGuruList(guru || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, kelas_id: form.kelas_id || null, guru_id: form.guru_id || null }
    const { error } = await supabase.from('jadwal').insert(payload)
    setSaving(false)
    if (!error) { setShowForm(false); setForm(emptyForm); loadData() }
    else alert('Gagal menyimpan: ' + error.message)
  }

  async function handleDelete(id) {
    if (!confirm('Hapus jadwal ini?')) return
    const { error } = await supabase.from('jadwal').delete().eq('id', id)
    if (!error) loadData()
  }

  const filtered = filterKelas ? data.filter((j) => j.kelas_id === filterKelas) : data

  return (
    <Layout title="Jadwal Pelajaran" subtitle="Susunan jam mengajar per kelas" actions={
      <button className="btn-primary" onClick={() => setShowForm(true)}><Plus size={16} /> Tambah Jadwal</button>
    }>
      <div className="card p-4 mb-4">
        <select className="input-field max-w-xs" value={filterKelas} onChange={(e) => setFilterKelas(e.target.value)}>
          <option value="">Semua Kelas</option>
          {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
        </select>
      </div>

      <div className="space-y-5">
        {HARI.map((hari) => {
          const items = filtered.filter((j) => j.hari === hari)
          if (items.length === 0) return null
          return (
            <div key={hari} className="card p-5">
              <h3 className="font-display text-base font-semibold mb-3">{hari}</h3>
              <table className="table-shell">
                <thead>
                  <tr><th>Jam</th><th>Kelas</th><th>Mata Pelajaran</th><th>Guru</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((j) => (
                    <tr key={j.id}>
                      <td className="font-mono text-xs">{j.jam_mulai?.slice(0,5)} – {j.jam_selesai?.slice(0,5)}</td>
                      <td>{j.kelas?.nama_kelas || '—'}</td>
                      <td>{j.mata_pelajaran}</td>
                      <td>{j.guru?.nama_lengkap || '—'}</td>
                      <td className="text-right">
                        <button onClick={() => handleDelete(j.id)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600/70"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })}
        {!loading && filtered.length === 0 && <p className="text-sm text-ink-700/50">Belum ada jadwal untuk ditampilkan.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-md p-6 relative">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"><X size={20} /></button>
            <h2 className="font-display text-xl font-semibold mb-4">Tambah Jadwal</h2>
            <div className="space-y-3">
              <div>
                <label className="eyebrow mb-1.5 block">Kelas</label>
                <select required className="input-field" value={form.kelas_id} onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                  <option value="">Pilih kelas</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Mata Pelajaran</label>
                <input required className="input-field" value={form.mata_pelajaran} onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })} />
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Guru Pengajar</label>
                <select className="input-field" value={form.guru_id} onChange={(e) => setForm({ ...form, guru_id: e.target.value })}>
                  <option value="">— Pilih guru —</option>
                  {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                </select>
              </div>
              <div>
                <label className="eyebrow mb-1.5 block">Hari</label>
                <select className="input-field" value={form.hari} onChange={(e) => setForm({ ...form, hari: e.target.value })}>
                  {HARI.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="eyebrow mb-1.5 block">Jam Mulai</label>
                  <input required type="time" className="input-field" value={form.jam_mulai} onChange={(e) => setForm({ ...form, jam_mulai: e.target.value })} />
                </div>
                <div>
                  <label className="eyebrow mb-1.5 block">Jam Selesai</label>
                  <input required type="time" className="input-field" value={form.jam_selesai} onChange={(e) => setForm({ ...form, jam_selesai: e.target.value })} />
                </div>
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
