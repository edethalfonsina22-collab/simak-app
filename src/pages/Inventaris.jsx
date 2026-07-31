import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { eksporExcel } from '../lib/exportUtils'
import { Plus, Search, Pencil, Trash2, X, Loader2, FileSpreadsheet } from 'lucide-react'

const emptyForm = {
  nama_barang: '',
  kategori: '',
  jumlah: 1,
  kondisi: 'baik',
  lokasi: '',
  tanggal_masuk: '',
  catatan: '',
}

const kondisiLabel = {
  baik: 'Baik',
  rusak_ringan: 'Rusak Ringan',
  rusak_berat: 'Rusak Berat',
}

export default function Inventaris() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  async function loadData() {
    setLoading(true)
    const { data: rows } = await supabase.from('inventaris').select('*').order('nama_barang')
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
    setForm({ ...emptyForm, ...row })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, jumlah: Number(form.jumlah) || 1 }
    const { error } = editingId
      ? await supabase.from('inventaris').update(payload).eq('id', editingId)
      : await supabase.from('inventaris').insert(payload)
    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data inventaris ini?')) return
    const { error } = await supabase.from('inventaris').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  function handleExport() {
    eksporExcel(
      filtered.map((d) => ({
        'Nama Barang': d.nama_barang,
        Kategori: d.kategori,
        Jumlah: d.jumlah,
        Kondisi: kondisiLabel[d.kondisi] || d.kondisi,
        Lokasi: d.lokasi,
        'Tanggal Masuk': d.tanggal_masuk,
        Catatan: d.catatan,
      })),
      'inventaris-sekolah',
      'Inventaris'
    )
  }

  const filtered = data.filter((d) =>
    `${d.nama_barang} ${d.kategori} ${d.lokasi}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout
      title="Inventaris"
      subtitle={`${data.length} jenis barang tercatat`}
      actions={
        <>
          <button className="btn-secondary" onClick={handleExport}>
            <FileSpreadsheet size={16} /> Ekspor Excel
          </button>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} /> Tambah Barang
          </button>
        </>
      }
    >
      <div className="card p-4 mb-4">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            className="input-field pl-9"
            placeholder="Cari nama barang, kategori, atau lokasi..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama Barang</th>
              <th>Kategori</th>
              <th>Jumlah</th>
              <th>Kondisi</th>
              <th>Lokasi</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">Belum ada data.</td></tr>
            )}
            {filtered.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.nama_barang}</td>
                <td>{d.kategori || '-'}</td>
                <td>{d.jumlah}</td>
                <td>
                  <span
                    className={`text-xs px-2 py-1 rounded-full font-medium ${
                      d.kondisi === 'baik'
                        ? 'bg-sage-500/10 text-sage-500'
                        : d.kondisi === 'rusak_ringan'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {kondisiLabel[d.kondisi] || d.kondisi}
                  </span>
                </td>
                <td>{d.lokasi || '-'}</td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button className="icon-btn" onClick={() => openEdit(d)}><Pencil size={15} /></button>
                    <button className="icon-btn text-red-600" onClick={() => handleDelete(d.id)}><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">
                {editingId ? 'Ubah Barang' : 'Tambah Barang'}
              </h2>
              <button className="icon-btn" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label-field">Nama Barang *</label>
                <input
                  required
                  className="input-field"
                  value={form.nama_barang}
                  onChange={(e) => setForm({ ...form, nama_barang: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Kategori</label>
                  <input
                    className="input-field"
                    placeholder="Elektronik, Furnitur, dll"
                    value={form.kategori}
                    onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Jumlah</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.jumlah}
                    onChange={(e) => setForm({ ...form, jumlah: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Kondisi</label>
                  <select
                    className="input-field"
                    value={form.kondisi}
                    onChange={(e) => setForm({ ...form, kondisi: e.target.value })}
                  >
                    <option value="baik">Baik</option>
                    <option value="rusak_ringan">Rusak Ringan</option>
                    <option value="rusak_berat">Rusak Berat</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Tanggal Masuk</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.tanggal_masuk}
                    onChange={(e) => setForm({ ...form, tanggal_masuk: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label-field">Lokasi</label>
                <input
                  className="input-field"
                  placeholder="Ruang Guru, Lab Komputer, dll"
                  value={form.lokasi}
                  onChange={(e) => setForm({ ...form, lokasi: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Catatan</label>
                <textarea
                  className="input-field"
                  rows={2}
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}
