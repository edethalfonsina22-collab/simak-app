import { forwardRef } from 'react'
import { terbilangRupiah } from '../lib/terbilang'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian bertitik-titik — meniru blanko kwitansi fisik (lihat gambar acuan).
// PENTING: `width` di sini adalah lebar TETAP (bukan minimum) supaya kotak ini
// tidak pernah melebar sendiri dan merusak layout kop surat — beda dari versi
// sebelumnya yang memakai 60 karakter "." literal (lebarnya tidak terkendali,
// menyebabkan baris pecah / teks lain kepotong).
// Kalau `value` kosong: tampil garis titik-titik CSS selebar `width`.
// Kalau `value` ada: teks ditumpuk di atas garis titik itu (dengan background
// putih di belakangnya) supaya tidak tabrakan dengan titik-titik.
function Blank({ value, width = 140 }) {
  return (
    <span
      className="relative inline-block align-bottom"
      style={{ width, height: '1.1em' }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 bottom-[2px] border-b border-dotted border-black/70"
      />
      {value && (
        <span
          className="absolute inset-0 bg-white px-1 whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {value}
        </span>
      )}
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
      className="print-only relative bg-white text-black p-12 text-base leading-relaxed overflow-hidden border border-black"
      style={{
        width: '210mm',
        minHeight: '148mm',
        margin: '0 auto',
        boxSizing: 'border-box',
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
          {/* No. Bukti & Lembar sekarang pakai struktur tabel yang sama dengan
              Mata Anggaran / Tahun di sebelah kanan, supaya label, titik dua,
              dan nilainya sejajar rapi (sebelumnya "No. Bukti" ditulis polos
              tanpa titik dua dan tidak sejajar dengan nilainya). */}
          <table>
            <tbody>
              <tr>
                <td className="text-left whitespace-nowrap align-bottom pr-1 font-semibold" style={{ width: 90 }}>No. Bukti</td>
                <td className="align-bottom pr-1 font-semibold">:</td>
                <td className="align-bottom"><Blank value={data?.no_bukti} width={220} /></td>
              </tr>
              <tr>
                <td className="text-left whitespace-nowrap align-bottom pr-1 font-semibold" style={{ width: 90 }}>Lembar</td>
                <td className="align-bottom pr-1 font-semibold">:</td>
                <td className="align-bottom">
                  <span className="relative inline-block align-bottom font-semibold" style={{ height: '1.1em' }}>
                    {data?.lembar || 'I/II/III/IV/V'}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
          {/* Tabel kecil supaya "Mata Anggaran" & "Tahun" sejajar: label rata kiri
              dalam kolomnya sendiri, titik dua & kolom isian ikut sejajar di
              bawahnya — sebelumnya pakai <p> + text-right sehingga label yang
              lebih pendek ("Tahun") ikut terdorong ke kanan dan tidak sejajar. */}
          <table className="ml-auto">
            <tbody>
              <tr>
                <td className="text-left whitespace-nowrap pr-1 font-semibold">Mata Anggaran</td>
                <td className="pr-1 font-semibold">:</td>
                <td><Blank value={data?.mata_anggaran} width={190} /></td>
              </tr>
              <tr>
                <td className="text-left whitespace-nowrap pr-1 font-semibold">Tahun</td>
                <td className="pr-1 font-semibold">:</td>
                <td><Blank value={data?.tahun_anggaran} width={120} /></td>
              </tr>
            </tbody>
          </table>
        </div>

        <h1 className="font-display text-center text-3xl font-bold underline tracking-wide mb-6">KWITANSI</h1>

        <table className="w-full mb-8 text-base">
          <tbody>
            <tr>
              <td className="w-52 py-1.5 align-top font-semibold">Sudah Terima Dari</td>
              <td className="w-4 align-top font-semibold">:</td>
              <td className="py-1.5 align-top">{data?.diterima_dari || '-'}</td>
            </tr>
            <tr>
              <td className="py-1.5 align-top font-semibold">Uang Sejumlah</td>
              <td className="align-top font-semibold">:</td>
              <td className="py-1.5 align-top italic uppercase">{terbilangRupiah(total)}</td>
            </tr>
            <tr>
              <td className="py-1.5 align-top font-semibold">Untuk Pembayaran</td>
              <td className="align-top font-semibold">:</td>
              <td className="py-1.5 align-top whitespace-pre-line">{data?.untuk_pembayaran || '-'}</td>
            </tr>
            {/* TERBILANG sekarang jadi baris tabel juga (bukan <div> terpisah lagi)
                supaya label & garis bawah nominalnya sejajar rata kiri dengan
                "Sudah Terima Dari / Uang Sejumlah / Untuk Pembayaran" di atasnya. */}
            <tr>
              <td className="py-1.5 align-top font-semibold" colSpan={2}>TERBILANG : Rp.</td>
              <td className="py-1.5 align-top font-semibold">
                <span className="border-b-2 border-black px-4 text-lg">{formatRupiah(total)}</span>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="grid grid-cols-3 gap-6 mb-10 text-base">
          {/* Lunas dibayar */}
          <div className="text-center">
            <p className="font-semibold">Lunas dibayar</p>
            <p className="font-semibold">Pemegang Kas,</p>
            <div className="h-20" />
            <div className="border-b border-black pb-1">
              <p>{data?.dibayar_oleh || '.......................'}</p>
              <p className="text-sm">NIP. {data?.nip_dibayar || '.......................'}</p>
            </div>
            <p className="text-sm mt-2 text-left">Tgl. Dibayarkan : {formatTanggal(data?.tanggal)}</p>
          </div>

          {/* Setuju dibayar */}
          <div className="text-center">
            <p className="font-semibold">Setuju dibayar :</p>
            <p className="font-semibold">{data?.jabatan_disetujui || 'Atasan Langsung'},</p>
            <div className="h-20" />
            <div className="border-b border-black pb-1">
              <p>{data?.disetujui_oleh || '.......................'}</p>
              <p className="text-sm">NIP. {data?.nip_disetujui || '.......................'}</p>
            </div>
          </div>

          {/* Yang Menerima — tanggal di atas sekarang disertai nama kota (diambil
              dari field Alamat Penerima), jadi formatnya "Dobo, 9 Maret 2025"
              sama seperti pola tanggal+kota yang lazim di surat, dan konsisten
              dengan alamat yang sudah tampil di bawah nama penerima. */}
          <div className="text-center">
            <p className="font-semibold">{data?.alamat_penerima ? `${data.alamat_penerima}, ` : ''}{formatTanggal(data?.tanggal)}</p>
            <p className="font-semibold">Yang Menerima,</p>
            <div className="h-20" />
            <div className="border-b border-black pb-1">
              <p>{data?.nama_penerima || '.......................'}</p>
              <p className="text-sm">Alamat : {data?.alamat_penerima || '-'}</p>
            </div>
          </div>
        </div>

        {data?.catatan && <p className="text-sm italic">Catatan: {data.catatan}</p>}
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
