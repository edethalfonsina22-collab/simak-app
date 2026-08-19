import { forwardRef, useId } from 'react'

// Blanko kwitansi bergaya dokumen resmi (cek/giro) dengan motif guilloche —
// garis-garis melingkar halus khas kertas berharga — meniru tampilan blanko
// kwitansi cetak fisik (nomor seri, counterfoil/sobekan arsip di kiri, dan
// slip utama di kanan dengan watermark rosette).
// Ukuran fisik total ~125mm x 52mm.
//
// Props:
//   sekolah: { nama, alamat, kota }
//   data: { no_kwitansi, tanggal, dari, uang_sejumlah, untuk_pembayaran, jumlah }

const INK = '#173438'
const LINE = '#2c5a66'
const LINE_SOFT = 'rgba(44,90,102,0.45)'
const PAPER = '#eaf7f8'
const PAPER_DEEP = '#d7edf1'
const GUILLOCHE = 'rgba(41,95,109,0.34)'
const GUILLOCHE_SOFT = 'rgba(41,95,109,0.14)'

// Latar motif guilloche: pola ubin (tile) berisi lingkaran-lingkaran
// bersinggungan, menghasilkan efek jalinan garis khas kertas berharga.
function GuillocheField({ patternId, opacity = 1 }) {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity }}
    >
      <defs>
        <pattern id={patternId} width="15" height="15" patternUnits="userSpaceOnUse">
          <rect width="15" height="15" fill={PAPER} />
          <circle cx="0" cy="0" r="7.4" fill="none" stroke={GUILLOCHE} strokeWidth="0.45" />
          <circle cx="15" cy="0" r="7.4" fill="none" stroke={GUILLOCHE} strokeWidth="0.45" />
          <circle cx="0" cy="15" r="7.4" fill="none" stroke={GUILLOCHE} strokeWidth="0.45" />
          <circle cx="15" cy="15" r="7.4" fill="none" stroke={GUILLOCHE} strokeWidth="0.45" />
          <circle cx="7.5" cy="7.5" r="5.6" fill="none" stroke={GUILLOCHE_SOFT} strokeWidth="0.4" />
          <circle cx="7.5" cy="7.5" r="2.6" fill="none" stroke={GUILLOCHE} strokeWidth="0.35" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

// Medali rosette (cincin konsentris) — elemen watermark tunggal yang
// diulang di counterfoil dan sebagai watermark besar di tengah slip utama.
function Rosette({ size = 40 }) {
  const rings = [19, 16.4, 13.8, 11.2, 8.6, 6, 3.4]
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      {rings.map((r, i) => (
        <circle
          key={r}
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={i % 2 === 0 ? LINE_SOFT : GUILLOCHE}
          strokeWidth={i % 2 === 0 ? 0.6 : 0.4}
        />
      ))}
      <circle cx="20" cy="20" r="1.6" fill={LINE_SOFT} />
    </svg>
  )
}

// Garis isian putus-putus (leader line) di bawah sebuah nilai.
const leaderLine = {
  borderBottom: `0.6px dotted ${LINE}`,
  minHeight: '3.6mm',
  padding: '0 1mm 0.3mm',
}

const doubleFrame = {
  border: `1.1px solid ${LINE}`,
  outline: `0.4px solid ${LINE}`,
  outlineOffset: '1mm',
}

const KuitansiJasaPrintTemplate = forwardRef(function KuitansiJasaPrintTemplate(
  { sekolah, data },
  ref
) {
  const reactId = useId()
  const bodyPatternId = `guilloche-body-${reactId}`
  const stubPatternId = `guilloche-stub-${reactId}`

  const tanggal = data?.tanggal
    ? new Date(data.tanggal).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : ''

  const labelStyle = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: INK,
    fontSize: '9.5px',
    whiteSpace: 'nowrap',
    paddingRight: '2mm',
  }
  const valueStyle = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    color: INK,
    fontSize: '10px',
  }

  return (
    <div
      ref={ref}
      className="print-only"
      style={{
        width: '125mm',
        minHeight: '50mm',
        display: 'flex',
        boxSizing: 'border-box',
        padding: '2mm',
        background: PAPER_DEEP,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      {/* Counterfoil / sobekan arsip */}
      <div
        style={{
          ...doubleFrame,
          position: 'relative',
          width: '24mm',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '2mm 1mm',
        }}
      >
        <GuillocheField patternId={stubPatternId} opacity={0.9} />
        <div style={{ position: 'relative', fontSize: '7px', color: INK, textAlign: 'center', lineHeight: 1.3 }}>
          {sekolah?.nama}
        </div>
        <div style={{ position: 'relative' }}>
          <Rosette size={26} />
        </div>
        <div style={{ position: 'relative', fontSize: '7px', color: INK, textAlign: 'center' }}>
          No. {data?.no_kwitansi}
        </div>
      </div>

      {/* Garis perforasi */}
      <div
        style={{
          width: '2.5mm',
          flexShrink: 0,
          borderLeft: `0.5px dashed ${LINE_SOFT}`,
          borderRight: `0.5px dashed ${LINE_SOFT}`,
        }}
      />

      {/* Slip utama */}
      <div
        style={{
          ...doubleFrame,
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          padding: '2.5mm 4mm',
        }}
      >
        <GuillocheField patternId={bodyPatternId} opacity={0.55} />
        {/* Watermark rosette besar di tengah */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            opacity: 0.5,
          }}
        >
          <Rosette size={62} />
        </div>

        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5mm' }}>
            <div style={{ fontWeight: 'bold', fontSize: '12px', letterSpacing: '1.5px', color: INK }}>
              KWITANSI
            </div>
            <div style={{ fontSize: '8px', color: INK }}>{sekolah?.nama}</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', flex: 1 }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '28%' }}>No.</td>
                <td style={valueStyle}>:</td>
                <td style={{ ...valueStyle, ...leaderLine }}>{data?.no_kwitansi}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Telah terima dari</td>
                <td style={valueStyle}>:</td>
                <td style={{ ...valueStyle, ...leaderLine }}>{data?.dari}</td>
              </tr>
              <tr>
                <td style={labelStyle}>Uang sejumlah</td>
                <td style={valueStyle}>:</td>
                <td style={{ ...valueStyle, ...leaderLine, fontStyle: 'italic' }}>
                  {data?.uang_sejumlah}
                </td>
              </tr>
              <tr>
                <td style={labelStyle}>Untuk pembayaran</td>
                <td style={valueStyle}>:</td>
                <td style={{ ...valueStyle, ...leaderLine }}>{data?.untuk_pembayaran}</td>
              </tr>
            </tbody>
          </table>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              marginTop: '2.5mm',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                fontSize: '13px',
                color: INK,
                border: `0.6px solid ${LINE}`,
                padding: '0.8mm 2mm',
                background: 'rgba(255,255,255,0.35)',
              }}
            >
              Rp {new Intl.NumberFormat('id-ID').format(data?.jumlah || 0)}
            </div>
            <div style={{ textAlign: 'center', fontSize: '9px', color: INK }}>
              <div>{sekolah?.kota}{sekolah?.kota ? ', ' : ''}{tanggal}</div>
              <div style={{ height: '9mm' }} />
              <div style={{ borderTop: `0.6px solid ${LINE}`, paddingTop: '0.5mm', minWidth: '28mm' }}>
                Yang menerima
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiJasaPrintTemplate
