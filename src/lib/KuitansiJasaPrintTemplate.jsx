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
const PAPER_DEEP = '#d7edf1'
const GUILLOCHE = 'rgba(41,95,109,0.34)'
const GUILLOCHE_SOFT = 'rgba(41,95,109,0.14)'

// Jarak dari tepi atas kertas A4 ke kwitansi, meniru posisi pada
// sampel_kwitansi.docx (kwitansi "diturunkan" ke bagian bawah kertas,
// bukan menempel di pojok atas).
const TOP_OFFSET_MM = 123

// Latar motif guilloche: pola ubin (tile) berisi lingkaran-lingkaran
// bersinggungan, menghasilkan efek jalinan garis khas kertas berharga.
// (Beda dengan NotaPrintTemplate yang polos hitam-putih — kwitansi meniru
// blanko fisik bergaya cek/giro yang memang bermotif kertas berharga.)
function GuillocheField({ patternId, opacity = 1 }) {
  return (
    <svg
      aria-hidden="true"
      className="absolute inset-0 w-full h-full"
      style={{ opacity }}
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

// Kolom isian bertitik-titik (BUKAN garis solid seperti di NotaPrintTemplate)
// — blanko kwitansi fisik yang jadi acuan pakai titik-titik untuk kolom
// isiannya. Lebar TETAP (bukan minimum) supaya rapi mengikuti lebar kolom.
function Blank({ value, italic = false }) {
  return (
    <span
      className="block whitespace-nowrap overflow-hidden text-ellipsis"
      style={{
        borderBottom: `0.6px dotted ${LINE}`,
        minHeight: '3.6mm',
        padding: '0 1mm 0.3mm',
        fontStyle: italic ? 'italic' : 'normal',
      }}
    >
      {value}
    </span>
  )
}

const doubleFrame = {
  border: `1.1px solid ${LINE}`,
  outline: `0.4px solid ${LINE}`,
  outlineOffset: '1mm',
}

// Kwitansi Jasa — blanko kwitansi bergaya dokumen resmi (cek/giro) dengan
// motif guilloche, counterfoil/sobekan arsip di kiri, dan watermark rosette
// di slip utama. Dipakai KHUSUS untuk transaksi jasa (mis. transport,
// honor kegiatan) — beda dari NotaPrintTemplate yang khusus belanja barang.
//
// SATU KWITANSI = SATU LEMBAR A4 SENDIRI (dicetak terpisah dari Nota, tidak
// digabung dalam satu lembar). Kwitansi diposisikan turun ke bagian bawah
// kertas (bukan menempel di pojok atas), mengikuti posisi pada sampel
// referensi (sampel_kwitansi.docx).
//
// Catatan: strukturnya (helper formatRupiah/formatTanggal, className
// Tailwind, forwardRef, printColorAdjust) mengikuti pola NotaPrintTemplate
// supaya konsisten satu codebase — TIDAK mengubah atau bergantung pada
// NotaPrintTemplate itu sendiri.
//
// Props:
//   sekolah: { nama, alamat, kota }
//   data: { no_kwitansi, tanggal, dari, uang_sejumlah, untuk_pembayaran, jumlah }
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
          width: '185mm',
          padding: '2mm',
          background: PAPER_DEEP,
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        {/* Counterfoil / sobekan arsip */}
        <div
          className="relative flex flex-shrink-0 flex-col items-center justify-between overflow-hidden"
          style={{ ...doubleFrame, width: '24mm', padding: '2mm 1mm' }}
        >
          <GuillocheField patternId={stubPatternId} opacity={0.9} />
          <div className="relative text-center leading-tight" style={{ fontSize: '7px', color: INK }}>
            {sekolah?.nama}
          </div>
          <div className="relative">
            <Rosette size={26} />
          </div>
          <div className="relative text-center" style={{ fontSize: '7px', color: INK }}>
            No. {data?.no_kwitansi}
          </div>
        </div>

        {/* Garis perforasi */}
        <div
          className="flex-shrink-0"
          style={{
            width: '2.5mm',
            borderLeft: `0.5px dashed ${LINE_SOFT}`,
            borderRight: `0.5px dashed ${LINE_SOFT}`,
          }}
        />

        {/* Slip utama */}
        <div
          className="relative flex-1 overflow-hidden"
          style={{ ...doubleFrame, padding: '2.5mm 4mm' }}
        >
          <GuillocheField patternId={bodyPatternId} opacity={0.55} />
          {/* Watermark rosette besar di tengah */}
          <div
            className="absolute opacity-50"
            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
          >
            <Rosette size={62} />
          </div>

          <div className="relative flex h-full flex-col">
            <div className="text-center" style={{ marginBottom: '1.5mm' }}>
              <div className="font-bold" style={{ fontSize: '12px', letterSpacing: '1.5px', color: INK }}>
                KWITANSI
              </div>
              <div style={{ fontSize: '8px', color: INK }}>{sekolah?.nama}</div>
            </div>

            <table className="w-full flex-1 border-collapse" style={{ color: INK, fontSize: '10px' }}>
              <tbody>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ width: '28%', paddingRight: '2mm' }}>
                    No.
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.no_kwitansi} /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: '2mm' }}>
                    Telah terima dari
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.dari} /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: '2mm' }}>
                    Uang sejumlah
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.uang_sejumlah} italic /></td>
                </tr>
                <tr>
                  <td className="align-top whitespace-nowrap" style={{ paddingRight: '2mm' }}>
                    Untuk pembayaran
                  </td>
                  <td className="align-top">:</td>
                  <td><Blank value={data?.untuk_pembayaran} /></td>
                </tr>
              </tbody>
            </table>

            <div className="flex items-end justify-between" style={{ marginTop: '2.5mm' }}>
              <div
                className="font-bold"
                style={{
                  fontSize: '13px',
                  color: INK,
                  border: `0.6px solid ${LINE}`,
                  padding: '0.8mm 2mm',
                  background: 'rgba(255,255,255,0.35)',
                }}
              >
                Rp {formatRupiah(data?.jumlah || 0)}
              </div>
              <div className="text-center" style={{ fontSize: '9px', color: INK }}>
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
    </div>
  )
})

export default KuitansiJasaPrintTemplate
