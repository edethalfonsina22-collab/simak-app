import { useEffect, useState, useMemo } from 'react'
import Layout from '../components/Layout'
import { eksporExcel, eksporPDF } from '../lib/exportUtils'
import { loadArkasItemsDenganSisa, formatRupiahArkas as formatRupiah } from '../lib/arkasUtils'
import { Search, FileDown, FileSpreadsheet } from 'lucide-react'

export default function AnggaranArkas() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [cari, setCari] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const hasil = await loadArkasItemsDenganSisa()
      setItems(hasil)
    } catch (error) {
      alert('Gagal memuat data ARKAS: ' + error.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const dataTampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (it) =>
        it.uraian?.toLowerCase().includes(q) ||
        it.kode_rekening?.toLowerCase().includes(q) ||
        it.item_no?.toLowerCase().includes(q)
    )
  }, [items, cari])

  const totalAnggaran = items.reduce((a, b) => a + Number(b.jumlah || 0), 0)
  const totalRealisasi = items.reduce((a, b) => a + b.realisasi, 0)
  const totalSisa = totalAnggaran - totalRealisasi

  function handleExportPDF() {
    const kolom = ['Kode Rekening', 'Uraian', 'Anggaran', 'Realisasi', 'Sisa']
    const baris = dataTampil.map((it) => [
      it.kode_rekening || '-',
      it.uraian || '-',
      formatRupiah(it.jumlah),
      formatRupiah(it.realisasi),
      formatRupiah(it.sisa),
    ])
    baris.push(['', 'Total', formatRupiah(totalAnggaran), formatRupiah(totalRealisasi), formatRupiah(totalSisa)])
    eksporPDF('Anggaran ARKAS', kolom, baris, 'anggaran-arkas')
  }

  function handleExportExcel() {
    eksporExcel(
      dataTampil.map((it) => ({
        'Kode Rekening': it.kode_rekening || '-',
        Uraian: it.uraian || '-',
        Anggaran: it.jumlah,
        Realisasi: it.realisasi,
        Sisa: it.sisa,
      })),
      'anggaran-arkas',
      'Anggaran ARKAS'
    )
  }

  return (
    <Layout
      title="Anggaran ARKAS"
      subtitle={`${items.length} item anggaran`}
      actions={
        <>
          <button className="btn-secondary" onClick={handleExportPDF}>
            <FileDown size={16} /> PDF
          </button>
          <button className="btn-secondary" onClick={handleExportExcel}>
            <FileSpreadsheet size={16} /> Excel
          </button>
        </>
      }
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-5">
          <p className="text-xs text-ink-700/50">Total Anggaran</p>
          <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalAnggaran)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-700/50">Total Realisasi</p>
          <p className="font-display text-lg font-semibold text-ink-950">{formatRupiah(totalRealisasi)}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink-700/50">Sisa Anggaran</p>
          <p className={`font-display text-lg font-semibold ${totalSisa < 0 ? 'text-red-600' : 'text-sage-500'}`}>
            {formatRupiah(totalSisa)}
          </p>
        </div>
      </div>

      <div className="card p-4 mb-4 flex items-center gap-2">
        <Search size={16} className="text-ink-700/40" />
        <input
          className="input-field flex-1"
          placeholder="Cari kode rekening atau uraian..."
          value={cari}
          onChange={(e) => setCari(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Kode Rekening</th>
              <th>Uraian</th>
              <th>Anggaran</th>
              <th>Realisasi</th>
              <th>Sisa</th>
              <th>Progres</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink-700/50">
                  Memuat data...
                </td>
              </tr>
            )}
            {!loading && dataTampil.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-8 text-ink-700/50">
                  Tidak ada item ditemukan.
                </td>
              </tr>
            )}
            {dataTampil.map((it) => (
              <tr key={it.id}>
                <td className="whitespace-nowrap">{it.kode_rekening || '-'}</td>
                <td>{it.uraian}</td>
                <td>{formatRupiah(it.jumlah)}</td>
                <td>{formatRupiah(it.realisasi)}</td>
                <td className={it.sisa < 0 ? 'text-red-600 font-medium' : 'font-medium'}>
                  {formatRupiah(it.sisa)}
                </td>
                <td>
                  <div className="w-28 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full ${it.persen >= 100 ? 'bg-red-500' : 'bg-sage-500'}`}
                      style={{ width: `${it.persen}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Layout>
  )
}
