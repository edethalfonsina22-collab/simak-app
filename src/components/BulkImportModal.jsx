import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Plus, Trash2, X, Loader2, Printer } from 'lucide-react'
import KuitansiPrintTemplate from './KuitansiPrintTemplate'

const emptyItem = () => ({ id: crypto.randomUUID(), nama_barang: '', jumlah: 1, harga_satuan: 0 })

/**
 * Dipanggil dari Keuangan.jsx:
 *   <KuitansiModal
 *     keuanganRow={row}          // baris transaksi keuangan yang mau dibuatkan kuitansi
 *     sekolah={{ nama, alamat, kota }}
 *     onClose={() => setKuitansiFor(null)}
 *   />
 */
export default function KuitansiModal({ keuanganRow, sekolah, onClose }) {
  const [jenis, setJenis] = useState('kuitansi')
  const [form, setForm] = useState({
    // umum
    diterima_dari: '',
    untuk_pembayaran: keuanganRow?.catatan || keuanganRow?.kategori || '',
    disetujui_oleh: '',
    jabatan_disetujui: 'Atasan Langsung',
    dibayar_oleh: '',
    jabatan_dibayar: 'Pemegang Kas',
    catatan: '',
    tanggal: keuanganRow?.tanggal || new Date().toISOString().slice(0, 10),
    // khusus kwitansi
    no_bukti: '',
    lembar: 'I/II/III/IV/V',
    mata_anggaran: '',
    tahun_anggaran: String(new Date().getFullYear()),
    nip_dibayar: '',
    nip_disetujui: '',
    nama_penerima: '',
    alamat_penerima: '',
    // khusus nota
    tuan: '',
    toko: '',
  })
  const [items, setItems] = useState([
    { ...emptyItem(), nama_barang: keuanganRow?.catatan || keuanganRow?.kategori || '', jumlah: 1, harga_satuan: keuanganRow?.jumlah || 0 },
  ])
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null) // { ...kuitansi row } setelah tersimpan, siap dicetak
  const printRef = useRef(null)

  const total = items.reduce((a, b) => a + Number(b.jumlah || 0) * Number(b.harga_satuan || 0), 0)

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
      const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: jenis })
      if (nomorErr) throw nomorErr

      const payload = {
        keuangan_id: keuanganRow?.id || null,
        jenis,
        nomor: nomorData,
        tanggal: form.tanggal,
        diterima_dari: form.diterima_dari,
        untuk_pembayaran: form.untuk_pembayaran,
        jumlah_total: total,
        disetujui_oleh: form.disetujui_oleh,
        jabatan_disetujui: form.jabatan_disetujui,
        dibayar_oleh: form.dibayar_oleh,
        jabatan_dibayar: form.jabatan_dibayar,
        catatan: form.catatan,
        no_bukti: form.no_bukti,
        lembar: form.lembar,
        mata_anggaran: form.mata_anggaran,
        tahun_anggaran: form.tahun_anggaran,
        nip_dibayar: form.nip_dibayar,
        nip_disetujui: form.nip_disetujui,
        nama_penerima: form.nama_penerima,
        alamat_penerima: form.alamat_penerima,
        tuan: form.tuan,
        toko: form.toko,
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Buat Kuitansi / Nota</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <form onSubmit={handleSimpan} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Jenis Dokumen</label>
              <select className="input-field" value={jenis} onChange={(e) => setJenis(e.target.value)}>
                <option value="kuitansi">Kuitansi</option>
                <option value="nota">Nota</option>
              </select>
            </div>
            <div>
              <label className="label-field">Tanggal</label>
              <input
                type="date"
                className="input-field"
                value={form.tanggal}
                onChange={(e) => setForm({ ...form, tanggal: e.target.value })}
              />
            </div>
          </div>

          {jenis === 'kuitansi' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">No. Bukti</label>
                <input
                  className="input-field"
                  placeholder="Mis. BNU-12"
                  value={form.no_bukti}
                  onChange={(e) => setForm({ ...form, no_bukti: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Lembar</label>
                <input
                  className="input-field"
                  value={form.lembar}
                  onChange={(e) => setForm({ ...form, lembar: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Mata Anggaran</label>
                <input
                  className="input-field"
                  placeholder="Mis. 5.1.02.01.01.00.55"
                  value={form.mata_anggaran}
                  onChange={(e) => setForm({ ...form, mata_anggaran: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Tahun</label>
                <input
                  className="input-field"
                  value={form.tahun_anggaran}
                  onChange={(e) => setForm({ ...form, tahun_anggaran: e.target.value })}
                />
              </div>
            </div>
          )}

          {jenis === 'nota' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Tuan</label>
                <input
                  className="input-field"
                  placeholder="Nama pembeli"
                  value={form.tuan}
                  onChange={(e) => setForm({ ...form, tuan: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Toko</label>
                <input
                  className="input-field"
                  placeholder="Nama toko/penjual"
                  value={form.toko}
                  onChange={(e) => setForm({ ...form, toko: e.target.value })}
                />
              </div>
            </div>
          )}

          {jenis === 'kuitansi' && (
            <div>
              <label className="label-field">Sudah Terima Dari</label>
              <input
                className="input-field"
                placeholder="Nama orang tua / pihak pembayar"
                value={form.diterima_dari}
                onChange={(e) => setForm({ ...form, diterima_dari: e.target.value })}
              />
            </div>
          )}

          <div>
            <label className="label-field">Untuk Pembayaran / Keterangan</label>
            <input
              className="input-field"
              value={form.untuk_pembayaran}
              onChange={(e) => setForm({ ...form, untuk_pembayaran: e.target.value })}
            />
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Setuju Dibayar (nama)</label>
              <input
                className="input-field"
                value={form.disetujui_oleh}
                onChange={(e) => setForm({ ...form, disetujui_oleh: e.target.value })}
              />
            </div>
            <div>
              <label className="label-field">Lunas Dibayar (nama)</label>
              <input
                className="input-field"
                value={form.dibayar_oleh}
                onChange={(e) => setForm({ ...form, dibayar_oleh: e.target.value })}
              />
            </div>
          </div>

          {jenis === 'kuitansi' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">NIP Setuju Dibayar</label>
                  <input
                    className="input-field"
                    value={form.nip_disetujui}
                    onChange={(e) => setForm({ ...form, nip_disetujui: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">NIP Lunas Dibayar</label>
                  <input
                    className="input-field"
                    value={form.nip_dibayar}
                    onChange={(e) => setForm({ ...form, nip_dibayar: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Yang Menerima (nama toko/penerima)</label>
                  <input
                    className="input-field"
                    value={form.nama_penerima}
                    onChange={(e) => setForm({ ...form, nama_penerima: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label-field">Alamat Penerima</label>
                  <input
                    className="input-field"
                    value={form.alamat_penerima}
                    onChange={(e) => setForm({ ...form, alamat_penerima: e.target.value })}
                  />
                </div>
              </div>
            </>
          )}

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
