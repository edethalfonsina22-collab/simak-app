import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { useAuth } from '../lib/AuthContext'
import { Plus, Pencil, Trash2, X, Loader2, MapPin, User, CalendarDays } from 'lucide-react'

const emptyForm = {
  judul: '',
  deskripsi: '',
  tanggal_mulai: '',
  tanggal_selesai: '',
  lokasi: '',
  penanggung_jawab: '',
}

function formatTanggal(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function Agenda() {
  const { isAdmin } = useAuth()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data: rows } = await supabase.from('agenda').select('*').order('tanggal_mulai')
    setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({
      ...emptyForm,
      ...row,
      tanggal_mulai: row.tanggal_mulai ? row.tanggal_mulai.slice(0, 16) : '',
      tanggal_selesai: row.tanggal_selesai ? row.tanggal_selesai.slice(0, 16) : '',
    })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, tanggal_selesai: form.tanggal_selesai || null }
    const { error } = editingId
      ? await supabase.from('agenda').update(payload).eq('id', editingId)
      : await supabase.from('agenda').insert(payload)
    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus agenda ini?')) return
    const { error } = await supabase.from('agenda').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const sekarang = new Date()
  const akanDatang = data.filter((d) => new Date(d.tanggal_mulai) >= sekarang)
  const sudahLewat = data.filter((d) => new Date(d.tanggal_mulai) < sekarang)

  function KartuAgenda({ d }) {
    return (
      <div className="bg-white rounded-xl border border-[#6b0f1a]/10 shadow-sm p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-[#3b0a0a]">{d.judul}</p>
          <p className="text-sm text-[#6b0f1a]/60 mt-0.5 flex items-center gap-1.5">
            <CalendarDays size={14} /> {formatTanggal(d.tanggal_mulai)}
            {d.tanggal_selesai && ` — ${formatTanggal(d.tanggal_selesai)}`}
          </p>
          {d.lokasi && (
            <p className="text-sm text-[#6b0f1a]/60 mt-0.5 flex items-center gap-1.5">
              <MapPin size={14} /> {d.lokasi}
            </p>
          )}
          {d.penanggung_jawab && (
            <p className="text-sm text-[#6b0f1a]/60 mt-0.5 flex items-center gap-1.5">
              <User size={14} /> {d.penanggung_jawab}
            </p>
          )}
          {d.deskripsi && <p className="text-sm text-[#6b0f1a]/70 mt-2">{d.deskripsi}</p>}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1 shrink-0">
            <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#6b0f1a]" onClick={() => openEdit(d)}><Pencil size={15} /></button>
            <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#8f1f22]" onClick={() => handleDelete(d.id)}><Trash2 size={15} /></button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Layout
      title="Agenda Sekolah"
      subtitle={`${data.length} kegiatan tercatat`}
      actions={isAdmin && (
        <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors shadow-sm shadow-[#6b0f1a]/30" onClick={openAdd}>
          <Plus size={16} /> Tambah Kegiatan
        </button>
      )}
    >
      <div className="min-h-screen bg-gradient-to-b from-[#fdf3f1] to-[#f7e6e3] -m-4 p-4 rounded-xl">
      {loading && <p className="text-center py-8 text-[#6b0f1a]/50 text-sm">Memuat data...</p>}

      {!loading && (
        <div className="space-y-6">
          <div>
            <h3 className="font-display font-semibold text-[#3b0a0a] mb-3 flex items-center gap-2">
              <span className="w-1.5 h-5 rounded-full bg-[#d4a017]"></span>
              Akan Datang
            </h3>
            <div className="space-y-3">
              {akanDatang.length === 0 && (
                <p className="text-sm text-[#6b0f1a]/50">Belum ada kegiatan mendatang.</p>
              )}
              {akanDatang.map((d) => <KartuAgenda key={d.id} d={d} />)}
            </div>
          </div>

          {sudahLewat.length > 0 && (
            <div>
              <h3 className="font-display font-semibold text-[#3b0a0a] mb-3 opacity-60">Sudah Berlalu</h3>
              <div className="space-y-3 opacity-60">
                {sudahLewat.reverse().map((d) => <KartuAgenda key={d.id} d={d} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-[#3b0a0a]/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 border-t-4 border-[#6b0f1a]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-[#3b0a0a]">
                {editingId ? 'Ubah Kegiatan' : 'Tambah Kegiatan'}
              </h2>
              <button className="p-1.5 rounded-md hover:bg-[#6b0f1a]/10 text-[#6b0f1a]" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Judul Kegiatan *</label>
                <input
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                  value={form.judul}
                  onChange={(e) => setForm({ ...form, judul: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Mulai *</label>
                  <input
                    required
                    type="datetime-local"
                    className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                    value={form.tanggal_mulai}
                    onChange={(e) => setForm({ ...form, tanggal_mulai: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Selesai (opsional)</label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                    value={form.tanggal_selesai}
                    onChange={(e) => setForm({ ...form, tanggal_selesai: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Lokasi</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                  value={form.lokasi}
                  onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Penanggung Jawab</label>
                <input
                  className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                  value={form.penanggung_jawab}
                  onChange={(e) => setForm({ ...form, penanggung_jawab: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#6b0f1a]/70 mb-1">Deskripsi</label>
                <textarea
                  className="w-full px-3 py-2 rounded-lg border border-[#6b0f1a]/15 focus:border-[#6b0f1a] focus:ring-2 focus:ring-[#6b0f1a]/20 outline-none transition-colors"
                  rows={3}
                  value={form.deskripsi}
                  onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="px-4 py-2 rounded-lg text-sm font-medium bg-[#f7e6e3] text-[#6b0f1a] hover:bg-[#efd3ce] transition-colors" onClick={() => setShowForm(false)}>
                  Batal
                </button>
                <button type="submit" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-[#6b0f1a] text-white hover:bg-[#7d1420] transition-colors" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </Layout>
  )
}
