import { forwardRef } from 'react'
import blankoKwitansi from '../assets/kwitansi-jasa-blanko.jpg'
// ^ salin file kwitansi-jasa-blanko.jpg (hasil ekstrak dari sampel_kwitansi.docx)
//   ke src/assets/, atau sesuaikan path importnya.

/**
 * Kwitansi Jasa — blanko kwitansi toko (bermotif security pattern) sebagai
 * latar belakang, dengan data dinamis ditumpuk (overlay) tepat di atas
 * garis-garis yang sudah ada di gambar.
 *
 * Ukuran & posisi elemen di bawah ini diukur langsung dari gambar sampel
 * (159.23mm x 60.29mm). Field values dikalibrasi dari posisi baris pada
 * gambar aslinya, tapi karena garisnya menyatu dengan pola dekoratif,
 * sebaiknya dicek sekali lagi di print preview browser dan digeser
 * beberapa mm kalau perlu (lihat komentar "sesuaikan" di tiap style).
 *
 * Props:
 *  - sekolah: { nama, alamat, kota } — tidak dipakai di kwitansi jasa ini
 *    (blanko resminya tidak ada kop instansi), tapi tetap diterima biar
 *    konsisten dengan komponen lain.
 *  - data: {
 *      no_kwitansi, tanggal, dari, uang_sejumlah,
 *      untuk_pembayaran, jumlah
 *    }
 *
 * Dibungkus forwardRef supaya bisa dipasangi ref={printRef} dari halaman
 * pemanggil (KwitansiJasa.jsx), persis seperti NotaPrintTemplate dipakai
 * dari Nota.jsx.
 */
const KuitansiJasaPrintTemplate = forwardRef(function KuitansiJasaPrintTemplate(
  { sekolah, data },
  ref
) {
  const d = data || {}

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        position: 'relative',
        width: '159.23mm',
        height: '60.29mm',
        backgroundImage: `url(${blankoKwitansi})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        fontFamily: '"Times New Roman", serif',
        fontSize: '9pt',
        color: '#1a1a1a',
      }}
    >
      {/* No. — baris pendek di kanan atas kolom kanan */}
      <div
        style={{
          position: 'absolute',
          left: '37mm',
          top: '6.5mm',
          width: '26mm',
        }}
      >
        {d.no_kwitansi}
      </div>

      {/* Telah terima dari */}
      <div
        style={{
          position: 'absolute',
          left: '35mm',
          top: '24.5mm', // sesuaikan: baris "Telah terima dari"
          width: '117mm',
        }}
      >
        {d.dari}
      </div>

      {/* Uang sejumlah (terbilang) */}
      <div
        style={{
          position: 'absolute',
          left: '35mm',
          top: '29mm', // sesuaikan: baris "Uang sejumlah"
          width: '117mm',
        }}
      >
        {d.uang_sejumlah}
      </div>

      {/* Untuk pembayaran — bisa 2 baris (baris ke-2 untuk lanjutan teks
          panjang, memakai garis kosong keempat di blanko) */}
      <div
        style={{
          position: 'absolute',
          left: '35mm',
          top: '33.5mm', // sesuaikan: baris pertama "Untuk pembayaran"
          width: '117mm',
          lineHeight: '4.4mm',
        }}
      >
        {d.untuk_pembayaran}
      </div>

      {/* Rp. — kotak nominal di kiri bawah */}
      <div
        style={{
          position: 'absolute',
          left: '34mm',
          top: '49mm', // sesuaikan: tengah kotak "Rp."
          width: '90mm',
          fontWeight: 'bold',
        }}
      >
        {d.jumlah != null ? Number(d.jumlah).toLocaleString('id-ID') : ''}
      </div>
    </div>
  )
})

export default KuitansiJasaPrintTemplate
