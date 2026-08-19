import { forwardRef } from 'react'
import KuitansiJasaPrintTemplate from './KuitansiJasaPrintTemplate'

// Bungkus halaman A4 penuh yang menempatkan kwitansi pada posisi yang sama
// seperti pada contoh (sampel_kwitansi.docx): sekitar 123mm dari tepi atas
// kertas, rata tengah secara horizontal — bukan lagi menempel di pojok atas.
//
// Props: sama seperti KuitansiJasaPrintTemplate
//   sekolah: { nama, alamat, kota }
//   data: { no_kwitansi, tanggal, dari, uang_sejumlah, untuk_pembayaran, jumlah }

const TOP_OFFSET_MM = 123 // jarak dari tepi atas kertas ke kwitansi, mengikuti sampel

const KuitansiJasaPrintPage = forwardRef(function KuitansiJasaPrintPage(
  { sekolah, data },
  ref
) {
  return (
    <>
      {/* Pastikan ukuran kertas A4 & tanpa margin browser saat dicetak */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; }
        }
      `}</style>

      <div
        className="print-only"
        style={{
          width: '210mm',
          height: '297mm',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div style={{ height: `${TOP_OFFSET_MM}mm`, flexShrink: 0 }} />
        <KuitansiJasaPrintTemplate ref={ref} sekolah={sekolah} data={data} />
      </div>
    </>
  )
})

export default KuitansiJasaPrintPage
