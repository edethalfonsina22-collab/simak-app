import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { ImagePlus, Loader2, X, Trash2, Images, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'

const KATEGORI_LIST = ['Semua', 'Akademik', 'Ekstrakurikuler', 'Perayaan', 'Umum']

// Warna badge kategori per album — senada dengan palet kartu ringkasan di Dasbor,
// supaya tiap kategori punya identitas visual sendiri di grid galeri.
const KATEGORI_BADGE = {
  Akademik: 'bg-blue-600/90',
  Ekstrakurikuler: 'bg-emerald-600/90',
  Perayaan: 'bg-rose-600/90',
  Umum: 'bg-purple-600/90',
}

// Ekstensi yang dianggap video — dipakai untuk menentukan apakah sebuah item
// di galeri harus dirender sebagai <video> atau <img>.
const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'm4v']

function isVideoPath(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase()
  return VIDEO_EXT.includes(ext)
}

// Motif batik (kawung + parang) — sama persis dengan Profil Saya & Dasbor,
// warna garis menyesuaikan latar (emas di atas navy).
function BatikOverlay({ patternId, strokeColor = '#d4af37', opacity = 1, size = 72 }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <g fill="none" stroke={strokeColor} strokeWidth="1.1" opacity={opacity}>
            <ellipse cx={size / 2} cy={size * 0.333} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size / 2} cy={size * 0.667} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size * 0.333} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <ellipse cx={size * 0.667} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <circle cx={size / 2} cy={size / 2} r={size * 0.042} opacity="0.7" />
          </g>
          <path
            d={`M0 ${size} L${size * 0.25} ${size * 0.75} L${size * 0.5} ${size} L${size * 0.75} ${size * 0.75} L${size} ${size}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.35}
          />
          <path
            d={`M0 0 L${size * 0.25} ${size * 0.25} L0 ${size * 0.5}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.3}
          />
          <circle cx={size * 0.11} cy={size * 0.11} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.89} cy={size * 0.22} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.22} cy={size * 0.89} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

export default function Galeri() {
  const { profil, isAdmin } = useAuth()
  const [kegiatan, setKegiatan] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openAlbum, setOpenAlbum] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [lightboxIndex, setLightboxIndex] = useState(null) // index item yang lagi dibuka, null = tertutup

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

      // contentType eksplisit supaya video (mp4/webm/dll) disajikan browser
      // dengan mime type yang benar, bukan default octet-stream.
      const { error: uploadError } = await supabase.storage
        .from('galeri-foto')
        .upload(path, file, { contentType: file.type || undefined })
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
    <Layout title="Galeri Kegiatan" subtitle="Dokumentasi foto & video kegiatan sekolah">
      {/* Keyframe animasi muncul bertahap, senada dengan Dasbor & Login */}
      <style>{`
        @keyframes galeriFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .galeri-fade-in {
          animation: galeriFadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      {/* Banner navy — sama seperti Dasbor & Profil Saya, dengan corak batik emas */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-6 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <BatikOverlay patternId="batikGaleriBanner" strokeColor="#d4af37" />

        <div className="relative flex items-center justify-between mb-4 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 text-white flex items-center justify-center shrink-0">
              <Images size={20} />
            </div>
            <div>
              <p className="font-display font-semibold text-lg text-white">
                {kegiatanTerfilter.length} Album Kegiatan
              </p>
              <p className="text-sm text-blue-200/70">Dokumentasi momen sekolah dari waktu ke waktu.</p>
            </div>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium hover:brightness-95 transition shadow"
          >
            <ImagePlus size={16} />
            Album Baru
          </button>
        </div>

        {/* Filter kategori */}
        <div className="relative flex flex-wrap gap-2 mb-1">
          {KATEGORI_LIST.map((kat) => (
            <button
              key={kat}
              onClick={() => setFilterKategori(kat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterKategori === kat
                  ? 'bg-brass-400 text-ink-950'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>

        {showForm && (
          <form onSubmit={handleUpload} className="relative bg-white rounded-xl p-6 mt-5 space-y-3 shadow">
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
              accept="image/*,video/*"
              multiple
              onChange={(e) => setForm({ ...form, files: Array.from(e.target.files || []) })}
              required
            />
            {form.files.length > 0 && (
              <p className="text-xs text-slate-500">{form.files.length} file dipilih (foto/video)</p>
            )}
            <button
              type="submit"
              disabled={uploading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium hover:brightness-95 disabled:opacity-50 transition"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              {uploading ? 'Mengunggah...' : 'Upload Album'}
            </button>
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-700/50">Memuat...</p>
      ) : kegiatanTerfilter.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink-700/50">Belum ada album kegiatan di kategori ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {kegiatanTerfilter.map((item, i) => {
            const foto = item.galeri_foto || []
            const cover = foto[0]
            const coverIsVideo = cover && isVideoPath(cover.foto_path)
            return (
              <button
                key={item.id}
                onClick={() => setOpenAlbum(item)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="galeri-fade-in opacity-0 relative overflow-hidden bg-white rounded-2xl text-left shadow-sm hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 border border-ink-900/[0.06]"
              >
                <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400 z-10" />
                <div className="aspect-video bg-slate-100 relative">
                  {cover ? (
                    coverIsVideo ? (
                      <>
                        <video
                          src={fotoUrl(cover.foto_path)}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <PlayCircle size={36} className="text-white drop-shadow" />
                        </div>
                      </>
                    ) : (
                      <img src={fotoUrl(cover.foto_path)} alt={item.judul} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Images size={28} />
                    </div>
                  )}
                  <span className={`absolute top-3 left-2 text-[11px] font-medium px-2 py-0.5 rounded-md text-white ${KATEGORI_BADGE[item.kategori] || KATEGORI_BADGE.Umum}`}>
                    {item.kategori || 'Umum'}
                  </span>
                  <span className="absolute bottom-2 right-2 text-[11px] font-medium px-2 py-0.5 rounded-md bg-ink-950/80 text-white">
                    {foto.length} media
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

      {/* Modal Album (grid foto/video) */}
      {openAlbum && (
        <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center p-4 z-50" onClick={() => setOpenAlbum(null)}>
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative p-5 border-b border-slate-200 flex items-start justify-between sticky top-0 bg-white overflow-hidden">
              <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
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
              {(openAlbum.galeri_foto || []).map((f, idx) => {
                const video = isVideoPath(f.foto_path)
                return (
                  <button key={f.id} onClick={() => openLightboxAt(idx)} className="relative block">
                    {video ? (
                      <>
                        <video
                          src={fotoUrl(f.foto_path)}
                          className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-zoom-in"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <PlayCircle size={28} className="text-white drop-shadow" />
                        </span>
                      </>
                    ) : (
                      <img
                        src={fotoUrl(f.foto_path)}
                        alt=""
                        className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-zoom-in"
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox foto/video (klik item, geser next/prev) */}
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

          {isVideoPath(openAlbum.galeri_foto[lightboxIndex].foto_path) ? (
            <video
              src={fotoUrl(openAlbum.galeri_foto[lightboxIndex].foto_path)}
              className="max-w-[90vw] max-h-[85vh] rounded-lg"
              controls
              autoPlay
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <img
              src={fotoUrl(openAlbum.galeri_foto[lightboxIndex].foto_path)}
              alt=""
              className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}

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
