import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { FileUp, Loader2, FileText, Download, Trash2, HardDrive, Eye, X } from 'lucide-react'

const CARD_BORDER = ['border-t-blue-500', 'border-t-emerald-500', 'border-t-purple-500', 'border-t-orange-400']
const ICON_BG = ['bg-blue-500/15 text-blue-600', 'bg-emerald-500/15 text-emerald-600', 'bg-purple-500/15 text-purple-600', 'bg-orange-100 text-orange-500']

const IMAGE_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const OFFICE_EXT = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']

function getExt(fileName = '') {
  return (fileName.split('.').pop() || '').toLowerCase()
}

function isPreviewable(fileName) {
  const ext = getExt(fileName)
  return ext === 'pdf' || IMAGE_EXT.includes(ext) || OFFICE_EXT.includes(ext)
}

// Motif batik (kawung + parang) — sama persis dengan Profil Saya, Dasbor & Galeri,
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

// Modal preview: PDF & gambar dibuka langsung, dokumen Office lewat Google Docs Viewer
function PreviewModal({ url, fileName, onClose }) {
  if (!url) return null
  const ext = getExt(fileName)
  const isImage = IMAGE_EXT.includes(ext)
  const isOffice = OFFICE_EXT.includes(ext)
  const viewerSrc = isOffice ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true` : url

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <div className="relative flex items-center justify-between px-4 py-3 border-b border-slate-200 overflow-hidden">
          <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
          <p className="text-sm font-medium text-slate-900 truncate pr-4">{fileName}</p>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0">
            <X size={18} />
          </button>
        </div>
        {isImage ? (
          <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-50 p-4">
            <img src={url} alt={fileName} className="max-w-full max-h-full object-contain" />
          </div>
        ) : (
          <iframe src={viewerSrc} title={fileName} className="flex-1 w-full" style={{ border: 'none' }} />
        )}
      </div>
    </div>
  )
}

export default function Dokumen() {
  const { profil, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ judul: '', deskripsi: '', file: null })
  const [preview, setPreview] = useState(null) // { url, fileName }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('dokumen')
      .select('*, guru(nama_lengkap)')
      .order('dibuat_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.judul || !form.file) return
    setUploading(true)

    const ext = form.file.name.split('.').pop()
    const path = `${profil.guru_id}/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('dokumen-penting').upload(path, form.file)
    if (uploadError) {
      alert('Gagal upload file: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('dokumen').insert({
      judul: form.judul,
      deskripsi: form.deskripsi,
      file_path: path,
      file_nama: form.file.name,
      guru_id: profil.guru_id,
    })

    if (insertError) {
      alert('Gagal simpan data dokumen: ' + insertError.message)
    } else {
      setForm({ judul: '', deskripsi: '', file: null })
      setShowForm(false)
      await load()
    }
    setUploading(false)
  }

  async function getSignedUrl(path, expiresIn = 60) {
    const { data, error } = await supabase.storage.from('dokumen-penting').createSignedUrl(path, expiresIn)
    if (error) throw error
    return data.signedUrl
  }

  async function handleDownload(item) {
    try {
      const url = await getSignedUrl(item.file_path)
      const a = document.createElement('a')
      a.href = url
      a.download = item.file_nama
      a.click()
    } catch (err) {
      alert('Gagal buka file: ' + err.message)
    }
  }

  async function handlePreview(item) {
    try {
      const url = await getSignedUrl(item.file_path, 300)
      setPreview({ url, fileName: item.file_nama })
    } catch (err) {
      alert('Gagal membuka pratinjau: ' + err.message)
    }
  }

  async function handleDelete(item) {
    if (!confirm(`Hapus dokumen "${item.judul}"?`)) return
    await supabase.storage.from('dokumen-penting').remove([item.file_path])
    const { error } = await supabase.from('dokumen').delete().eq('id', item.id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    await load()
  }

  const canDelete = (item) => isAdmin || item.guru_id === profil?.guru_id

  function extBadge(fileName) {
    const ext = (fileName.split('.').pop() || '').toUpperCase()
    return ext.length <= 5 ? ext : 'FILE'
  }

  return (
    <Layout title="Dokumen Penting" subtitle="Berkas dan dokumen bersama untuk seluruh warga sekolah">
      {/* Keyframe animasi muncul bertahap, senada dengan Dasbor & Galeri */}
      <style>{`
        @keyframes dokumenFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dokumen-fade-in {
          animation: dokumenFadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      {/* Banner navy — sama seperti Dasbor, Profil Saya & Galeri, dengan corak batik emas */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-6 flex items-center justify-between gap-4 flex-wrap bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <BatikOverlay patternId="batikDokumenBanner" strokeColor="#d4af37" />

        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0">
            <HardDrive size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-white">Dokumen Penting</p>
            <p className="text-sm text-blue-200/70 mt-0.5">Semua berkas resmi sekolah tersimpan rapi di sini.</p>
          </div>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium hover:brightness-95 transition shadow"
        >
          <FileUp size={16} />
          Upload Dokumen
        </button>
      </div>

      <p className="text-sm text-ink-700/50 mb-4">{items.length} dokumen</p>

      {showForm && (
        <form onSubmit={handleUpload} className="card relative overflow-hidden p-6 mb-6 space-y-3">
          <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
          <input
            className="input w-full border-slate-200"
            placeholder="Judul dokumen (mis. SK Kepala Sekolah 2026)"
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            required
          />
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
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            required
          />
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium hover:brightness-95 disabled:opacity-50 transition"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <FileUp size={16} />}
            {uploading ? 'Mengunggah...' : 'Upload'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-700/50">Memuat...</p>
      ) : items.length === 0 ? (
        <div className="card p-6">
          <p className="text-sm text-ink-700/50">Belum ada dokumen diupload.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {items.map((item, i) => (
            <div
              key={item.id}
              style={{ animationDelay: `${i * 60}ms` }}
              className={`dokumen-fade-in opacity-0 relative overflow-hidden card border-t-4 ${CARD_BORDER[i % CARD_BORDER.length]} p-5 flex flex-col transition-transform duration-300 ease-out hover:-translate-y-1`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${ICON_BG[i % ICON_BG.length]}`}>
                <FileText size={18} />
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 w-fit mb-1.5">
                {extBadge(item.file_nama)}
              </span>
              <p className="text-sm font-medium text-slate-900 leading-snug">{item.judul}</p>
              {item.deskripsi && <p className="text-xs text-slate-500 mt-1 line-clamp-2">{item.deskripsi}</p>}
              <p className="text-xs text-slate-400 mt-2">
                {item.guru?.nama_lengkap || 'Admin'} · {new Date(item.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 flex-wrap">
                {isPreviewable(item.file_nama) && (
                  <button
                    onClick={() => handlePreview(item)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                  >
                    <Eye size={14} /> Lihat
                  </button>
                )}
                <button
                  onClick={() => handleDownload(item)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100"
                >
                  <Download size={14} /> Unduh
                </button>
                {canDelete(item) && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50 ml-auto"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <FileText size={72} className="absolute -right-3 -bottom-4 text-slate-900/[0.04]" />
            </div>
          ))}
        </div>
      )}

      {preview && <PreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />}
    </Layout>
  )
}
