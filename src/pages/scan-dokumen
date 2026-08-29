import { useState } from 'react'
import Tesseract from 'tesseract.js'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { saveAs } from 'file-saver'
import { ScanLine, Loader2, Download, FileText, FileType2, Trash2, Camera } from 'lucide-react'

const BAHASA_OPTIONS = [
  { value: 'ind', label: 'Indonesia' },
  { value: 'eng', label: 'Inggris' },
  { value: 'ind+eng', label: 'Indonesia + Inggris' },
]

export default function ScanDokumen() {
  const [antrian, setAntrian] = useState([]) // { id, name, previewUrl }
  const [bahasa, setBahasa] = useState('ind')
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrProgress, setOcrProgress] = useState(0)
  const [fileSedangDiproses, setFileSedangDiproses] = useState('')
  const [teksHasil, setTeksHasil] = useState('')
  const [namaFile, setNamaFile] = useState('Dokumen Hasil Scan')
  const [error, setError] = useState('')

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
        const { data: { text } } = await Tesseract.recognize(file, bahasa, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              setOcrProgress(Math.round(m.progress * 100))
            }
          },
        })
        const teksBersih = text.trim()
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
                Membaca "{fileSedangDiproses}"... {ocrProgress}%
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
