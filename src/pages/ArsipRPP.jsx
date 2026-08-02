import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import {
  FileText,
  Download,
  Archive,
  Search,
  Upload,
  Loader2,
  Eye,
  X,
  Trash2,
} from 'lucide-react'

function isDocFile(nameOrType = '') {
  return /\.(docx?|DOCX?)$/.test(nameOrType) || nameOrType.includes('word')
}

function isPdfFile(nameOrType = '') {
  return /\.pdf$/i.test(nameOrType) || nameOrType.includes('pdf')
}

// Modal preview: PDF dibuka langsung via iframe, Word lewat Google Docs Viewer
function PreviewModal({ url, fileName, onClose }) {
  if (!url) return null
  const isDoc = isDocFile(fileName)
  const viewerSrc = isDoc
    ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`
    : url

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-ink-900/[0.08]">
          <p className="text-sm font-medium text-ink-900 truncate pr-4">{fileName}</p>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-ink-900/[0.05] shrink-0"
          >
            <X size={18} />
          </button>
        </div>
        <iframe
          src={viewerSrc}
          title={fileName}
          className="flex-1 w-full"
          style={{ border: 'none' }}
        />
      </div>
    </div>
  )
}

export default function ArsipRPP() {
  const { isAdmin, profil, session } = useAuth()
  const [tab, setTab] = useState('disetujui') // 'disetujui' | 'unggah'

  // --- Tab: dari pengajuan yang sudah disetujui (tabel "rpp") ---
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // --- Tab: upload langsung (tabel "rpp_arsip") ---
  const [arsipItems, setArsipItems] = useState([])
  const [loadingArsip, setLoadingArsip] = useState(true)
  const [queryArsip, setQueryArsip] = useState('')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    judul: '',
    mata_pelajaran: '',
    kelas: '',
    semester: 'Ganjil',
    tahun_ajaran: '',
    file: null,
  })

  const [preview, setPreview] = useState(null) // { url, fileName }

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('rpp')
      .select('*, guru(nama_lengkap)')
      .eq('status', 'disetujui')
      .order('disetujui_pada', { ascending: false })
    setItems(data || [])
    setLoading(false)
  }

  async function loadArsip() {
    setLoadingArsip(true)
    const { data } = await supabase
      .from('rpp_arsip')
      .select('*')
      .order('dibuat_pada', { ascending: false })
    setArsipItems(data || [])
    setLoadingArsip(false)
  }

  useEffect(() => {
    load()
    loadArsip()
  }, [])

  async function getSignedUrl(path) {
    const { data, error } = await supabase.storage.from('rpp-files').createSignedUrl(path, 300)
    if (error) throw error
    return data.signedUrl
  }

  async function handleDownload(path, fileName) {
    try {
      const url = await getSignedUrl(path)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
    } catch (err) {
      alert('Gagal buka file: ' + err.message)
    }
  }

  async function handlePreview(path, fileName) {
    try {
      const url = await getSignedUrl(path)
      setPreview({ url, fileName })
    } catch (err) {
      alert('Gagal membuka pratinjau: ' + err.message)
    }
  }

  async function handleUpload(e) {
    e.preventDefault()
    if (!form.file || !form.judul) return
    setUploading(true)

    const ext = form.file.name.split('.').pop()
    const path = `arsip/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('rpp-files')
      .upload(path, form.file)

    if (uploadError) {
      alert('Gagal upload file: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { error: insertError } = await supabase.from('rpp_arsip').insert({
      judul: form.judul,
      mata_pelajaran: form.mata_pelajaran,
      kelas: form.kelas,
      semester: form.semester,
      tahun_ajaran: form.tahun_ajaran,
      diupload_oleh: session?.user?.id,
      nama_pengupload: profil?.nama_lengkap || session?.user?.email,
      file_path: path,
      file_nama: form.file.name,
      file_type: form.file.type,
    })

    if (insertError) {
      alert('Gagal simpan data: ' + insertError.message)
    } else {
      setForm({ judul: '', mata_pelajaran: '', kelas: '', semester: 'Ganjil', tahun_ajaran: '', file: null })
      await loadArsip()
    }
    setUploading(false)
  }

  async function handleDeleteArsip(item) {
    if (!confirm(`Hapus "${item.judul}" dari arsip?`)) return
    const { error } = await supabase.from('rpp_arsip').delete().eq('id', item.id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    await supabase.storage.from('rpp-files').remove([item.file_path])
    await loadArsip()
  }

  async function handleDeleteRpp(item) {
    if (!confirm(`Hapus "${item.judul}" dari arsip pengajuan? Data pengajuan ini akan hilang permanen.`)) return
    const { error } = await supabase.from('rpp').delete().eq('id', item.id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    const pathsToRemove = [item.file_path]
    if (item.lembar_persetujuan_path) pathsToRemove.push(item.lembar_persetujuan_path)
    await supabase.storage.from('rpp-files').remove(pathsToRemove)
    await load()
  }

  const filtered = items.filter((item) => {
    const q = query.toLowerCase()
    return (
      item.judul?.toLowerCase().includes(q) ||
      item.mata_pelajaran?.toLowerCase().includes(q) ||
      item.guru?.nama_lengkap?.toLowerCase().includes(q) ||
      item.kelas?.toLowerCase().includes(q)
    )
  })

  const filteredArsip = arsipItems.filter((item) => {
    const q = queryArsip.toLowerCase()
    return (
      item.judul?.toLowerCase().includes(q) ||
      item.mata_pelajaran?.toLowerCase().includes(q) ||
      item.nama_pengupload?.toLowerCase().includes(q) ||
      item.kelas?.toLowerCase().includes(q)
    )
  })

  return (
    <Layout title="Arsip RPP" subtitle="Kumpulan RPP yang sudah disetujui maupun yang diunggah langsung">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <Archive size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Arsip RPP</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {items.length} dari pengajuan · {arsipItems.length} unggahan langsung
            </p>
          </div>
        </div>
        <Archive size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('disetujui')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'disetujui' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60 hover:bg-ink-900/[0.08]'
          }`}
        >
          Dari Pengajuan
        </button>
        <button
          onClick={() => setTab('unggah')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'unggah' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60 hover:bg-ink-900/[0.08]'
          }`}
        >
          Upload Langsung
        </button>
      </div>

      {tab === 'disetujui' && (
        <>
          <div className="card p-4 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                className="input-field !pl-9"
                placeholder="Cari judul, mata pelajaran, guru, atau kelas..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Daftar dari Pengajuan (Disetujui)</h3>
            {loading ? (
              <p className="text-sm text-ink-700/50">Memuat...</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-ink-700/50">Belum ada RPP yang disetujui.</p>
            ) : (
              <ul className="divide-y divide-ink-900/[0.06]">
                {filtered.map((item) => (
                  <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-sage-500/15 text-sage-500">
                          Disetujui
                        </span>
                        <span className="text-sm font-medium text-ink-900 truncate">{item.judul}</span>
                      </div>
                      <p className="text-xs text-ink-700/50 mt-1">
                        {isAdmin && <>{item.guru?.nama_lengkap || 'Guru'} · </>}
                        {item.mata_pelajaran} · Kelas {item.kelas} · {item.semester} {item.tahun_ajaran}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePreview(item.file_path, item.file_nama)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                      >
                        <Eye size={14} /> Lihat
                      </button>
                      <button
                        onClick={() => handleDownload(item.file_path, item.file_nama)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                      >
                        <Download size={14} /> Unduh
                      </button>
                      {item.lembar_persetujuan_path && (
                        <button
                          onClick={() =>
                            handleDownload(item.lembar_persetujuan_path, `Lembar-Persetujuan-${item.judul}.pdf`)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-sage-500 hover:bg-sage-500/10"
                        >
                          <FileText size={14} /> Lembar Persetujuan
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => handleDeleteRpp(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
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
        </>
      )}

      {tab === 'unggah' && (
        <>
          <form onSubmit={handleUpload} className="card p-6 mb-6 space-y-3">
            <h3 className="font-display text-lg font-semibold mb-1">Upload RPP ke Arsip</h3>
            <p className="text-xs text-ink-700/50 -mt-1 mb-2">
              Untuk penyimpanan langsung, tanpa perlu persetujuan admin. Bisa diisi guru maupun admin.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                className="input-field"
                placeholder="Judul RPP"
                value={form.judul}
                onChange={(e) => setForm({ ...form, judul: e.target.value })}
                required
              />
              <input
                className="input-field"
                placeholder="Mata Pelajaran"
                value={form.mata_pelajaran}
                onChange={(e) => setForm({ ...form, mata_pelajaran: e.target.value })}
              />
              <input
                className="input-field"
                placeholder="Kelas"
                value={form.kelas}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
              />
              <select
                className="input-field"
                value={form.semester}
                onChange={(e) => setForm({ ...form, semester: e.target.value })}
              >
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
              <input
                className="input-field"
                placeholder="Tahun Ajaran (mis. 2026/2027)"
                value={form.tahun_ajaran}
                onChange={(e) => setForm({ ...form, tahun_ajaran: e.target.value })}
              />
              <input
                className="input-field"
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                required
              />
            </div>
            <button type="submit" disabled={uploading} className="btn-primary">
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {uploading ? 'Mengunggah...' : 'Upload ke Arsip'}
            </button>
          </form>

          <div className="card p-4 mb-6">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
              <input
                className="input-field !pl-9"
                placeholder="Cari judul, mata pelajaran, pengunggah, atau kelas..."
                value={queryArsip}
                onChange={(e) => setQueryArsip(e.target.value)}
              />
            </div>
          </div>

          <div className="card p-6">
            <h3 className="font-display text-lg font-semibold mb-4">Daftar Upload Langsung</h3>
            {loadingArsip ? (
              <p className="text-sm text-ink-700/50">Memuat...</p>
            ) : filteredArsip.length === 0 ? (
              <p className="text-sm text-ink-700/50">Belum ada RPP yang diunggah langsung.</p>
            ) : (
              <ul className="divide-y divide-ink-900/[0.06]">
                {filteredArsip.map((item) => (
                  <li key={item.id} className="py-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-ink-900 truncate">{item.judul}</span>
                      <p className="text-xs text-ink-700/50 mt-1">
                        {item.nama_pengupload} · {item.mata_pelajaran} · Kelas {item.kelas} · {item.semester}{' '}
                        {item.tahun_ajaran}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handlePreview(item.file_path, item.file_nama)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                      >
                        <Eye size={14} /> Lihat
                      </button>
                      <button
                        onClick={() => handleDownload(item.file_path, item.file_nama)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-ink-700 hover:bg-ink-900/[0.05]"
                      >
                        <Download size={14} /> Unduh
                      </button>
                      {(isAdmin || item.diupload_oleh === session?.user?.id) && (
                        <button
                          onClick={() => handleDeleteArsip(item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-100 text-red-600"
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
        </>
      )}

      {preview && (
        <PreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />
      )}
    </Layout>
  )
}
