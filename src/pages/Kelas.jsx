import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Plus, Pencil, Trash2, X, Loader2, Users } from 'lucide-react'
import './Kelas.css'

const emptyForm = { nama_kelas: '', tingkat: '', wali_kelas_id: '', tahun_ajaran: '' }

function fotoWaliUrl(path) {
  if (!path) return null
  return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
}

// Motif sirkuit dekoratif senada dengan Loader & Login — dipakai sebagai
// latar tipis di balik grid kartu kelas, bukan menutupi seluruh halaman.
function CircuitBackdrop() {
  return (
    <svg className="kelas-circuit" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <pattern id="kelasCircuitTile" width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="#2DD4EE" strokeWidth="1" opacity="0.4">
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
      <rect width="100%" height="100%" fill="url(#kelasCircuitTile)" />
    </svg>
  )
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
      <button className="kelas-btn-primary" onClick={openAdd}><Plus size={16} /> Tambah Kelas</button>
    }>
      <div className="kelas-wrap">
        <CircuitBackdrop />

        <div className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading && <p className="text-ink-700/50 text-sm">Memuat data...</p>}
          {!loading && data.length === 0 && <p className="text-ink-700/50 text-sm">Belum ada kelas. Tambahkan kelas pertama Anda.</p>}
          {data.map((k) => (
            <div key={k.id} className="kelas-card">
              <div className="kelas-card-glow" />

              <div className="relative flex items-start justify-between">
                <div>
                  <p className="font-display text-lg font-semibold kelas-card-title">{k.nama_kelas}</p>
                  <p className="text-xs kelas-card-subtitle mt-0.5">Tingkat {k.tingkat} &middot; {k.tahun_ajaran}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(k)} className="kelas-icon-btn kelas-icon-btn-edit"><Pencil size={14} /></button>
                  <button onClick={() => handleDelete(k.id)} className="kelas-icon-btn kelas-icon-btn-delete"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="relative mt-4 pt-4 kelas-card-footer flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="kelas-avatar">
                    {fotoWaliUrl(k.guru?.foto_profil_path) ? (
                      <img src={fotoWaliUrl(k.guru.foto_profil_path)} alt={k.guru?.nama_lengkap || 'Wali kelas'} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-semibold">{k.guru?.nama_lengkap?.[0] || '?'}</span>
                    )}
                  </div>
                  <span className="kelas-card-subtitle">Wali: {k.guru?.nama_lengkap || '—'}</span>
                </div>
                <span className="kelas-badge"><Users size={12} /> {k.jumlah_siswa} siswa</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="kelas-modal">
            <button type="button" onClick={() => setShowForm(false)} className="kelas-modal-close"><X size={20} /></button>
            <p className="kelas-modal-eyebrow">SIMAK &middot; DATA KELAS</p>
            <h2 className="kelas-modal-title">{editingId ? 'Ubah Kelas' : 'Tambah Kelas'}</h2>
            <div className="space-y-3">
              <div>
                <label className="kelas-label">Nama Kelas</label>
                <input required className="kelas-input" placeholder="Contoh: VII-A" value={form.nama_kelas} onChange={(e) => setForm({ ...form, nama_kelas: e.target.value })} />
              </div>
              <div>
                <label className="kelas-label">Tingkat</label>
                <input className="kelas-input" placeholder="Contoh: VII" value={form.tingkat} onChange={(e) => setForm({ ...form, tingkat: e.target.value })} />
              </div>
              <div>
                <label className="kelas-label">Wali Kelas</label>
                <select className="kelas-input" value={form.wali_kelas_id} onChange={(e) => setForm({ ...form, wali_kelas_id: e.target.value })}>
                  <option value="">— Belum ditentukan —</option>
                  {guruList.map((g) => <option key={g.id} value={g.id}>{g.nama_lengkap}</option>)}
                </select>
              </div>
              <div>
                <label className="kelas-label">Tahun Ajaran</label>
                <input className="kelas-input" placeholder="Contoh: 2026/2027" value={form.tahun_ajaran} onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="kelas-btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="kelas-btn-primary">{saving && <Loader2 size={16} className="kelas-spin" />} Simpan</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  )
}
