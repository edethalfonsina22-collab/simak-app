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
 * Template cetak Kuitansi / Nota — meniru format blanko resmi fisik
 * (kop "No. Bukti / Lembar / Mata Anggaran / Tahun" untuk Kwitansi,
 * dan kop "Tuan / Toko" untuk Nota).
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
    <div ref={ref} className="print-only bg-white text-black p-10 text-sm" style={{ width: '210mm', minHeight: '148mm' }}>

      {/* ================= KWITANSI ================= */}
      {!isNota && (
        <>
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
                <td className="py-1 align-top whitespace-pre-line">{data?.untuk_pembayaran || '-'}</td>
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
              <p className="text-xs mt-2 text-left">Tgl. Dibayarkan :</p>
            </div>
            <div className="text-center">
              <p>{formatTanggal(data?.tanggal)}</p>
              <p>Setuju dibayar :</p>
              <p>Atasan Langsung,</p>
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
        </>
      )}

      {/* ================= RINCIAN BARANG (selalu tampil, gaya Nota) ================= */}
      <div className="mb-3">
        <p>Tuan <span className="ml-2">{data?.tuan || data?.diterima_dari || '.....................................'}</span></p>
        <p>Toko <span className="ml-2">{data?.toko || data?.nama_penerima || '.....................................'}</span></p>
      </div>

      <h2 className="text-lg font-bold mb-2">NOTA No. <span className="font-normal">{data?.no_bukti || data?.nomor || '-'}</span></h2>

      {items.length > 0 && (
        <table className="w-full border-collapse mb-2">
          <thead>
            <tr className="border-y-2 border-black">
              <th className="text-left py-1 font-semibold w-24">Banyaknya</th>
              <th className="text-left py-1 font-semibold">Nama Barang</th>
              <th className="text-right py-1 font-semibold w-28">Harga</th>
              <th className="text-right py-1 font-semibold w-28">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={it.id || i} className="border-b border-black/20">
                <td className="py-1">{it.jumlah}</td>
                <td className="py-1">{it.nama_barang}</td>
                <td className="py-1 text-right">{formatRupiah(it.harga_satuan)}</td>
                <td className="py-1 text-right">{formatRupiah(it.jumlah * it.harga_satuan)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="flex justify-end mb-6">
        <table>
          <tbody>
            <tr>
              <td className="pr-3 font-semibold">Jumlah Rp.</td>
              <td className="border-b-2 border-black px-3 font-semibold text-right min-w-[8rem]">{formatRupiah(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {data?.catatan && <p className="text-xs italic mb-4">Catatan: {data.catatan}</p>}

      <div className="flex justify-between mt-6">
        <div className="text-center w-48">
          <p>Tanda Terima</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1">&nbsp;</p>
        </div>
        <div className="text-center w-48">
          <p>Hormat kami,</p>
          <div className="h-16" />
          <p className="border-t border-black pt-1">&nbsp;</p>
        </div>
      </div>
    </div>
  )
})

export default KuitansiPrintTemplate
