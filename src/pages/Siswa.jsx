import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import BulkImportModal from '../components/BulkImportModal'
import { Plus, UploadCloud, Pencil, Trash2, Search, X, Loader2 } from 'lucide-react'

const emptyForm = {
  nis: '',
  nisn: '',
  nama_lengkap: '',
  jenis_kelamin: 'L',
  tempat_lahir: '',
  tanggal_lahir: '',
  alamat: '',
  nama_orang_tua: '',
  no_hp_orang_tua: '',
  kelas_id: '',
  status: 'aktif',
}

export default function Siswa() {
  const [data, setData] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

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

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...emptyForm, ...row, kelas_id: row.kelas_id || '' })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, kelas_id: form.kelas_id || null }
    delete payload.kelas

    const { error } = editingId
      ? await supabase.from('siswa').update(payload).eq('id', editingId)
      : await supabase.from('siswa').insert(payload)

    setSaving(false)
    if (!error) {
      setShowForm(false)
      loadData()
    } else {
      alert('Gagal menyimpan: ' + error.message)
    }
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data siswa ini? Tindakan ini tidak bisa dibatalkan.')) return
    const { error } = await supabase.from('siswa').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const filtered = data.filter((s) =>
    `${s.nama_lengkap} ${s.nis} ${s.nisn}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout
      title="Data Siswa"
      subtitle={`${data.length} siswa terdaftar`}
      actions={
        <>
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <UploadCloud size={16} /> Impor Massal
          </button>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} /> Tambah Siswa
          </button>
        </>
      }
    >
      {/* Kartu pencarian — background biru tua (navy), sama seperti kartu identitas di Profil Saya */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-4 flex items-center gap-4 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative w-10 h-10 rounded-full bg-white/10 ring-2 ring-white/20 text-white flex items-center justify-center shrink-0">
          <Search size={18} />
        </div>
        <div className="relative max-w-sm w-full">
          <input
            className="input-field w-full"
            placeholder="Cari nama, NIS, atau NISN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card relative overflow-hidden overflow-x-auto">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama Lengkap</th>
              <th>NIS</th>
              <th>NISN</th>
              <th>Kelas</th>
              <th>Jenis Kelamin</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-ink-700/50">Belum ada data siswa.</td></tr>
            )}
            {filtered.map((s) => (
              <tr key={s.id}>
                <td className="font-medium">{s.nama_lengkap}</td>
                <td className="font-mono text-xs">{s.nis}</td>
                <td className="font-mono text-xs">{s.nisn}</td>
                <td>{s.kelas?.nama_kelas || '—'}</td>
                <td>{s.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</td>
                <td>
                  <span className={`badge ${s.status === 'aktif' ? 'bg-sage-500/15 text-sage-500' : 'bg-ink-900/10 text-ink-700'}`}>
                    {s.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(s)} className="p-2 hover:bg-ink-900/5 rounded-lg text-ink-700/60">
                      <Pencil size={15} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600/70">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900">
              <X size={20} />
            </button>
            <h2 className="font-display text-xl font-semibold mb-4">
              {editingId ? 'Ubah Data Siswa' : 'Tambah Siswa'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Lengkap" full>
                <input required className="input-field" value={form.nama_lengkap}
                  onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} />
              </Field>
              <Field label="NIS">
                <input className="input-field" value={form.nis}
                  onChange={(e) => setForm({ ...form, nis: e.target.value })} />
              </Field>
              <Field label="NISN">
                <input className="input-field" value={form.nisn}
                  onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
              </Field>
              <Field label="Jenis Kelamin">
                <select className="input-field" value={form.jenis_kelamin}
                  onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Kelas">
                <select className="input-field" value={form.kelas_id}
                  onChange={(e) => setForm({ ...form, kelas_id: e.target.value })}>
                  <option value="">— Belum ada kelas —</option>
                  {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </Field>
              <Field label="Tempat Lahir">
                <input className="input-field" value={form.tempat_lahir}
                  onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} />
              </Field>
              <Field label="Tanggal Lahir">
                <input type="date" className="input-field" value={form.tanggal_lahir || ''}
                  onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} />
              </Field>
              <Field label="Nama Orang Tua/Wali" full>
                <input className="input-field" value={form.nama_orang_tua}
                  onChange={(e) => setForm({ ...form, nama_orang_tua: e.target.value })} />
              </Field>
              <Field label="No. HP Orang Tua">
                <input className="input-field" value={form.no_hp_orang_tua}
                  onChange={(e) => setForm({ ...form, no_hp_orang_tua: e.target.value })} />
              </Field>
              <Field label="Status">
                <select className="input-field" value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="lulus">Lulus</option>
                  <option value="pindah">Pindah</option>
                </select>
              </Field>
              <Field label="Alamat" full>
                <textarea className="input-field" rows={2} value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })} />
              </Field>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />}
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      <BulkImportModal
        open={showImport}
        onClose={() => { setShowImport(false); loadData() }}
        title="Impor Data Siswa"
        templateHeaders={['nama_lengkap', 'nis', 'nisn', 'jenis_kelamin(L/P)', 'tempat_lahir', 'tanggal_lahir(YYYY-MM-DD)', 'nama_orang_tua', 'no_hp_orang_tua', 'alamat']}
        mapRow={(row) => {
          if (!row.nama_lengkap) return null
          return {
            nama_lengkap: String(row.nama_lengkap).trim(),
            nis: String(row.nis || '').trim(),
            nisn: String(row.nisn || '').trim(),
            jenis_kelamin: String(row['jenis_kelamin(L/P)'] || row.jenis_kelamin || 'L').trim().toUpperCase(),
            tempat_lahir: String(row.tempat_lahir || '').trim(),
            tanggal_lahir: row['tanggal_lahir(YYYY-MM-DD)'] || row.tanggal_lahir || null,
            nama_orang_tua: String(row.nama_orang_tua || '').trim(),
            no_hp_orang_tua: String(row.no_hp_orang_tua || '').trim(),
            alamat: String(row.alamat || '').trim(),
            status: 'aktif',
          }
        }}
        onImport={async (rows) => {
          const { error } = await supabase.from('siswa').insert(rows)
          if (error) throw error
          return { count: rows.length }
        }}
      />
    </Layout>
  )
}

function Field({ label, children, full }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="eyebrow mb-1.5 block">{label}</label>
      {children}
    </div>
  )
}
