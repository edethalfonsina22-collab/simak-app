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
  Sparkles, // <-- Tambahan Ikon
  Copy,     // <-- Tambahan Ikon
  Check,
} from 'lucide-react'

function isDocFile(nameOrType = '') {
  return /\.(docx?|DOCX?)$/.test(nameOrType) || nameOrType.includes('word')
}

// --- MODAL REKOMENDASI AI (FITUR BARU) ---
function AiRppModal({ isOpen, onClose, onApplyToForm }) {
  const [mataPelajaran, setMataPelajaran] = useState('')
  const [kelas, setKelas] = useState('')
  const [materi, setMateri] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [copied, setCopied] = useState(false)

  if (!isOpen) return null

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    setResult('')

    try {
      const res = await fetch('/api/generate-rpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mataPelajaran, kelas, materi }),
      })
      const data = await res.json()

      if (res.ok) {
        setResult(data.result)
      } else {
        alert(data.error || 'Terjadi kesalahan')
      }
    } catch (err) {
      alert('Gagal membuat rekomendasi RPP: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleUseResult() {
    onApplyToForm({
      judul: `RPP ${materi}`,
      mata_pelajaran: mataPelajaran,
      kelas: kelas,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-900/[0.08] bg-slate-50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="font-display font-semibold text-ink-900">Rekomendasi RPP AI</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 text-slate-500">
            <X size={18} />
          </button>
        </div>

        {/* Body Modal */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <form onSubmit={handleGenerate} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              className="input-field"
              placeholder="Mata Pelajaran (mis. Matematika)"
              value={mataPelajaran}
              onChange={(e) => setMataPelajaran(e.target.value)}
              required
            />
            <input
              className="input-field"
              placeholder="Kelas (mis. X / 10)"
              value={kelas}
              onChange={(e) => setKelas(e.target.value)}
            />
            <input
              className="input-field sm:col-span-2"
              placeholder="Materi / Topik Pembelajaran (mis. Persamaan Kuadrat)"
              value={materi}
              onChange={(e) => setMateri(e.target.value)}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="sm:col-span-2 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? 'Sedang Menyusun Rekomendasi...' : 'Generate Rekomendasi RPP'}
            </button>
          </form>

          {/* Hasil AI */}
          {result && (
            <div className="mt-4 border border-slate-200 rounded-lg p-4 bg-slate-50 relative">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Hasil Rekomendasi
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900 bg-white border px-2 py-1 rounded"
                >
                  {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
                  {copied ? 'Tersalin!' : 'Salin Teks'}
                </button>
              </div>
              <textarea
                readOnly
                value={result}
                className="w-full h-48 p-2 text-xs font-mono border rounded bg-white text-slate-800 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleUseResult}
                className="mt-3 w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800"
              >
                Gunakan Parameter Ini di Form Upload
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Modal Preview bawaan...
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
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-ink-900/[0.05] shrink-0">
            <X size={18} />
          </button>
        </div>
        <iframe src={viewerSrc} title={fileName} className="flex-1 w-full" style={{ border: 'none' }} />
      </div>
    </div>
  )
}

export default function ArsipRPP() {
  const { isAdmin, profil, session } = useAuth()
  const [tab, setTab] = useState('disetujui')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  const [arsipItems, setArsipItems] = useState([])
  const [loadingArsip, setLoadingArsip] = useState(true)
  const [queryArsip, setQueryArsip] = useState('')
  const [uploading, setUploading] = useState(false)
  
  // State Modal AI
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  const [form, setForm] = useState({
    judul: '',
    mata_pelajaran: '',
    kelas: '',
    semester: 'Ganjil',
    tahun_ajaran: '',
    file: null,
  })

  const [preview, setPreview] = useState(null)

  // ... [Fungsi load, loadArsip, getSignedUrl, handleDownload, handlePreview, handleUpload, handleDelete disamakan seperti kode asli Anda] ...

  return (
    <Layout title="Arsip RPP" subtitle="Kumpulan RPP yang sudah disetujui maupun yang diunggah langsung">
      {/* Banner Header disamakan... */}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('disetujui')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'disetujui' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60'
          }`}
        >
          Dari Pengajuan
        </button>
        <button
          onClick={() => setTab('unggah')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'unggah' ? 'bg-brass-400 text-ink-950' : 'bg-ink-900/[0.05] text-ink-700/60'
          }`}
        >
          Upload Langsung
        </button>
      </div>

      {/* Tab 2: Upload Langsung dengan Tombol Rekomendasi AI */}
      {tab === 'unggah' && (
        <>
          <form onSubmit={handleUpload} className="card p-6 mb-6 space-y-3">
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-display text-lg font-semibold">Upload RPP ke Arsip</h3>
              
              {/* TOMBOL REKOMENDASI AI */}
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border border-amber-500/30 transition-all"
              >
                <Sparkles size={14} />
                <span>Rekomendasi RPP (AI)</span>
              </button>
            </div>

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

          {/* Sisa UI List disamakan... */}
        </>
      )}

      {/* Modal AI Generator */}
      <AiRppModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyToForm={(data) => setForm((prev) => ({ ...prev, ...data }))}
      />

      {/* Modal Preview */}
      {preview && (
        <PreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />
      )}
    </Layout>
  )
}
