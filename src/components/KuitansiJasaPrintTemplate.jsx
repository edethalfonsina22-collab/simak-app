import { forwardRef } from 'react'

// Blanko kwitansi kecil untuk pembayaran jasa (ukuran fisik ~12.5cm x 5.5cm).
// Props:
//   sekolah: { nama, alamat, kota }
//   data: { no_kwitansi, tanggal, dari, uang_sejumlah, untuk_pembayaran, jumlah }
const KuitansiJasaPrintTemplate = forwardRef(function KuitansiJasaPrintTemplate(
  { sekolah, data },
  ref
) {
  const tanggal = data?.tanggal
    ? new Date(data.tanggal).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        width: '125mm',
        border: '1px solid #000',
        padding: '4mm',
        fontSize: '11px',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '3mm' }}>
        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>KWITANSI</div>
        <div style={{ fontSize: '10px' }}>{sekolah?.nama}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ width: '30%', padding: '1mm 0', verticalAlign: 'top' }}>No.</td>
            <td style={{ width: '2%' }}>:</td>
            <td style={{ padding: '1mm 0' }}>{data?.no_kwitansi}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 0', verticalAlign: 'top' }}>Telah terima dari</td>
            <td>:</td>
            <td style={{ padding: '1mm 0' }}>{data?.dari}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 0', verticalAlign: 'top' }}>Uang sejumlah</td>
            <td>:</td>
            <td style={{ padding: '1mm 0', fontStyle: 'italic' }}>{data?.uang_sejumlah}</td>
          </tr>
          <tr>
            <td style={{ padding: '1mm 0', verticalAlign: 'top' }}>Untuk pembayaran</td>
            <td>:</td>
            <td style={{ padding: '1mm 0' }}>{data?.untuk_pembayaran}</td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginTop: '4mm',
        }}
      >
        <div style={{ fontWeight: 'bold' }}>
          Rp {new Intl.NumberFormat('id-ID').format(data?.jumlah || 0)}
        </div>
        <div style={{ textAlign: 'center' }}>
          <div>{sekolah?.kota}, {tanggal}</div>
          <div style={{ height: '12mm' }} />
          <div style={{ borderTop: '1px solid #000', paddingTop: '1mm' }}>
            Yang menerima
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiJasaPrintTemplate
