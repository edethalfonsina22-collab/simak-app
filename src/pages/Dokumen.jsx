import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { FileUp, Loader2, FileText, Download, Trash2, HardDrive } from 'lucide-react'

const CARD_BORDER = ['border-t-brass-400', 'border-t-sage-500', 'border-t-ink-950', 'border-t-red-400']
const ICON_BG = ['bg-brass-400/15 text-brass-600', 'bg-sage-500/15 text-sage-500', 'bg-ink-950/10 text-ink-950', 'bg-red-100 text-red-500']

export default function Dokumen() {
  const { profil, isAdmin } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ judul: '', deskripsi: '', file: null })

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

  async function handleDownload(item) {
    const { data, error } = await supabase.storage.from('dokumen-penting').createSignedUrl(item.file_path, 60)
    if (error) {
      alert('Gagal buka file: ' + error.message)
      return
    }
    const a = document.createElement('a')
    a.href = data.signedUrl
    a.download = item.file_nama
    a.click()
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
      {/* Banner sambutan */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <HardDrive size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Dokumen Penting</p>
            <p className="text-sm text-paper/70 mt-0.5">Semua berkas resmi sekolah tersimpan rapi di sini.</p>
          </div>
        </div>
        <HardDrive size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-ink-700/50">{items.length} dokumen</p>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium"
        >
          <FileUp size={16} />
          Upload Dokumen
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleUpload} className="card p-6 mb-6 space-y-3">
          <input
            className="input w-full"
            placeholder="Judul dokumen (mis. SK Kepala Sekolah 2026)"
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
            onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
            required
          />
          <button
            type="submit"
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brass-400 text-ink-950 text-sm font-medium disabled:opacity-50"
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
              className={`relative overflow-hidden card border-t-4 ${CARD_BORDER[i % CARD_BORDER.length]} p-5 flex flex-col`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${ICON_BG[i % ICON_BG.length]}`}>
                <FileText size={18} />
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ink-900/[0.06] text-ink-700/60 w-fit mb-1.5">
                {extBadge(item.file_nama)}
              </span>
              <p className="text-sm font-medium text-ink-950 leading-snug">{item.judul}</p>
              {item.deskripsi && <p className="text-xs text-ink-700/50 mt-1 line-clamp-2">{item.deskripsi}</p>}
              <p className="text-xs text-ink-700/40 mt-2">
                {item.guru?.nama_lengkap || 'Admin'} · {new Date(item.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>

              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-ink-900/[0.06]">
                <button
                  onClick={() => handleDownload(item)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
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

              <FileText size={72} className="absolute -right-3 -bottom-4 text-ink-950/[0.03]" />
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
