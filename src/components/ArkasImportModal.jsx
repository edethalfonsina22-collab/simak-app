import { useState } from 'react'
import Papa from 'papaparse'
import { parseArkasPdf } from '../lib/parseArkasPdf'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Tombol + Modal "Input Data Massal ARKAS"
 * Menerima file PDF Kertas Kerja RKAS/ARKAS asli (dibaca langsung di
 * browser lewat parseArkasPdf, tidak perlu konversi manual lagi) atau file
 * CSV dengan kolom:
 * no_urut, level, kode_kegiatan, kode_rekening, item_no, uraian, jumlah,
 * bosp_reguler_operasi, bosp_reguler_modal, bosp_daerah_operasi, bosp_daerah_modal,
 * afirmasi_kinerja_operasi, afirmasi_kinerja_modal, silpa_operasi, silpa_modal,
 * bosp_lainnya_operasi, bosp_lainnya_modal, is_item, tanggal (opsional)
 *
 * TAHUN ANGGARAN & TANGGAL:
 * - Untuk file PDF: tahun anggaran diambil otomatis dari teks
 *   "TAHUN ANGGARAN : ####" di dalam PDF itu sendiri (BUKAN dari tahun
 *   berjalan aplikasi/komputer, dan bukan dari dropdown Tahun Anggaran di
 *   halaman Keuangan) — supaya tetap benar walau yang sedang dikerjakan
 *   adalah ARKAS untuk tahun sebelumnya. Semua baris otomatis dapat
 *   tanggal 1 Januari tahun tersebut, karena PDF tidak punya kolom tanggal
 *   per baris.
 * - Untuk file CSV: kolom "tanggal" (opsional, per baris) tetap dipakai
 *   kalau ada; kalau kosong dipakai fallback 1 Januari dari prop
 *   tahunAnggaran (nilai dropdown Tahun Anggaran di halaman Keuangan).
 *   Format yang didukung: YYYY-MM-DD, YYYY/MM/DD, DD-MM-YYYY, DD/MM/YYYY.
 *
 * PENTING: sebelum insert data baru, modal ini akan MENGHAPUS dulu:
 *  1) semua baris ARKAS untuk tahun anggaran (& npsn) yang sama di tabel
 *     `arkas_anggaran` (detail lengkap, semua level/hirarki)
 *  2) semua baris hasil impor ARKAS tahun ini di tabel `keuangan` (ditandai
 *     lewat prefix "[ARKAS-<tahun>]" di kolom catatan)
 * lalu insert ulang keduanya. Jadi upload = "ganti total" data tahun itu,
 * bukan "tambah terus" — supaya tidak dobel walau file yang sama di-upload
 * berkali-kali. "Tahun" yang dipakai di sini adalah tahun anggaran efektif
 * (hasil deteksi PDF kalau filenya PDF, atau prop tahunAnggaran kalau CSV).
 *
 * Data yang masuk ke tabel `keuangan` hanya baris item (is_item = true)
 * dengan jumlah > 0, supaya baris header/grup ARKAS tidak ikut terhitung
 * dobel di ringkasan Pemasukan/Pengeluaran halaman Keuangan.
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

const ARKAS_TAG_PREFIX = '[ARKAS-'

function toNumber(val) {
  if (val === null || val === undefined || val === '') return 0
  if (typeof val === 'number') return val
  const cleaned = String(val).replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

// Ambil nilai kolom dari raw row tanpa peduli besar/kecil huruf nama kolom
// (mis. "Tanggal", "tanggal", "TANGGAL" dianggap sama).
function getField(row, names) {
  const keys = Object.keys(row)
  for (const name of names) {
    const found = keys.find((k) => k.trim().toLowerCase() === name.toLowerCase())
    if (found !== undefined && row[found] !== '') return row[found]
  }
  return undefined
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatDateISO(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

// CSV kadang menyimpan tanggal sebagai serial number (hari sejak 1899-12-30).
function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569)
  const utcValue = utcDays * 86400
  return new Date(utcValue * 1000)
}

// Parse nilai kolom "tanggal" dari file CSV. Mendukung:
// - Date object
// - Serial number ala Excel
// - String "YYYY-MM-DD" / "YYYY/MM/DD"
// - String "DD-MM-YYYY" / "DD/MM/YYYY"
// Kalau gagal / kosong, fallback ke 1 Januari tahunFallback.
function parseTanggal(val, tahunFallback) {
  const fallback = `${tahunFallback}-01-01`
  if (val === null || val === undefined || val === '') return fallback

  if (val instanceof Date && !isNaN(val)) return formatDateISO(val)

  if (typeof val === 'number') {
    const d = excelSerialToDate(val)
    return isNaN(d) ? fallback : formatDateISO(d)
  }

  const str = String(val).trim()

  let m = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) {
    const [, y, mo, d] = m
    return `${y}-${pad2(mo)}-${pad2(d)}`
  }

  m = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${pad2(mo)}-${pad2(d)}`
  }

  return fallback
}

function normalizeCsvRow(row, tahunAnggaran, npsn) {
  const arkas = {
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
  for (const f of NUMERIC_FIELDS) arkas[f] = toNumber(row[f])

  // tanggal HANYA dipakai untuk mapping ke tabel keuangan, tidak dikirim ke
  // tabel arkas_anggaran (supaya tidak error kalau kolom itu tidak ada di sana).
  const tanggalMentah = getField(row, ['tanggal', 'tanggal_transaksi'])
  const tanggal = parseTanggal(tanggalMentah, tahunAnggaran)

  return { arkas, tanggal }
}

// Mapping baris ARKAS -> baris ringkas untuk tabel keuangan.
// Hanya dipakai untuk baris item (is_item true) dengan jumlah > 0.
function toKeuanganRow({ arkas, tanggal }) {
  const tag = `${ARKAS_TAG_PREFIX}${arkas.tahun_anggaran}]`
  const kodeRek = arkas.kode_rekening ? ` (${arkas.kode_rekening})` : ''
  return {
    jenis: 'keluar',
    kategori: 'Lainnya',
    siswa_id: null,
    jumlah: arkas.jumlah,
    tanggal,
    catatan: `${tag} ${arkas.uraian}${kodeRek}`.trim(),
  }
}

export default function ArkasImportModal({ tahunAnggaran, npsn, onSelesai }) {
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState([]) // array of { arkas, tanggal }
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(null)
  const [pdfMeta, setPdfMeta] = useState(null) // { tahunAnggaran, npsn } kalau sumbernya PDF

  // Tahun anggaran yang benar-benar dipakai untuk hapus+insert: kalau file
  // PDF, pakai tahun yang terdeteksi dari isi PDF (bukan dropdown halaman
  // Keuangan) supaya tetap benar walau sedang mengerjakan ARKAS tahun lalu.
  const tahunEfektif = pdfMeta?.tahunAnggaran || tahunAnggaran

  function resetState() {
    setRows([])
    setFileName('')
    setError('')
    setDone(null)
    setPdfMeta(null)
  }

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    resetState()
    setFileName(file.name)

    const lower = file.name.toLowerCase()

    if (lower.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (result) => setRows(result.data.map((r) => normalizeCsvRow(r, tahunAnggaran, npsn))),
        error: (err) => setError('Gagal membaca CSV: ' + err.message),
      })
    } else if (lower.endsWith('.pdf')) {
      setLoading(true)
      parseArkasPdf(file, tahunAnggaran, npsn)
        .then(({ rows: parsedRows, tahunAnggaran: tahunTerdeteksi, npsn: npsnTerdeteksi }) => {
          setRows(parsedRows)
          setPdfMeta({ tahunAnggaran: tahunTerdeteksi, npsn: npsnTerdeteksi })
        })
        .catch((err) => setError('Gagal membaca PDF: ' + err.message))
        .finally(() => setLoading(false))
    } else {
      setError('Format file tidak didukung. Upload file .pdf (Kertas Kerja ARKAS asli) atau .csv.')
    }
  }

  async function handleImport() {
    if (rows.length === 0) return

    const konfirmasi = confirm(
      `Data ARKAS tahun ${tahunEfektif} yang sudah ada (di tabel arkas_anggaran maupun di daftar Transaksi Keuangan) akan DIHAPUS dan diganti dengan ${rows.length} baris dari file ini. Lanjutkan?`
    )
    if (!konfirmasi) return

    setLoading(true)
    setError('')

    try {
      // 1) Hapus dulu data ARKAS tahun ini (& npsn ini kalau ada) di tabel detail
      //    arkas_anggaran, supaya upload ulang tidak menumpuk jadi dobel.
      let hapusArkasQuery = supabase.from('arkas_anggaran').delete().eq('tahun_anggaran', tahunEfektif)
      if (npsn) hapusArkasQuery = hapusArkasQuery.eq('npsn', npsn)
      const { error: hapusArkasError } = await hapusArkasQuery
      if (hapusArkasError) throw hapusArkasError

      // 2) Hapus juga baris hasil impor ARKAS tahun ini di tabel keuangan
      //    (ditandai lewat prefix "[ARKAS-<tahun>]" pada kolom catatan).
      const tagTahun = `${ARKAS_TAG_PREFIX}${tahunEfektif}]%`
      const { error: hapusKeuanganError } = await supabase
        .from('keuangan')
        .delete()
        .ilike('catatan', tagTahun)
      if (hapusKeuanganError) throw hapusKeuanganError

      // 3) Insert data detail baru ke arkas_anggaran per batch
      const BATCH_SIZE = 200
      let insertedTotal = 0
      for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE).map((r) => r.arkas)
        const { error: insertError, data } = await supabase
          .from('arkas_anggaran')
          .insert(batch)
          .select('id')
        if (insertError) throw insertError
        insertedTotal += data?.length || 0
      }

      // 4) Insert versi ringkas ke tabel keuangan supaya muncul di halaman
      //    Keuangan/Transaksi. Hanya baris item (is_item true) dengan jumlah > 0,
      //    tanggalnya mengikuti kolom "tanggal" pada file impor.
      const keuanganRows = rows
        .filter((r) => r.arkas.is_item && r.arkas.jumlah > 0)
        .map(toKeuanganRow)

      let keuanganInsertedTotal = 0
      for (let i = 0; i < keuanganRows.length; i += BATCH_SIZE) {
        const batch = keuanganRows.slice(i, i + BATCH_SIZE)
        const { error: insertKeuanganError, data } = await supabase
          .from('keuangan')
          .insert(batch)
          .select('id')
        if (insertKeuanganError) throw insertKeuanganError
        keuanganInsertedTotal += data?.length || 0
      }

      setDone({ inserted: insertedTotal, total: rows.length, keuangan: keuanganInsertedTotal })
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
              Upload file <strong>PDF Kertas Kerja RKAS/ARKAS</strong> asli (langsung dibaca
              di sini, tidak perlu konversi manual), atau file <strong>CSV</strong> hasil
              ekspor manual. Tahun anggaran & tanggal transaksi untuk file PDF diambil otomatis
              dari isi PDF itu sendiri, bukan dari tahun berjalan aplikasi — jadi tetap benar
              walau yang sedang diimpor adalah ARKAS untuk tahun sebelumnya.
              <strong> Upload baru akan menggantikan seluruh data ARKAS tahun itu yang lama</strong>, baik
              detail anggaran maupun ringkasannya di daftar Transaksi Keuangan.
            </p>

            <input
              type="file"
              accept=".pdf,.csv"
              onChange={handleFile}
              className="input-field mb-3"
            />

            {pdfMeta && (
              <div className="text-sm mb-3 p-2 rounded-lg bg-sage-50 text-ink-700/80">
                Terdeteksi dari PDF: <strong>Tahun Anggaran {pdfMeta.tahunAnggaran}</strong>
                {pdfMeta.npsn ? <> · NPSN {pdfMeta.npsn}</> : null}
                {String(tahunAnggaran) !== String(pdfMeta.tahunAnggaran) && (
                  <div className="flex items-center gap-2 text-amber-600 mt-1">
                    <AlertCircle size={14} />
                    Tahun ini beda dengan filter Tahun Anggaran ({tahunAnggaran}) yang lagi
                    dipilih di halaman Keuangan. Data akan disimpan sebagai tahun{' '}
                    <strong>{pdfMeta.tahunAnggaran}</strong> mengikuti isi PDF — pastikan itu
                    memang tahun yang dimaksud.
                  </div>
                )}
              </div>
            )}

            {fileName && !loading && (
              <div className="text-sm text-ink-700/70 mb-3">
                File: <strong>{fileName}</strong> — {rows.length} baris terbaca
                {' '}({rows.filter((r) => r.arkas.is_item).length} baris item)
              </div>
            )}

            {rows.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded-lg text-xs mb-3">
                <table className="w-full">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">Uraian</th>
                      <th className="text-left p-1">Tanggal</th>
                      <th className="text-right p-1">Jumlah</th>
                      <th className="text-center p-1">Item?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1">{r.arkas.uraian}</td>
                        <td className="p-1">{r.tanggal}</td>
                        <td className="p-1 text-right">{r.arkas.jumlah.toLocaleString('id-ID')}</td>
                        <td className="p-1 text-center">{r.arkas.is_item ? '✓' : ''}</td>
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
                <CheckCircle2 size={16} /> Berhasil! {done.inserted} dari {done.total} baris tersimpan ke arkas_anggaran,
                {' '}{done.keuangan} baris item masuk ke Transaksi Keuangan (data lama tahun {tahunEfektif} sudah diganti).
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
