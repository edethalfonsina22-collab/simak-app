import { forwardRef } from 'react'
import { terbilangRupiah } from '../lib/terbilang'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Template cetak Kuitansi / Nota.
 * Dipakai sebagai elemen tersembunyi (class "print-only") yang baru terlihat
 * saat window.print() dipanggil — mengikuti pola SuratKeteranganPrintTemplate
 * dan BebanMengajarPrintTemplate yang sudah ada di project ini.
 *
 * Props:
 *  - sekolah: { nama, alamat, kota }
 *  - data: baris dari tabel `kuitansi`
 *  - items: baris-baris dari tabel `kuitansi_item`
 */
const KuitansiPrintTemplate = forwardRef(function KuitansiPrintTemplate({ sekolah, data, items = [] }, ref) {
  const isNota = data?.jenis === 'nota'
  const total = items.reduce((a, b) => a + Number(b.jumlah) * Number(b.harga_satuan), 0) || Number(data?.jumlah_total) || 0

  return (
    <div ref={ref} className="print-only bg-white text-black px-4 py-10 text-sm" style={{ width: '210mm', minHeight: '148mm' }}>
      <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
        <div>
          <p className="font-bold text-base uppercase">{sekolah?.nama || 'Nama Sekolah'}</p>
          <p className="text-xs">{sekolah?.alamat || 'Alamat sekolah'}</p>
          {sekolah?.kota && <p className="text-xs">{sekolah.kota}</p>}
        </div>
        <div className="text-right">
          <p className="font-bold text-lg uppercase tracking-wide">{isNota ? 'Nota' : 'Kuitansi'}</p>
          <p className="text-xs">No: {data?.nomor || '-'}</p>
        </div>
      </div>

      {!isNota && (
        <table className="w-full mb-4">
          <tbody>
            <tr>
              <td className="w-40 py-1 align-top">Sudah terima dari</td>
              <td className="w-4 align-top">:</td>
              <td className="py-1 align-top">{data?.diterima_dari || '-'}</td>
            </tr>
            <tr>
              <td className="py-1 align-top">Uang sejumlah</td>
              <td className="align-top">:</td>
              <td className="py-1 align-top italic">{terbilangRupiah(total)}</td>
            </tr>
            <tr>
              <td className="py-1 align-top">Untuk pembayaran</td>
              <td className="align-top">:</td>
              <td className="py-1 align-top">{data?.untuk_pembayaran || '-'}</td>
            </tr>
          </tbody>
        </table>
      )}

      {items.length > 0 && (
        <table className="w-full border-collapse mb-4">
          <thead>
            <tr className="border-y border-black">
              <th className="text-left py-1 font-semibold w-8">No</th>
              <th className="text-left py-1 font-semibold">Nama Barang</th>
              <th className="text-right py-1 font-semibold w-16">Jml</th>
              <th className="text-right py-1 font-semibold w-28">Harga Satuan</th>
              <th className="text-right py-1 font-semibold w-28">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id || i} className="border-b border-black/20">
                <td className="py-1">{i + 1}</td>
                <td className="py-1">{it.nama_barang}</td>
                <td className="py-1 text-right">{it.jumlah}</td>
                <td className="py-1 text-right">{formatRupiah(it.harga_satuan)}</td>
                <td className="py-1 text-right">{formatRupiah(it.jumlah * it.harga_satuan)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-black font-semibold">
              <td colSpan={4} className="py-2 text-right pr-3">Total</td>
              <td className="py-2 text-right">Rp {formatRupiah(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      {isNota && items.length === 0 && (
        <p className="mb-4">{data?.untuk_pembayaran || '-'} — Rp {formatRupiah(total)}</p>
      )}

      {data?.catatan && <p className="text-xs italic mb-4">Catatan: {data.catatan}</p>}

      <div className="flex justify-between mt-10">
        <div className="text-center w-48">
          <p>Setuju dibayar,</p>
          <p className="text-xs text-black/60">({data?.jabatan_disetujui || 'Atasan Langsung'})</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1">{data?.disetujui_oleh || '.......................'}</p>
        </div>
        <div className="text-center w-48">
          <p>{formatTanggal(data?.tanggal)}</p>
          <p>Lunas dibayar,</p>
          <p className="text-xs text-black/60">({data?.jabatan_dibayar || 'Pemegang Kas'})</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1">{data?.dibayar_oleh || '.......................'}</p>
        </div>
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
