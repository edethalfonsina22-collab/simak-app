import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { FileUp, Loader2, FileText, Download, Trash2 } from 'lucide-react'

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

      <div className="card p-6">
        {loading ? (
          <p className="text-sm text-ink-700/50">Memuat...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-ink-700/50">Belum ada dokumen diupload.</p>
        ) : (
          <ul className="divide-y divide-ink-900/[0.06]">
            {items.map((item) => (
              <li key={item.id} className="py-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-brass-400/15 text-brass-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-ink-900/[0.06] text-ink-700/60">
                      {extBadge(item.file_nama)}
                    </span>
                    <p className="text-sm font-medium text-ink-950 truncate">{item.judul}</p>
                  </div>
                  {item.deskripsi && <p className="text-xs text-ink-700/50 mt-0.5 truncate">{item.deskripsi}</p>}
                  <p className="text-xs text-ink-700/40 mt-0.5">
                    {item.guru?.nama_lengkap || 'Admin'} · {new Date(item.dibuat_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownload(item)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                  >
                    <Download size={14} /> Unduh
                  </button>
                  {canDelete(item) && (
                    <button
                      onClick={() => handleDelete(item)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
