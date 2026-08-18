import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient' // sesuaikan path kalau berbeda di project kamu
import Layout from '../components/Layout'
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
      const wb = XLSX.read(buf, { type: 'array' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })

      // Kelompokkan baris berdasarkan "No Nota"
      const kelompok = new Map()
      for (const r of rows) {
        const noNota = String(r['No Nota'] ?? '').trim()
        if (!noNota) continue
        if (!kelompok.has(noNota)) {
          kelompok.set(noNota, {
            no_nota: noNota,
            tanggal: r['Tanggal'] || new Date().toISOString().slice(0, 10),
            tuan: r['Tuan'] || '',
            toko: r['Toko'] || '',
            alamat_lanjutan: '',
            items: [],
          })
        }
        const grup = kelompok.get(noNota)
        // Isi tuan/toko/tanggal kalau baris pertama grup kosong tapi baris ini ada isinya
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
      }

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
        setImportRingkasan({ sukses: records.length, gagal: 0, pesan: null })
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
    <Layout
      title="Nota Belanja"
      subtitle="Riwayat semua nota belanja yang pernah dibuat"
      actions={
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
          <button onClick={bukaTambah} className="px-3 py-2 rounded bg-blue-600 text-white text-sm">
            + Tambah Nota
          </button>
        </>
      }
    >
      <div className="no-print">
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

      {/* Wajib DI LUAR elemen "no-print" — ini yang tampil saat window.print() */}
      {notaCetak && (
        <NotaPrintTemplate ref={printRef} sekolah={sekolah} data={notaCetak} />
      )}
    </Layout>
  )
}
