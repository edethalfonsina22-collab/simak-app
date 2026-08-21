import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, AlertTriangle } from 'lucide-react'

/**
 * Tombol + Modal "Input Data Massal BKU"
 * Menerima CSV/Excel hasil konversi PDF BKU Pembantu Bank lewat
 * pdf_ke_csv_bku.py (lihat file itu di root repo untuk cara pakai).
 *
 * Kolom yang dibaca dari file:
 *   tanggal, no_bukti, uraian, penerimaan, pengeluaran,
 *   kode_kegiatan, kode_rekening, saldo_dokumen
 * (saldo_dokumen dipakai HANYA untuk validasi silang, tidak disimpan
 * ke database — saldo berjalan selalu dihitung ulang dari penerimaan
 * dan pengeluaran tiap kali halaman Keuangan dibuka.)
 *
 * Upload akan MENGHAPUS dulu data bku_kas pada tahun+bulan yang sama
 * dengan baris-baris di file, baru insert ulang — supaya upload
 * berkali-kali tidak menumpuk jadi dobel. Satu file boleh berisi lebih
 * dari satu bulan (mis. rekap satu tahun penuh); tiap baris dikelompokkan
 * ke bulan sesuai tanggalnya sendiri, bukan filter Bulan yang aktif di
 * halaman.
 *
 * Penggunaan di Keuangan.jsx (sudah ada di file itu):
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

function normalizeRow(row) {
  return {
    tanggal: (row.tanggal || '').trim(),
    no_bukti: (row.no_bukti || '').trim() || null,
    uraian: (row.uraian || '').trim(),
    penerimaan: toNumber(row.penerimaan),
    pengeluaran: toNumber(row.pengeluaran),
    kode_kegiatan: (row.kode_kegiatan || '').trim() || null,
    kode_rekening: (row.kode_rekening || '').trim() || null,
    saldo_dokumen: row.saldo_dokumen !== undefined && row.saldo_dokumen !== ''
      ? toNumber(row.saldo_dokumen)
      : null,
  }
}

function tahunBulanDari(tanggal) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tanggal)
  if (!m) return null
  return { tahun: parseInt(m[1], 10), bulan: parseInt(m[2], 10) }
}

export default function BkuImportModal({ tahun, bulan, npsn, onSelesai }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [invalidCount, setInvalidCount] = useState(0)
  const [mismatchCount, setMismatchCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  function resetState() {
    setRows([])
    setInvalidCount(0)
    setMismatchCount(0)
    setFileName('')
    setError('')
    setDone(null)
  }

  function processRows(rawRows) {
    const normalized = rawRows.map(normalizeRow)
    const valid = normalized.filter((r) => tahunBulanDari(r.tanggal) && r.uraian)
    setInvalidCount(normalized.length - valid.length)

    // Validasi silang: hitung ulang saldo berjalan per bulan lalu
    // bandingkan dengan saldo_dokumen dari PDF, supaya salah parse
    // ketahuan sebelum data disimpan ke database.
    const saldoBerjalan = new Map()
    let mismatches = 0
    valid.forEach((r) => {
      const { tahun: ty, bulan: bm } = tahunBulanDari(r.tanggal)
      const key = `${ty}-${bm}`
      const prev = saldoBerjalan.get(key) || 0
      const next = prev + r.penerimaan - r.pengeluaran
      saldoBerjalan.set(key, next)
      if (r.saldo_dokumen !== null && Math.round(next) !== Math.round(r.saldo_dokumen)) {
        mismatches += 1
      }
    })
    setMismatchCount(mismatches)
    setRows(valid)
  }

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    resetState()
    setFileName(file.name)

    const lower = file.name.toLowerCase()

    if (lower.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => processRows(result.data),
        error: (err) => setError('Gagal membaca CSV: ' + err.message),
      })
      return
    }

    if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
      const reader = new FileReader()
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target.result, { type: 'binary' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          processRows(json)
        } catch (err) {
          setError('Gagal membaca Excel: ' + err.message)
        }
      }
      reader.readAsBinaryString(file)
      return
    }

    setError('Format file tidak dikenali. Gunakan file .csv atau .xlsx hasil konversi pdf_ke_csv_bku.py.')
  }

  const kelompok = [...new Set(rows.map((r) => {
    const { tahun: ty, bulan: bm } = tahunBulanDari(r.tanggal)
    return `${ty}-${String(bm).padStart(2, '0')}`
  }))].sort()

  async function handleImport() {
    if (rows.length === 0) return

    const konfirmasi = confirm(
      `Data BKU pada ${kelompok.length} bulan (${kelompok.join(', ')}) yang sudah ada akan DIHAPUS dan diganti dengan ${rows.length} baris dari file ini. Lanjutkan?`
    )
    if (!konfirmasi) return

    setLoading(true)
    setError('')

    try {
      // 1) Hapus dulu data pada bulan-bulan yang tersentuh file ini,
      //    supaya upload ulang tidak menumpuk jadi dobel.
      for (const key of kelompok) {
        const [ty, bm] = key.split('-').map(Number)
        let hapusQuery = supabase.from('bku_kas').delete().eq('tahun', ty).eq('bulan', bm)
        if (npsn) hapusQuery = hapusQuery.eq('npsn', npsn)
        const { error: hapusError } = await hapusQuery
        if (hapusError) throw hapusError
      }

      // 2) Insert data baru per batch
      const payload = rows.map((r) => {
        const { tahun: ty, bulan: bm } = tahunBulanDari(r.tanggal)
        return {
          npsn: npsn || null,
          tahun: ty,
          bulan: bm,
          tanggal: r.tanggal,
          no_bukti: r.no_bukti,
          uraian: r.uraian,
          kode_kegiatan: r.kode_kegiatan,
          kode_rekening: r.kode_rekening,
          penerimaan: r.penerimaan,
          pengeluaran: r.pengeluaran,
        }
      })

      const BATCH_SIZE = 200
      let insertedTotal = 0
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE)
        const { error: insertError, data } = await supabase
          .from('bku_kas')
          .insert(batch)
          .select('id')
        if (insertError) throw insertError
        insertedTotal += data?.length || 0
      }
      setDone({ inserted: insertedTotal, total: payload.length })
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
              Upload file CSV/Excel hasil konversi PDF BKU Pembantu Bank (lihat <code>pdf_ke_csv_bku.py</code> di
              root repo). <strong>Upload baru akan menggantikan data BKU pada bulan-bulan yang ada di file ini</strong>,
              bukan menambah.
            </p>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="input-field mb-3"
            />

            {fileName && (
              <div className="text-sm text-ink-700/70 mb-3">
                File: <strong>{fileName}</strong> — {rows.length} baris siap diimpor
                {kelompok.length > 0 && <> ({kelompok.length} bulan: {kelompok.join(', ')})</>}
              </div>
            )}

            {invalidCount > 0 && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{invalidCount} baris dilewati karena tanggal atau uraian kosong/tidak valid.</span>
              </div>
            )}

            {mismatchCount > 0 && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {mismatchCount} baris punya saldo berjalan hasil hitung yang beda dari saldo di PDF asli.
                  Kemungkinan ada baris yang salah terbaca — sebaiknya dicek dulu sebelum disimpan.
                </span>
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
                        <td className="p-1">{r.tanggal}</td>
                        <td className="p-1">{r.uraian}</td>
                        <td className="p-1 text-right">{r.penerimaan ? r.penerimaan.toLocaleString('id-ID') : '-'}</td>
                        <td className="p-1 text-right">{r.pengeluaran ? r.pengeluaran.toLocaleString('id-ID') : '-'}</td>
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
