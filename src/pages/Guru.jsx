import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import BulkImportModal from '../components/BulkImportModal'
import TeleponLink from '../components/TeleponLink'
import { Plus, UploadCloud, Pencil, Trash2, Search, X, Loader2, GraduationCap } from 'lucide-react'

const emptyForm = {
  nip: '',
  nama_lengkap: '',
  jenis_kelamin: 'L',
  mata_pelajaran: '',
  no_hp: '',
  email: '',
  status: 'aktif',
  tempat_lahir: '',
  tanggal_lahir: '',
}

function formatTanggal(tgl) {
  if (!tgl) return null
  try {
    return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return tgl
  }
}

export default function Guru() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [profilLihat, setProfilLihat] = useState(null) // guru yang sedang dilihat detail profilnya

  async function loadData() {
    setLoading(true)
    const { data: guru } = await supabase.from('guru').select('*').order('nama_lengkap')
    setData(guru || [])
    setLoading(false)
    // Jaga agar modal profil tetap sinkron kalau datanya baru saja diubah
    if (profilLihat) {
      const updated = (guru || []).find((g) => g.id === profilLihat.id)
      if (updated) setProfilLihat(updated)
    }
  }

  useEffect(() => { loadData() }, [])

  // Foto profil guru — memakai bucket & kolom yang sama persis dengan Profil Saya
  function fotoUrl(path) {
    if (!path) return null
    return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
  }

  function openAdd() {
    setForm(emptyForm)
    setEditingId(null)
    setShowForm(true)
  }

  function openEdit(row) {
    setForm({ ...emptyForm, ...row, tanggal_lahir: row.tanggal_lahir ? String(row.tanggal_lahir).slice(0, 10) : '' })
    setEditingId(row.id)
    setShowForm(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = { ...form, tanggal_lahir: form.tanggal_lahir || null }
    const { error } = editingId
      ? await supabase.from('guru').update(payload).eq('id', editingId)
      : await supabase.from('guru').insert(payload)
    setSaving(false)
    if (!error) { setShowForm(false); loadData() }
    else alert('Gagal menyimpan: ' + error.message)
  }

  async function handleDelete(id) {
    if (!confirm('Hapus data guru ini?')) return
    const { error } = await supabase.from('guru').delete().eq('id', id)
    if (!error) loadData()
    else alert('Gagal menghapus: ' + error.message)
  }

  const filtered = data.filter((g) =>
    `${g.nama_lengkap} ${g.nip} ${g.mata_pelajaran}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Layout
      title="Data Guru"
      subtitle={`${data.length} guru & staf terdaftar`}
      actions={
        <>
          <button className="btn-secondary" onClick={() => setShowImport(true)}>
            <UploadCloud size={16} /> Impor Massal
          </button>
          <button className="btn-primary" onClick={openAdd}>
            <Plus size={16} /> Tambah Guru
          </button>
        </>
      }
    >
      {/* Kartu pencarian — aksen garis biru→maroon di tepi atas sebagai identitas modul Guru */}
      <div className="card relative overflow-hidden p-4 mb-4">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-red-900" />
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
            <GraduationCap size={18} />
          </div>
          <div className="relative max-w-sm w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input className="input-field pl-9" placeholder="Cari nama, NIP, atau mapel..."
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr className="border-b-2 border-blue-600/20">
              <th>Nama Lengkap</th>
              <th>NIP</th>
              <th>Mata Pelajaran</th>
              <th>No. HP</th>
              <th>Email</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-ink-700/50">Belum ada data guru.</td></tr>
            )}
            {filtered.map((g) => (
              <tr key={g.id} className="hover:bg-blue-600/[0.03] transition-colors">
                <td className="font-medium">
                  <button
                    type="button"
                    onClick={() => setProfilLihat(g)}
                    className="hover:underline hover:text-blue-700 text-left"
                  >
                    {g.nama_lengkap}
                  </button>
                </td>
                <td className="font-mono text-xs">{g.nip}</td>
                <td>{g.mata_pelajaran}</td>
                <td>
                  <span className="inline-flex items-center gap-1.5">
                    {g.no_hp}
                    <TeleponLink nomor={g.no_hp} />
                  </span>
                </td>
                <td>{g.email}</td>
                <td>
                  <span className={`badge ${g.status === 'aktif' ? 'bg-blue-600/15 text-blue-700' : 'bg-red-900/10 text-red-900'}`}>
                    {g.status}
                  </span>
                </td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button onClick={() => openEdit(g)} className="p-2 hover:bg-blue-600/10 rounded-lg text-blue-700/70"><Pencil size={15} /></button>
                    <button onClick={() => handleDelete(g.id)} className="p-2 hover:bg-red-900/10 rounded-lg text-red-900/70"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit} className="card relative overflow-hidden w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-red-900" />
            <button type="button" onClick={() => setShowForm(false)} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900"><X size={20} /></button>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-700 flex items-center justify-center shrink-0">
                <GraduationCap size={19} />
              </div>
              <h2 className="font-display text-xl font-semibold">{editingId ? 'Ubah Data Guru' : 'Tambah Guru'}</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nama Lengkap" full>
                <input required className="input-field" value={form.nama_lengkap} onChange={(e) => setForm({ ...form, nama_lengkap: e.target.value })} />
              </Field>
              <Field label="NIP">
                <input className="input-field" value={form.nip} onChange={(e) => setForm({ ...form, nip: e.target.value })} />
              </Field>
              <Field label="Jenis Kelamin">
                <select className="input-field" value={form.jenis_kelamin} onChange={(e) => setForm({ ...form, jenis_kelamin: e.target.value })}>
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </Field>
              <Field label="Tempat Lahir">
                <input className="input-field" value={form.tempat_lahir} onChange={(e) => setForm({ ...form, tempat_lahir: e.target.value })} />
              </Field>
              <Field label="Tanggal Lahir">
                <input type="date" className="input-field" value={form.tanggal_lahir} onChange={(e) => setForm({ ...form, tanggal_lahir: e.target.value })} />
              </Field>
              <Field label="Mata Pelajaran" full>
                <input className="input-field" value={form.mata_pelajaran} onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })} />
              </Field>
              <Field label="No. HP">
                <input className="input-field" value={form.no_hp} onChange={(e) => setForm({ ...form, no_hp: e.target.value })} />
              </Field>
              <Field label="Email">
                <input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
              <Field label="Status" full>
                <select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="aktif">Aktif</option>
                  <option value="nonaktif">Nonaktif</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Batal</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving && <Loader2 size={16} className="animate-spin" />} Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Lihat Profil — identitas lengkap + foto besar, dibuka dengan klik nama guru (pola sama seperti di Data Siswa) */}
      {profilLihat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
          <div className="card w-full max-w-md p-0 relative overflow-hidden max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setProfilLihat(null)}
              className="absolute top-4 right-4 z-10 text-white/80 hover:text-white bg-ink-950/20 rounded-full p-1"
            >
              <X size={18} />
            </button>

            <div className="relative bg-gradient-to-br from-blue-900 to-blue-950 pt-8 pb-16 flex flex-col items-center">
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/20 bg-white/10 flex items-center justify-center shrink-0">
                {fotoUrl(profilLihat.foto_profil_path) ? (
                  <img src={fotoUrl(profilLihat.foto_profil_path)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-white/60">{profilLihat.nama_lengkap?.[0]}</span>
                )}
              </div>
              <p className="font-display font-semibold text-lg text-white mt-3 text-center px-6">{profilLihat.nama_lengkap}</p>
              <span className={`badge mt-1.5 ${profilLihat.status === 'aktif' ? 'bg-sage-500/20 text-sage-100' : 'bg-white/10 text-white/70'}`}>
                {profilLihat.status}
              </span>
            </div>

            <div className="px-6 -mt-12 pb-6">
              <div className="card p-4 space-y-3 bg-white shadow-md">
                <ProfilRow label="NIP" value={profilLihat.nip} />
                <ProfilRow label="NUPTK" value={profilLihat.nuptk} />
                <ProfilRow label="Mata Pelajaran" value={profilLihat.mata_pelajaran} />
                <ProfilRow label="Jenis Kelamin" value={profilLihat.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} />
                <ProfilRow label="Pangkat / Golongan" value={profilLihat.pangkat_golongan} />
                <ProfilRow label="Pendidikan Terakhir" value={profilLihat.pendidikan_terakhir} />
                <ProfilRow label="Tempat, Tgl Lahir" value={profilLihat.tempat_lahir || profilLihat.tanggal_lahir ? `${profilLihat.tempat_lahir || '-'}, ${formatTanggal(profilLihat.tanggal_lahir) || '-'}` : null} />
                <ProfilRow label="No. HP" value={profilLihat.no_hp} telepon />
                <ProfilRow label="Email" value={profilLihat.email} />
                <ProfilRow label="Alamat" value={profilLihat.alamat} />
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setProfilLihat(null); openEdit(profilLihat) }}
                  className="btn-secondary flex-1 justify-center"
                >
                  <Pencil size={15} /> Ubah Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <BulkImportModal
        open={showImport}
        onClose={() => { setShowImport(false); loadData() }}
        title="Impor Data Guru"
        templateHeaders={['nama_lengkap', 'nip', 'jenis_kelamin(L/P)', 'mata_pelajaran', 'no_hp', 'email']}
        mapRow={(row) => {
          if (!row.nama_lengkap) return null
          return {
            nama_lengkap: String(row.nama_lengkap).trim(),
            nip: String(row.nip || '').trim(),
            jenis_kelamin: String(row['jenis_kelamin(L/P)'] || row.jenis_kelamin || 'L').trim().toUpperCase(),
            mata_pelajaran: String(row.mata_pelajaran || '').trim(),
            no_hp: String(row.no_hp || '').trim(),
            email: String(row.email || '').trim(),
            status: 'aktif',
          }
        }}
        onImport={async (rows) => {
          const { error } = await supabase.from('guru').insert(rows)
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

function ProfilRow({ label, value, telepon }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-ink-700/50 shrink-0">{label}</span>
      <span className="text-ink-950 font-medium text-right inline-flex items-center gap-1.5">
        {value || '—'}
        {telepon && <TeleponLink nomor={value} />}
      </span>
    </div>
  )
}
