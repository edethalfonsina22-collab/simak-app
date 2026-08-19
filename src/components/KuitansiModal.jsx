import { useEffect, useId, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Loader2, Printer } from 'lucide-react'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import { useSaranFormKuitansi } from '../lib/useSaranFormKuitansi'

const emptyForm = (keuanganRow) => ({
  no_bukti: '',
  lembar: 'I/II/III/IV/V',
  mata_anggaran: '',
  tahun_anggaran: String(new Date().getFullYear()),
  tanggal: keuanganRow?.tanggal || new Date().toISOString().slice(0, 10),
  diterima_dari: '',
  jumlah: keuanganRow?.jumlah || '',
  untuk_pembayaran: keuanganRow?.catatan || keuanganRow?.kategori || '',
  catatan: '',
  disetujui_oleh: '',
  jabatan_disetujui: 'Atasan Langsung',
  nip_disetujui: '',
  dibayar_oleh: '',
  jabatan_dibayar: 'Pemegang Kas',
  nip_dibayar: '',
  nama_penerima: '',
  alamat_penerima: '',
})

// Input teks dengan dropdown rekomendasi (datalist) — orang tetap bisa mengetik
// bebas, tapi kalau nilainya pernah dipakai sebelumnya (riwayat kuitansi atau
// daftar guru), tinggal pilih dari daftar tanpa mengetik ulang.
function InputSaran({ id, value, onChange, options = [], placeholder, type = 'text', ...rest }) {
  return (
    <>
      <input
        className="input-field"
        type={type}
        list={id}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete="off"
        {...rest}
      />
      <datalist id={id}>
        {options.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
  )
}

/**
 * Form untuk membuat Kuitansi (khusus Kwitansi — bagian Nota belum didukung di sini).
 * Nominal diisi langsung lewat field "Uang Sejumlah" (tidak lagi dihitung dari
 * rincian barang, karena rincian barang/item hanya relevan untuk Nota).
 *
 * Semua field teks punya dropdown rekomendasi (lihat useSaranFormKuitansi),
 * digabung dari riwayat kuitansi yang pernah dibuat + daftar guru/pegawai —
 * supaya tidak perlu mengetik ulang nama, mata anggaran, keterangan, dsb.
 * Memilih nama pada "Disetujui/Dibayar Oleh" yang cocok dengan data guru akan
 * otomatis mengisi NIP-nya (kalau kolom NIP masih kosong).
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
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null) // { ...kuitansi row } setelah tersimpan, siap dicetak
  const printRef = useRef(null)
  const { saran, namaKeNip } = useSaranFormKuitansi()
  const reactId = useId()
  const dl = (nama) => `saran-${nama}-${reactId}`

  function ubah(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Sama seperti ubah(), tapi khusus field nama penyetuju/pembayar: kalau nama
  // yang diketik/dipilih cocok dengan data guru dan NIP-nya masih kosong,
  // NIP ikut terisi otomatis.
  function ubahNama(fieldNama, fieldNip, value) {
    setForm((prev) => {
      const nip = namaKeNip[value.trim()]
      const nipBaru = nip && !prev[fieldNip] ? nip : prev[fieldNip]
      return { ...prev, [fieldNama]: value, [fieldNip]: nipBaru }
    })
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
                <InputSaran
                  id={dl('no_bukti')}
                  placeholder="Contoh: BNU-12"
                  value={form.no_bukti}
                  onChange={(e) => ubah('no_bukti', e.target.value)}
                  options={saran.no_bukti}
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
                <InputSaran
                  id={dl('lembar')}
                  value={form.lembar}
                  onChange={(e) => ubah('lembar', e.target.value)}
                  options={saran.lembar}
                />
              </div>
              <div>
                <label className="label-field">Tahun Anggaran</label>
                <InputSaran
                  id={dl('tahun_anggaran')}
                  value={form.tahun_anggaran}
                  onChange={(e) => ubah('tahun_anggaran', e.target.value)}
                  options={saran.tahun_anggaran}
                />
              </div>
            </div>

            <div>
              <label className="label-field">Mata Anggaran</label>
              <InputSaran
                id={dl('mata_anggaran')}
                placeholder="Contoh: 5.1.02.01.01.0055"
                value={form.mata_anggaran}
                onChange={(e) => ubah('mata_anggaran', e.target.value)}
                options={saran.mata_anggaran}
              />
            </div>

            <div>
              <label className="label-field">Sudah Terima Dari</label>
              <InputSaran
                id={dl('diterima_dari')}
                placeholder="Nama orang tua / pihak pembayar"
                value={form.diterima_dari}
                onChange={(e) => ubah('diterima_dari', e.target.value)}
                options={saran.diterima_dari}
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
              <InputSaran
                id={dl('untuk_pembayaran')}
                value={form.untuk_pembayaran}
                onChange={(e) => ubah('untuk_pembayaran', e.target.value)}
                options={saran.untuk_pembayaran}
              />
            </div>

            {/* ==== Tanda tangan ==== */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Setuju Dibayar (nama)</label>
                <InputSaran
                  id={dl('disetujui_oleh')}
                  value={form.disetujui_oleh}
                  onChange={(e) => ubahNama('disetujui_oleh', 'nip_disetujui', e.target.value)}
                  options={saran.disetujui_oleh}
                />
              </div>
              <div>
                <label className="label-field">NIP Penyetuju</label>
                <InputSaran
                  id={dl('nip_disetujui')}
                  value={form.nip_disetujui}
                  onChange={(e) => ubah('nip_disetujui', e.target.value)}
                  options={saran.nip_disetujui}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Lunas Dibayar (nama)</label>
                <InputSaran
                  id={dl('dibayar_oleh')}
                  value={form.dibayar_oleh}
                  onChange={(e) => ubahNama('dibayar_oleh', 'nip_dibayar', e.target.value)}
                  options={saran.dibayar_oleh}
                />
              </div>
              <div>
                <label className="label-field">NIP Pembayar</label>
                <InputSaran
                  id={dl('nip_dibayar')}
                  value={form.nip_dibayar}
                  onChange={(e) => ubah('nip_dibayar', e.target.value)}
                  options={saran.nip_dibayar}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-field">Yang Menerima (nama)</label>
                <InputSaran
                  id={dl('nama_penerima')}
                  value={form.nama_penerima}
                  onChange={(e) => ubah('nama_penerima', e.target.value)}
                  options={saran.nama_penerima}
                />
              </div>
              <div>
                <label className="label-field">Alamat Penerima</label>
                <InputSaran
                  id={dl('alamat_penerima')}
                  value={form.alamat_penerima}
                  onChange={(e) => ubah('alamat_penerima', e.target.value)}
                  options={saran.alamat_penerima}
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
