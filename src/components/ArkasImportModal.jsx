import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Tombol + Modal "Input Data Massal ARKAS"
 * Menerima file CSV (hasil pdf_ke_csv_arkas.py) atau Excel dengan kolom:
 * no_urut, level, kode_kegiatan, kode_rekening, item_no, uraian, jumlah,
 * bosp_reguler_operasi, bosp_reguler_modal, bosp_daerah_operasi, bosp_daerah_modal,
 * afirmasi_kinerja_operasi, afirmasi_kinerja_modal, silpa_operasi, silpa_modal,
 * bosp_lainnya_operasi, bosp_lainnya_modal, is_item
 *
 * Penggunaan di Keuangan.jsx:
 *   import ArkasImportModal from '../components/ArkasImportModal'
 *   ...
 *   <ArkasImportModal tahunAnggaran={String(tahun)} onSelesai={loadData} />
 */

const NUMERIC_FIELDS = [
  'jumlah',
  'bosp_reguler_operasi', 'bosp_reguler_modal',
  'bosp_daerah_operasi', 'bosp_daerah_modal',
  'afirmasi_kinerja_operasi', 'afirmasi_kinerja_modal',
  'silpa_operasi', 'silpa_modal',
  'bosp_lainnya_operasi', 'bosp_lainnya_modal',
]

function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function normalizeRow(row, tahunAnggaran, npsn) {
  const out = {
    tahun_anggaran: tahunAnggaran,
    npsn: npsn || null,
    no_urut: row.no_urut ? parseInt(row.no_urut, 10) : null,
    level: row.level ? parseInt(row.level, 10) : 1,
    kode_kegiatan: row.kode_kegiatan || null,
    kode_rekening: row.kode_rekening || null,
    item_no: row.item_no || null,
    uraian: (row.uraian || '').trim(),
    is_item: String(row.is_item).trim().toLowerCase() === 'true' || row.is_item === true,
    status: 'draft',
  }
  for (const f of NUMERIC_FIELDS) out[f] = toNumber(row[f])
  return out
}

export default function ArkasImportModal({ tahunAnggaran, npsn, onSelesai }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  function resetState() {
    setRows([])
    setFileName('')
    setError('')
    setDone(null)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    resetState()
    setFileName(file.name)

    if (file.name.toLowerCase().endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => setRows(result.data.map((r) => normalizeRow(r, tahunAnggaran, npsn))),
        error: (err) => setError('Gagal membaca CSV: ' + err.message),
      })
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'binary' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          setRows(json.map((r) => normalizeRow(r, tahunAnggaran, npsn)))
        } catch (err) {
          setError('Gagal membaca Excel: ' + err.message)
        }
      }
      reader.readAsBinaryString(file)
    }
  }

  async function handleImport() {
    if (rows.length === 0) return
    setLoading(true)
    setError('')
    const BATCH_SIZE = 200
    let insertedTotal = 0

    try {
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error: insertError, data } = await supabase
          .from('arkas_anggaran')
          .insert(batch)
          .select('id')
        if (insertError) throw insertError
        insertedTotal += data?.length || 0
      }
      setDone({ inserted: insertedTotal, total: rows.length })
      onSelesai?.()
    } catch (err) {
      setError('Gagal menyimpan ke database: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>
        <Upload size={16} /> Input Data Massal ARKAS
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Input Data Massal ARKAS</h2>
              <button className="icon-btn" onClick={() => { setOpen(false); resetState() }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-ink-700/60 mb-3">
              Upload file CSV atau Excel hasil konversi Kertas Kerja ARKAS
              (pakai skrip <code>pdf_ke_csv_arkas.py</code> kalau sumbernya PDF).
            </p>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="input-field mb-3"
            />

            {fileName && (
              <div className="text-sm text-ink-700/70 mb-3">
                File: <strong>{fileName}</strong> — {rows.length} baris terbaca
                {' '}({rows.filter((r) => r.is_item).length} baris item)
              </div>
            )}

            {rows.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded-lg text-xs mb-3">
                <table className="w-full">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">Uraian</th>
                      <th className="text-right p-1">Jumlah</th>
                      <th className="text-center p-1">Item?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1">{r.uraian}</td>
                        <td className="p-1 text-right">{r.jumlah.toLocaleString('id-ID')}</td>
                        <td className="p-1 text-center">{r.is_item ? '✓' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <div className="p-1 text-center text-ink-700/40">...dan {rows.length - 20} baris lainnya</div>
                )}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 mb-3">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            {done && (
              <div className="flex items-center gap-2 text-sm text-sage-600 mb-3">
                <CheckCircle2 size={16} /> Berhasil! {done.inserted} dari {done.total} baris tersimpan.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button className="btn-secondary" onClick={() => { setOpen(false); resetState() }}>
                Tutup
              </button>
              <button
                className="btn-primary"
                onClick={handleImport}
                disabled={rows.length === 0 || loading}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Simpan {rows.length > 0 ? rows.length : ''} Baris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
