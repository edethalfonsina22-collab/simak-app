import { forwardRef, useId } from 'react'

function formatRupiah(angka) {
  if (angka === null || angka === undefined || angka === '') return ''
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(angka)
}

function formatTanggal(tgl) {
  if (!tgl) return ''
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

const INK = '#173438'
const LINE = '#2c5a66'
const LINE_SOFT = 'rgba(44,90,102,0.45)'
const PAPER = '#eaf7f8'
const GUILLOCHE = 'rgba(41,95,109,0.34)'
const GUILLOCHE_SOFT = 'rgba(41,95,109,0.14)'

// Jarak dari tepi atas kertas A4 ke kwitansi. Posisi (bukan ukuran), jadi
// tidak ikut di-scale — kalau kwitansi makin besar dan mepet ke bawah
// kertas, kurangi angka ini secukupnya.
const TOP_OFFSET_MM = 118

// ————————————————————————————————————————————————————————————
// SATU faktor pembesar untuk SEMUA ukuran (lebar, tinggi lewat padding,
// font, jarak, watermark). Sebelumnya lebar & tinggi dibesarkan dengan
// angka mm yang tidak berhubungan (lebar +80mm, tinggi +40mm) sementara
// font/spacing di dalamnya tetap ukuran semula — hasilnya kwitansi jadi
// sangat lebar tapi isinya kecil dan "tenggelam", jadi tidak seimbang.
//
// Sekarang: tentukan ukuran DASAR (desain awal, lebar 125mm) lalu kalikan
// semuanya dengan SCALE. Naikkan/turunkan SCALE saja untuk memperbesar
// atau memperkecil kwitansi secara proporsional.
// ————————————————————————————————————————————————————————————
const SCALE = 1.4

const mm = (v) => `${+(v * SCALE).toFixed(2)}mm`
const px = (v) => `${+(v * SCALE).toFixed(2)}px`
const num = (v) => +(v * SCALE).toFixed(2)

// Ukuran dasar (pada SCALE = 1) — meniru proporsi sampel_kwitansi.docx.
const BASE = {
  slipWidth: 125,
  counterfoilWidth: 24,
  perforation: 2.5,
  outerPadTop: 2,
  outerPadBottom: 62, // dulu: 2mm dasar + 60mm ekstra supaya kwitansi tetap
                       // tinggi walau kontennya pendek (h-fit)
  outerPadX: 2,
  slipPadY: 2.5,
  slipPadX: 4,
  counterfoilPadY: 2,
  counterfoilPadX: 1,
  rosetteStub: 26,
  rosetteWatermark: 62,
  blankMinHeight: 3.6,
  headerGap: 1.5,
  amountGap: 2.5,
  signatureSpacer: 9,
  signatureMinWidth: 28,
}

function GuillocheField({ patternId, opacity = 1 }) {
  return (
    <svg aria-hidden="true" className="absolute inset-0 w-full h-full" style={{ opacity }}>
      <defs>
        <pattern id={patternId} width={num(15)} height={num(15)} patternUnits="userSpaceOnUse">
          <rect width={num(15)} height={num(15)} fill={PAPER} />
          <circle cx="0" cy="0" r={num(7.4)} fill="none" stroke={GUILLOCHE} strokeWidth={num(0.45)} />
          <circle cx={num(15)} cy="0" r={num(7.4)} fill="none" stroke={GUILLOCHE} strokeWidth={num(0.45)} />
          <circle cx="0" cy={num(15)} r={num(7.4)} fill="none" stroke={GUILLOCHE} strokeWidth={num(0.45)} />
          <circle cx={num(15)} cy={num(15)} r={num(7.4)} fill="none" stroke={GUILLOCHE} strokeWidth={num(0.45)} />
          <circle cx={num(7.5)} cy={num(7.5)} r={num(5.6)} fill="none" stroke={GUILLOCHE_SOFT} strokeWidth={num(0.4)} />
          <circle cx={num(7.5)} cy={num(7.5)} r={num(2.6)} fill="none" stroke={GUILLOCHE} strokeWidth={num(0.35)} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

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

function Blank({ value, italic = false }) {
  return (
    <span
      className="block whitespace-nowrap overflow-hidden text-ellipsis"
      style={{
        borderBottom: `0.6px dotted ${LINE}`,
        minHeight: mm(BASE.blankMinHeight),
        padding: `0 ${mm(1)} ${mm(0.3)}`,
        fontStyle: italic ? 'italic' : 'normal',
      }}
    >
      {value}
    </span>
  )
}

const doubleFrame = { border: `1.1px solid ${LINE}` }

const KuitansiJasaPrintTemplate = forwardRef(function KuitansiJasaPrintTemplate(
  { sekolah, data },
  ref
) {
  const reactId = useId()
  const bodyPatternId = `guilloche-body-${reactId}`
  const stubPatternId = `guilloche-stub-${reactId}`
  const tanggal = formatTanggal(data?.tanggal)

  return (
    <div
      ref={ref}
      className="print-only relative bg-white text-black text-xs flex justify-center"
      style={{
        width: '210mm',
        minHeight: '297mm',
        paddingTop: `${TOP_OFFSET_MM}mm`,
        boxSizing: 'border-box',
        WebkitPrintColorAdjust: 'exact',
        printColorAdjust: 'exact',
        colorAdjust: 'exact',
      }}
    >
      <div
        className="flex box-border h-fit"
        style={{
          width: mm(BASE.slipWidth),
          paddingTop: mm(BASE.outerPadTop),
          paddingBottom: mm(BASE.outerPadBottom),
          paddingLeft: mm(BASE.outerPadX),
          paddingRight: mm(BASE.outerPadX),
          background: 'transparent',
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Counterfoil / sobekan arsip */}
        <div
          className="relative flex flex-shrink-0 flex-col items-center justify-between overflow-hidden"
          style={{
            ...doubleFrame,
            width: mm(BASE.counterfoilWidth),
            padding: `${mm(BASE.counterfoilPadY)} ${mm(BASE.counterfoilPadX)}`,
          }}
        >
          <GuillocheField patternId={stubPatternId} opacity={0.9} />
          <div className="relative text-center leading-tight" style={{ fontSize: px(7), color: INK }}>
            {sekolah?.nama}
          </div>
          <div className="relative">
            <Rosette size={num(BASE.rosetteStub)} />
          </div>
          <div className="relative text-center" style={{ fontSize: px(7), color: INK }}>
            No. {data?.no_kwitansi}
          </div>
        </div>

        {/* Garis perforasi */}
        <div
          className="flex-shrink-0"
          style={{
            width: mm(BASE.perforation),
            borderLeft: `0.5px dashed ${LINE_SOFT}`,
            borderRight: `0.5px dashed ${LINE_SOFT}`,
          }}
        />

        {/* Slip utama */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{ ...doubleFrame, padding: `${mm(BASE.slipPadY)} ${mm(BASE.slipPadX)}` }}
        >
          <GuillocheField patternId={bodyPatternId} opacity={0.55} />
          <div
            className="absolute opacity-50"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <Rosette size={num(BASE.rosetteWatermark)} />
          </div>

          <div className="relative flex h-full flex-col">
            <div className="text-center" style={{ marginBottom: mm(BASE.headerGap) }}>
              <div className="font-bold" style={{ fontSize: px(12), letterSpacing: '1.5px', color: INK }}>
                KWITANSI
              </div>
              <div style={{ fontSize: px(8), color: INK }}>{sekolah?.nama}</div>
            </div>

            <table className="w-full flex-1 border-collapse" style={{ color: INK, fontSize: px(10) }}>
              <tbody>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ width: '28%', paddingRight: mm(2) }}>
                    No.
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.no_kwitansi} /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: mm(2) }}>
                    Telah terima dari
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.dari} /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: mm(2) }}>
                    Uang sejumlah
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.uang_sejumlah} italic /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: mm(2) }}>
                    Untuk pembayaran
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.untuk_pembayaran} /></td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-end justify-between" style={{ marginTop: mm(BASE.amountGap) }}>
              <div
                className="font-bold"
                style={{
                  fontSize: px(13),
                  color: INK,
                  border: `0.6px solid ${LINE}`,
                  padding: `${mm(0.8)} ${mm(2)}`,
                  background: 'rgba(255,255,255,0.35)',
                }}
              >
                Rp {formatRupiah(data?.jumlah || 0)}
              </div>
              <div className="text-center" style={{ fontSize: px(9), color: INK }}>
                <div>{sekolah?.kota}{sekolah?.kota ? ', ' : ''}{tanggal}</div>
                <div style={{ height: mm(BASE.signatureSpacer) }} />
                <div
                  style={{
                    borderTop: `0.6px solid ${LINE}`,
                    paddingTop: mm(0.5),
                    minWidth: mm(BASE.signatureMinWidth),
                  }}
                >
                  Yang menerima
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

export default KuitansiJasaPrintTemplate
