import { forwardRef } from 'react'

function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian bergaris — sama persis dengan komponen Blank di NotaPrintTemplate.jsx
// supaya konsisten. Lebar TETAP (bukan minimum) supaya tidak melebar sendiri.
function Blank({ value, width = 160, align = 'left' }) {
  return (
    <span
      className="relative inline-block align-bottom"
      style={{ width, height: '1.1em' }}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 right-0 bottom-[2px] border-b border-black/70"
      />
      {value && (
        <span
          className={`absolute inset-0 bg-white px-1 whitespace-nowrap overflow-hidden text-ellipsis ${
            align === 'right' ? 'text-right' : 'text-left'
          }`}
        >
          {value}
        </span>
      )}
    </span>
  )
}

/**
 * Template cetak Kwitansi — meniru blanko kwitansi fisik (lihat contoh
 * blanko kosong yang dipakai sebagai acuan): border ganda, kolom sobekan
 * (counterfoil) berornamen di sisi kiri, dan badan kwitansi di kanan berisi
 * No. / Telah terima dari / Uang sejumlah / Untuk pembayaran / Rp.
 *
 * Beda dengan NotaPrintTemplate: kwitansi TIDAK punya tabel barang, hanya
 * baris-baris isian tunggal, jadi cukup setengah halaman pendek (~90mm).
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (opsional, dipakai untuk kop/label counterfoil)
 *  - data: {
 *      no_kwitansi, tanggal, dari, uang_sejumlah (terbilang),
 *      untuk_pembayaran, jumlah (angka)
 *    }
 *    Sesuaikan nama field di bawah kalau skema Supabase kamu berbeda.
 */
const KuitansiPrintTemplate = forwardRef(function KuitansiPrintTemplate({ sekolah, data }, ref) {
  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black p-4 text-xs"
      style={{
        width: '210mm',
        minHeight: '90mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      <div className="flex border-2 border-black h-full">
        {/* Kolom sobekan / counterfoil kiri, meniru pola berornamen di blanko asli */}
        <div className="w-1/5 border-r-2 border-black flex flex-col items-center justify-between p-2 text-center">
          <p className="font-semibold leading-tight">{sekolah?.nama || 'KWITANSI'}</p>
          <div className="flex-1" />
          <div className="w-full">
            <p className="text-[10px]">No.</p>
            <Blank value={data?.no_kwitansi} width={90} align="left" />
          </div>
          <div className="w-full mt-2">
            <p className="text-[10px]">Rp.</p>
            <Blank value={data?.jumlah ? formatRupiah(data.jumlah) : ''} width={90} align="right" />
          </div>
        </div>

        {/* Badan kwitansi kanan */}
        <div className="flex-1 p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="flex items-baseline gap-1">
                <span className="font-semibold">No.</span>
                <Blank value={data?.no_kwitansi} width={160} />
              </p>
              <Blank value={formatTanggal(data?.tanggal)} width={200} align="right" />
            </div>

            <p className="flex items-baseline gap-1 mb-2">
              <span className="font-semibold">Telah terima dari</span>
              <Blank value={data?.dari} width={420} />
            </p>
            <p className="flex items-baseline gap-1 mb-2">
              <span className="font-semibold">Uang sejumlah</span>
              <Blank value={data?.uang_sejumlah} width={420} />
            </p>
            <p className="flex items-baseline gap-1 mb-2">
              <span className="font-semibold">Untuk pembayaran</span>
              <Blank value={data?.untuk_pembayaran} width={420} />
            </p>
          </div>

          {/* Rp. + tanda tangan */}
          <div className="flex items-end justify-between mt-4">
            <p className="flex items-baseline gap-2">
              <span className="font-semibold">Rp.</span>
              <span className="inline-block min-w-[160px] text-right px-2 border-b-4 border-double border-black font-semibold">
                {data?.jumlah ? formatRupiah(data.jumlah) : ''}
              </span>
            </p>
            <div className="text-center">
              <p>{sekolah?.kota || ''}</p>
              <div className="h-10" />
              <div className="border-b border-black w-40" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
