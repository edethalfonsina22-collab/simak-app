import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient' // sesuaikan path kalau berbeda di project kamu
import NotaPrintTemplate from '../components/NotaPrintTemplate'

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
// date di Postgres.

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

function susunTanggal(tahun, bulan, tanggal) {
  let y = Number(tahun)
  const m = Number(bulan)
  const d = Number(tanggal)
  if (y < 100) y += 2000
  if (!y || !m || !d) return null
  if (m < 1 || m > 12) return null
  if (d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    return null
  }
  return `${y}-${pad2(m)}-${pad2(d)}`
}

function tanggalDariAngkaSerialExcel(n) {
  const epoch = Date.UTC(1899, 11, 30)
  const ms = epoch + Math.round(n) * 86400000
  const dt = new Date(ms)
  if (isNaN(dt.getTime())) return null
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`
}

function tanggalDariTeks(teks) {
  const s = String(teks).trim()
  if (!s) return null

  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (m) return susunTanggal(m[1], m[2], m[3])

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/)
  if (m) return susunTanggal(m[3], m[2], m[1])

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{2,4})$/)
  if (m) {
    const kunci = m[2].toLowerCase().replace(/\./g, '')
    const bulan = NAMA_BULAN_ID[kunci] || NAMA_BULAN_EN[kunci]
    if (bulan) return susunTanggal(m[3], bulan, m[1])
  }

  m = s.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{2,4})$/)
  if (m) {
    const kunci = m[1].toLowerCase().replace(/\./g, '')
    const bulan = NAMA_BULAN_ID[kunci] || NAMA_BULAN_EN[kunci]
    if (bulan) return susunTanggal(m[3], bulan, m[2])
  }

  if (/^\d{4,6}$/.test(s)) {
    const hasil = tanggalDariAngkaSerialExcel(Number(s))
    if (hasil) return hasil
  }

  const coba = new Date(s)
  if (!isNaN(coba.getTime())) {
    return `${coba.getUTCFullYear()}-${pad2(coba.getUTCMonth() + 1)}-${pad2(coba.getUTCDate())}`
  }

  return null
}

// Fungsi utama: terima nilai apa pun dari sel Excel ("Tanggal") dan
// kembalikan teks "YYYY-MM-DD" yang valid, atau null kalau tidak bisa
// dikenali sama sekali.
function tanggalDariExcel(nilai) {
  if (nilai === '' || nilai === null || nilai === undefined) return null

  if (nilai instanceof Date) {
    if (isNaN(nilai.getTime())) return null
    return `${nilai.getUTCFullYear()}-${pad2(nilai.getUTCMonth() + 1)}-${pad2(nilai.getUTCDate())}`
  }

  if (typeof nilai === 'number') {
    return tanggalDariAngkaSerialExcel(nilai)
  }

  return tanggalDariTeks(nilai)
}

export default function Nota({ sekolah }) {
  const [daftar, setDaftar] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(formKosong())
  const [notaCetak, setNotaCetak] = useState(null) // data yang lagi disiapkan untuk print
  const [importBusy, setImportBusy] = useState(false)
  const [importRingkasan, setImportRingkasan] = useState(null)

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

  // Setelah dialog print ditutup, kosongkan notaCetak supaya blok pratinjau
  // cetak tidak tertinggal di DOM.
  useEffect(() => {
    function bersihkanSetelahPrint() {
      setNotaCetak(null)
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

  // ------------------------- Cetak -------------------------
  function cetakNota(row) {
    setNotaCetak(mapUntukCetak(row))
    // beri waktu render sebelum memanggil print
    setTimeout(() => window.print(), 100)
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
      // object, bukan angka serial (mis. 45725).
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Kelompokkan baris berdasarkan "No Nota"
      const kelompok = new Map()
      const tanggalGagal = []

      rows.forEach((r, i) => {
        const noNota = String(r['No Nota'] ?? '').trim()
        if (!noNota) return

        const nomorBarisExcel = i + 2

        if (!kelompok.has(noNota)) {
          let tanggal = tanggalDariExcel(r['Tanggal'])
          if (!tanggal) {
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
        if (!grup.tuan && r['Tuan']) grup.tuan = r['Tuan']
        if (!grup.toko && r['Toko']) grup.toko = r['Toko']
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

  return (
    <div className="p-4">
      <div className="no-print">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">Nota Belanja</h1>
          <div className="flex gap-2">
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
            <button onClick={bukaTambah} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">
              + Tambah Nota
            </button>
          </div>
        </div>

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
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Memuat...</td></tr>
              ) : daftar.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Belum ada nota</td></tr>
              ) : (
                daftar.map((row) => (
                  <tr key={row.id} className="border-t">
                    <td className="p-2">{row.no_nota}</td>
                    <td className="p-2">{row.tanggal}</td>
                    <td className="p-2">{row.tuan}</td>
                    <td className="p-2">{row.toko}</td>
                    <td className="p-2 text-right">
                      {new Intl.NumberFormat('id-ID').format(row.jumlah_total || 0)}
                    </td>
                    <td className="p-2">
                      <div className="flex justify-center gap-2 text-xs">
                        <button onClick={() => cetakNota(row)} className="text-blue-600">Cetak</button>
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
      </div>

      {/* Wajib DI LUAR elemen "no-print" — ini yang tampil saat window.print().
          marginTop mendorong nota turun ke bagian bawah kertas A4 (297mm).
          Nota-nya sendiri tingginya sekitar 148mm. Kalau posisinya masih
          kurang turun / malah kepotong ke halaman 2, sesuaikan angka
          marginTop ini sedikit demi sedikit (mis. dari 120mm ke 130mm)
          sambil cek hasil print preview. */}
      {notaCetak && (
        <div style={{ marginTop: '120mm' }}>
          <NotaPrintTemplate ref={printRef} sekolah={sekolah} data={notaCetak} />
        </div>
      )}
    </div>
  )
}
