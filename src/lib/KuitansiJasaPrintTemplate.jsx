import { forwardRef } from 'react'

function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian bergaris — konsisten dengan pola Blank di NotaPrintTemplate.jsx.
function Blank({ value, width = 100, align = 'left' }) {
  return (
    <span className="relative inline-block align-bottom" style={{ width, height: '1.1em' }}>
      <span aria-hidden="true" className="absolute left-0 right-0 bottom-[1px] border-b border-black" />
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

// Pola latar tipis ala kertas berpengaman — kesan visual saja, BUKAN replika
// presisi watermark/guilloche pada blanko kwitansi fisik asli.
const polaLatar = {
  backgroundImage:
    'repeating-linear-gradient(45deg, rgba(37,99,235,0.06) 0px, rgba(37,99,235,0.06) 1px, transparent 1px, transparent 6px)',
}

function Rosette({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 46 46" className="mx-auto" aria-hidden="true">
      <circle cx="23" cy="23" r="21" fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="0.7" />
      <circle cx="23" cy="23" r="14" fill="none" stroke="#2563eb" strokeOpacity="0.5" strokeWidth="0.7" />
      <circle cx="23" cy="23" r="7" fill="none" stroke="#2563eb" strokeOpacity="0.6" strokeWidth="0.7" />
      {Array.from({ length: 8 }).map((_, i) => (
        <line
          key={i}
          x1="23" y1="23"
          x2={23 + 21 * Math.cos((i * Math.PI) / 4)}
          y2={23 + 21 * Math.sin((i * Math.PI) / 4)}
          stroke="#2563eb" strokeOpacity="0.25" strokeWidth="0.6"
        />
      ))}
    </svg>
  )
}

/**
 * Template cetak Kwitansi SEDERHANA khusus belanja JASA — pasangan dari
 * NotaPrintTemplate.jsx (belanja BARANG). Beda dengan Nota, ukuran fisik
 * blanko kwitansi ini KECIL — kira-kira 12-13cm x 5-6cm (seukuran blanko
 * kwitansi umum di toko alat tulis), BUKAN selebar/setinggi setengah
 * halaman A4. Ditempel di ruang kosong sisa halaman laporan (lihat
 * LaporanPrintTemplate.jsx), bukan memenuhi seluruh area bawah.
 *
 * JANGAN disamakan/ditimpa dengan src/lib/KuitansiPrintTemplate.jsx —
 * itu kuitansi resmi instansi (No. Bukti, Mata Anggaran, tanda tangan
 * Disetujui/Dibayar/dll) yang tampil di BAGIAN ATAS lembar laporan.
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (opsional)
 *  - data: { no_kwitansi, tanggal, dari, uang_sejumlah (terbilang), untuk_pembayaran, jumlah }
 */
const KuitansiJasaPrintTemplate = forwardRef(function KuitansiJasaPrintTemplate({ sekolah, data }, ref) {
  const d = data || {}
  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black text-[8px] leading-tight"
      style={{
        width: '125mm',
        height: '55mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      {/* Border ganda ala blanko kwitansi */}
      <div className="border border-black p-[2px] h-full">
        <div className="border border-black flex h-full" style={polaLatar}>
          {/* Kolom sobekan kiri */}
          <div className="w-[18%] border-r border-black flex flex-col items-center justify-between py-1 px-1 text-center">
            <p className="font-semibold tracking-wide leading-none text-[7px]">
              {sekolah?.nama ? sekolah.nama.slice(0, 12) : 'KWITANSI'}
            </p>
            <Rosette />
            <div className="w-full">
              <p className="text-[6px]">No.</p>
              <p className="border-b border-black px-1 min-h-[1em]">{d.no_kwitansi || '\u00A0'}</p>
            </div>
            <div className="w-full mt-0.5">
              <p className="text-[6px]">Rp.</p>
              <p className="border-b border-black px-1 min-h-[1em] font-semibold -mx-2">
                {d.jumlah ? formatRupiah(d.jumlah) : '\u00A0'}
              </p>
            </div>
          </div>

          {/* Badan kwitansi kanan */}
          <div className="flex-1 px-2 py-1.5 flex flex-col justify-between">
            <div>
              <div className="flex items-baseline justify-between mb-1">
                <p className="flex items-baseline gap-1">
                  <span className="font-semibold">No.</span>
                  <Blank value={d.no_kwitansi} width={70} />
                </p>
                <Blank value={formatTanggal(d.tanggal)} width={110} align="right" />
              </div>

              <p className="flex items-baseline gap-1 mb-0.5">
                <span className="font-semibold shrink-0">Telah terima dari</span>
                <Blank value={d.dari} width={230} />
              </p>
              <p className="flex items-baseline gap-1 mb-0.5">
                <span className="font-semibold shrink-0">Uang sejumlah</span>
                <Blank value={d.uang_sejumlah} width={230} />
              </p>
              <p className="flex items-baseline gap-1 mb-0.5">
                <span className="font-semibold shrink-0">Untuk pembayaran</span>
                <Blank value={d.untuk_pembayaran} width={230} />
              </p>
            </div>

            <div className="flex items-end justify-between mt-1">
              <p className="flex items-baseline gap-1">
                <span className="font-semibold">Rp.</span>
                <span className="inline-block min-w-[80px] text-center px-1 border-b-2 border-black font-semibold">
                  {d.jumlah ? formatRupiah(d.jumlah) : ''}
                </span>
              </p>
              <div className="border-b border-black w-24" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiJasaPrintTemplate
