import { forwardRef } from 'react'

function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

// Kolom isian bergaris (BUKAN titik-titik) — nota fisik di gambar cuma pakai
// garis lurus polos untuk Tuan/Toko/NOTA No., beda dengan blanko kwitansi yang
// pakai titik-titik. Lebar TETAP (bukan minimum) supaya tidak melebar sendiri
// dan merusak layout. Kalau `value` ada, teks ditumpuk di atas garisnya.
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

// Nota sekarang SETENGAH HALAMAN (148mm — sama seperti KuitansiPrintTemplate)
// supaya bisa ditempatkan di ruang kosong di bawah Kuitansi pada lembar cetak
// yang sama, bukan menghabiskan satu lembar A4 penuh untuk dirinya sendiri.
// Jumlah baris tabel diperkecil (dari 11 -> 6) supaya tetap muat tanpa
// memotong bagian tanda tangan di bawahnya.
//
// PERUBAHAN: bungkus (wrapper) sekarang berukuran satu HALAMAN A4 PENUH
// (297mm) dan memakai flexbox `justify-content: flex-end`, supaya blok
// nota (yang tingginya tetap 148mm) otomatis terdorong ke BAGIAN PALING
// BAWAH kertas saat dicetak — bukan menempel di atas seperti sebelumnya.
const MIN_ROWS = 6

/**
 * Template cetak Nota Belanja — meniru blanko nota fisik (lihat contoh
 * blanko kosong yang dipakai sebagai acuan): baris tanggal, "Tuan / Toko",
 * "NOTA No.", tabel Banyaknya / Nama Barang / Harga / Jumlah dengan GARIS
 * KOTAK PENUH di setiap sel (persis blanko aslinya — sebelumnya cuma garis
 * horizontal tanpa garis vertikal antar kolom), baris "Jumlah Rp." di kanan
 * bawah tabel, lalu "Tanda Terima" (kiri) & "Hormat kami," (kanan).
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } (opsional, dipakai untuk keterangan toko/pengirim)
 *  - data: baris dari tabel nota, MISALNYA:
 *      {
 *        no_nota, tanggal, tuan, toko, alamat_lanjutan,
 *        items: [{ banyaknya, nama_barang, harga, jumlah }, ...],
 *        jumlah_total,
 *      }
 *    Sesuaikan nama field di bawah kalau skema Supabase kamu berbeda.
 */
const NotaPrintTemplate = forwardRef(function NotaPrintTemplate({ sekolah, data }, ref) {
  const items = Array.isArray(data?.items) ? data.items : []
  const total = data?.jumlah_total != null
    ? Number(data.jumlah_total) || 0
    : items.reduce((sum, it) => sum + (Number(it?.jumlah) || 0), 0)

  const rows = [...items]
  while (rows.length < MIN_ROWS) rows.push(null)

  return (
    // Wrapper satu halaman A4 penuh (210mm x 297mm). flex + justify-end
    // mendorong kartu nota di bawahnya supaya menempel ke tepi bawah kertas.
    <div
      className="print-only relative bg-white flex flex-col justify-end"
      style={{
        width: '210mm',
        height: '297mm',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      <div
        ref={ref}
        className="relative bg-white text-black p-6 text-xs"
        style={{
          width: '210mm',
          minHeight: '148mm',
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          colorAdjust: 'exact',
        }}
      >
        {/* Baris tanggal / kota di kanan atas */}
        <div className="text-right mb-1">
          <Blank value={formatTanggal(data?.tanggal)} width={220} align="right" />
        </div>

        {/* Tuan / Toko */}
        <div className="mb-2">
          <p className="flex items-baseline gap-1">
            <span className="font-semibold underline">Tuan</span>
            <Blank value={data?.tuan} width={380} />
          </p>
          <p className="flex items-baseline gap-1">
            <span className="font-semibold underline">Toko</span>
            <Blank value={data?.toko} width={380} />
          </p>
          {data?.alamat_lanjutan && (
            <p className="pl-10">
              <Blank value={data.alamat_lanjutan} width={380} />
            </p>
          )}
        </div>

        {/* NOTA No. */}
        <div className="flex items-baseline justify-between mb-1">
          <p className="flex items-baseline gap-1">
            <span className="text-lg font-bold">NOTA No.</span>
            <Blank value={data?.no_nota} width={140} />
          </p>
          <div className="border-b-2 border-black w-48 h-2" aria-hidden="true" />
        </div>

        {/* Tabel item belanja — garis kotak PENUH di tiap sel, meniru blanko fisik.
            table-layout: fixed + lebar persen di setiap kolom supaya kolom
            NAMA BARANG tidak otomatis melebar mengambil semua sisa ruang. */}
        <table className="w-full border-collapse border border-black" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th className="border border-black py-1 px-1 text-left font-bold" style={{ width: '14%' }}>BANYAKNYA</th>
              <th className="border border-black py-1 px-1 text-left font-bold" style={{ width: '42%' }}>NAMA BARANG</th>
              <th className="border border-black py-1 px-1 text-left font-bold" style={{ width: '20%' }}>HARGA</th>
              <th className="border border-black py-1 px-1 text-left font-bold" style={{ width: '24%' }}>JUMLAH</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item, idx) => (
              <tr key={idx}>
                <td className="border border-black py-1 px-1 align-top">{item?.banyaknya || '\u00A0'}</td>
                <td className="border border-black py-1 px-1 align-top break-words">{item?.nama_barang || '\u00A0'}</td>
                <td className="border border-black py-1 px-1 align-top">{item?.harga ? formatRupiah(item.harga) : '\u00A0'}</td>
                <td className="border border-black py-1 px-1 align-top">{item?.jumlah ? formatRupiah(item.jumlah) : '\u00A0'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Jumlah Rp. */}
        <div className="flex justify-end mt-1 mb-4">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold">Jumlah Rp.</span>
            <span className="inline-block min-w-[120px] text-right px-2 border-b-4 border-double border-black font-semibold">
              {formatRupiah(total)}
            </span>
          </div>
        </div>

        {/* Tanda tangan */}
        <div className="flex justify-between px-4">
          <div className="text-center">
            <p>Tanda Terima</p>
            <div className="h-8" />
            <div className="border-b border-black w-36" />
          </div>
          <div className="text-center">
            <p>Hormat kami,</p>
            <div className="h-8" />
            <div className="border-b border-black w-36" />
          </div>
        </div>
      </div>
    </div>
  )
})

export default NotaPrintTemplate
