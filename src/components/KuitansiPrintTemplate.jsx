import { forwardRef } from 'react'

function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian bergaris — sama pola dengan komponen Blank di NotaPrintTemplate.jsx.
function Blank({ value, width = 160, align = 'left' }) {
  return (
    <span className="relative inline-block align-bottom" style={{ width, height: '1.2em' }}>
      <span aria-hidden="true" className="absolute left-0 right-0 bottom-[2px] border-b border-black" />
      {value && (
        <span
          className={`absolute inset-0 px-1 whitespace-nowrap overflow-hidden text-ellipsis ${
            align === 'right' ? 'text-right' : 'text-left'
          }`}
        >
          {value}
        </span>
      )}
    </span>
  )
}

// Pola latar tipis ala kertas berpengaman. Ini BUKAN replika presisi
// watermark/guilloche pada blanko kwitansi asli (pola pengaman cetak
// seperti itu tidak realistis dibuat lewat CSS) — hanya kesan visual
// garis-garis halus supaya terasa seperti "blanko kwitansi", tetap
// terbaca jelas saat dicetak hitam-putih.
const polaLatar = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(37,99,235,0.06) 0px, rgba(37,99,235,0.06) 1px, transparent 1px, transparent 7px)',
}

// Motif rosette sederhana untuk kolom sobekan kiri, meniru kesan lingkaran
// berornamen pada blanko asli (bukan replika presisi).
function Rosette({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" className="mx-auto" aria-hidden="true">
      <circle cx="23" cy="23" r="21" fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="0.6" />
      <circle cx="23" cy="23" r="16" fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="0.6" />
      <circle cx="23" cy="23" r="11" fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="0.6" />
      <circle cx="23" cy="23" r="6" fill="none" stroke="#2563eb" strokeOpacity="0.6" strokeWidth="0.6" />
      {Array.from({ length: 12 }).map((_, i) => (
        <line
          key={i}
          x1="23"
          y1="23"
          x2={23 + 21 * Math.cos((i * Math.PI) / 6)}
          y2={23 + 21 * Math.sin((i * Math.PI) / 6)}
          stroke="#2563eb"
          strokeOpacity="0.25"
          strokeWidth="0.5"
        />
      ))}
    </svg>
  )
}

/**
 * Template cetak Kwitansi — mengikuti proporsi & tata letak blanko kwitansi
 * fisik (lebar-pendek, border ganda, kolom sobekan berornamen di kiri):
 * No. / Telah terima dari / Uang sejumlah / Untuk pembayaran / Rp.
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (opsional)
 *  - data: {
 *      no_kwitansi, tanggal, dari, uang_sejumlah (terbilang),
 *      untuk_pembayaran, jumlah (angka)
 *    }
 */
const KuitansiPrintTemplate = forwardRef(function KuitansiPrintTemplate({ sekolah, data }, ref) {
  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black p-2 text-[11px]"
      style={{
        width: '210mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      {/* Border ganda ala blanko kwitansi */}
      <div className="border border-black p-[3px]">
        <div className="border border-black flex" style={{ minHeight: '68mm', ...polaLatar }}>
          {/* Kolom sobekan kiri */}
          <div className="w-[16%] border-r border-black flex flex-col items-center justify-between py-3 px-1 text-center">
            <p className="font-semibold tracking-wide text-[11px]">{sekolah?.nama ? sekolah.nama.slice(0, 14) : 'KWITANSI'}</p>
            <Rosette />
            <div className="w-full">
              <p className="text-[9px]">No.</p>
              <p className="border-b border-black px-1 min-h-[1.1em]">{data?.no_kwitansi || '\u00A0'}</p>
            </div>
            <div className="w-full mt-1">
              <p className="text-[9px]">Rp.</p>
              <p className="border-b border-black px-1 min-h-[1.1em] font-semibold">
                {data?.jumlah ? formatRupiah(data.jumlah) : '\u00A0'}
              </p>
            </div>
          </div>

          {/* Badan kwitansi kanan */}
          <div className="flex-1 px-5 py-3 flex flex-col justify-between">
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <p className="flex items-baseline gap-1">
                  <span className="font-semibold">No.</span>
                  <Blank value={data?.no_kwitansi} width={140} />
                </p>
                <Blank value={formatTanggal(data?.tanggal)} width={220} align="right" />
              </div>

              <p className="flex items-baseline gap-1 mb-2">
                <span className="font-semibold shrink-0">Telah terima dari</span>
                <Blank value={data?.dari} width={430} />
              </p>
              <p className="flex items-baseline gap-1 mb-2">
                <span className="font-semibold shrink-0">Uang sejumlah</span>
                <Blank value={data?.uang_sejumlah} width={430} />
              </p>
              <p className="flex items-baseline gap-1 mb-2">
                <span className="font-semibold shrink-0">Untuk pembayaran</span>
                <Blank value={data?.untuk_pembayaran} width={430} />
              </p>
            </div>

            <div className="flex items-end justify-between mt-4">
              <p className="flex items-baseline gap-2">
                <span className="font-semibold">Rp.</span>
                <span className="inline-block min-w-[160px] text-center px-2 border-b-2 border-black font-semibold">
                  {data?.jumlah ? formatRupiah(data.jumlah) : ''}
                </span>
              </p>
              <div className="border-b border-black w-56" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
