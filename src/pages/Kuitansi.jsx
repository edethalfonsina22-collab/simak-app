import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import KuitansiModal from '../components/KuitansiModal'
import KuitansiPrintTemplate from '../lib/KuitansiPrintTemplate'
import { Plus, Printer, Search, Loader2, Receipt } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Kuitansi() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pencarian, setPencarian] = useState('')
  const [filterJenis, setFilterJenis] = useState('semua')
  const [showBuat, setShowBuat] = useState(false)
  const [sekolah, setSekolah] = useState(null)

  // Data yang sedang dicetak ulang: { ...row, items: [...] }
  const [cetakUlang, setCetakUlang] = useState(null)
  const [memuatCetak, setMemuatCetak] = useState(null) // id kuitansi yang sedang disiapkan untuk cetak
  const printRef = useRef(null)

  async function loadData() {
    setLoading(true)
    const { data: rows, error } = await supabase
      .from('kuitansi')
      .select('*')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })
    if (!error) setData(rows || [])
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      if (data) {
        setSekolah({
          nama: data.nama_sekolah,
          alamat: data.alamat,
          kota: data.kabupaten,
        })
      }
    })
  }, [])

  const dataTersaring = useMemo(() => {
    return data.filter((d) => {
      if (filterJenis !== 'semua' && d.jenis !== filterJenis) return false
      if (!pencarian.trim()) return true
      const q = pencarian.toLowerCase()
      return (
        (d.nomor || '').toLowerCase().includes(q) ||
        (d.diterima_dari || '').toLowerCase().includes(q) ||
        (d.untuk_pembayaran || '').toLowerCase().includes(q) ||
        (d.tuan || '').toLowerCase().includes(q)
      )
    })
  }, [data, pencarian, filterJenis])

  async function handleCetakUlang(row) {
    setMemuatCetak(row.id)
    const { data: items, error } = await supabase
      .from('kuitansi_item')
      .select('*')
      .eq('kuitansi_id', row.id)
      .order('urutan', { ascending: true })
    setMemuatCetak(null)
    if (error) {
      alert('Gagal memuat rincian kuitansi: ' + error.message)
      return
    }
    setCetakUlang({ ...row, items: items || [] })
  }

  useEffect(() => {
    if (cetakUlang) {
      const t = setTimeout(() => {
        window.print()
        setCetakUlang(null)
      }, 150)
      return () => clearTimeout(t)
    }
  }, [cetakUlang])

  function handleTutupBuat() {
    setShowBuat(false)
    loadData()
  }

  return (
    <Layout
      title="Kuitansi & Nota"
      subtitle="Riwayat semua kuitansi dan nota yang pernah dibuat"
      actions={
        <button className="btn-primary" onClick={() => setShowBuat(true)}>
          <Plus size={16} /> Buat Kuitansi Baru
        </button>
      }
    >
      <div className="card p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[220px]">
          <label className="label-field">Cari</label>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
            <input
              className="input-field pl-9"
              placeholder="Cari nomor, nama, atau keterangan..."
              value={pencarian}
              onChange={(e) => setPencarian(e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="label-field">Jenis</label>
          <select className="input-field" value={filterJenis} onChange={(e) => setFilterJenis(e.target.value)}>
            <option value="semua">Semua</option>
            <option value="kuitansi">Kuitansi</option>
            <option value="nota">Nota</option>
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nomor</th>
              <th>Tanggal</th>
              <th>Jenis</th>
              <th>Diterima Dari / Tuan</th>
              <th>Keterangan</th>
              <th>Jumlah</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="text-center py-8 text-ink-700/50">Memuat data...</td></tr>
            )}
            {!loading && dataTersaring.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-10 text-ink-700/50">
                  <div className="flex flex-col items-center gap-2">
                    <Receipt size={28} className="text-ink-700/25" />
                    <span>Belum ada kuitansi/nota yang cocok.</span>
                  </div>
                </td>
              </tr>
            )}
            {dataTersaring.map((d) => (
              <tr key={d.id}>
                <td className="font-medium">{d.nomor || '-'}</td>
                <td>{formatTanggal(d.tanggal)}</td>
                <td>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    d.jenis === 'nota' ? 'bg-brass-400/20 text-brass-600' : 'bg-sage-500/10 text-sage-500'
                  }`}>
                    {d.jenis === 'nota' ? 'Nota' : 'Kuitansi'}
                  </span>
                </td>
                <td>{d.diterima_dari || d.tuan || '-'}</td>
                <td className="max-w-[220px] truncate">{d.untuk_pembayaran || '-'}</td>
                <td className="font-medium">{formatRupiah(d.jumlah_total)}</td>
                <td>
                  <div className="flex items-center gap-1 justify-end">
                    <button
                      className="icon-btn"
                      title="Cetak Ulang"
                      disabled={memuatCetak === d.id}
                      onClick={() => handleCetakUlang(d)}
                    >
                      {memuatCetak === d.id ? <Loader2 size={15} className="animate-spin" /> : <Printer size={15} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBuat && (
        <KuitansiModal
          keuanganRow={null}
          sekolah={sekolah}
          onClose={handleTutupBuat}
        />
      )}

      {cetakUlang && (
        <KuitansiPrintTemplate
          ref={printRef}
          sekolah={sekolah}
          data={cetakUlang}
          items={cetakUlang.items}
        />
      )}
    </Layout>
  )
}
