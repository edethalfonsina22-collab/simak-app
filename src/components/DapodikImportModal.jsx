import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { matchKelasByName } from '../lib/kelasMatch'

/**
 * Modal impor khusus untuk file unduhan resmi Dapodik "Daftar Peserta Didik" (.xlsx).
 * BEDA dengan BulkImportModal biasa: file Dapodik punya struktur 2 baris header
 * (baris utama, lalu baris sub-header untuk grup Data Ayah/Data Ibu/Data Wali yang
 * kolomnya digabung/merge), didahului beberapa baris judul/metadata sekolah.
 *
 * Supaya tahan terhadap perubahan urutan kolom oleh Kemendikbud di kemudian hari,
 * kolom TIDAK dicari berdasarkan posisi tetap — melainkan berdasarkan NAMA header,
 * persis seperti pendekatan BulkImportModal untuk modul lain:
 *   1. Baca sheet sebagai baris mentah (array-of-arrays).
 *   2. Cari baris header utama (baris yang mengandung "NIPD").
 *   3. Baris tepat di bawahnya adalah sub-header untuk kolom yang di-merge
 *      (Data Ayah / Data Ibu / Data Wali) — kolom lain sub-headernya kosong.
 *   4. Bangun peta "nama kolom -> index" dari kombinasi kedua baris itu, lalu
 *      ambil nilai tiap baris data berdasarkan nama itu, bukan angka posisi.
 */

function normalisasi(teks) {
  return String(teks ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ') // buang tanda baca (titik, strip, kurung, dst)
    .replace(/\s+/g, ' ')
    .trim()
}

// Membangun peta "nama kolom (dinormalisasi) -> index kolom" dari baris header utama
// + baris sub-header di bawahnya. Kolom dalam grup (Data Ayah/Ibu/Wali) diberi awalan
// nama grupnya supaya "Nama" versi Ayah tidak tertukar dengan "Nama" versi Ibu/Wali.
function bangunPetaKolom(baris1, baris2) {
  const peta = {}
  let grupBerjalan = ''
  const panjang = Math.max(baris1.length, baris2.length)
  for (let j = 0; j < panjang; j++) {
    const utama = normalisasi(baris1[j])
    const sub = normalisasi(baris2[j])
    if (utama) grupBerjalan = utama
    if (sub) {
      const label = grupBerjalan ? `${grupBerjalan} ${sub}` : sub
      peta[label] = j
    } else if (utama) {
      peta[utama] = j
    }
  }
  return peta
}

function buatPengambil(peta, baris) {
  return (namaKolom) => {
    const idx = peta[normalisasi(namaKolom)]
    if (idx === undefined) return ''
    const v = baris[idx]
    return v === undefined || v === null ? '' : String(v).trim()
  }
}

function toIntOrNull(v) {
  const n = parseInt(String(v ?? '').trim(), 10)
  return Number.isFinite(n) ? n : null
}

function toNumOrNull(v) {
  const s = String(v ?? '').trim()
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
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
        // Baca sebagai baris mentah supaya tidak terpengaruh baris judul/metadata di atas.
        const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

        const headerRowIndex = aoa.findIndex((r) => r.some((sel) => normalisasi(sel) === 'nipd'))
        if (headerRowIndex === -1) {
          throw new Error('Header "NIPD" tidak ditemukan')
        }
        const barisHeaderUtama = aoa[headerRowIndex] || []
        const barisSubHeader = aoa[headerRowIndex + 1] || []
        const peta = bangunPetaKolom(barisHeaderUtama, barisSubHeader)

        // Coba baca metadata kabupaten/kota & provinsi sekolah dari baris judul di atas
        // (format khas: "Kecamatan ..., Kabupaten ..., Provinsi ..."), untuk mengisi
        // default field alamat orang tua di Halaman Identitas Rapor.
        let metaKabupaten = ''
        let metaProvinsi = ''
        for (let i = 0; i < Math.min(headerRowIndex, 6); i++) {
          const teksBaris = String(aoa[i]?.[0] || '')
          const mKab = teksBaris.match(/Kabupaten\s+(.+?),\s*Provinsi/i)
          const mProv = teksBaris.match(/Provinsi\s+(.+)$/i)
          if (mKab) metaKabupaten = mKab[1].trim()
          if (mProv) metaProvinsi = mProv[1].trim()
        }

        const namaIdx = peta[normalisasi('Nama')]
        const dataRows = aoa
          .slice(headerRowIndex + 2)
          .filter((r) => namaIdx !== undefined && r[namaIdx] && String(r[namaIdx]).trim())

        const mapped = dataRows
          .map((row) => {
            const ambil = buatPengambil(peta, row)
            const namaLengkap = ambil('Nama')
            if (!namaLengkap) return null

            const rombel = ambil('Rombel Saat Ini')
            const matchedKelas = matchKelasByName(kelasList, rombel)
            const alamat = ambil('Alamat')

            return {
              nama_lengkap: namaLengkap,
              nis: ambil('NIPD'),
              nisn: ambil('NISN'),
              nik: ambil('NIK'),
              jenis_kelamin: ambil('JK') === 'P' ? 'P' : 'L',
              agama: ambil('Agama'),
              tempat_lahir: ambil('Tempat Lahir'),
              tanggal_lahir: formatTanggal(row[peta[normalisasi('Tanggal Lahir')]]),
              // Dapodik tidak membedakan alamat KTP vs alamat domisili, jadi keduanya diisi sama.
              alamat,
              alamat_tinggal: alamat,
              rt: ambil('RT'),
              rw: ambil('RW'),
              dusun: ambil('Dusun'),
              kelurahan: ambil('Kelurahan'),
              kecamatan: ambil('Kecamatan'),
              kode_pos: ambil('Kode Pos'),
              jenis_tinggal: ambil('Jenis Tinggal'),
              alat_transportasi: ambil('Alat Transportasi'),
              jarak_rumah_ke_sekolah: toNumOrNull(row[peta[normalisasi('Jarak Rumah ke Sekolah (KM)')]]),
              lintang: toNumOrNull(row[peta[normalisasi('Lintang')]]),
              bujur: toNumOrNull(row[peta[normalisasi('Bujur')]]),
              telepon: ambil('Telepon'),
              hp: ambil('HP'),
              email: ambil('E-Mail'),
              skhun: ambil('SKHUN'),
              penerima_kps: ambil('Penerima KPS'),
              no_kps: ambil('No. KPS'),
              nama_ayah: ambil('Data Ayah Nama'),
              tahun_lahir_ayah: toIntOrNull(row[peta[normalisasi('Data Ayah Tahun Lahir')]]),
              pendidikan_ayah: ambil('Data Ayah Jenjang Pendidikan'),
              pekerjaan_ayah: ambil('Data Ayah Pekerjaan'),
              penghasilan_ayah: ambil('Data Ayah Penghasilan'),
              nik_ayah: ambil('Data Ayah NIK'),
              nama_ibu: ambil('Data Ibu Nama'),
              tahun_lahir_ibu: toIntOrNull(row[peta[normalisasi('Data Ibu Tahun Lahir')]]),
              pendidikan_ibu: ambil('Data Ibu Jenjang Pendidikan'),
              pekerjaan_ibu: ambil('Data Ibu Pekerjaan'),
              penghasilan_ibu: ambil('Data Ibu Penghasilan'),
              nik_ibu: ambil('Data Ibu NIK'),
              nama_wali: ambil('Data Wali Nama'),
              tahun_lahir_wali: toIntOrNull(row[peta[normalisasi('Data Wali Tahun Lahir')]]),
              pendidikan_wali: ambil('Data Wali Jenjang Pendidikan'),
              pekerjaan_wali: ambil('Data Wali Pekerjaan'),
              penghasilan_wali: ambil('Data Wali Penghasilan'),
              nik_wali: ambil('Data Wali NIK'),
              nomor_ujian: ambil('No Peserta Ujian Nasional'),
              no_seri_ijazah: ambil('No Seri Ijazah'),
              penerima_kip: ambil('Penerima KIP'),
              nomor_kip: ambil('Nomor KIP'),
              nama_di_kip: ambil('Nama di KIP'),
              nomor_kks: ambil('Nomor KKS'),
              no_registrasi_akta_lahir: ambil('No Registrasi Akta Lahir'),
              bank: ambil('Bank'),
              no_rekening: ambil('Nomor Rekening Bank'),
              rekening_atas_nama: ambil('Rekening Atas Nama'),
              layak_pip: ambil('Layak PIP (usulan dari sekolah)'),
              alasan_layak_pip: ambil('Alasan Layak PIP'),
              kebutuhan_khusus: ambil('Kebutuhan Khusus'),
              pendidikan_sebelumnya: ambil('Sekolah Asal'),
              sekolah_asal: ambil('Sekolah Asal'),
              anak_ke: toIntOrNull(row[peta[normalisasi('Anak ke-berapa')]]),
              no_kk: ambil('No KK'),
              berat_badan: toNumOrNull(row[peta[normalisasi('Berat Badan')]]),
              tinggi_badan: toNumOrNull(row[peta[normalisasi('Tinggi Badan')]]),
              lingkar_kepala: toNumOrNull(row[peta[normalisasi('Lingkar Kepala')]]),
              jumlah_saudara_kandung: toIntOrNull(row[peta[normalisasi('Jml. Saudara Kandung')]]),
              // Alamat orang tua untuk Halaman Identitas Rapor — diisi otomatis dari
              // Kelurahan/Kecamatan siswa + metadata Kabupaten/Provinsi sekolah.
              ortu_kelurahan_desa: ambil('Kelurahan'),
              ortu_kecamatan: ambil('Kecamatan'),
              ortu_kabupaten_kota: metaKabupaten,
              ortu_provinsi: metaProvinsi,
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
          Semua field Dapodik (alamat rinci, data ayah/ibu/wali, KIP/KPS/PIP, data fisik, dll) ikut terbaca.
        </p>

        <div className="mt-3 flex items-start gap-2 text-xs text-ink-700/60 bg-ink-900/[0.04] rounded-lg px-3 py-2.5">
          <Info size={14} className="mt-0.5 shrink-0" />
          Siswa dicocokkan dengan data yang sudah ada berdasarkan NIS (NIPD) atau NISN, dan kelas dicocokkan otomatis dari kolom "Rombel Saat Ini". Kolom dibaca berdasarkan nama header, jadi tetap terbaca walau urutannya berubah.
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
