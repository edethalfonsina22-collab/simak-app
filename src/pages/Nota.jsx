import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient' // sesuaikan path kalau berbeda di project kamu
import NotaPrintTemplate from '../components/NotaPrintTemplate'
import KuitansiPrintTemplate from '../components/KuitansiPrintTemplate'
import Layout from '../components/Layout'

// -----------------------------------------------------------------
// Baris item kosong untuk form manual
// -----------------------------------------------------------------
function itemKosong() {
  return { banyaknya: '', satuan: '', nama_barang: '', harga: '' }
}

function formKosong() {
  return {
    no_nota: '',
    tanggal: new Date().toISOString().slice(0, 10),
    tuan: '',
    toko: '',
    alamat_lanjutan: '',
    items: [itemKosong()],
  }
}

function hitungJumlahBaris(item) {
  const qty = Number(item.banyaknya) || 0
  const harga = Number(item.harga) || 0
  return qty * harga
}

function hitungTotal(items) {
  return items.reduce((sum, it) => sum + hitungJumlahBaris(it), 0)
}

// ------------------------- Terbilang (angka -> teks) -------------------------
// Dipakai untuk kolom "Uang sejumlah" di Kuitansi resmi, yang harus berupa
// teks (mis. "Tiga ratus lima puluh ribu rupiah"), bukan angka.
const SATUAN_TERBILANG = [
  '', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan',
  'sepuluh', 'sebelas',
]

function angkaKeTerbilang(n) {
  n = Math.floor(Math.abs(Number(n) || 0))
  if (n < 12) return SATUAN_TERBILANG[n]
  if (n < 20) return `${angkaKeTerbilang(n - 10)} belas`
  if (n < 100) return `${angkaKeTerbilang(Math.floor(n / 10))} puluh ${angkaKeTerbilang(n % 10)}`.trim()
  if (n < 200) return `seratus ${angkaKeTerbilang(n - 100)}`.trim()
  if (n < 1000) return `${angkaKeTerbilang(Math.floor(n / 100))} ratus ${angkaKeTerbilang(n % 100)}`.trim()
  if (n < 2000) return `seribu ${angkaKeTerbilang(n - 1000)}`.trim()
  if (n < 1000000) return `${angkaKeTerbilang(Math.floor(n / 1000))} ribu ${angkaKeTerbilang(n % 1000)}`.trim()
  if (n < 1000000000) return `${angkaKeTerbilang(Math.floor(n / 1000000))} juta ${angkaKeTerbilang(n % 1000000)}`.trim()
  return `${angkaKeTerbilang(Math.floor(n / 1000000000))} miliar ${angkaKeTerbilang(n % 1000000000)}`.trim()
}

function rupiahTerbilang(n) {
  const teks = angkaKeTerbilang(n).replace(/\s+/g, ' ').trim()
  const kapital = teks.charAt(0).toUpperCase() + teks.slice(1)
  return `${kapital} rupiah`
}

// Ubah satu baris nota jadi data yang dipahami KuitansiPrintTemplate.
// "Telah terima dari" diisi nama sekolah (pembeli/pembayar), karena
// kwitansi ini dikeluarkan toko sebagai bukti sekolah sudah membayar.
function mapUntukKwitansi(row, sekolah) {
  const namaBarang = (row.items || []).map((it) => it.nama_barang).filter(Boolean).join(', ')
  return {
    no_kwitansi: row.no_nota,
    tanggal: row.tanggal,
    dari: sekolah?.nama || '',
    uang_sejumlah: rupiahTerbilang(row.jumlah_total || 0),
    untuk_pembayaran: `Pembayaran belanja ${namaBarang ? `(${namaBarang}) ` : ''}sesuai Nota No. ${row.no_nota}`,
    jumlah: row.jumlah_total || 0,
  }
}

// Ubah item tersimpan (banyaknya angka + satuan terpisah) jadi bentuk yang
// dipahami NotaPrintTemplate (banyaknya sebagai satu teks, mis. "2 buah").
function mapUntukCetak(nota) {
  return {
    ...nota,
    items: (nota.items || []).map((it) => ({
      ...it,
      banyaknya: [it.banyaknya, it.satuan].filter(Boolean).join(' '),
      jumlah: it.jumlah ?? hitungJumlahBaris(it),
    })),
  }
}

// ------------------------- Parser tanggal (impor Excel) -------------------------
// Kolom "Tanggal" di file Excel yang diimpor bisa datang dalam berbagai
// macam bentuk tergantung cara user mengetik/format sel di Excel, misalnya:
//   - Date object asli dari Excel (karena kita baca dengan cellDates: true)
//   - Angka serial Excel, mis. 45725 (kalau cellDates gagal / sel "General")
//   - "2025-03-09" atau "2025/03/09"      (ISO / tahun dulu)
//   - "09-03-2025" atau "09/03/2025"      (tanggal-bulan-tahun, gaya ID)
//   - "9-3-2025", "9/3/25"                (tanpa nol di depan, tahun 2 digit)
//   - "9 Maret 2025", "9 Mar 2025"        (nama bulan Indonesia)
//   - "March 9, 2025", "Mar 9 2025"       (nama bulan Inggris)
// Semua ditampung dan diubah jadi teks "YYYY-MM-DD" yang valid untuk kolom
// date di Postgres. Kalau benar-benar tidak bisa dikenali, kembalikan null
// supaya baris tsb ditandai gagal (bukan diam-diam diisi tanggal hari ini,
// yang bisa menyesatkan data).

const NAMA_BULAN_ID = {
  jan: 1, januari: 1,
  feb: 2, februari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, agt: 8, agustus: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, desember: 12,
}

const NAMA_BULAN_EN = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

// Susun "YYYY-MM-DD" dari komponen, dengan validasi dasar (bulan 1-12,
// tanggal masuk akal). Tahun 2 digit dianggap 2000-an.
function susunTanggal(tahun, bulan, tanggal) {
  let y = Number(tahun)
  const m = Number(bulan)
  const d = Number(tanggal)
  if (y < 100) y += 2000
  if (!y || !m || !d) return null
  if (m < 1 || m > 12) return null
  if (d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  // Pastikan tanggal tidak "meluber" (mis. 31 Februari -> jadi Maret)
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null
  }
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function tanggalDariAngkaSerialExcel(n) {
  // Basis tanggal Excel: 30 Desember 1899 (memperhitungkan bug tahun kabisat 1900 Excel)
  const epoch = Date.UTC(1899, 11, 30)
  const ms = epoch + Math.round(n) * 86400000
  const dt = new Date(ms)
  if (isNaN(dt.getTime())) return null
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function tanggalDariTeks(teks) {
  const s = String(teks).trim()
  if (!s) return null

  // 1) ISO / tahun-dulu: YYYY-MM-DD atau YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return susunTanggal(m[1], m[2], m[3])

  // 2) Tanggal-Bulan-Tahun angka: DD-MM-YYYY, DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY, dst
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) return susunTanggal(m[3], m[2], m[1])

  // 3) "9 Maret 2025" / "9 Mar 2025" (nama bulan Indonesia)
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})$/)
  if (m) {
    const kunci = m[2].toLowerCase().replace(/\./g, '')
    const bulan = NAMA_BULAN_ID[kunci] || NAMA_BULAN_EN[kunci]
    if (bulan) return susunTanggal(m[3], bulan, m[1])
  }

  // 4) "Maret 9, 2025" / "March 9, 2025" (nama bulan di depan, gaya Inggris)
  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})$/)
  if (m) {
    const kunci = m[1].toLowerCase().replace(/\./g, '')
    const bulan = NAMA_BULAN_ID[kunci] || NAMA_BULAN_EN[kunci]
    if (bulan) return susunTanggal(m[3], bulan, m[2])
  }

  // 5) Angka serial Excel yang ketulis sebagai teks, mis. "45725"
  if (/^\d{4,6}$/.test(s)) {
    const hasil = tanggalDariAngkaSerialExcel(Number(s))
    if (hasil) return hasil
  }

  // 6) Terakhir, coba serahkan ke parser bawaan JavaScript (mis. format ISO
  //    dengan waktu, atau format lain yang belum tertangkap di atas)
  const coba = new Date(s)
  if (!isNaN(coba.getTime())) {
    return `${coba.getUTCFullYear()}-${pad2(coba.getUTCMonth() + 1)}-${pad2(coba.getUTCDate())}`
  }

  return null
}

// Fungsi utama: terima nilai apa pun dari sel Excel ("Tanggal") dan
// kembalikan teks "YYYY-MM-DD" yang valid, atau null kalau tidak bisa
// dikenali sama sekali (baris ini nanti akan ditandai gagal saat impor,
// bukan diam-diam diisi tanggal hari ini).
function tanggalDariExcel(nilai) {
  if (nilai === '' || nilai === null || nilai === undefined) return null

  // Date object asli (karena workbook dibaca dengan cellDates: true)
  if (nilai instanceof Date) {
    if (isNaN(nilai.getTime())) return null
    return `${nilai.getUTCFullYear()}-${pad2(nilai.getUTCMonth() + 1)}-${pad2(nilai.getUTCDate())}`
  }

  // Angka serial Excel (fallback kalau cellDates tidak berlaku utk sel ini)
  if (typeof nilai === 'number') {
    return tanggalDariAngkaSerialExcel(nilai)
  }

  // Segala bentuk teks
  return tanggalDariTeks(nilai)
}

export default function Nota({ sekolah }) {
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(formKosong())
  // notaCetak sekarang berupa ARRAY nota (bisa isi 1 nota atau banyak
  // sekaligus), supaya cetak massal bisa memuat semua nota terpilih dalam
  // satu kali window.print() -> satu print job banyak halaman, bukan
  // satu-satu.
  const [notaCetak, setNotaCetak] = useState([])
  // Data kwitansi yang lagi disiapkan untuk print (null = tidak ada).
  const [kuitansiCetak, setKuitansiCetak] = useState(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importRingkasan, setImportRingkasan] = useState(null)
  // Set berisi id nota yang dicentang di tabel, untuk cetak massal.
  const [terpilih, setTerpilih] = useState(new Set())

  const printRef = useRef(null)
  const fileInputRef = useRef(null)

  async function muatDaftar() {
    setLoading(true)
    const { data, error } = await supabase
      .from('nota')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('dibuat_pada', { ascending: false })
    if (!error) setDaftar(data || [])
    setLoading(false)
  }

  useEffect(() => {
    muatDaftar()
  }, [])

  // Setelah dialog print ditutup (baik jadi dicetak atau dibatalkan),
  // kosongkan lagi notaCetak supaya blok pratinjau cetak (yang tingginya
  // satu halaman A4 penuh) tidak tertinggal di DOM dan mengganggu layout
  // layar biasa (mis. menutupi sidebar).
  useEffect(() => {
    function bersihkanSetelahPrint() {
      setNotaCetak([])
      setKuitansiCetak(null)
    }
    window.addEventListener('afterprint', bersihkanSetelahPrint)
    return () => window.removeEventListener('afterprint', bersihkanSetelahPrint)
  }, [])

  // ------------------------- Form manual -------------------------
  function bukaTambah() {
    setEditingId(null)
    setForm(formKosong())
    setShowForm(true)
  }

  function bukaEdit(row) {
    setEditingId(row.id)
    setForm({
      no_nota: row.no_nota || '',
      tanggal: row.tanggal || new Date().toISOString().slice(0, 10),
      tuan: row.tuan || '',
      toko: row.toko || '',
      alamat_lanjutan: row.alamat_lanjutan || '',
      items: row.items?.length ? row.items : [itemKosong()],
    })
    setShowForm(true)
  }

  function ubahItem(idx, field, value) {
    setForm((f) => {
      const items = [...f.items]
      items[idx] = { ...items[idx], [field]: value }
      return { ...f, items }
    })
  }

  function tambahBarisItem() {
    setForm((f) => ({ ...f, items: [...f.items, itemKosong()] }))
  }

  function hapusBarisItem(idx) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  }

  async function simpanForm(e) {
    e.preventDefault()
    const items = form.items.filter((it) => it.nama_barang?.trim())
    const payload = {
      no_nota: form.no_nota,
      tanggal: form.tanggal,
      tuan: form.tuan,
      toko: form.toko,
      alamat_lanjutan: form.alamat_lanjutan,
      items,
      jumlah_total: hitungTotal(items),
    }

    const query = editingId
      ? supabase.from('nota').update(payload).eq('id', editingId)
      : supabase.from('nota').insert(payload)

    const { error } = await query
    if (error) {
      alert('Gagal menyimpan nota: ' + error.message)
      return
    }
    setShowForm(false)
    muatDaftar()
  }

  async function hapusNota(id) {
    if (!confirm('Hapus nota ini?')) return
    const { error } = await supabase.from('nota').delete().eq('id', id)
    if (error) {
      alert('Gagal menghapus: ' + error.message)
      return
    }
    muatDaftar()
  }

  // ------------------------- Pilih baris (untuk cetak massal) -------------------------
  function toggleTerpilih(id) {
    setTerpilih((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleTerpilihSemua() {
    setTerpilih((prev) =>
      prev.size === daftar.length ? new Set() : new Set(daftar.map((r) => r.id))
    )
  }

  // ------------------------- Cetak -------------------------
  // Cetak satu nota saja (tombol "Cetak" per baris).
  function cetakNota(row) {
    setNotaCetak([mapUntukCetak(row)])
    // beri waktu render sebelum memanggil print
    setTimeout(() => window.print(), 100)
  }

  // Cetak Kwitansi resmi untuk satu nota (tombol "Cetak Kwitansi" per baris).
  function cetakKuitansi(row) {
    setKuitansiCetak(mapUntukKwitansi(row, sekolah))
    setTimeout(() => window.print(), 100)
  }

  // Gabungkan beberapa baris nota (No Nota berbeda-beda) jadi SATU nota
  // dengan SATU tabel barang -> dipakai kalau belanjanya berasal dari satu
  // mata anggaran yang sama walau dicatat sebagai beberapa nota terpisah.
  // - items dari semua nota terpilih digabung jadi satu daftar
  // - Tuan/Toko dipakai dari nota pertama (asumsi sama, karena satu mata
  //   anggaran biasanya belanja di toko yang sama)
  // - No. Nota digabung jadi satu teks (mis. "001 / 002 / 003")
  // - Tanggal dipakai tanggal PALING AKHIR dari nota-nota yang digabung
  function gabungkanNota(rows) {
    const urutan = [...rows].sort((a, b) => String(a.tanggal || '').localeCompare(String(b.tanggal || '')))
    const items = urutan.flatMap((r) =>
      (r.items || []).map((it) => ({
        ...it,
        banyaknya: [it.banyaknya, it.satuan].filter(Boolean).join(' '),
        jumlah: it.jumlah ?? hitungJumlahBaris(it),
      }))
    )
    return {
      no_nota: urutan.map((r) => r.no_nota).join(' / '),
      tanggal: urutan[urutan.length - 1]?.tanggal,
      tuan: urutan[0]?.tuan,
      toko: urutan[0]?.toko,
      alamat_lanjutan: urutan[0]?.alamat_lanjutan,
      items,
      jumlah_total: items.reduce((sum, it) => sum + (Number(it.jumlah) || 0), 0),
    }
  }

  // Cetak SEMUA nota yang dicentang sekaligus, DIGABUNG jadi satu tabel di
  // satu nota (bukan satu nota per halaman) -> satu kali window.print().
  function cetakTerpilih() {
    const rows = daftar.filter((r) => terpilih.has(r.id))
    if (rows.length === 0) {
      alert('Pilih dulu minimal satu nota yang mau dicetak.')
      return
    }
    setNotaCetak([gabungkanNota(rows)])
    setTimeout(() => window.print(), 150)
  }

  // ------------------------- Impor Massal -------------------------
  // Template Excel yang diharapkan (baris pertama = header):
  // No Nota | Tanggal | Tuan | Toko | Banyaknya | Satuan | Nama Barang | Harga
  //
  // Beberapa baris dengan "No Nota" yang sama akan digabung jadi satu nota
  // dengan banyak baris barang (items). Tanggal/Tuan/Toko cukup diisi di
  // baris pertama tiap kelompok No Nota, baris berikutnya boleh dikosongkan.
  //
  // Kolom "Tanggal" boleh ditulis dalam format apa pun yang wajar: sel
  // bertipe Date asli di Excel, angka serial, "2025-03-09", "09/03/2025",
  // "9 Maret 2025", "March 9, 2025", dst. Lihat tanggalDariExcel() di atas.
  function unduhTemplateExcel() {
    const contoh = [
      {
        'No Nota': '001',
        Tanggal: '2026-08-01',
        Tuan: 'Toko Makmur Jaya',
        Toko: 'Jl. Pendidikan No. 5',
        Banyaknya: 2,
        Satuan: 'buah',
        'Nama Barang': 'Buku Tulis',
        Harga: 5000,
      },
      {
        'No Nota': '001',
        Tanggal: '',
        Tuan: '',
        Toko: '',
        Banyaknya: 1,
        Satuan: 'pak',
        'Nama Barang': 'Spidol',
        Harga: 25000,
      },
    ]
    const ws = XLSX.utils.json_to_sheet(contoh)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Template Nota')
    XLSX.writeFile(wb, 'template_impor_nota.xlsx')
  }

  async function handleFileImpor(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportBusy(true)
    setImportRingkasan(null)

    try {
      const buf = await file.arrayBuffer()
      // cellDates: true -> sel bertipe tanggal di Excel dibaca sebagai Date
      // object, bukan angka serial (mis. 45725). Kalau sel "Tanggal" bukan
      // bertipe Date asli (mis. ditulis sebagai teks bebas), tanggalDariExcel()
      // di bawah tetap akan mencoba mengenali berbagai format teks umum.
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Kelompokkan baris berdasarkan "No Nota"
      const kelompok = new Map()
      // Simpan baris Excel (nomor baris asli, 1-based + header) yang
      // tanggalnya gagal dikenali, supaya bisa ditampilkan ke user.
      const tanggalGagal = []

      rows.forEach((r, i) => {
        const noNota = String(r['No Nota'] ?? '').trim()
        if (!noNota) return

        const nomorBarisExcel = i + 2 // +1 karena index 0-based, +1 lagi karena baris 1 = header

        if (!kelompok.has(noNota)) {
          let tanggal = tanggalDariExcel(r['Tanggal'])
          if (!tanggal) {
            // Tanggal tidak dikenali / kosong di baris pertama grup ini ->
            // pakai tanggal hari ini sebagai fallback, tapi catat sebagai
            // peringatan supaya user bisa cek & perbaiki manual kalau perlu.
            tanggal = new Date().toISOString().slice(0, 10)
            if (r['Tanggal']) {
              tanggalGagal.push(`Baris ${nomorBarisExcel} (No Nota ${noNota}): "${r['Tanggal']}"`)
            }
          }
          kelompok.set(noNota, {
            no_nota: noNota,
            tanggal,
            tuan: r['Tuan'] || '',
            toko: r['Toko'] || '',
            alamat_lanjutan: '',
            items: [],
          })
        }

        const grup = kelompok.get(noNota)
        // Isi tuan/toko kalau baris pertama grup kosong tapi baris ini ada isinya
        if (!grup.tuan && r['Tuan']) grup.tuan = r['Tuan']
        if (!grup.toko && r['Toko']) grup.toko = r['Toko']
        // Kalau baris lanjutan (bukan baris pertama grup) membawa tanggal
        // sendiri yang valid, dan grup belum sempat dapat tanggal yang jelas,
        // boleh dipakai juga -> tapi umumnya tanggal cukup diisi di baris
        // pertama tiap grup, jadi ini hanya jaring pengaman tambahan.
        if (r['Nama Barang']) {
          grup.items.push({
            banyaknya: Number(r['Banyaknya']) || 0,
            satuan: r['Satuan'] || '',
            nama_barang: r['Nama Barang'],
            harga: Number(r['Harga']) || 0,
          })
        }
      })

      const records = Array.from(kelompok.values()).map((n) => ({
        ...n,
        jumlah_total: hitungTotal(n.items),
      }))

      if (records.length === 0) {
        setImportRingkasan({ sukses: 0, gagal: 0, pesan: 'Tidak ada baris valid ditemukan di file.' })
        return
      }

      const { error } = await supabase.from('nota').insert(records)
      if (error) {
        setImportRingkasan({ sukses: 0, gagal: records.length, pesan: error.message })
      } else {
        const pesanPeringatan =
          tanggalGagal.length > 0
            ? `Perhatian: ${tanggalGagal.length} nota memakai tanggal hari ini karena format tanggal di Excel tidak dikenali -> ${tanggalGagal.join('; ')}`
            : null
        setImportRingkasan({ sukses: records.length, gagal: 0, pesan: pesanPeringatan })
        muatDaftar()
      }
    } catch (err) {
      setImportRingkasan({ sukses: 0, gagal: 0, pesan: 'Gagal membaca file: ' + err.message })
    } finally {
      setImportBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const totalForm = hitungTotal(form.items)
  const semuaTerpilih = daftar.length > 0 && terpilih.size === daftar.length

  // Tombol-tombol aksi ini dipindah ke prop `actions` milik <Layout>, persis
  // pola yang dipakai halaman lain (mis. "Data Guru": Impor Massal, + Tambah
  // Guru tampil di header sebelah kanan) — supaya sidebar & header konsisten
  // dan selalu tampil, bukan hilang seperti sebelumnya saat Nota.jsx
  // render div penuh sendirian tanpa <Layout>.
  const aksiHeader = (
    <>
      <button onClick={unduhTemplateExcel} className="px-3 py-2 rounded bg-gray-200 text-sm">
        Unduh Template
      </button>
      <label className="px-3 py-2 rounded bg-emerald-600 text-white text-sm cursor-pointer">
        {importBusy ? 'Mengimpor...' : 'Impor Massal'}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          disabled={importBusy}
          onChange={handleFileImpor}
        />
      </label>
      <button
        onClick={cetakTerpilih}
        disabled={terpilih.size === 0}
        className={`px-3 py-2 rounded text-white text-sm ${
          terpilih.size === 0 ? 'bg-gray-300 cursor-not-allowed' : 'bg-purple-600'
        }`}
      >
        Gabung & Cetak ({terpilih.size})
      </button>
      <button onClick={bukaTambah} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">
        + Tambah Nota
      </button>
    </>
  )

  return (
    <>
      <Layout title="Nota Belanja" subtitle={`${daftar.length} nota tercatat`} actions={aksiHeader}>
        {importRingkasan && (
          <div
            className={`mb-4 p-3 rounded text-sm ${
              importRingkasan.gagal ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {importRingkasan.pesan
              ? importRingkasan.pesan
              : `Berhasil mengimpor ${importRingkasan.sukses} nota.`}
          </div>
        )}

        {/* Tabel daftar nota */}
        <div className="overflow-x-auto border rounded">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-center w-8">
                  <input
                    type="checkbox"
                    checked={semuaTerpilih}
                    onChange={toggleTerpilihSemua}
                    aria-label="Pilih semua nota"
                  />
                </th>
                <th className="p-2 text-left">No. Nota</th>
                <th className="p-2 text-left">Tanggal</th>
                <th className="p-2 text-left">Tuan</th>
                <th className="p-2 text-left">Toko</th>
                <th className="p-2 text-right">Jumlah</th>
                <th className="p-2 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">Memuat...</td></tr>
              ) : daftar.length === 0 ? (
                <tr><td colSpan={7} className="p-4 text-center text-gray-500">Belum ada nota</td></tr>
              ) : (
                daftar.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2 text-center">
                      <input
                        type="checkbox"
                        checked={terpilih.has(row.id)}
                        onChange={() => toggleTerpilih(row.id)}
                        aria-label={`Pilih nota ${row.no_nota}`}
                      />
                    </td>
                    <td className="p-2">{row.no_nota}</td>
                    <td className="p-2">{row.tanggal}</td>
                    <td className="p-2">{row.tuan}</td>
                    <td className="p-2">{row.toko}</td>
                    <td className="p-2 text-right">
                      {new Intl.NumberFormat('id-ID').format(row.jumlah_total || 0)}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-2 text-xs">
                        <button onClick={() => cetakNota(row)} className="text-blue-600">Cetak Nota</button>
                        <button onClick={() => cetakKuitansi(row)} className="text-purple-600">Cetak Kwitansi</button>
                        <button onClick={() => bukaEdit(row)} className="text-amber-600">Edit</button>
                        <button onClick={() => hapusNota(row.id)} className="text-red-600">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Modal form manual */}
        {showForm && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <form
              onSubmit={simpanForm}
              className="bg-white rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6"
            >
              <h2 className="text-lg font-bold mb-4">
                {editingId ? 'Edit Nota' : 'Tambah Nota'}
              </h2>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs mb-1">No. Nota</label>
                  <input
                    className="border rounded w-full p-2 text-sm"
                    value={form.no_nota}
                    onChange={(e) => setForm((f) => ({ ...f, no_nota: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Tanggal</label>
                  <input
                    type="date"
                    className="border rounded w-full p-2 text-sm"
                    value={form.tanggal}
                    onChange={(e) => setForm((f) => ({ ...f, tanggal: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Tuan</label>
                  <input
                    className="border rounded w-full p-2 text-sm"
                    value={form.tuan}
                    onChange={(e) => setForm((f) => ({ ...f, tuan: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Toko</label>
                  <input
                    className="border rounded w-full p-2 text-sm"
                    value={form.toko}
                    onChange={(e) => setForm((f) => ({ ...f, toko: e.target.value }))}
                  />
                </div>
              </div>

              <h3 className="text-sm font-semibold mt-4 mb-2">Daftar Barang</h3>
              <div className="space-y-2">
                {form.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="col-span-2 border rounded p-2 text-sm"
                      placeholder="Qty"
                      type="number"
                      value={it.banyaknya}
                      onChange={(e) => ubahItem(idx, 'banyaknya', e.target.value)}
                    />
                    <input
                      className="col-span-2 border rounded p-2 text-sm"
                      placeholder="Satuan"
                      value={it.satuan}
                      onChange={(e) => ubahItem(idx, 'satuan', e.target.value)}
                    />
                    <input
                      className="col-span-4 border rounded p-2 text-sm"
                      placeholder="Nama barang"
                      value={it.nama_barang}
                      onChange={(e) => ubahItem(idx, 'nama_barang', e.target.value)}
                    />
                    <input
                      className="col-span-2 border rounded p-2 text-sm"
                      placeholder="Harga satuan"
                      type="number"
                      value={it.harga}
                      onChange={(e) => ubahItem(idx, 'harga', e.target.value)}
                    />
                    <div className="col-span-1 text-xs text-right">
                      {new Intl.NumberFormat('id-ID').format(hitungJumlahBaris(it))}
                    </div>
                    <button
                      type="button"
                      onClick={() => hapusBarisItem(idx)}
                      className="col-span-1 text-red-600 text-xs"
                    >
                      Hapus
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={tambahBarisItem}
                className="mt-2 text-sm text-blue-600"
              >
                + Tambah baris barang
              </button>

              <div className="flex justify-end mt-4 font-semibold text-sm">
                Jumlah Total: Rp {new Intl.NumberFormat('id-ID').format(totalForm)}
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded bg-gray-200 text-sm"
                >
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white text-sm">
                  Simpan
                </button>
              </div>
            </form>
          </div>
        )}
      </Layout>

      {/* Wajib DI LUAR <Layout> — ini yang tampil saat window.print().
          Dibungkus "hidden print:block" (Tailwind) supaya PASTI tersembunyi
          di layar biasa (tidak ikut memengaruhi layout sidebar), dan hanya
          muncul saat proses cetak berjalan.

          Nota SENDIRI (148mm) dibungkus wrapper 1 halaman A4 penuh (297mm)
          dengan flex+justify-end, supaya menempel ke bagian PALING BAWAH
          kertas (bukan menempel di atas). Wrapper ini HANYA di sini, tidak
          ikut masuk ke NotaPrintTemplate.jsx sendiri, supaya komponen itu
          tetap 148mm apa adanya dan aman dipakai bareng Kuitansi di
          LaporanPrintTemplate.jsx (148mm Kuitansi + 148mm Nota = 1 lembar). */}
      <div className="hidden print:block">
        {notaCetak.map((n, idx) => (
          <div
            key={n.id ?? idx}
            style={{
              width: '210mm',
              height: '297mm',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              ...(idx < notaCetak.length - 1 ? { breakAfter: 'page', pageBreakAfter: 'always' } : {}),
            }}
          >
            <NotaPrintTemplate ref={idx === 0 ? printRef : null} sekolah={sekolah} data={n} />
          </div>
        ))}
        {kuitansiCetak && (
          <KuitansiPrintTemplate sekolah={sekolah} data={kuitansiCetak} />
        )}
      </div>
    </>
  )
}
