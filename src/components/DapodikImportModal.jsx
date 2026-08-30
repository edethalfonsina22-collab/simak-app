import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { matchKelasByName } from '../lib/kelasMatch'

/**
 * Modal impor khusus untuk file unduhan resmi Dapodik "Daftar Peserta Didik" (.xlsx).
 * BEDA dengan BulkImportModal biasa: file Dapodik punya struktur yang jauh lebih rumit
 * (4 baris judul/metadata, lalu header 2 baris dengan sel gabungan untuk Data Ayah/Ibu/Wali),
 * jadi tidak bisa dibaca dengan sheet_to_json biasa (yang menganggap baris pertama = header).
 *
 * Di sini file dibaca sebagai array-of-arrays (header:1), baris header dicari otomatis
 * (baris yang mengandung "NIPD"), lalu tiap baris data diambil berdasarkan POSISI KOLOM
 * tetap sesuai format ekspor Dapodik saat ini. Kalau suatu saat Kemendikbud mengubah
 * urutan kolom di ekspornya, cukup sesuaikan angka-angka di objek COL di bawah ini.
 */

// Posisi kolom (index array, mulai dari 0) berdasarkan baris header utama Dapodik.
const COL = {
  NAMA: 1,
  NIPD: 2,
  JK: 3,
  NISN: 4,
  TEMPAT_LAHIR: 5,
  TANGGAL_LAHIR: 6,
  NIK: 7,
  AGAMA: 8,
  ALAMAT: 9,
  AYAH_NAMA: 24,
  AYAH_TAHUN_LAHIR: 25,
  AYAH_NIK: 29,
  IBU_NAMA: 30,
  IBU_TAHUN_LAHIR: 31,
  IBU_NIK: 35,
  ROMBEL: 42, // "Rombel Saat Ini", contoh isinya: "Kelas 3"
}

function cell(row, idx) {
  const v = row[idx]
  return v === undefined || v === null ? '' : String(v).trim()
}

function toIntOrNull(v) {
  const n = parseInt(String(v || '').trim(), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function formatTanggal(v) {
  if (!v) return null
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).trim() || null
}

export default function DapodikImportModal({ open, onClose, kelasList, onImport }) {
  const [rows, setRows] = useState([])
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('idle') // idle | parsed | importing | done | error
  const [errorMsg, setErrorMsg] = useState('')
  const [result, setResult] = useState(null)
  const [tanpaKelasCount, setTanpaKelasCount] = useState(0)

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
        // Baca sebagai array-of-arrays supaya tidak terpengaruh baris judul/header ganda.
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        // Cari baris header utama secara otomatis (mengandung "NIPD").
        // Data baris siswa dimulai 2 baris setelahnya (baris berikutnya adalah
        // sub-header "Nama/Tahun Lahir/.../NIK" untuk Data Ayah/Ibu/Wali).
        const headerRowIndex = aoa.findIndex((r) => r.includes('NIPD'))
        if (headerRowIndex === -1) {
          throw new Error('Header "NIPD" tidak ditemukan')
        }

        const dataRows = aoa
          .slice(headerRowIndex + 2)
          .filter((r) => r[COL.NAMA] && String(r[COL.NAMA]).trim())

        const mapped = dataRows
          .map((row) => {
            const namaLengkap = cell(row, COL.NAMA)
            if (!namaLengkap) return null

            const rombel = cell(row, COL.ROMBEL)
            const matchedKelas = matchKelasByName(kelasList, rombel)

            return {
              nama_lengkap: namaLengkap,
              nis: cell(row, COL.NIPD),
              nisn: cell(row, COL.NISN),
              nik: cell(row, COL.NIK),
              jenis_kelamin: cell(row, COL.JK) === 'P' ? 'P' : 'L',
              agama: cell(row, COL.AGAMA),
              tempat_lahir: cell(row, COL.TEMPAT_LAHIR),
              tanggal_lahir: formatTanggal(row[COL.TANGGAL_LAHIR]),
              // Dapodik tidak membedakan alamat KTP vs alamat domisili, jadi keduanya diisi sama.
              alamat: cell(row, COL.ALAMAT),
              alamat_tinggal: cell(row, COL.ALAMAT),
              nama_ayah: cell(row, COL.AYAH_NAMA),
              nik_ayah: cell(row, COL.AYAH_NIK),
              tahun_lahir_ayah: toIntOrNull(row[COL.AYAH_TAHUN_LAHIR]),
              nama_ibu: cell(row, COL.IBU_NAMA),
              nik_ibu: cell(row, COL.IBU_NIK),
              tahun_lahir_ibu: toIntOrNull(row[COL.IBU_TAHUN_LAHIR]),
              kelas_id: matchedKelas ? matchedKelas.id : null,
              status: 'aktif',
            }
          })
          .filter(Boolean)

        setRows(mapped)
        setTanpaKelasCount(mapped.filter((r) => !r.kelas_id).length)
        setStatus('parsed')
      } catch (err) {
        setErrorMsg(
          'Gagal membaca file. Pastikan ini adalah file unduhan "Daftar Peserta Didik" dari Dapodik (.xlsx), belum diedit strukturnya.'
        )
        setStatus('error')
      }
    }
    reader.readAsBinaryString(file)
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
    setTanpaKelasCount(0)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/50 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg p-6 relative">
        <button onClick={handleClose} className="absolute top-4 right-4 text-ink-700/40 hover:text-ink-900">
          <X size={20} />
        </button>
        <h2 className="font-display text-xl font-semibold text-ink-950">Impor dari Dapodik</h2>
        <p className="text-sm text-ink-700/60 mt-1">
          Unggah langsung file "Daftar Peserta Didik" hasil unduhan Dapodik — tidak perlu diedit dulu di Excel.
        </p>

        <div className="mt-3 flex items-start gap-2 text-xs text-ink-700/60 bg-ink-900/[0.04] rounded-lg px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0" />
          Siswa dicocokkan dengan data yang sudah ada berdasarkan NIS (NIPD) atau NISN, dan kelas dicocokkan otomatis dari kolom "Rombel Saat Ini".
        </div>

        <label className="mt-3 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-ink-900/15 rounded-xl py-8 cursor-pointer hover:border-brass-400 transition-colors">
          <UploadCloud size={24} className="text-ink-700/40" />
          <span className="text-sm text-ink-700/60">
            {fileName || 'Klik untuk memilih file .xlsx dari Dapodik'}
          </span>
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
        </label>

        {status === 'parsed' && (
          <div className="mt-4 flex items-center gap-2 text-sm text-sage-500 bg-sage-500/10 rounded-lg px-3 py-2.5">
            <CheckCircle2 size={16} />
            <span>
              {rows.length} siswa terbaca dari file.
              {tanpaKelasCount > 0 && (
                <span className="text-ink-700/60"> ({tanpaKelasCount} tanpa kelas yang cocok)</span>
              )}
            </span>
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
