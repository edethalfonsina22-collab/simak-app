import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Tombol + Modal "Input Data Massal BKU (Buku Kas Umum)"
 * Menerima file CSV (hasil pdf_ke_csv_bku.py) atau Excel dengan kolom:
 * tanggal, no_bukti, uraian, penerimaan, pengeluaran
 *
 * Catatan format sumber:
 *  - tanggal harus berformat YYYY-MM-DD (kalau file sumber pakai format
 *    lain, ubah dulu di skrip konversi atau di file sebelum diupload)
 *  - penerimaan / pengeluaran boleh kosong untuk salah satu (baris
 *    penerimaan mengisi kolom penerimaan saja, baris pengeluaran mengisi
 *    kolom pengeluaran saja), nilai kosong dianggap 0
 *
 * PENTING (mengikuti pola ArkasImportModal): sebelum insert data baru,
 * modal ini akan MENGHAPUS dulu semua baris BKU untuk bulan & tahun yang
 * sama (& npsn kalau ada). Jadi upload = "ganti total" data bulan itu,
 * bukan "tambah terus" — supaya tidak dobel walau file yang sama
 * di-upload berkali-kali.
 *
 * Penggunaan di Keuangan.jsx:
 *   import BkuImportModal from '../components/BkuImportModal'
 *   ...
 *   <BkuImportModal bulan={bulan} tahun={tahun} onSelesai={loadBkuData} />
 */

function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function normalizeTanggal(val) {
  if (!val) return null
  const s = String(val).trim()
  // Sudah format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // Format DD/MM/YYYY atau DD-MM-YYYY
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return s
}

function normalizeRow(row, bulan, tahun, npsn) {
  return {
    tahun: Number(tahun),
    bulan: Number(bulan),
    npsn: npsn || null,
    tanggal: normalizeTanggal(row.tanggal),
    no_bukti: (row.no_bukti || '').toString().trim() || null,
    uraian: (row.uraian || '').toString().trim(),
    penerimaan: toNumber(row.penerimaan),
    pengeluaran: toNumber(row.pengeluaran),
    // Kolom tambahan opsional — hanya terisi kalau sumbernya CSV hasil
    // pdf_ke_csv_bku.py (yang menyertakan kode_kegiatan/kode_rekening
    // dari PDF BKU Pembantu Bank). Kalau file CSV/Excel tidak punya
    // kolom ini, nilainya otomatis kosong dan tidak masalah.
    kode_kegiatan: (row.kode_kegiatan || '').toString().trim() || null,
    kode_rekening: (row.kode_rekening || '').toString().trim() || null,
    status: 'draft',
  }
}

export default function BkuImportModal({ bulan, tahun, npsn, onSelesai }) {
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
        complete: (result) => setRows(result.data.map((r) => normalizeRow(r, bulan, tahun, npsn))),
        error: (err) => setError('Gagal membaca CSV: ' + err.message),
      })
    } else {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'binary' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          setRows(json.map((r) => normalizeRow(r, bulan, tahun, npsn)))
        } catch (err) {
          setError('Gagal membaca Excel: ' + err.message)
        }
      }
      reader.readAsBinaryString(file)
    }
  }

  async function handleImport() {
    if (rows.length === 0) return

    const namaBulan = ['', 'Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'][bulan]

    const konfirmasi = confirm(
      `Data BKU bulan ${namaBulan} ${tahun} yang sudah ada akan DIHAPUS dan diganti dengan ${rows.length} baris dari file ini. Lanjutkan?`
    )
    if (!konfirmasi) return

    setLoading(true)
    setError('')

    try {
      // 1) Hapus dulu data BKU bulan & tahun ini (& npsn ini kalau ada)
      //    supaya upload ulang tidak menumpuk jadi dobel.
      let hapusQuery = supabase.from('bku_kas').delete().eq('tahun', Number(tahun)).eq('bulan', Number(bulan))
      if (npsn) hapusQuery = hapusQuery.eq('npsn', npsn)
      const { error: hapusError } = await hapusQuery
      if (hapusError) throw hapusError

      // 2) Insert data baru per batch
      const BATCH_SIZE = 200
      let insertedTotal = 0
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE)
        const { error: insertError, data } = await supabase
          .from('bku_kas')
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
      <button className="btn-primary" onClick={() => setOpen(true)}>
        <Upload size={16} /> Input Data Massal BKU
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Input Data Massal BKU</h2>
              <button className="icon-btn" onClick={() => { setOpen(false); resetState() }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-ink-700/60 mb-3">
              Upload file CSV atau Excel hasil konversi Buku Kas Umum
              (pakai skrip <code>pdf_ke_csv_bku.py</code> kalau sumbernya PDF).
              Kolom wajib: <code>tanggal, no_bukti, uraian, penerimaan, pengeluaran</code>.
              Kolom <code>kode_kegiatan</code> dan <code>kode_rekening</code> ikut tersimpan kalau ada.
              <strong> Upload baru akan menggantikan seluruh data BKU bulan ini yang lama</strong>, bukan menambah.
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
              </div>
            )}

            {rows.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded-lg text-xs mb-3">
                <table className="w-full">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">Tanggal</th>
                      <th className="text-left p-1">Uraian</th>
                      <th className="text-right p-1">Penerimaan</th>
                      <th className="text-right p-1">Pengeluaran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1">{r.tanggal || '-'}</td>
                        <td className="p-1">{r.uraian}</td>
                        <td className="p-1 text-right">{r.penerimaan ? r.penerimaan.toLocaleString('id-ID') : ''}</td>
                        <td className="p-1 text-right">{r.pengeluaran ? r.pengeluaran.toLocaleString('id-ID') : ''}</td>
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
                <CheckCircle2 size={16} /> Berhasil! {done.inserted} dari {done.total} baris tersimpan (data lama bulan ini sudah diganti).
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
