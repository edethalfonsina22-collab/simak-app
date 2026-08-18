import { forwardRef } from 'react'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import NotaPrintTemplate from './NotaPrintTemplate'
import KuitansiJasaPrintTemplate from './KuitansiJasaPrintTemplate'

/**
 * Menyusun SATU LEMBAR laporan cetak A4 (297mm):
 *  - BAGIAN ATAS (148mm): Kuitansi resmi instansi, selalu tampil,
 *    dari src/lib/KuitansiPrintTemplate.jsx (No. Bukti, Mata Anggaran,
 *    tanda tangan Disetujui/Dibayar/dll).
 *  - BAGIAN BAWAH (148mm): mengisi ruang kosong sisa halaman, isinya
 *    tergantung jenis belanja:
 *      - jenisBelanja === 'barang' -> NotaPrintTemplate (rincian barang)
 *      - jenisBelanja === 'jasa'   -> KuitansiJasaPrintTemplate (blanko
 *        kwitansi sederhana untuk pembayaran jasa)
 *
 * 148mm + 148mm = 296mm, pas satu halaman A4 (297mm), jadi kedua bagian
 * ini SELALU dicetak bersama di satu lembar yang sama, bukan di halaman
 * terpisah.
 *
 * Props:
 *  - sekolah: { nama, alamat, kota }
 *  - dataKuitansiAtas: data kuitansi resmi (field sama seperti yang
 *    dikirim KuitansiModal.jsx / dibaca src/lib/KuitansiPrintTemplate.jsx)
 *  - jenisBelanja: 'barang' | 'jasa'
 *  - dataBawah:
 *      - kalau jenisBelanja 'barang' -> data nota (field sama seperti
 *        yang dipakai NotaPrintTemplate.jsx / mapUntukCetak() di Nota.jsx)
 *      - kalau jenisBelanja 'jasa'   -> { no_kwitansi, tanggal, dari,
 *        uang_sejumlah, untuk_pembayaran, jumlah }
 *
 * Contoh pemakaian:
 *   <LaporanPrintTemplate
 *     ref={printRef}
 *     sekolah={sekolah}
 *     dataKuitansiAtas={kuitansiRow}
 *     jenisBelanja={kuitansiRow.jenis_belanja} // 'barang' | 'jasa'
 *     dataBawah={jenisBelanja === 'barang' ? mapUntukCetak(notaRow) : dataKwitansiJasa}
 *   />
 */
const LaporanPrintTemplate = forwardRef(function LaporanPrintTemplate(
  { sekolah, dataKuitansiAtas, jenisBelanja, dataBawah },
  ref
) {
  return (
    <div ref={ref} className="print-only" style={{ width: '210mm' }}>
      {/* ================= BAGIAN ATAS: Kuitansi resmi ================= */}
      <div style={{ minHeight: '148mm' }}>
        <KuitansiPrintTemplate sekolah={sekolah} data={dataKuitansiAtas} />
      </div>

      {/* Garis potong antara bagian atas & bawah — hilangkan className ini
          kalau kertas fisiknya sudah punya garis potong sendiri */}
      <div className="border-t border-dashed border-black/40" style={{ margin: '2mm 0' }} />

      {/* ================= BAGIAN BAWAH: Nota atau Kwitansi Jasa =================
          Nota memang didesain memenuhi 148mm (rincian barang bisa panjang).
          Kwitansi Jasa BEDA — ukuran fisiknya kecil (~12.5cm x 5.5cm), jadi
          sengaja TIDAK dipaksa memenuhi ruang 148mm, cukup ditaruh di area
          kosong sisa halaman. */}
      {jenisBelanja === 'jasa' ? (
        <div className="pt-2">
          <KuitansiJasaPrintTemplate sekolah={sekolah} data={dataBawah} />
        </div>
      ) : (
        <div style={{ minHeight: '148mm' }}>
          <NotaPrintTemplate sekolah={sekolah} data={dataBawah} />
        </div>
      )}
    </div>
  )
})

export default LaporanPrintTemplate
