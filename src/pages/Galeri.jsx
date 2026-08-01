import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { ImagePlus, Loader2, X, Trash2, Images } from 'lucide-react'

export default function Galeri() {
  const { profil, isAdmin } = useAuth()
  const [kegiatan, setKegiatan] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openAlbum, setOpenAlbum] = useState(null)
  const [showForm, setShowForm] = useState(false)

  const [form, setForm] = useState({ judul: '', deskripsi: '', files: [] })

  async function load() {
    setLoading(true)
    const { data: kegiatanRows } = await supabase
      .from('galeri_kegiatan')
      .select('*, guru(nama_lengkap), galeri_foto(id, foto_path)')
      .order('dibuat_pada', { ascending: false })
    setKegiatan(kegiatanRows || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function fotoUrl(path) {
    return supabase.storage.from('galeri-foto').getPublicUrl(path).data.publicUrl
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.judul || form.files.length === 0) return
    setUploading(true)

    const { data: newKegiatan, error: insertError } = await supabase
      .from('galeri_kegiatan')
      .insert({ judul: form.judul, deskripsi: form.deskripsi, guru_id: profil.guru_id })
      .select()
      .single()

    if (insertError) {
      alert('Gagal membuat album: ' + insertError.message)
      setUploading(false)
      return
    }

    for (let i = 0; i < form.files.length; i++) {
      const file = form.files[i]
      const ext = file.name.split('.').pop()
      const path = `${newKegiatan.id}/${Date.now()}-${i}.${ext}`

      const { error: uploadError } = await supabase.storage.from('galeri-foto').upload(path, file)
      if (uploadError) continue

      await supabase.from('galeri_foto').insert({ kegiatan_id: newKegiatan.id, foto_path: path })
    }

    setForm({ judul: '', deskripsi: '', files: [] })
    setShowForm(false)
    setUploading(false)
    await load()
  }

  async function handleDeleteKegiatan(item) {
    if (!confirm(`Hapus album "${item.judul}" beserta semua fotonya?`)) return

    const paths = (item.galeri_foto || []).map((f) => f.foto_path)
    if (paths.length > 0) {
      await supabase.storage.from('galeri-foto').remove(paths)
    }
    const { error } = await supabase.from('galeri_kegiatan').delete().eq('id', item.id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    setOpenAlbum(null)
    await load()
  }

  const canDelete = (item) => isAdmin || item.guru_id === profil?.guru_id

  return (
    <Layout title="Galeri Kegiatan" subtitle="Dokumentasi foto kegiatan sekolah">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-700/50">{kegiatan.length} album kegiatan</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium"
        >
          <ImagePlus size={16} />
          Album Baru
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="card p-6 mb-6 space-y-3">
          <input
            className="input w-full"
            placeholder="Judul kegiatan (mis. Perayaan Hari Kemerdekaan)"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            required
          />
          <textarea
            className="input w-full"
            rows={2}
            placeholder="Deskripsi singkat (opsional)"
            value={form.deskripsi}
            onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
          />
          <input
            className="input w-full"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setForm({ ...form, files: Array.from(e.target.files || []) })}
            required
          />
          {form.files.length > 0 && (
            <p className="text-xs text-ink-700/50">{form.files.length} foto dipilih</p>
          )}
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium disabled:opacity-50"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
            {uploading ? 'Mengunggah...' : 'Upload Album'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-700/50">Memuat...</p>
      ) : kegiatan.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink-700/50">Belum ada album kegiatan. Klik "Album Baru" untuk mulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {kegiatan.map((item) => {
            const foto = item.galeri_foto || []
            return (
              <button
                key={item.id}
                onClick={() => setOpenAlbum(item)}
                className="card overflow-hidden text-left hover:shadow-sm transition-shadow"
              >
                <div className="aspect-video bg-ink-900/[0.06] relative">
                  {foto[0] ? (
                    <img src={fotoUrl(foto[0].foto_path)} alt={item.judul} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-ink-700/30">
                      <Images size={28} />
                    </div>
                  )}
                  <span className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-950/70 text-paper">
                    {foto.length} foto
                  </span>
                </div>
                <div className="p-4">
                  <p className="font-medium text-sm text-ink-950 truncate">{item.judul}</p>
                  <p className="text-xs text-ink-700/50 mt-0.5">
                    {item.guru?.nama_lengkap || 'Admin'} · {new Date(item.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {openAlbum && (
        <div className="fixed inset-0 bg-ink-950/70 flex items-center justify-center p-4 z-50" onClick={() => setOpenAlbum(null)}>
          <div className="bg-paper rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-ink-900/10 flex items-start justify-between sticky top-0 bg-paper">
              <div>
                <p className="font-display font-semibold text-lg text-ink-950">{openAlbum.judul}</p>
                {openAlbum.deskripsi && <p className="text-sm text-ink-700/60 mt-1">{openAlbum.deskripsi}</p>}
                <p className="text-xs text-ink-700/40 mt-1">
                  {openAlbum.guru?.nama_lengkap || 'Admin'} · {new Date(openAlbum.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canDelete(openAlbum) && (
                  <button
                    onClick={() => handleDeleteKegiatan(openAlbum)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
                <button
                  onClick={() => setOpenAlbum(null)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-700 hover:bg-ink-900/[0.05]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(openAlbum.galeri_foto || []).map((f) => (
                <img
                  key={f.id}
                  src={fotoUrl(f.foto_path)}
                  alt=""
                  className="w-full aspect-square object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}
