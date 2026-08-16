import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { buildAiRppDocxFile, downloadAiRppDocx } from '../lib/generateAiRppDocx'
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
  Sparkles,
  Copy,
  Check,
  FileDown,
} from 'lucide-react'

function isDocFile(nameOrType = '') {
  return /\.(docx?|DOCX?)$/.test(nameOrType) || nameOrType.includes('word')
}

// Modal Rekomendasi RPP berbasis AI — memanggil endpoint serverless
// `/api/generate-rpp` (Gemini). API key hanya hidup sebagai secret di
// server (Vercel env var), tidak pernah terkirim ke client.
//
// Alur baru: begitu ada hasil, user bisa langsung
//   1) "Unduh sebagai .docx" -> file .docx ter-generate & terdownload, ATAU
//   2) "Gunakan Data Ini di Form Upload" -> file .docx ter-generate otomatis
//      DAN langsung dititipkan ke form upload (kolom Choose File terisi
//      sendiri), jadi user tidak perlu lagi copy-paste manual ke Word.
function AiRppModal({ isOpen, onClose, onApplyToForm, defaultNamaGuru, defaultNamaKepalaSekolah, tempatTtd }) {
  const [mataPelajaran, setMataPelajaran] = useState('')
  const [kelas, setKelas] = useState('')
  const [materi, setMateri] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [copied, setCopied] = useState(false)
  const [generatingDocx, setGeneratingDocx] = useState(false)
  const [applyingToForm, setApplyingToForm] = useState(false)
  const [sertakanLampiran, setSertakanLampiran] = useState(true)
  // Nama untuk kolom tanda tangan di halaman terakhir RPP — diisi otomatis
  // dari data guru yang login & Profil Sekolah, tapi tetap bisa diedit
  // manual (misalnya kalau yang menyusun/menandatangani bukan yang login).
  const [namaGuruTtd, setNamaGuruTtd] = useState(defaultNamaGuru || '')
  const [namaKepsekTtd, setNamaKepsekTtd] = useState(defaultNamaKepalaSekolah || '')

  useEffect(() => {
    if (isOpen) {
      setNamaGuruTtd(defaultNamaGuru || '')
      setNamaKepsekTtd(defaultNamaKepalaSekolah || '')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, defaultNamaGuru, defaultNamaKepalaSekolah])

  if (!isOpen) return null

  async function handleGenerate(e) {
    e.preventDefault()
    setLoading(true)
    setResult('')
    setErrorMsg('')

    try {
      const res = await fetch('/api/generate-rpp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mataPelajaran, kelas, materi, sertakanLampiran }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || 'Gagal memproses permintaan AI.')
      }

      setResult(data?.result || 'Gagal menghasilkan RPP.')
    } catch (err) {
      setErrorMsg('Gagal membuat rekomendasi RPP: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function buildKotaTanggal() {
    const tanggal = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    return tempatTtd ? `${tempatTtd}, ${tanggal}` : tanggal
  }

  async function handleDownloadDocx() {
    setGeneratingDocx(true)
    setErrorMsg('')
    try {
      await downloadAiRppDocx({
        mataPelajaran,
        kelas,
        materi,
        resultText: result,
        namaGuru: namaGuruTtd,
        namaKepalaSekolah: namaKepsekTtd,
        kotaTanggal: buildKotaTanggal(),
      })
    } catch (err) {
      setErrorMsg('Gagal membuat file .docx: ' + err.message)
    }
    setGeneratingDocx(false)
  }

  async function handleUseResult() {
    setApplyingToForm(true)
    setErrorMsg('')
    try {
      const file = await buildAiRppDocxFile({
        mataPelajaran,
        kelas,
        materi,
        resultText: result,
        namaGuru: namaGuruTtd,
        namaKepalaSekolah: namaKepsekTtd,
        kotaTanggal: buildKotaTanggal(),
      })
      onApplyToForm({
        judul: `RPP ${materi}`,
        mata_pelajaran: mataPelajaran,
        kelas: kelas,
        file,
      })
      onClose()
    } catch (err) {
      setErrorMsg('Gagal menyiapkan file untuk form upload: ' + err.message)
    }
    setApplyingToForm(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-ink-900/[0.08] bg-slate-50">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            <h3 className="font-display font-semibold text-ink-900">Rekomendasi RPP (AI)</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/5 text-slate-500">
            <X size={18} />
          </button>
        </div>

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
            <label className="sm:col-span-2 flex items-start gap-2 text-xs text-slate-600 -mt-1">
              <input
                type="checkbox"
                checked={sertakanLampiran}
                onChange={(e) => setSertakanLampiran(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Sertakan lampiran lengkap (LKPD, Instrumen Penilaian, Bahan Ajar, Kisi-kisi & Soal Evaluasi) —
                digabung dalam satu file .docx dengan RPP-nya
              </span>
            </label>

            <div className="sm:col-span-2 rounded-lg border border-slate-200 p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                Nama untuk kolom tanda tangan
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  className="input-field !text-xs !py-1.5"
                  placeholder="Nama Guru"
                  value={namaGuruTtd}
                  onChange={(e) => setNamaGuruTtd(e.target.value)}
                />
                <input
                  className="input-field !text-xs !py-1.5"
                  placeholder="Nama Kepala Sekolah"
                  value={namaKepsekTtd}
                  onChange={(e) => setNamaKepsekTtd(e.target.value)}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Terisi otomatis dari data akun & Profil Sekolah — silakan ubah kalau perlu.
              </p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="sm:col-span-2 py-2 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {loading ? 'Sedang Menyusun Rekomendasi...' : 'Generate Rekomendasi RPP'}
            </button>
          </form>

          {errorMsg && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-600">
              {errorMsg}
            </div>
          )}

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
                onClick={handleDownloadDocx}
                disabled={generatingDocx}
                className="mt-3 w-full py-2 bg-white border border-slate-300 text-slate-700 text-xs font-medium rounded hover:bg-slate-100 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {generatingDocx ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
                {generatingDocx ? 'Menyiapkan file...' : 'Unduh sebagai .docx'}
              </button>

              <button
                type="button"
                onClick={handleUseResult}
                disabled={applyingToForm}
                className="mt-2 w-full py-2 bg-slate-900 text-white text-xs font-medium rounded hover:bg-slate-800 flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {applyingToForm ? <Loader2 size={14} className="animate-spin" /> : null}
                {applyingToForm ? 'Menyiapkan file & mengisi form...' : 'Gunakan Data Ini di Form Upload'}
              </button>
              <p className="text-[11px] text-slate-400 mt-1.5 text-center">
                File .docx akan dibuat otomatis dan langsung mengisi kolom "Choose File" di form upload —
                tidak perlu copy-paste manual ke Word lagi.
                {sertakanLampiran && ' Lampiran (LKPD, dll.) ikut tergabung di halaman berikutnya dalam file yang sama.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

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
  const [tab, setTab] = useState('disetujui')

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  // Dipakai untuk mengisi otomatis nama Kepala Sekolah di kolom tanda tangan
  // draf RPP AI (lihat AiRppModal) — sama seperti field yang dipakai fitur
  // Surat Keterangan & Beban Mengajar.
  const [schoolProfile, setSchoolProfile] = useState(null)
  // Nama guru yang login — diambil dari tabel "guru" lewat profil.guru_id
  // (tabel "profil" sendiri tidak menyimpan nama_lengkap)
  const [namaGuruLogin, setNamaGuruLogin] = useState('')

  const [arsipItems, setArsipItems] = useState([])
  const [loadingArsip, setLoadingArsip] = useState(true)
  const [queryArsip, setQueryArsip] = useState('')
  const [uploading, setUploading] = useState(false)
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
    supabase
      .from('profil_sekolah')
      .select('kepala_sekolah, tempat_ttd')
      .limit(1)
      .single()
      .then(({ data, error }) => {
        if (!error) setSchoolProfile(data)
      })
  }, [])

  useEffect(() => {
    if (!profil?.guru_id) return
    supabase
      .from('guru')
      .select('nama_lengkap')
      .eq('id', profil.guru_id)
      .single()
      .then(({ data, error }) => {
        if (!error) setNamaGuruLogin(data?.nama_lengkap || '')
      })
  }, [profil?.guru_id])

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
            <div className="flex justify-between items-center mb-1">
              <h3 className="font-display text-lg font-semibold">Upload RPP ke Arsip</h3>

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
              <div>
                <input
                  className="input-field"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                  required
                />
                {form.file && form.file.name.startsWith('RPP_AI_') && (
                  <p className="text-[11px] text-amber-600 mt-1">File dibuat otomatis dari draf AI.</p>
                )}
              </div>
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

      <AiRppModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        onApplyToForm={(data) => setForm((prev) => ({ ...prev, ...data }))}
        defaultNamaGuru={namaGuruLogin || session?.user?.email || ''}
        defaultNamaKepalaSekolah={schoolProfile?.kepala_sekolah || ''}
        tempatTtd={schoolProfile?.tempat_ttd || ''}
      />

      {preview && (
        <PreviewModal url={preview.url} fileName={preview.fileName} onClose={() => setPreview(null)} />
      )}
    </Layout>
  )
}
