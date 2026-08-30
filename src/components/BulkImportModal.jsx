import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Modal generik untuk input data massal dari file Excel (.xlsx) atau CSV.
 * - `templateHeaders`: kolom yang diharapkan, ditampilkan sebagai contoh unduhan template,
 *   dan juga dipakai untuk MENDETEKSI baris header sebenarnya di file yang diunggah.
 * - `mapRow(row)`: mengubah satu baris mentah dari file menjadi object siap kirim ke Supabase.
 * - `onImport(rows)`: fungsi async yang melakukan insert ke Supabase.
 *
 * Deteksi header otomatis: banyak file ekspor resmi (mis. Dapodik) punya beberapa baris
 * judul/metadata (nama sekolah, kecamatan, tanggal unduh) SEBELUM baris header kolom yang
 * sebenarnya. Supaya file itu bisa diunggah apa adanya tanpa diedit dulu, kita baca sheet
 * sebagai baris mentah, cari baris yang paling banyak cocok dengan `templateHeaders`, lalu
 * jadikan baris itu sebagai header — baris-baris di atasnya (termasuk yang tidak beraturan
 * jumlah kolomnya) otomatis diabaikan.
 */

const MAX_BARIS_DICARI = 25 // batas pencarian baris header, cukup untuk file dgn banyak baris judul
const MIN_KECOCOKAN = 2 // minimal jumlah kolom cocok supaya baris dianggap header

function normalisasi(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // buang anotasi seperti "(L/P)"
    .replace(/[\/_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cariBarisHeader(rowsAoa, templateHeaders) {
  const targetSet = (templateHeaders || []).map(normalisasi).filter(Boolean)
  if (targetSet.length === 0) return 0

  let terbaik = { index: 0, skor: -1 }
  const batas = Math.min(rowsAoa.length, MAX_BARIS_DICARI)

  for (let i = 0; i < batas; i++) {
    const baris = rowsAoa[i] || []
    const selNormal = baris.map(normalisasi).filter(Boolean)
    if (selNormal.length === 0) continue

    let skor = 0
    for (const target of targetSet) {
      if (selNormal.some((sel) => sel === target || sel.includes(target) || target.includes(sel))) {
        skor++
      }
    }
    if (skor > terbaik.skor) terbaik = { index: i, skor }
  }

  // Kalau tidak ada baris yang cukup mirip header, anggap file memang sudah rapi dari baris 1
  return terbaik.skor >= MIN_KECOCOKAN ? terbaik.index : 0
}

export default function BulkImportModal({ open, onClose, title, templateHeaders, mapRow, onImport }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('idle') // idle | parsed | importing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)
  const [dilewati, setDilewati] = useState(0)

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

        // Baca dulu sebagai baris mentah untuk mencari baris header sebenarnya
        const rowsAoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false })
        const idxHeader = cariBarisHeader(rowsAoa, templateHeaders)

        // Lalu baca ulang mulai dari baris header itu, jadi key object = nama kolom asli
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '', range: idxHeader })

        const mapped = json.map(mapRow).filter(Boolean)
        setRows(mapped)
        setDilewati(idxHeader)
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
    setDilewati(0)
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
          Unggah file Excel/CSV untuk menambahkan banyak data sekaligus. File ekspor asli
          (misalnya Dapodik, dengan baris judul di bagian atas) bisa langsung diunggah apa adanya.
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
            {rows.length} baris data siap diimpor
            {dilewati > 0 ? ` (${dilewati} baris judul di atas otomatis dilewati)` : ''}.
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
