import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Modal generik untuk input data massal dari file Excel (.xlsx) atau CSV.
 * - `templateHeaders`: kolom yang diharapkan, ditampilkan sebagai contoh unduhan template.
 * - `mapRow(row)`: mengubah satu baris mentah dari file menjadi object siap kirim ke Supabase.
 * - `onImport(rows)`: fungsi async yang melakukan insert ke Supabase.
 */
export default function BulkImportModal({ open, onClose, title, templateHeaders, mapRow, onImport }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('idle') // idle | parsed | importing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)

  if (!open) return null

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setStatus('idle')
    setErrorMsg('')

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
        const mapped = json.map(mapRow).filter(Boolean)
        setRows(mapped)
        setStatus('parsed')
      } catch (err) {
        setErrorMsg('Gagal membaca file. Pastikan formatnya .xlsx atau .csv sesuai template.')
        setStatus('error')
      }
    }
    reader.readAsBinaryString(file)
  }

  function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([templateHeaders])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template')
    XLSX.writeFile(wb, `template-${title.toLowerCase().replace(/\s+/g, '-')}.xlsx`)
  }

  async function handleImport() {
    setStatus('importing')
    try {
      const res = await onImport(rows)
      setResult(res)
      setStatus('done')
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan data.')
      setStatus('error')
    }
  }

  function handleClose() {
    setRows([])
    setFileName('')
    setStatus('idle')
    setErrorMsg('')
    setResult(null)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative">
        <button onClick={handleClose} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900">
          <X size={20} />
        </button>
        <h2 className="font-display text-xl font-semibold text-ink-950">{title}</h2>
        <p className="text-sm text-ink-700/60 mt-1">
          Unggah file Excel/CSV untuk menambahkan banyak data sekaligus.
        </p>

        <button onClick={downloadTemplate} className="btn-secondary mt-4 w-full">
          Unduh Template Kosong
        </button>

        <label className="mt-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-900/15 rounded-xl py-8 cursor-pointer hover:border-brass-400 transition-colors">
          <UploadCloud size={24} className="text-ink-700/40" />
          <span className="text-sm text-ink-700/60">
            {fileName || 'Klik untuk memilih file .xlsx atau .csv'}
          </span>
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </label>

        {status === 'parsed' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-sage-500 bg-sage-500/10 rounded-lg px-3 py-2.5">
            <CheckCircle2 size={16} />
            {rows.length} baris data siap diimpor.
          </div>
        )}

        {status === 'error' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-700 bg-red-50 rounded-lg px-3 py-2.5">
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}

        {status === 'done' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-sage-500 bg-sage-500/10 rounded-lg px-3 py-2.5">
            <CheckCircle2 size={16} />
            Berhasil menyimpan {result?.count ?? rows.length} data.
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button className="btn-secondary" onClick={handleClose}>
            {status === 'done' ? 'Tutup' : 'Batal'}
          </button>
          {status !== 'done' && (
            <button
              className="btn-primary"
              disabled={rows.length === 0 || status === 'importing'}
              onClick={handleImport}
            >
              {status === 'importing' && <Loader2 size={16} className="animate-spin" />}
              Impor {rows.length > 0 ? `${rows.length} Data` : ''}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
