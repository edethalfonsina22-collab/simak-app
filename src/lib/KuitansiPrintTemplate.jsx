import { forwardRef } from 'react'
import { terbilangRupiah } from '../lib/terbilang'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Watermark bintang berulang di latar, meniru kertas blanko kwitansi asli
// (kertas blanko fisik punya pola bintang tipis di seluruh halaman).
const STAR_WATERMARK_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Ctext x='32' y='40' font-size='24' text-anchor='middle' fill='%23000000' fill-opacity='0.07'%3E%E2%98%85%3C/text%3E%3C/svg%3E\")",
  backgroundRepeat: 'repeat',
  backgroundPosition: '0 0',
}

/**
 * Template cetak Kuitansi — meniru format blanko resmi fisik:
 * kop "No. Bukti / Lembar / Mata Anggaran / Tahun", judul KWITANSI,
 * baris Sudah Terima Dari / Uang Sejumlah / Untuk Pembayaran, TERBILANG,
 * dan tiga kolom tanda tangan (Pemegang Kas, Atasan Langsung, Yang Menerima).
 *
 * Sengaja tidak lagi menampilkan bagian Nota (tabel rincian barang / "NOTA No.")
 * — dokumen ini fokus khusus pada Kwitansi.
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (disediakan untuk pemakaian di masa depan)
 *  - data: baris dari tabel `kuitansi`
 *  - items: baris-baris dari tabel `kuitansi_item` (hanya dipakai untuk menghitung total
 *           dan sebagai isi default kolom "Untuk Pembayaran" jika field itu kosong)
 */
const KuitansiPrintTemplate = forwardRef(function KuitansiPrintTemplate({ sekolah, data, items = [] }, ref) {
  const total = items.reduce((a, b) => a + Number(b.jumlah) * Number(b.harga_satuan), 0) || Number(data?.jumlah_total) || 0

  const untukPembayaran =
    data?.untuk_pembayaran?.trim() ||
    (items.length > 0
      ? items.map((it) => `${it.nama_barang} (${it.jumlah} x ${formatRupiah(it.harga_satuan)})`).join('\n')
      : '-')

  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black p-10 text-sm overflow-hidden"
      style={{ width: '210mm', minHeight: '148mm' }}
    >
      {/* Watermark bintang */}
      <div className="absolute inset-0" style={STAR_WATERMARK_STYLE} aria-hidden="true" />

      {/* Konten di atas watermark */}
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p>No. Bukti <span className="ml-2">{data?.no_bukti || '..........................'}</span></p>
            <p>Lembar : {data?.lembar || 'I/II/III/IV/V'}</p>
          </div>
          <div className="text-right">
            <p>Mata Anggaran : <span className="ml-1">{data?.mata_anggaran || '..........................'}</span></p>
            <p>Tahun : <span className="ml-1">{data?.tahun_anggaran || '..........................'}</span></p>
          </div>
        </div>

        <h1 className="text-center text-xl font-bold underline tracking-wide mb-4">KWITANSI</h1>

        <table className="w-full mb-2">
          <tbody>
            <tr>
              <td className="w-40 py-1 align-top">Sudah Terima Dari</td>
              <td className="w-4 align-top">:</td>
              <td className="py-1 align-top">{data?.diterima_dari || '-'}</td>
            </tr>
            <tr>
              <td className="py-1 align-top">Uang Sejumlah</td>
              <td className="align-top">:</td>
              <td className="py-1 align-top italic uppercase">{terbilangRupiah(total)}</td>
            </tr>
            <tr>
              <td className="py-1 align-top">Untuk Pembayaran</td>
              <td className="align-top">:</td>
              <td className="py-1 align-top whitespace-pre-line">{untukPembayaran}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-center gap-2 mb-6">
          <span className="font-semibold">TERBILANG : Rp.</span>
          <span className="border-b-2 border-black px-3 font-semibold">{formatRupiah(total)}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="text-center">
            <p>Lunas dibayar</p>
            <p>Pemegang Kas,</p>
            <div className="h-16" />
            <p className="border-t border-black pt-1">{data?.dibayar_oleh || '.......................'}</p>
            <p className="text-xs">NIP. {data?.nip_dibayar || '.......................'}</p>
            <p className="text-xs mt-2 text-left">Tgl. Dibayarkan : {formatTanggal(data?.tanggal)}</p>
          </div>
          <div className="text-center">
            <p>{formatTanggal(data?.tanggal)}</p>
            <p>Setuju dibayar :</p>
            <p>{data?.jabatan_disetujui || 'Atasan Langsung'},</p>
            <div className="h-16" />
            <p className="border-t border-black pt-1">{data?.disetujui_oleh || '.......................'}</p>
            <p className="text-xs">NIP. {data?.nip_disetujui || '.......................'}</p>
          </div>
          <div className="text-center">
            <p>Yang Menerima,</p>
            <div className="h-16" />
            <p className="border-t border-black pt-1">{data?.nama_penerima || '.......................'}</p>
            <p className="text-xs">Alamat : {data?.alamat_penerima || '-'}</p>
          </div>
        </div>

        {data?.catatan && <p className="text-xs italic">Catatan: {data.catatan}</p>}
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
