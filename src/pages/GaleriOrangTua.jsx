import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Images, X, ChevronLeft, ChevronRight, PlayCircle } from 'lucide-react'

// ============================================================
// Halaman khusus ORANG TUA — read-only sepenuhnya. Beda dengan
// Galeri.jsx (punya Guru/Admin): tidak ada tombol Album Baru,
// tidak ada upload, tidak ada hapus, tidak ada Bagikan ke Pesan.
// sekolahId diambil langsung dari useAuth() (profil.sekolah_id),
// sama seperti Galeri.jsx asli — PASTIKAN akun orang tua Anda
// juga punya baris `profil` dengan sekolah_id terisi, kalau tidak
// filter ini tidak akan menampilkan apa-apa.
// ============================================================

const KATEGORI_LIST = ['Semua', 'Akademik', 'Ekstrakurikuler', 'Perayaan', 'Umum']

const KATEGORI_BADGE = {
  Akademik: 'bg-blue-600/90',
  Ekstrakurikuler: 'bg-emerald-600/90',
  Perayaan: 'bg-rose-600/90',
  Umum: 'bg-purple-600/90',
}

const VIDEO_EXT = ['mp4', 'webm', 'ogg', 'mov', 'mkv', 'avi', 'm4v']

function isVideoPath(path) {
  const ext = (path || '').split('.').pop()?.toLowerCase()
  return VIDEO_EXT.includes(ext)
}

export default function GaleriOrangTua() {
  const { sekolahId } = useAuth()

  const [kegiatan, setKegiatan] = useState([])
  const [loading, setLoading] = useState(true)
  const [openAlbum, setOpenAlbum] = useState(null)
  const [filterKategori, setFilterKategori] = useState('Semua')
  const [lightboxIndex, setLightboxIndex] = useState(null)

  async function load() {
    setLoading(true)
    let query = supabase
      .from('galeri_kegiatan')
      .select('*, guru(nama_lengkap), galeri_foto(id, foto_path)')
      .order('dibuat_pada', { ascending: false })
    if (sekolahId) {
      query = query.eq('sekolah_id', sekolahId)
    }
    const { data: kegiatanRows } = await query
    setKegiatan(kegiatanRows || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sekolahId])

  function fotoUrl(path) {
    return supabase.storage.from('galeri-foto').getPublicUrl(path).data.publicUrl
  }

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
      <div className="relative overflow-hidden rounded-xl p-6 mb-6 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative flex items-center gap-3 mb-4">
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

        <div className="relative flex flex-wrap gap-2">
          {KATEGORI_LIST.map((kat) => (
            <button
              key={kat}
              onClick={() => setFilterKategori(kat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterKategori === kat ? 'bg-brass-400 text-ink-950' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {kat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-ink-700/50">Memuat...</p>
      ) : kegiatanTerfilter.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink-700/50">Belum ada album kegiatan di kategori ini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {kegiatanTerfilter.map((item) => {
            const foto = item.galeri_foto || []
            const cover = foto[0]
            const coverIsVideo = cover && isVideoPath(cover.foto_path)
            return (
              <button
                key={item.id}
                onClick={() => setOpenAlbum(item)}
                className="relative overflow-hidden bg-white rounded-2xl text-left shadow-sm hover:shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 border border-ink-900/[0.06]"
              >
                <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400 z-10" />
                <div className="aspect-video bg-slate-100 relative">
                  {cover ? (
                    coverIsVideo ? (
                      <>
                        <video src={fotoUrl(cover.foto_path)} className="w-full h-full object-cover" muted playsInline preload="metadata" />
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
              <button onClick={() => setOpenAlbum(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0">
                <X size={16} />
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(openAlbum.galeri_foto || []).map((f, idx) => {
                const video = isVideoPath(f.foto_path)
                return (
                  <button key={f.id} onClick={() => openLightboxAt(idx)} className="relative block">
                    {video ? (
                      <>
                        <video src={fotoUrl(f.foto_path)} className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-zoom-in" muted playsInline preload="metadata" />
                        <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <PlayCircle size={28} className="text-white drop-shadow" />
                        </span>
                      </>
                    ) : (
                      <img src={fotoUrl(f.foto_path)} alt="" className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity cursor-zoom-in" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {openAlbum && lightboxIndex !== null && (
        <div className="fixed inset-0 bg-slate-900/90 flex items-center justify-center z-[60]" onClick={closeLightbox}>
          <button onClick={closeLightbox} className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20">
            <X size={20} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); prevFoto() }} className="absolute left-2 sm:left-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20">
            <ChevronLeft size={24} />
          </button>

          {isVideoPath(openAlbum.galeri_foto[lightboxIndex].foto_path) ? (
            <video src={fotoUrl(openAlbum.galeri_foto[lightboxIndex].foto_path)} className="max-w-[90vw] max-h-[85vh] rounded-lg" controls autoPlay onClick={(e) => e.stopPropagation()} />
          ) : (
            <img src={fotoUrl(openAlbum.galeri_foto[lightboxIndex].foto_path)} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
          )}

          <button onClick={(e) => { e.stopPropagation(); nextFoto() }} className="absolute right-2 sm:right-6 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20">
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
