import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Loader2, Printer } from 'lucide-react'
import KuitansiJasaPrintTemplate from '../lib/KuitansiJasaPrintTemplate'
import { terbilangRupiah } from '../lib/terbilang'

// `initialData` (opsional) adalah baris kuitansi/kuitansi-jasa yang mau ditarik
// datanya (dari tombol "Tarik dari Kuitansi" atau "Duplikat" di KuitansiJasa.jsx).
// Semua field diisi otomatis dari initialData, termasuk No. Bukti dan Tanggal —
// keduanya ikut ditarik sama persis dari kuitansi utama (bukan direset ke
// kosong/hari ini lagi), sesuai konfirmasi user.
//
// `alamat` dipetakan ke kolom `alamat_penerima` di tabel `kuitansi` — kolom
// yang sama dipakai Kuitansi Utama untuk baris "<kota>, <tanggal>" di
// cetakan (mis. "Ambon, 27 November 2026"). Kwitansi Jasa sebelumnya malah
// memakai field Kabupaten di Profil Sekolah untuk baris ini, yang isinya
// nama instansi untuk kop surat (mis. "PEMERINTAH KABUPATEN KEPULAUAN ARU"),
// bukan nama kota — makanya salah muncul di cetakan.
const emptyForm = (initialData) => ({
  no_bukti: initialData?.no_bukti || '',
  tanggal: initialData?.tanggal || new Date().toISOString().slice(0, 10),
  diterima_dari: initialData?.diterima_dari || '',
  jumlah: initialData?.jumlah_total != null && initialData.jumlah_total !== ''
    ? String(initialData.jumlah_total)
    : '',
  untuk_pembayaran: initialData?.untuk_pembayaran || '',
  alamat: initialData?.alamat_penerima || '',
})

export default function KuitansiJasaModal({ sekolah, initialData, onClose }) {
  const [form, setForm] = useState(() => emptyForm(initialData))
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null)
  const printRef = useRef(null)

  function ubah(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSimpan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let nomorFinal = form.no_bukti.trim()
      if (!nomorFinal) {
        const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi_jasa' })
        if (nomorErr) throw nomorErr
        nomorFinal = nomorData
      }

      const payload = {
        jenis: 'kuitansi_jasa',
        nomor: nomorFinal,
        no_bukti: form.no_bukti,
        tanggal: form.tanggal,
        diterima_dari: form.diterima_dari,
        untuk_pembayaran: form.untuk_pembayaran,
        jumlah_total: Number(form.jumlah) || 0,
        alamat_penerima: form.alamat,
      }

      const { data: inserted, error: insertErr } = await supabase.from('kuitansi').insert(payload).select().single()
      if (insertErr) throw insertErr

      setSavedData(inserted)
    } catch (err) {
      alert('Gagal menyimpan kuitansi jasa: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (savedData) {
      const t = setTimeout(() => window.print(), 150)
      return () => clearTimeout(t)
    }
  }, [savedData])

  const dataCetak = savedData
    ? {
        no_kwitansi: savedData.nomor,
        tanggal: savedData.tanggal,
        dari: savedData.diterima_dari,
        uang_sejumlah: terbilangRupiah(savedData.jumlah_total).toUpperCase(),
        untuk_pembayaran: savedData.untuk_pembayaran,
        jumlah: savedData.jumlah_total,
        alamat: savedData.alamat_penerima,
      }
    : null

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Buat Kuitansi Jasa</h2>
            <button className="icon-btn" onClick={onClose}><X size={18} /></button>
          </div>

          <form onSubmit={handleSimpan} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">No. Bukti (opsional)</label>
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

            <div>
              <label className="label-field">Telah Terima Dari</label>
              <input
                className="input-field"
                placeholder="Nama orang / pihak pembayar"
                value={form.diterima_dari}
                onChange={(e) => ubah('diterima_dari', e.target.value)}
              />
            </div>

            <div>
              <label className="label-field">Jumlah (Rp)</label>
              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="Contoh: 250000"
                value={form.jumlah}
                onChange={(e) => ubah('jumlah', e.target.value)}
              />
              {form.jumlah > 0 && (
                <p className="text-xs text-ink-700/50 mt-1 italic">
                  Terbilang: {terbilangRupiah(form.jumlah).toUpperCase()}
                </p>
              )}
            </div>

            <div>
              <label className="label-field">Untuk Pembayaran / Keterangan</label>
              <input
                className="input-field"
                placeholder="Contoh: Transport kegiatan lomba"
                value={form.untuk_pembayaran}
                onChange={(e) => ubah('untuk_pembayaran', e.target.value)}
              />
            </div>

            <div>
              <label className="label-field">Alamat (kota untuk tanggal di cetakan)</label>
              <input
                className="input-field"
                placeholder="Contoh: Ambon"
                value={form.alamat}
                onChange={(e) => ubah('alamat', e.target.value)}
              />
              <p className="text-xs text-ink-700/50 mt-1">
                Akan muncul di cetakan sebagai &quot;{form.alamat || 'Ambon'}, {new Date(form.tanggal || Date.now()).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}&quot;
              </p>
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
      </div>

      {dataCetak && (
        <KuitansiJasaPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={dataCetak}
        />
      )}
    </>
  )
}
