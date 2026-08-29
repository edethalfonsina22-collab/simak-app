import { useState } from 'react'
import Tesseract from 'tesseract.js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import { ScanLine, Loader2, Download, FileText, FileType2, Trash2, Camera, Sparkles } from 'lucide-react'

const BAHASA_OPTIONS = [
  { value: 'ind', label: 'Indonesia' },
  { value: 'eng', label: 'Inggris' },
  { value: 'ind+eng', label: 'Indonesia + Inggris' },
]

// Dua metode pembacaan teks:
// - 'tesseract' : OCR lokal di browser (gratis, offline, sudah ada sebelumnya)
// - 'ai'        : dikirim ke endpoint backend yang memanggil Claude (vision),
//                 lebih akurat untuk tulisan tangan / dokumen kompleks / tabel
const METODE_OPTIONS = [
  { value: 'tesseract', label: 'OCR Cepat', desc: 'Offline, gratis, cocok untuk teks cetak yang jelas' },
  { value: 'ai', label: 'AI Scan (Gemini)', desc: 'Ditenagai Gemini — lebih akurat untuk tulisan tangan & dokumen rumit' },
]

export default function ScanDokumen() {
  const [antrian, setAntrian] = useState([]) // { id, name, previewUrl }
  const [bahasa, setBahasa] = useState('ind')
  const [metodeScan, setMetodeScan] = useState('tesseract')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [fileSedangDiproses, setFileSedangDiproses] = useState('')
  const [teksHasil, setTeksHasil] = useState('')
  const [namaFile, setNamaFile] = useState('Dokumen Hasil Scan')
  const [error, setError] = useState('')

  // --- Metode 1: OCR lokal dengan Tesseract (fitur lama, tidak diubah) ---
  async function scanDenganTesseract(file) {
    const { data: { text } } = await Tesseract.recognize(file, bahasa, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setOcrProgress(Math.round(m.progress * 100))
        }
      },
    })
    return text.trim()
  }

  // --- Metode 2 (baru): AI Scan via backend endpoint yang memanggil Gemini ---
  async function scanDenganAI(file) {
    setOcrProgress(0)
    const base64 = await fileToBase64(file)

    const res = await fetch('/api/ai-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64,
        mimeType: file.type,
        bahasa, // dikirim sebagai konteks, bukan untuk menerjemahkan teksnya
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      throw new Error(`Server AI Scan (Gemini) gagal (${res.status}). ${detail}`)
    }

    const data = await res.json()
    if (!data.text) throw new Error('Respons AI Scan tidak berisi teks.')
    return data.text.trim()
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1]) // buang prefix data:...;base64,
      reader.onerror = () => reject(new Error('Gagal membaca file gambar.'))
      reader.readAsDataURL(file)
    })
  }

  async function handleUpload(e) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    setError('')
    setOcrLoading(true)

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const previewUrl = URL.createObjectURL(file)
      const id = `${Date.now()}-${i}`
      setAntrian((prev) => [...prev, { id, name: file.name, previewUrl }])
      setFileSedangDiproses(file.name)
      setOcrProgress(0)

      try {
        const teksBersih =
          metodeScan === 'ai'
            ? await scanDenganAI(file)
            : await scanDenganTesseract(file)

        setTeksHasil((prev) => (prev ? prev + '\n\n' + teksBersih : teksBersih))
      } catch (err) {
        setError(`Gagal membaca "${file.name}": ${err.message}`)
      }
    }

    setOcrLoading(false)
    setFileSedangDiproses('')
    setOcrProgress(0)
    e.target.value = ''
  }

  function hapusSemua() {
    setAntrian([])
    setTeksHasil('')
    setError('')
  }

  function unduhTxt() {
    if (!teksHasil.trim()) return
    const blob = new Blob([teksHasil], { type: 'text/plain;charset=utf-8' })
    saveAs(blob, `${namaFile || 'dokumen'}.txt`)
  }

  async function unduhDocx() {
    if (!teksHasil.trim()) return
    const paragraphs = teksHasil
      .split('\n')
      .map((baris) => new Paragraph({ children: [new TextRun(baris)] }))

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: paragraphs.length ? paragraphs : [new Paragraph('')],
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, `${namaFile || 'dokumen'}.docx`)
  }

  return (
    <div className="min-h-screen bg-paper py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-ink-950 flex items-center justify-center mx-auto mb-3">
            <ScanLine size={26} className="text-brass-400" />
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink-950 tracking-tight">
            Scan Dokumen
          </h1>
          <p className="text-ink-700/70 mt-2 max-w-md mx-auto text-sm">
            Unggah atau foto dokumen (surat, catatan, halaman buku, dll). Teksnya akan dibaca otomatis dan bisa diedit sebelum diunduh sebagai file Word atau teks.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 space-y-5">
          {/* Pilihan metode scan (baru) */}
          <div>
            <label className="label-field">Metode Pembacaan Teks</label>
            <div className="grid sm:grid-cols-2 gap-3">
              {METODE_OPTIONS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMetodeScan(m.value)}
                  className={`text-left rounded-xl border p-3 transition ${
                    metodeScan === m.value
                      ? 'border-ink-950 bg-ink-950/5'
                      : 'border-ink-950/10 hover:border-ink-950/25'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink-950">
                    {m.value === 'ai' && <Sparkles size={14} className="text-brass-500" />}
                    {m.label}
                  </span>
                  <span className="block text-xs text-ink-700/60 mt-0.5">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Kontrol bahasa OCR */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label-field">Bahasa Dokumen</label>
              <select className="input-field" value={bahasa} onChange={(e) => setBahasa(e.target.value)}>
                {BAHASA_OPTIONS.map((b) => (
                  <option key={b.value} value={b.value}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label-field">Nama File Hasil</label>
              <input
                className="input-field"
                value={namaFile}
                onChange={(e) => setNamaFile(e.target.value)}
                placeholder="Contoh: Surat Keterangan"
              />
            </div>
          </div>

          {/* Upload */}
          <div className="rounded-xl border border-dashed border-ink-950/15 bg-paper/60 p-4 space-y-3">
            <p className="text-sm font-semibold text-ink-950">Unggah / Foto Dokumen</p>
            <p className="text-xs text-ink-700/60">
              Bisa pilih lebih dari satu file sekaligus (misalnya beberapa halaman) — hasil teksnya akan digabung berurutan. Di HP, opsi kamera bisa langsung memotret dokumen.
            </p>

            <div className="flex flex-wrap gap-3">
              <label className="btn-primary cursor-pointer">
                <FileText size={16} />
                Pilih File
                <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
              </label>
              <label className="btn-primary cursor-pointer">
                <Camera size={16} />
                Ambil Foto
                <input type="file" accept="image/*" capture="environment" onChange={handleUpload} className="hidden" />
              </label>
              {antrian.length > 0 && (
                <button type="button" onClick={hapusSemua} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100">
                  <Trash2 size={16} />
                  Hapus Semua
                </button>
              )}
            </div>

            {antrian.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {antrian.map((a) => (
                  <img key={a.id} src={a.previewUrl} alt={a.name} title={a.name} className="w-16 h-16 object-cover rounded-lg border border-ink-950/10" />
                ))}
              </div>
            )}

            {ocrLoading && (
              <div className="flex items-center gap-2 text-sm text-ink-700/70">
                <Loader2 size={16} className="animate-spin" />
                {metodeScan === 'ai'
                  ? `Membaca "${fileSedangDiproses}" dengan Gemini AI...`
                  : `Membaca "${fileSedangDiproses}"... ${ocrProgress}%`}
              </div>
            )}

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>

          {/* Hasil teks */}
          <div>
            <label className="label-field">Hasil Teks (bisa diedit sebelum diunduh)</label>
            <textarea
              className="input-field font-mono text-sm"
              rows={14}
              value={teksHasil}
              onChange={(e) => setTeksHasil(e.target.value)}
              placeholder="Teks hasil scan akan muncul di sini..."
            />
          </div>

          {/* Tombol unduh */}
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={unduhDocx} disabled={!teksHasil.trim()} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
              <FileType2 size={16} />
              Unduh sebagai Word (.docx)
            </button>
            <button type="button" onClick={unduhTxt} disabled={!teksHasil.trim()} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-ink-950/15 text-ink-950 hover:bg-ink-950/5 disabled:opacity-40 disabled:cursor-not-allowed">
              <Download size={16} />
              Unduh sebagai Teks (.txt)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
