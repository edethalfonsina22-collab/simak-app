import { forwardRef } from 'react'
import { terbilangRupiah } from '../lib/terbilang'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian (pengganti deretan titik "..........." yang sering terlihat tidak
// rata saat dicetak) — lebar tetap, tanpa garis bawah, isi teks kalau ada.
function Blank({ value, width = 140 }) {
  return (
    <span className="inline-block align-bottom px-1 leading-tight" style={{ minWidth: width }}>
      {value || '\u00A0'}
    </span>
  )
}

// Watermark bintang tersebar di latar, meniru kertas blanko kwitansi asli
// (dua bintang per ubin dengan posisi & rotasi sedikit berbeda supaya terasa acak,
// lalu diulang memenuhi halaman).
const STAR_WATERMARK_STYLE = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='72'%20height='72'%3E%3Ctext%20x='14'%20y='26'%20font-size='22'%20fill='%23000000'%20fill-opacity='0.16'%20text-anchor='middle'%20transform='rotate(-8%2014%2026)'%3E%E2%98%85%3C/text%3E%3Ctext%20x='50'%20y='60'%20font-size='18'%20fill='%23000000'%20fill-opacity='0.16'%20text-anchor='middle'%20transform='rotate(10%2050%2060)'%3E%E2%98%85%3C/text%3E%3C/svg%3E\")",
  backgroundRepeat: 'repeat',
  backgroundPosition: '0 0',
  // Beberapa browser (terutama Chrome) tidak mencetak background sama sekali kecuali
  // property ini diset — tanpa ini, watermark akan hilang total saat print walaupun
  // tampil normal di layar / preview biasa.
  WebkitPrintColorAdjust: 'exact',
  printColorAdjust: 'exact',
  colorAdjust: 'exact',
}

/**
 * Template cetak Kuitansi — meniru format blanko resmi fisik:
 * kop "No. Bukti / Lembar / Mata Anggaran / Tahun", judul KWITANSI,
 * baris Sudah Terima Dari / Uang Sejumlah / Untuk Pembayaran, TERBILANG,
 * dan tiga kolom tanda tangan (Pemegang Kas, Atasan Langsung, Yang Menerima).
 *
 * Fokus khusus Kwitansi — tidak ada lagi bagian Nota / rincian barang.
 * Nominal langsung diambil dari `data.jumlah_total` (diisi lewat field
 * "Uang Sejumlah" di form), bukan dihitung dari daftar item.
 *
 * PENTING: komponen ini HARUS dirender di luar elemen manapun yang berclass
 * "no-print" — kalau induknya "no-print", seluruh lembar ini ikut hilang saat
 * dicetak walaupun class "print-only" di sini diberi visibility:visible
 * (display:none pada induk menang atas visibility pada anak).
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (disediakan untuk pemakaian di masa depan)
 *  - data: baris dari tabel `kuitansi`
 */
const KuitansiPrintTemplate = forwardRef(function KuitansiPrintTemplate({ sekolah, data }, ref) {
  const total = Number(data?.jumlah_total) || 0

  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black p-10 text-sm overflow-hidden"
      style={{
        width: '210mm',
        minHeight: '148mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      {/* Watermark bintang */}
      <div className="absolute inset-0" style={STAR_WATERMARK_STYLE} aria-hidden="true" />

      {/* Konten di atas watermark */}
      <div className="relative">
        <div className="flex items-start justify-between mb-2">
          <div>
            <p>No. Bukti <Blank value={data?.no_bukti} width={170} /></p>
            <p>Lembar : {data?.lembar || 'I/II/III/IV/V'}</p>
          </div>
          <div className="text-right">
            <p>Mata Anggaran : <Blank value={data?.mata_anggaran} width={150} /></p>
            <p>Tahun : <Blank value={data?.tahun_anggaran} width={90} /></p>
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
              <td className="py-1 align-top whitespace-pre-line">{data?.untuk_pembayaran || '-'}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex items-center gap-2 mb-6">
          <span className="font-semibold">TERBILANG : Rp.</span>
          <span className="border-b-2 border-black px-3 font-semibold">{formatRupiah(total)}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Lunas dibayar */}
          <div className="text-center">
            <p>Lunas dibayar</p>
            <p>Pemegang Kas,</p>
            <div className="h-16" />
            <div className="border-b border-black pb-1">
              <p>{data?.dibayar_oleh || '.......................'}</p>
              <p className="text-xs">NIP. {data?.nip_dibayar || '.......................'}</p>
            </div>
            <p className="text-xs mt-2 text-left">Tgl. Dibayarkan : {formatTanggal(data?.tanggal)}</p>
          </div>

          {/* Setuju dibayar */}
          <div className="text-center">
            <p>Setuju dibayar :</p>
            <p>{data?.jabatan_disetujui || 'Atasan Langsung'},</p>
            <div className="h-16" />
            <div className="border-b border-black pb-1">
              <p>{data?.disetujui_oleh || '.......................'}</p>
              <p className="text-xs">NIP. {data?.nip_disetujui || '.......................'}</p>
            </div>
          </div>

          {/* Yang Menerima — tanggal dipindah ke sini (dari kolom Setuju dibayar) */}
          <div className="text-center">
            <p>{formatTanggal(data?.tanggal)}</p>
            <p>Yang Menerima,</p>
            <div className="h-16" />
            <div className="border-b border-black pb-1">
              <p>{data?.nama_penerima || '.......................'}</p>
              <p className="text-xs">Alamat : {data?.alamat_penerima || '-'}</p>
            </div>
          </div>
        </div>

        {data?.catatan && <p className="text-xs italic">Catatan: {data.catatan}</p>}
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
