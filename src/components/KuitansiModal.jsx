import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Plus, Trash2, X, Loader2, Printer } from 'lucide-react'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'

const emptyItem = () => ({ id: crypto.randomUUID(), nama_barang: '', jumlah: 1, harga_satuan: 0 })

const emptyForm = (keuanganRow) => ({
  no_bukti: '',
  lembar: 'I/II/III/IV/V',
  mata_anggaran: '',
  tahun_anggaran: String(new Date().getFullYear()),
  tanggal: keuanganRow?.tanggal || new Date().toISOString().slice(0, 10),
  untuk_pembayaran: keuanganRow?.catatan || keuanganRow?.kategori || '',
  catatan: '',
  diterima_dari: '',
  disetujui_oleh: '',
  jabatan_disetujui: 'Atasan Langsung',
  nip_disetujui: '',
  dibayar_oleh: '',
  jabatan_dibayar: 'Pemegang Kas',
  nip_dibayar: '',
  nama_penerima: '',
  alamat_penerima: '',
})

/**
 * Form untuk membuat Kuitansi (khusus Kwitansi — bagian Nota belum didukung di sini).
 *
 * Dipanggil dari Keuangan.jsx atau Kuitansi.jsx:
 *   <KuitansiModal
 *     keuanganRow={row}          // baris transaksi keuangan yang mau dibuatkan kuitansi (boleh null)
 *     sekolah={{ nama, alamat, kota }}
 *     onClose={() => setKuitansiFor(null)}
 *   />
 */
export default function KuitansiModal({ keuanganRow, sekolah, onClose }) {
  const [form, setForm] = useState(emptyForm(keuanganRow))
  const [items, setItems] = useState([
    { ...emptyItem(), nama_barang: keuanganRow?.catatan || keuanganRow?.kategori || '', jumlah: 1, harga_satuan: keuanganRow?.jumlah || 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null) // { ...kuitansi row } setelah tersimpan, siap dicetak
  const printRef = useRef(null)

  const total = items.reduce((a, b) => a + Number(b.jumlah || 0) * Number(b.harga_satuan || 0), 0)

  function ubah(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function updateItem(id, field, value) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)))
  }

  function addItem() {
    setItems((prev) => [...prev, emptyItem()])
  }

  function removeItem(id) {
    setItems((prev) => (prev.length > 1 ? prev.filter((it) => it.id !== id) : prev))
  }

  async function handleSimpan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi' })
      if (nomorErr) throw nomorErr

      const payload = {
        keuangan_id: keuanganRow?.id || null,
        jenis: 'kuitansi',
        nomor: nomorData,
        no_bukti: form.no_bukti,
        lembar: form.lembar,
        mata_anggaran: form.mata_anggaran,
        tahun_anggaran: form.tahun_anggaran,
        tanggal: form.tanggal,
        diterima_dari: form.diterima_dari,
        untuk_pembayaran: form.untuk_pembayaran,
        jumlah_total: total,
        disetujui_oleh: form.disetujui_oleh,
        jabatan_disetujui: form.jabatan_disetujui,
        nip_disetujui: form.nip_disetujui,
        dibayar_oleh: form.dibayar_oleh,
        jabatan_dibayar: form.jabatan_dibayar,
        nip_dibayar: form.nip_dibayar,
        nama_penerima: form.nama_penerima,
        alamat_penerima: form.alamat_penerima,
        catatan: form.catatan,
      }

      const { data: inserted, error: insertErr } = await supabase.from('kuitansi').insert(payload).select().single()
      if (insertErr) throw insertErr

      const itemPayload = items
        .filter((it) => it.nama_barang.trim() !== '')
        .map((it, i) => ({
          kuitansi_id: inserted.id,
          nama_barang: it.nama_barang,
          jumlah: Number(it.jumlah) || 1,
          harga_satuan: Number(it.harga_satuan) || 0,
          urutan: i,
        }))

      if (itemPayload.length > 0) {
        const { error: itemErr } = await supabase.from('kuitansi_item').insert(itemPayload)
        if (itemErr) throw itemErr
      }

      setSavedData(inserted)
    } catch (err) {
      alert('Gagal menyimpan kuitansi: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (savedData) {
      // beri waktu render sebelum memanggil print dialog
      const t = setTimeout(() => window.print(), 150)
      return () => clearTimeout(t)
    }
  }, [savedData])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Buat Kuitansi</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSimpan} className="space-y-4">
          {/* ==== Header dokumen ==== */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">No. Bukti</label>
              <input
                className="input-field"
                placeholder="Contoh: BNU-12"
                value={form.no_bukti}
                onChange={(e) => ubah('no_bukti', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Tanggal</label>
              <input
                type="date"
                className="input-field"
                value={form.tanggal}
                onChange={(e) => ubah('tanggal', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Lembar</label>
              <input
                className="input-field"
                value={form.lembar}
                onChange={(e) => ubah('lembar', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Tahun Anggaran</label>
              <input
                className="input-field"
                value={form.tahun_anggaran}
                onChange={(e) => ubah('tahun_anggaran', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label-field">Mata Anggaran</label>
            <input
              className="input-field"
              placeholder="Contoh: 5.1.02.01.01.0055"
              value={form.mata_anggaran}
              onChange={(e) => ubah('mata_anggaran', e.target.value)}
            />
          </div>

          <div>
            <label className="label-field">Sudah Terima Dari</label>
            <input
              className="input-field"
              placeholder="Nama orang tua / pihak pembayar"
              value={form.diterima_dari}
              onChange={(e) => ubah('diterima_dari', e.target.value)}
            />
          </div>

          <div>
            <label className="label-field">Untuk Pembayaran / Keterangan</label>
            <input
              className="input-field"
              placeholder="Kosongkan untuk otomatis diisi dari rincian barang di bawah"
              value={form.untuk_pembayaran}
              onChange={(e) => ubah('untuk_pembayaran', e.target.value)}
            />
          </div>

          {/* ==== Rincian barang (dipakai untuk menghitung total, tidak dicetak sebagai tabel) ==== */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label-field mb-0">Rincian Barang / Item</label>
              <button type="button" className="icon-btn" onClick={addItem}><Plus size={15} /></button>
            </div>
            <div className="space-y-2">
              {items.map((it) => (
                <div key={it.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    className="input-field col-span-5"
                    placeholder="Nama barang"
                    value={it.nama_barang}
                    onChange={(e) => updateItem(it.id, 'nama_barang', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input-field col-span-2"
                    placeholder="Jml"
                    value={it.jumlah}
                    onChange={(e) => updateItem(it.id, 'jumlah', e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    className="input-field col-span-4"
                    placeholder="Harga satuan"
                    value={it.harga_satuan}
                    onChange={(e) => updateItem(it.id, 'harga_satuan', e.target.value)}
                  />
                  <button type="button" className="icon-btn col-span-1 text-red-600" onClick={() => removeItem(it.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-right text-sm font-medium mt-2">
              Total: {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total)}
            </p>
          </div>

          {/* ==== Tanda tangan ==== */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Setuju Dibayar (nama)</label>
              <input
                className="input-field"
                value={form.disetujui_oleh}
                onChange={(e) => ubah('disetujui_oleh', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">NIP Penyetuju</label>
              <input
                className="input-field"
                value={form.nip_disetujui}
                onChange={(e) => ubah('nip_disetujui', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Lunas Dibayar (nama)</label>
              <input
                className="input-field"
                value={form.dibayar_oleh}
                onChange={(e) => ubah('dibayar_oleh', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">NIP Pembayar</label>
              <input
                className="input-field"
                value={form.nip_dibayar}
                onChange={(e) => ubah('nip_dibayar', e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Yang Menerima (nama)</label>
              <input
                className="input-field"
                value={form.nama_penerima}
                onChange={(e) => ubah('nama_penerima', e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Alamat Penerima</label>
              <input
                className="input-field"
                value={form.alamat_penerima}
                onChange={(e) => ubah('alamat_penerima', e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Batal</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              Simpan & Cetak
            </button>
          </div>
        </form>
      </div>

      {savedData && (
        <KuitansiPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={savedData}
          items={items.filter((it) => it.nama_barang.trim() !== '')}
        />
      )}
    </div>
  )
}
