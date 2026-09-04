import { useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { Upload, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'

/**
 * Modal "Input Data Massal Siswa (dari export Dapodik)"
 *
 * COLUMN_MAP di bawah ini disesuaikan dengan urutan kolom PERSIS dari
 * file contoh "FORMAT_KELAS_DAPODIK_A_B.xlsx" (baris header ganda di
 * baris 5-6 Excel, data mulai baris 7). Urutan lengkap kolom (index
 * dari 0 = kolom A):
 *   0 No, 1 Nama, 2 NIPD, 3 JK, 4 NISN, 5 Tempat Lahir, 6 Tanggal Lahir,
 *   7 NIK, 8 Agama, 9 Alamat, 10 RT, 11 RW, 12 Dusun, 13 Kelurahan,
 *   14 Kecamatan, 15 Kode Pos, 16 Jenis Tinggal, 17 Alat Transportasi,
 *   18 Telepon, 19 HP, 20 E-Mail, 21 SKHUN, 22 Penerima KPS, 23 No. KPS,
 *   24-29 Data Ayah (Nama, Tahun Lahir, Pendidikan, Pekerjaan, Penghasilan, NIK),
 *   30-35 Data Ibu (6 kolom sama),
 *   36-41 Data Wali (6 kolom sama),
 *   42 Rombel Saat Ini, 43 No Peserta UN, 44 No Seri Ijazah,
 *   45 Penerima KIP, 46 Nomor KIP, 47 Nama di KIP, 48 Nomor KKS,
 *   49 No Registrasi Akta Lahir, 50 Bank, 51 Nomor Rekening Bank,
 *   52 Rekening Atas Nama, 53 Layak PIP, 54 Alasan Layak PIP,
 *   55 Kebutuhan Khusus, 56 Sekolah Asal, 57 Anak ke-, 58 Lintang,
 *   59 Bujur, 60 No KK, 61 Berat Badan, 62 Tinggi Badan,
 *   63 Lingkar Kepala, 64 Jml. Saudara Kandung, 65 Jarak Rumah ke Sekolah
 *
 * PENTING: kalau file export Dapodik sekolah Anda punya kolom yang
 * ditambah/dikurangi oleh Kemendikbud di kemudian hari, urutan index
 * ini bisa berubah. Cara cek cepat: buka file baru, lihat baris 5-6
 * (header), hitung manual posisi kolom "Rombel Saat Ini" dari kolom A=0.
 * Kalau berbeda dari 42, ubah nilai `col` pada baris `rombel` di bawah.
 *
 * NORMALISASI ROMBEL: field "Rombel Saat Ini" pada Dapodik kadang
 * berisi "Kelas 3A" / "Kelas 3B" (karena kelas 3 dipecah jadi 2
 * rombongan belajar). Sesuai permintaan, nilai seperti itu diringkas
 * menjadi angka kelasnya saja ("3"), sementara "Kelas 1", "Kelas 2",
 * "Kelas 4", "Kelas 5", "Kelas 6" tetap masuk sebagai angka kelasnya
 * juga ("1".."6"). Kalau justru ingin tahu rombel aslinya (3A vs 3B)
 * untuk keperluan lain (mis. membedakan wali kelas), simpan juga nilai
 * mentahnya di kolom terpisah — lihat field `rombel_asli` di bawah.
 *
 * PENYIMPANAN: memakai UPSERT berdasarkan NISN (bukan hapus-lalu-insert
 * seperti pada modal BKU), karena data siswa levelnya "per anak", bukan
 * "per bulan". Jadi upload file yang sama / file yang sudah diperbarui
 * akan memperbarui data siswa yang NISN-nya sudah ada, dan menambahkan
 * siswa baru yang belum ada. Siswa tanpa NISN akan selalu diinsert baru
 * (perlu dicek manual kalau ada duplikat).
 *
 * Penggunaan:
 *   import SiswaDapodikImportModal from '../components/SiswaDapodikImportModal'
 *   ...
 *   <SiswaDapodikImportModal npsn={npsnSekolah} onSelesai={loadSiswa} />
 */

const COLUMN_MAP = [
  { key: 'no_urut', col: 0, type: 'int' },
  { key: 'nama', col: 1, type: 'text' },
  { key: 'nis', col: 2, type: 'text' },          // NIPD
  { key: 'jenis_kelamin', col: 3, type: 'text' },
  { key: 'nisn', col: 4, type: 'text' },
  { key: 'tempat_lahir', col: 5, type: 'text' },
  { key: 'tanggal_lahir', col: 6, type: 'date' },
  { key: 'nik', col: 7, type: 'text' },
  { key: 'agama', col: 8, type: 'text' },
  { key: 'alamat', col: 9, type: 'text' },
  { key: 'rt', col: 10, type: 'text' },
  { key: 'rw', col: 11, type: 'text' },
  { key: 'dusun', col: 12, type: 'text' },
  { key: 'kelurahan', col: 13, type: 'text' },
  { key: 'kecamatan', col: 14, type: 'text' },
  { key: 'kode_pos', col: 15, type: 'text' },
  { key: 'jenis_tinggal', col: 16, type: 'text' },
  { key: 'alat_transportasi', col: 17, type: 'text' },
  { key: 'telepon', col: 18, type: 'text' },
  { key: 'hp', col: 19, type: 'text' },
  { key: 'email', col: 20, type: 'text' },
  { key: 'skhun', col: 21, type: 'text' },
  { key: 'penerima_kps', col: 22, type: 'text' },
  { key: 'no_kps', col: 23, type: 'text' },
  { key: 'nama_ayah', col: 24, type: 'text' },
  { key: 'tahun_lahir_ayah', col: 25, type: 'int' },
  { key: 'pendidikan_ayah', col: 26, type: 'text' },
  { key: 'pekerjaan_ayah', col: 27, type: 'text' },
  { key: 'penghasilan_ayah', col: 28, type: 'text' },
  { key: 'nik_ayah', col: 29, type: 'text' },
  { key: 'nama_ibu', col: 30, type: 'text' },
  { key: 'tahun_lahir_ibu', col: 31, type: 'int' },
  { key: 'pendidikan_ibu', col: 32, type: 'text' },
  { key: 'pekerjaan_ibu', col: 33, type: 'text' },
  { key: 'penghasilan_ibu', col: 34, type: 'text' },
  { key: 'nik_ibu', col: 35, type: 'text' },
  { key: 'nama_wali', col: 36, type: 'text' },
  { key: 'tahun_lahir_wali', col: 37, type: 'int' },
  { key: 'pendidikan_wali', col: 38, type: 'text' },
  { key: 'pekerjaan_wali', col: 39, type: 'text' },
  { key: 'penghasilan_wali', col: 40, type: 'text' },
  { key: 'nik_wali', col: 41, type: 'text' },
  { key: 'rombel', col: 42, type: 'rombel' },     // <-- diperbaiki dari 26 -> 42, dinormalisasi
  { key: 'no_peserta_un', col: 43, type: 'text' },
  { key: 'no_seri_ijazah', col: 44, type: 'text' },
  { key: 'penerima_kip', col: 45, type: 'text' },
  { key: 'nomor_kip', col: 46, type: 'text' },
  { key: 'nama_di_kip', col: 47, type: 'text' },
  { key: 'nomor_kks', col: 48, type: 'text' },
  { key: 'no_registrasi_akta_lahir', col: 49, type: 'text' },
  { key: 'anak_ke', col: 57, type: 'int' },
  { key: 'lintang', col: 58, type: 'float' },
  { key: 'bujur', col: 59, type: 'float' },
  { key: 'no_kk', col: 60, type: 'text' },
  { key: 'berat_badan', col: 61, type: 'float' },
  { key: 'tinggi_badan', col: 62, type: 'float' },
  { key: 'lingkar_kepala', col: 63, type: 'float' },
  { key: 'jumlah_saudara_kandung', col: 64, type: 'int' },
]

// Baris pertama berisi DATA (0-indexed). Baris 1-4 judul, baris 5-6
// header dua baris, jadi data mulai di baris ke-7 -> index 6.
const DATA_START_ROW_INDEX = 6

function toYMD(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function normalizeTanggal(val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) return toYMD(val)
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (m) {
    const [, d, mo, y] = m
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  return null
}

function toIntOrNull(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseInt(val, 10)
  return Number.isFinite(n) ? n : null
}

function toFloatOrNull(val) {
  if (val === null || val === undefined || val === '') return null
  const n = parseFloat(val)
  return Number.isFinite(n) ? n : null
}

function toTextOrNull(val) {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  return s === '' ? null : s
}

function normalizeJK(val) {
  const s = toTextOrNull(val)
  if (!s) return null
  const up = s.toUpperCase()
  return up === 'L' || up === 'P' ? up : null
}

// "Kelas 1" -> "1", "Kelas 3A" -> "3", "Kelas 3B" -> "3", "Kelas 3" -> "3"
// Mengambil angka pertama yang ditemukan pada teks rombel, mengabaikan
// huruf paralel (A/B/dst). Kalau tidak ditemukan angka sama sekali,
// nilai teks asli tetap disimpan apa adanya (tidak dibuang) supaya
// data tidak hilang diam-diam untuk format rombel yang tak terduga
// (misalnya rombel non-numerik).
function normalizeRombel(val) {
  const s = toTextOrNull(val)
  if (!s) return null
  const m = s.match(/(\d{1,2})/)
  if (!m) return s // format tak dikenali -> simpan teks asli, jangan dibuang
  return m[1]
}

function mapRawRowToSiswa(rawRow, npsn) {
  const out = { npsn: npsn || null }

  for (const { key, col, type } of COLUMN_MAP) {
    const raw = rawRow[col]

    if (key === 'jenis_kelamin') {
      out[key] = normalizeJK(raw)
      continue
    }

    switch (type) {
      case 'int':
        out[key] = toIntOrNull(raw)
        break
      case 'float':
        out[key] = toFloatOrNull(raw)
        break
      case 'date':
        out[key] = normalizeTanggal(raw)
        break
      case 'rombel':
        out[key] = normalizeRombel(raw)
        out.rombel_asli = toTextOrNull(raw) // simpan juga teks asli "Kelas 3A"/"Kelas 3B" kalau kolom ini ada di tabel Anda
        break
      default:
        out[key] = toTextOrNull(raw)
    }
  }

  return out
}

export default function SiswaDapodikImportModal({ npsn, onSelesai }) {
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

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: 'binary', cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]

        // header: 1 -> hasil berupa array-of-array (bukan object per baris),
        // range: DATA_START_ROW_INDEX -> lewati baris judul & header.
        const rawRows = XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          range: DATA_START_ROW_INDEX,
          defval: '',
          blankrows: false,
        })

        const mapped = rawRows
          .map((r) => mapRawRowToSiswa(r, npsn))
          // buang baris kosong (mis. baris "Total" atau baris kosong di akhir file)
          .filter((r) => r.nama)

        if (mapped.length === 0) {
          setError('Tidak ada baris data yang terbaca. Pastikan file sesuai format export "Daftar Peserta Didik" Dapodik.')
          return
        }

        setRows(mapped)
      } catch (err) {
        setError('Gagal membaca file: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
  }

  async function handleImport() {
    if (rows.length === 0) return

    const konfirmasi = confirm(
      `${rows.length} data siswa akan disimpan. Siswa dengan NISN yang sudah ada di database akan DIPERBARUI datanya, siswa baru akan ditambahkan. Lanjutkan?`
    )
    if (!konfirmasi) return

    setLoading(true)
    setError('')

    try {
      // Pisahkan baris yang punya NISN (di-upsert) dari yang tidak punya
      // NISN (selalu insert baru, karena tidak ada kunci unik untuk upsert).
      const withNisn = rows.filter((r) => r.nisn)
      const withoutNisn = rows.filter((r) => !r.nisn)

      const BATCH_SIZE = 200
      let savedTotal = 0

      for (let i = 0; i < withNisn.length; i += BATCH_SIZE) {
        const batch = withNisn.slice(i, i + BATCH_SIZE)
        const { error: upsertError, data } = await supabase
          .from('siswa')
          .upsert(batch, { onConflict: 'nisn' })
          .select('id')
        if (upsertError) throw upsertError
        savedTotal += data?.length || 0
      }

      for (let i = 0; i < withoutNisn.length; i += BATCH_SIZE) {
        const batch = withoutNisn.slice(i, i + BATCH_SIZE)
        const { error: insertError, data } = await supabase
          .from('siswa')
          .insert(batch)
          .select('id')
        if (insertError) throw insertError
        savedTotal += data?.length || 0
      }

      setDone({ saved: savedTotal, total: rows.length })
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
        <Upload size={16} /> Input Data Massal Siswa (Dapodik)
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold">Input Data Massal Siswa</h2>
              <button className="icon-btn" onClick={() => { setOpen(false); resetState() }}>
                <X size={18} />
              </button>
            </div>

            <p className="text-sm text-ink-700/60 mb-3">
              Upload file Excel hasil unduhan Dapodik menu{' '}
              <strong>Peserta Didik &rarr; Daftar Peserta Didik &rarr; Export</strong>{' '}
              (format <code>.xlsx</code>, kolom sesuai bawaan Dapodik, tidak perlu diubah dulu).
              <br />
              <strong>Siswa dengan NISN yang sudah ada akan diperbarui</strong>, siswa baru akan ditambahkan.
              Rombel seperti <strong>"Kelas 3A"/"Kelas 3B"</strong> otomatis disimpan sebagai kelas <strong>3</strong>.
            </p>

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="input-field mb-3"
            />

            {fileName && (
              <div className="text-sm text-ink-700/70 mb-3">
                File: <strong>{fileName}</strong> — {rows.length} siswa terbaca
              </div>
            )}

            {rows.length > 0 && (
              <div className="max-h-40 overflow-auto border rounded-lg text-xs mb-3">
                <table className="w-full">
                  <thead className="bg-sage-50 sticky top-0">
                    <tr>
                      <th className="text-left p-1">Nama</th>
                      <th className="text-left p-1">NISN</th>
                      <th className="text-left p-1">JK</th>
                      <th className="text-left p-1">Rombel</th>
                      <th className="text-left p-1">Rombel Asli</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-1">{r.nama}</td>
                        <td className="p-1">{r.nisn || '-'}</td>
                        <td className="p-1">{r.jenis_kelamin || '-'}</td>
                        <td className="p-1">{r.rombel || '-'}</td>
                        <td className="p-1">{r.rombel_asli || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <div className="p-1 text-center text-ink-700/40">...dan {rows.length - 20} siswa lainnya</div>
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
                <CheckCircle2 size={16} /> Berhasil! {done.saved} dari {done.total} data siswa tersimpan.
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
                Simpan {rows.length > 0 ? rows.length : ''} Siswa
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
