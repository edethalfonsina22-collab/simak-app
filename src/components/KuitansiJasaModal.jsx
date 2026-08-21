import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Loader2, Printer } from 'lucide-react'
import KuitansiJasaPrintTemplate from '../lib/KuitansiJasaPrintTemplate'
import { terbilangRupiah } from '../lib/terbilang'

const emptyForm = () => ({
  no_bukti: '',
  tanggal: new Date().toISOString().slice(0, 10),
  diterima_dari: '',
  jumlah: '',
  untuk_pembayaran: '',
  nama_penerima: '',
})

/**
 * Form untuk membuat Kuitansi Jasa (transport, honor kegiatan, dsb).
 * Berbeda dari KuitansiModal (kuitansi barang): field lebih ringkas dan
 * "Uang Sejumlah" pada hasil cetak digenerate OTOMATIS dari nominal
 * (terbilangRupiah), bukan diisi manual.
 *
 * Disimpan ke tabel yang sama dengan kuitansi biasa (`kuitansi`), dibedakan
 * lewat kolom jenis = 'kuitansi_jasa', supaya riwayat & penomoran tetap
 * terpusat di satu tabel.
 *
 * Dipanggil dari KuitansiJasa.jsx:
 *   <KuitansiJasaModal sekolah={{ nama, alamat, kota }} onClose={...} />
 */
export default function KuitansiJasaModal({ sekolah, onClose }) {
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null) // { ...kuitansi row } setelah tersimpan, siap dicetak
  const printRef = useRef(null)

  function ubah(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSimpan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi_jasa' })
      if (nomorErr) throw nomorErr

      const payload = {
        jenis: 'kuitansi_jasa',
        nomor: nomorData,
        no_bukti: form.no_bukti,
        tanggal: form.tanggal,
        diterima_dari: form.diterima_dari,
        untuk_pembayaran: form.untuk_pembayaran,
        jumlah_total: Number(form.jumlah) || 0,
        nama_penerima: form.nama_penerima,
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
      // beri waktu render sebelum memanggil print dialog
      const t = setTimeout(() => window.print(), 150)
      return () => clearTimeout(t)
    }
  }, [savedData])

  // Data yang dioper ke template cetak — memetakan nama kolom tabel (nomor,
  // diterima_dari, jumlah_total) ke nama prop yang dipakai KuitansiJasaPrintTemplate
  // (no_kwitansi, dari, uang_sejumlah, jumlah).
  const dataCetak = savedData
    ? {
        no_kwitansi: savedData.nomor,
        tanggal: savedData.tanggal,
        dari: savedData.diterima_dari,
        uang_sejumlah: terbilangRupiah(savedData.jumlah_total),
        untuk_pembayaran: savedData.untuk_pembayaran,
        jumlah: savedData.jumlah_total,
        nama_penerima: savedData.nama_penerima,
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
                  Terbilang: {terbilangRupiah(form.jumlah)}
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
              <label className="label-field">Yang Menerima (nama)</label>
              <input
                className="input-field"
                placeholder="Nama penerima uang"
                value={form.nama_penerima}
                onChange={(e) => ubah('nama_penerima', e.target.value)}
              />
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

      {/* Sengaja di luar div "no-print" di atas — kalau ada di dalamnya, lembar ini
          ikut disembunyikan saat print (display:none pada induk menang atas
          visibility:visible di sini), akibatnya hasil cetak jadi halaman kosong. */}
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
