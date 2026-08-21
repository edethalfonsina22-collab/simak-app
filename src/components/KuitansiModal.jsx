import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Loader2, Printer } from 'lucide-react'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'

// Kunci localStorage untuk mengingat isian tanda tangan terakhir (Setuju
// Dibayar/NIP Penyetuju/Lunas Dibayar/NIP Pembayar) — orangnya biasanya
// itu-itu saja (kepala sekolah & bendahara yang sama) tiap kuitansi dibuat,
// jadi tidak perlu ketik ulang tiap kali. Tetap bisa diedit manual di form.
const TTD_STORAGE_KEY = 'kuitansi_ttd_default'

function ambilTtdTersimpan() {
  try {
    const raw = localStorage.getItem(TTD_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function simpanTtdDefault(form) {
  try {
    localStorage.setItem(TTD_STORAGE_KEY, JSON.stringify({
      disetujui_oleh: form.disetujui_oleh,
      nip_disetujui: form.nip_disetujui,
      dibayar_oleh: form.dibayar_oleh,
      nip_dibayar: form.nip_dibayar,
    }))
  } catch {
    // localStorage tidak tersedia (mis. mode privat) — abaikan saja, form tetap
    // berfungsi normal, hanya fitur "ingat isian" yang tidak aktif.
  }
}

const emptyForm = (keuanganRow) => {
  const ttdDefault = ambilTtdTersimpan()
  return {
    no_bukti: keuanganRow?.no_bukti || '',
    lembar: 'I/II/III/IV/V',
    mata_anggaran: keuanganRow?.mata_anggaran || '',
    tahun_anggaran: String(new Date().getFullYear()),
    tanggal: keuanganRow?.tanggal || new Date().toISOString().slice(0, 10),
    diterima_dari: '',
    jumlah: keuanganRow?.jumlah || '',
    untuk_pembayaran: keuanganRow?.catatan || keuanganRow?.kategori || '',
    catatan: '',
    disetujui_oleh: ttdDefault.disetujui_oleh || '',
    jabatan_disetujui: 'Atasan Langsung',
    nip_disetujui: ttdDefault.nip_disetujui || '',
    dibayar_oleh: ttdDefault.dibayar_oleh || '',
    jabatan_dibayar: 'Pemegang Kas',
    nip_dibayar: ttdDefault.nip_dibayar || '',
    nama_penerima: '',
    alamat_penerima: '',
  }
}

/**
 * Form untuk membuat Kuitansi (khusus Kwitansi — bagian Nota belum didukung di sini).
 * Nominal diisi langsung lewat field "Uang Sejumlah" (tidak lagi dihitung dari
 * rincian barang, karena rincian barang/item hanya relevan untuk Nota).
 *
 * Dipanggil dari Keuangan.jsx atau Kuitansi.jsx:
 *   <KuitansiModal
 *     keuanganRow={row}          // baris transaksi keuangan yang mau dibuatkan kuitansi (boleh null)
 *     sekolah={{ nama, alamat, kota }}
 *     onClose={() => setKuitansiFor(null)}
 *   />
 *
 * keuanganRow juga dipakai untuk prefill dari alur "Tarik Data dari BKU" di
 * Kuitansi.jsx — baris bku_kas dipetakan ke bentuk yang sama di sana
 * ({ tanggal, jumlah, catatan, kategori, no_bukti, mata_anggaran }, TANPA
 * field id — lihat catatan di handleSimpan soal keuangan_id) sebelum dioper
 * ke sini, supaya komponen ini tidak perlu tahu soal BKU.
 *
 * Field tanda tangan (disetujui_oleh/nip_disetujui/dibayar_oleh/nip_dibayar)
 * diingat otomatis lewat localStorage (lihat TTD_STORAGE_KEY di atas) supaya
 * tidak perlu diketik ulang tiap kali — orangnya biasanya sama terus.
 */
export default function KuitansiModal({ keuanganRow, sekolah, onClose }) {
  const [form, setForm] = useState(emptyForm(keuanganRow))
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
      const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi' })
      if (nomorErr) throw nomorErr

      const payload = {
        // PENTING: keuangan_id punya foreign key ke tabel `keuangan`. keuanganRow
        // bisa juga datang dari alur "Tarik Data dari BKU" (baris tabel bku_kas,
        // ID-nya BUKAN ID di tabel keuangan) — di situ Kuitansi.jsx sengaja TIDAK
        // menyertakan field `id`, jadi keuanganRow?.id otomatis undefined -> null.
        // Jangan pernah oper id baris bku_kas ke sini, nanti FK violation lagi.
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
        jumlah_total: Number(form.jumlah) || 0,
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

      // Simpan 4 field tanda tangan sebagai default untuk kuitansi berikutnya.
      simpanTtdDefault(form)

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
    <>
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
              <label className="label-field">Uang Sejumlah (Rp)</label>
              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="Contoh: 1250000"
                value={form.jumlah}
                onChange={(e) => ubah('jumlah', e.target.value)}
              />
            </div>

            <div>
              <label className="label-field">Untuk Pembayaran / Keterangan</label>
              <input
                className="input-field"
                value={form.untuk_pembayaran}
                onChange={(e) => ubah('untuk_pembayaran', e.target.value)}
              />
            </div>

            {/* ==== Tanda tangan ====
                4 field ini otomatis terisi dari isian terakhir (localStorage)
                lewat emptyForm() di atas — tetap bisa diedit kalau orangnya beda. */}
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
      </div>

      {/* Sengaja di luar div "no-print" di atas — kalau ada di dalamnya, lembar ini
          ikut disembunyikan saat print (display:none pada induk menang atas
          visibility:visible di sini), akibatnya hasil cetak jadi halaman kosong. */}
      {savedData && (
        <KuitansiPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={savedData}
        />
      )}
    </>
  )
}
