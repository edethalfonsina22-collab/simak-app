import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { ImagePlus, Loader2, X, Trash2, Images, ChevronLeft, ChevronRight } from 'lucide-react'

const KATEGORI_LIST = ['Semua', 'Akademik', 'Ekstrakurikuler', 'Perayaan', 'Umum']

export default function Galeri() {
  const { profil, isAdmin } = useAuth()
  const [kegiatan, setKegiatan] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openAlbum, setOpenAlbum] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [lightboxIndex, setLightboxIndex] = useState(null) // index foto yang lagi dibuka, null = tertutup

  const [form, setForm] = useState({ judul: '', deskripsi: '', kategori: 'Umum', files: [] })

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
      .insert({ judul: form.judul, deskripsi: form.deskripsi, kategori: form.kategori, guru_id: profil.guru_id })
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

    setForm({ judul: '', deskripsi: '', kategori: 'Umum', files: [] })
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

  const kegiatanTerfilter =
    filterKategori === 'Semua' ? kegiatan : kegiatan.filter((k) => (k.kategori || 'Umum') === filterKategori)

  function openLightboxAt(index) {
    setLightboxIndex(index)
  }

  function closeLightbox() {
    setLightboxIndex(null)
  }

  function nextFoto() {
    const total = (openAlbum?.galeri_foto || []).length
    setLightboxIndex((i) => (i + 1) % total)
  }

  function prevFoto() {
    const total = (openAlbum?.galeri_foto || []).length
    setLightboxIndex((i) => (i - 1 + total) % total)
  }

  // Navigasi keyboard saat lightbox terbuka
  useEffect(() => {
    if (lightboxIndex === null) return
    function handleKey(e) {
      if (e.key === 'ArrowRight') nextFoto()
      if (e.key === 'ArrowLeft') prevFoto()
      if (e.key === 'Escape') closeLightbox()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxIndex, openAlbum])

  return (
    <Layout title="Galeri Kegiatan" subtitle="Dokumentasi foto kegiatan sekolah">
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-5 -m-1 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-white/70">{kegiatanTerfilter.length} album kegiatan</p>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors shadow"
          >
            <ImagePlus size={16} />
            Album Baru
          </button>
        </div>

        {/* Filter kategori */}
        <div className="flex flex-wrap gap-2 mb-6">
          {KATEGORI_LIST.map((kat) => (
            <button
              key={kat}
              onClick={() => setFilterKategori(kat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterKategori === kat
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>

        {showForm && (
          <form onSubmit={handleUpload} className="bg-white rounded-xl p-6 mb-6 space-y-3 shadow">
            <input
              className="input w-full border-slate-200"
              placeholder="Judul kegiatan (mis. Perayaan Hari Kemerdekaan)"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              required
            />
            <select
              className="input w-full border-slate-200"
              value={form.kategori}
              onChange={(e) => setForm({ ...form, kategori: e.target.value })}
            >
              {KATEGORI_LIST.filter((k) => k !== 'Semua').map((kat) => (
                <option key={kat} value={kat}>{kat}</option>
              ))}
            </select>
            <textarea
              className="input w-full border-slate-200"
              rows={2}
              placeholder="Deskripsi singkat (opsional)"
              value={form.deskripsi}
              onChange={(e) => setForm({ ...form, deskripsi: e.target.value })}
            />
            <input
              className="input w-full border-slate-200"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setForm({ ...form, files: Array.from(e.target.files || []) })}
              required
            />
            {form.files.length > 0 && (
              <p className="text-xs text-slate-500">{form.files.length} foto dipilih</p>
            )}
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {uploading ? 'Mengunggah...' : 'Upload Album'}
            </button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-white/70">Memuat...</p>
        ) : kegiatanTerfilter.length === 0 ? (
          <div className="bg-white rounded-xl p-6 shadow">
            <p className="text-sm text-slate-500">Belum ada album kegiatan di kategori ini.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {kegiatanTerfilter.map((item) => {
              const foto = item.galeri_foto || []
              return (
                <button
                  key={item.id}
                  onClick={() => setOpenAlbum(item)}
                  className="bg-white rounded-xl overflow-hidden text-left hover:shadow-lg transition-shadow border border-slate-100"
                >
                  <div className="aspect-video bg-slate-100 relative">
                    {foto[0] ? (
                      <img src={fotoUrl(foto[0].foto_path)} alt={item.judul} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-300">
                        <Images size={28} />
                      </div>
                    )}
                    <span className="absolute top-2 left-2 text-[11px] font-medium px-2 py-0.5 rounded-md bg-indigo-600/90 text-white">
                      {item.kategori || 'Umum'}
                    </span>
                    <span className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-600/90 text-white">
                      {foto.length} foto
                    </span>
                  </div>
                  <div className="p-4">
                    <p className="font-medium text-sm text-slate-900 truncate">{item.judul}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.guru?.nama_lengkap || 'Admin'} · {new Date(item.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal Album (grid foto) */}
      {openAlbum && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50" onClick={() => setOpenAlbum(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-200 flex items-start justify-between sticky top-0 bg-white">
              <div>
                <p className="font-display font-semibold text-lg text-slate-900">{openAlbum.judul}</p>
                {openAlbum.deskripsi && <p className="text-sm text-slate-600 mt-1">{openAlbum.deskripsi}</p>}
                <p className="text-xs text-slate-400 mt-1">
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(openAlbum.galeri_foto || []).map((f, idx) => (
                <button key={f.id} onClick={() => openLightboxAt(idx)} className="block">
                  <img
                    src={fotoUrl(f.foto_path)}
                    alt=""
                    className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-zoom-in"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox foto (klik foto, geser next/prev) */}
      {openAlbum && lightboxIndex !== null && (
        <div
          className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[60]"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
          >
            <X size={20} />
          </button>

          <button
            onClick={(e) => { e.stopPropagation(); prevFoto() }}
            className="absolute left-2 sm:left-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
          >
            <ChevronLeft size={24} />
          </button>

          <img
            src={fotoUrl(openAlbum.galeri_foto[lightboxIndex].foto_path)}
            alt=""
            className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={(e) => { e.stopPropagation(); nextFoto() }}
            className="absolute right-2 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20"
          >
            <ChevronRight size={24} />
          </button>

          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/70">
            {lightboxIndex + 1} / {openAlbum.galeri_foto.length}
          </span>
        </div>
      )}
    </Layout>
  )
}
