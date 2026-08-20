import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Loader2, Printer } from 'lucide-react'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import { useSaranFormKuitansi } from '../lib/useSaranFormKuitansi'

// initialData (opsional): baris kuitansi lain yang datanya mau disalin ke
// form ini. No. Bukti & Tanggal SENGAJA tidak ikut disalin karena keduanya
// harus baru untuk tiap transaksi.
const emptyForm = (initialData) => ({
  no_bukti: '',
  lembar: initialData?.lembar || 'I/II/III/IV/V',
  mata_anggaran: initialData?.mata_anggaran || '',
  tahun_anggaran: initialData?.tahun_anggaran || String(new Date().getFullYear()),
  tanggal: new Date().toISOString().slice(0, 10),
  diterima_dari: initialData?.diterima_dari || '',
  jumlah: initialData?.jumlah_total ?? initialData?.jumlah ?? '',
  untuk_pembayaran: initialData?.untuk_pembayaran || '',
  disetujui_oleh: initialData?.disetujui_oleh || '',
  jabatan_disetujui: initialData?.jabatan_disetujui || 'Atasan Langsung',
  nip_disetujui: initialData?.nip_disetujui || '',
  dibayar_oleh: initialData?.dibayar_oleh || '',
  nip_dibayar: initialData?.nip_dibayar || '',
  nama_penerima: initialData?.nama_penerima || '',
  alamat_penerima: initialData?.alamat_penerima || '',
  catatan: initialData?.catatan || '',
})

export default function KuitansiModal({ sekolah, initialData, onClose }) {
  const [form, setForm] = useState(emptyForm(initialData))
  const [saving, setSaving] = useState(false)
  const [savedData, setSavedData] = useState(null)
  const printRef = useRef(null)
  const { saran, namaKeNip } = useSaranFormKuitansi()

  function ubah(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // Kalau nama yang diketik cocok dengan nama guru/pegawai yang pernah
  // dipakai (dari useSaranFormKuitansi), NIP-nya otomatis ikut terisi.
  function ubahNamaDenganAutoNip(namaField, nipField, value) {
    setForm((prev) => {
      const next = { ...prev, [namaField]: value }
      const nipTerkait = namaKeNip[value.trim()]
      if (nipTerkait) next[nipField] = nipTerkait
      return next
    })
  }

  async function handleSimpan(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let nomorFinal = form.no_bukti.trim()
      if (!nomorFinal) {
        const { data: nomorData, error: nomorErr } = await supabase.rpc('next_nomor_kuitansi', { p_jenis: 'kuitansi' })
        if (nomorErr) throw nomorErr
        nomorFinal = nomorData
      }

      const payload = {
        jenis: 'kuitansi',
        nomor: nomorFinal,
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
      const t = setTimeout(() => window.print(), 150)
      return () => clearTimeout(t)
    }
  }, [savedData])

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-semibold">Buat Kuitansi Baru</h2>
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
              <div>
                <label className="label-field">Lembar</label>
                <input
                  className="input-field"
                  list="saran-lembar"
                  value={form.lembar}
                  onChange={(e) => ubah('lembar', e.target.value)}
                />
                <datalist id="saran-lembar">
                  {saran.lembar?.map((v) => <option key={v} value={v} />)}
                </datalist>
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
                list="saran-mata-anggaran"
                placeholder="Contoh: 5.1.02.01.01.00.12"
                value={form.mata_anggaran}
                onChange={(e) => ubah('mata_anggaran', e.target.value)}
              />
              <datalist id="saran-mata-anggaran">
                {saran.mata_anggaran?.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label className="label-field">Sudah Terima Dari</label>
              <input
                className="input-field"
                list="saran-diterima-dari"
                placeholder="Nama orang / pihak pembayar"
                value={form.diterima_dari}
                onChange={(e) => ubah('diterima_dari', e.target.value)}
              />
              <datalist id="saran-diterima-dari">
                {saran.diterima_dari?.map((v) => <option key={v} value={v} />)}
              </datalist>
            </div>

            <div>
              <label className="label-field">Jumlah (Rp)</label>
              <input
                type="number"
                min="0"
                className="input-field"
                placeholder="Contoh: 1000000"
                value={form.jumlah}
                onChange={(e) => ubah('jumlah', e.target.value)}
              />
            </div>

            <div>
              <label className="label-field">Untuk Pembayaran</label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="Contoh: Transportasi dalam rangka penyusunan soal UAS"
                value={form.untuk_pembayaran}
                onChange={(e) => ubah('untuk_pembayaran', e.target.value)}
              />
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">Pemegang Kas (yang membayar)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Nama</label>
                  <input
                    className="input-field"
                    list="saran-dibayar-oleh"
                    value={form.dibayar_oleh}
                    onChange={(e) => ubahNamaDenganAutoNip('dibayar_oleh', 'nip_dibayar', e.target.value)}
                  />
                  <datalist id="saran-dibayar-oleh">
                    {saran.dibayar_oleh?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">NIP</label>
                  <input
                    className="input-field"
                    value={form.nip_dibayar}
                    onChange={(e) => ubah('nip_dibayar', e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">Disetujui Oleh (atasan langsung)</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Nama</label>
                  <input
                    className="input-field"
                    list="saran-disetujui-oleh"
                    value={form.disetujui_oleh}
                    onChange={(e) => ubahNamaDenganAutoNip('disetujui_oleh', 'nip_disetujui', e.target.value)}
                  />
                  <datalist id="saran-disetujui-oleh">
                    {saran.disetujui_oleh?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">NIP</label>
                  <input
                    className="input-field"
                    value={form.nip_disetujui}
                    onChange={(e) => ubah('nip_disetujui', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="label-field">Jabatan</label>
                  <input
                    className="input-field"
                    list="saran-jabatan-disetujui"
                    value={form.jabatan_disetujui}
                    onChange={(e) => ubah('jabatan_disetujui', e.target.value)}
                  />
                  <datalist id="saran-jabatan-disetujui">
                    {saran.jabatan_disetujui?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold mb-3">Yang Menerima</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Nama</label>
                  <input
                    className="input-field"
                    list="saran-nama-penerima"
                    value={form.nama_penerima}
                    onChange={(e) => ubah('nama_penerima', e.target.value)}
                  />
                  <datalist id="saran-nama-penerima">
                    {saran.nama_penerima?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
                <div>
                  <label className="label-field">Alamat</label>
                  <input
                    className="input-field"
                    list="saran-alamat-penerima"
                    value={form.alamat_penerima}
                    onChange={(e) => ubah('alamat_penerima', e.target.value)}
                  />
                  <datalist id="saran-alamat-penerima">
                    {saran.alamat_penerima?.map((v) => <option key={v} value={v} />)}
                  </datalist>
                </div>
              </div>
            </div>

            <div>
              <label className="label-field">Catatan (opsional)</label>
              <input
                className="input-field"
                value={form.catatan}
                onChange={(e) => ubah('catatan', e.target.value)}
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
