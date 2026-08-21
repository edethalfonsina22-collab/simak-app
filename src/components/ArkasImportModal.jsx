import { useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle, AlertTriangle, Download } from 'lucide-react'

/**
 * Tombol + Modal "Input Data Massal ARKAS"
 * Menerima CSV/Excel hasil konversi PDF ARKAS (rencana anggaran sekolah).
 *
 * Kolom yang dibaca dari file:
 *   tahun_anggaran, no_urut, kode_rekening, kode_kegiatan, uraian,
 *   jumlah, status, is_item
 *
 * PENTING soal tahun anggaran:
 *   Sekolah sering mengerjakan laporan untuk tahun anggaran yang BUKAN
 *   tahun berjalan (mis. menyusun ARKAS 2024 di tahun 2026). Karena itu
 *   modal ini TIDAK memaksa semua baris memakai filter "Tahun" yang
 *   sedang aktif di halaman Keuangan — setiap baris membawa
 *   tahun_anggaran-nya sendiri dari file, dan baris-baris dikelompokkan
 *   per tahun_anggaran itu sendiri (sama seperti BkuImportModal
 *   mengelompokkan tiap baris BKU per tahun+bulan dari kolom tanggal,
 *   bukan dari filter Bulan/Tahun aktif).
 *
 * Upload akan MENGHAPUS dulu data arkas_anggaran pada tahun_anggaran yang
 * sama dengan baris-baris di file, baru insert ulang — supaya upload
 * berkali-kali tidak menumpuk jadi dobel. Satu file boleh berisi lebih
 * dari satu tahun anggaran sekaligus.
 *
 * Penggunaan di Keuangan.jsx:
 *   import ArkasImportModal from '../components/ArkasImportModal'
 *   ...
 *   <ArkasImportModal onSelesai={loadArkasData} />
 *
 * (Prop tahunAnggaran lama masih diterima untuk kompatibilitas tapi
 * tidak lagi dipakai untuk menentukan tahun data — tahun diambil dari
 * isi file.)
 */

const TEMPLATE_HEADERS = [
  'tahun_anggaran', 'no_urut', 'kode_rekening', 'kode_kegiatan', 'uraian',
  'jumlah', 'status', 'is_item',
]

// Baris contoh — sengaja pakai dua tahun anggaran berbeda untuk
// menunjukkan bahwa satu file boleh berisi lebih dari satu tahun.
const TEMPLATE_CONTOH = [
  ['2024', '1', '5.1.02.01.01.00', '06.05.08.', 'Belanja ATK', '', 'header', 'FALSE'],
  ['2024', '2', '5.1.02.01.01.00', '06.05.08.', 'Kertas HVS Folio', '420000', 'disetujui', 'TRUE'],
  ['2025', '1', '5.1.02.03.05.00', '05.02.03.', 'Belanja Buku Siswa', '', 'header', 'FALSE'],
  ['2025', '2', '5.1.02.03.05.00', '05.02.03.', 'KELAS II (BUKU SISWA) Tema 5 Pengalamanku', '170000', 'disetujui', 'TRUE'],
]

function unduhTemplateArkas() {
  const baris = [TEMPLATE_HEADERS, ...TEMPLATE_CONTOH]
  const csv = baris.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-arkas.csv'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function toBool(val) {
  if (typeof val === 'boolean') return val
  const s = String(val ?? '').trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'ya' || s === 'item'
}

function normalizeRow(row, idx) {
  return {
    tahun_anggaran: (row.tahun_anggaran ?? '').toString().trim(),
    no_urut: row.no_urut !== undefined && row.no_urut !== '' ? toNumber(row.no_urut) : idx + 1,
    kode_rekening: (row.kode_rekening || '').toString().trim() || null,
    kode_kegiatan: (row.kode_kegiatan || '').toString().trim() || null,
    uraian: (row.uraian || '').toString().trim(),
    jumlah: toNumber(row.jumlah),
    status: (row.status || '').toString().trim() || null,
    is_item: toBool(row.is_item),
  }
}

function tahunValid(tahun_anggaran) {
  return /^\d{4}$/.test(tahun_anggaran)
}

export default function ArkasImportModal({ tahunAnggaran, npsn, onSelesai }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([])
  const [invalidCount, setInvalidCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)

  function resetState() {
    setRows([])
    setInvalidCount(0)
    setFileName('')
    setError('')
    setDone(null)
  }

  function processRows(rawRows) {
    const normalized = rawRows.map(normalizeRow)
    const valid = normalized.filter((r) => tahunValid(r.tahun_anggaran) && r.uraian)
    setInvalidCount(normalized.length - valid.length)
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

    setError('Format file tidak dikenali. Gunakan file .csv atau .xlsx hasil konversi PDF ARKAS.')
  }

  const kelompok = [...new Set(rows.map((r) => r.tahun_anggaran))].sort()

  async function handleImport() {
    if (rows.length === 0) return

    const konfirmasi = confirm(
      `Data ARKAS pada ${kelompok.length} tahun anggaran (${kelompok.join(', ')}) yang sudah ada akan DIHAPUS dan diganti dengan ${rows.length} baris dari file ini. Lanjutkan?`
    )
    if (!konfirmasi) return

    setLoading(true)
    setError('')

    try {
      // 1) Hapus dulu data pada tahun-tahun anggaran yang tersentuh file
      //    ini, supaya upload ulang tidak menumpuk jadi dobel.
      for (const ty of kelompok) {
        let hapusQuery = supabase.from('arkas_anggaran').delete().eq('tahun_anggaran', ty)
        if (npsn) hapusQuery = hapusQuery.eq('npsn', npsn)
        const { error: hapusError } = await hapusQuery
        if (hapusError) throw hapusError
      }

      // 2) Insert data baru per batch
      const payload = rows.map((r) => ({
        npsn: npsn || null,
        tahun_anggaran: r.tahun_anggaran,
        no_urut: r.no_urut,
        kode_rekening: r.kode_rekening,
        kode_kegiatan: r.kode_kegiatan,
        uraian: r.uraian,
        jumlah: r.jumlah,
        status: r.status,
        is_item: r.is_item,
      }))

      const BATCH_SIZE = 200
      let insertedTotal = 0
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE)
        const { error: insertError, data } = await supabase
          .from('arkas_anggaran')
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
              Upload file CSV/Excel hasil konversi PDF ARKAS. Tahun anggaran diambil dari
              kolom <code>tahun_anggaran</code> di masing-masing baris file — bukan dari filter
              Tahun yang aktif di halaman ini — sehingga satu file boleh berisi laporan untuk
              tahun anggaran yang berbeda dari tahun berjalan.{' '}
              <strong>Upload baru akan menggantikan data ARKAS pada tahun anggaran yang ada di file ini</strong>,
              bukan menambah.
            </p>

            <button
              type="button"
              className="btn-secondary w-full mb-3 justify-center"
              onClick={unduhTemplateArkas}
            >
              <Download size={16} /> Unduh Template CSV
            </button>

            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFile}
              className="input-field mb-3"
            />

            {fileName && (
              <div className="text-sm text-ink-700/70 mb-3">
                File: <strong>{fileName}</strong> — {rows.length} baris siap diimpor
                {kelompok.length > 0 && <> ({kelompok.length} tahun anggaran: {kelompok.join(', ')})</>}
              </div>
            )}

            {invalidCount > 0 && (
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg p-2 mb-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{invalidCount} baris dilewati karena tahun_anggaran atau uraian kosong/tidak valid.</span>
              </div>
            )}

            {rows.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded-lg text-xs mb-3">
                <table className="w-full">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">Tahun</th>
                      <th className="text-left p-1">Kode Rekening</th>
                      <th className="text-left p-1">Uraian</th>
                      <th className="text-right p-1">Jumlah</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1">{r.tahun_anggaran}</td>
                        <td className="p-1">{r.kode_rekening || '-'}</td>
                        <td className="p-1">{r.uraian}</td>
                        <td className="p-1 text-right">{r.jumlah ? r.jumlah.toLocaleString('id-ID') : '-'}</td>
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
