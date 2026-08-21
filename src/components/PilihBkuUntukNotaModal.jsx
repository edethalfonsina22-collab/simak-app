import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Search, Loader2, Receipt, ArrowDownToLine } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Modal untuk mencari & memilih BANYAK baris pengeluaran dari BKU (tabel bku_kas)
 * sekaligus, dipakai untuk mengisi otomatis daftar barang di form Nota Belanja
 * lewat tombol "Tarik dari BKU".
 *
 * Beda dengan PilihBkuModal (single-select, dipakai di Kuitansi): di sini user
 * mencentang beberapa baris — biasanya beberapa baris dengan No. Bukti yang
 * sama, yaitu satu nota belanja yang berisi banyak barang — lalu semua baris
 * terpilih dijadikan baris item di form Nota sekaligus.
 *
 * Hanya menampilkan baris dengan pengeluaran > 0 (baris penerimaan tidak
 * relevan untuk nota belanja).
 *
 * Dipanggil dari Nota.jsx:
 *   <PilihBkuUntukNotaModal
 *     onTarik={(rows) => { ...isi form pakai rows...; setShowForm(true) }}
 *     onClose={() => setShowPilihBku(false)}
 *   />
 */
export default function PilihBkuUntukNotaModal({ onTarik, onClose }) {
  const [pencarian, setPencarian] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dipilih, setDipilih] = useState(() => new Set()) // Set of bku_kas.id

  async function loadData(q) {
    setLoading(true)
    setError('')
    let query = supabase
      .from('bku_kas')
      .select('*')
      .gt('pengeluaran', 0)
      .order('tanggal', { ascending: false })
      .limit(100)

    if (q.trim()) {
      query = query.or(
        `uraian.ilike.%${q}%,no_bukti.ilike.%${q}%,kode_rekening.ilike.%${q}%`
      )
    }

    const { data, error: err } = await query
    if (err) {
      setError('Gagal memuat data BKU: ' + err.message)
      setRows([])
    } else {
      setRows(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const t = setTimeout(() => loadData(pencarian), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pencarian])

  function toggleSatu(id) {
    setDipilih((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const semuaTampilTerpilih = rows.length > 0 && rows.every((r) => dipilih.has(r.id))

  function toggleSemuaTampil() {
    setDipilih((prev) => {
      if (semuaTampilTerpilih) {
        // lepas hanya baris yang sedang tampil, baris terpilih lain (di luar hasil filter) tetap
        const next = new Set(prev)
        rows.forEach((r) => next.delete(r.id))
        return next
      }
      const next = new Set(prev)
      rows.forEach((r) => next.add(r.id))
      return next
    })
  }

  const barisTerpilih = rows.filter((r) => dipilih.has(r.id))
  const totalTerpilih = barisTerpilih.reduce((sum, r) => sum + (Number(r.pengeluaran) || 0), 0)

  function handleTarik() {
    if (barisTerpilih.length === 0) return
    onTarik(barisTerpilih)
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Tarik dari BKU</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <p className="text-sm text-ink-700/60 mb-3">
          Centang beberapa baris pengeluaran BKU — biasanya baris-baris dengan No. Bukti yang
          sama, yaitu satu nota belanja — lalu klik "Tarik ke Nota". Setiap baris akan jadi
          satu baris barang di form Nota.
        </p>

        <div className="relative mb-3 shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            autoFocus
            className="input-field pl-9"
            placeholder="Cari uraian, no. bukti, atau kode rekening..."
            value={pencarian}
            onChange={(e) => setPencarian(e.target.value)}
          />
        </div>

        {error && <div className="text-sm text-red-600 mb-3">{error}</div>}

        <div className="border rounded-lg overflow-auto flex-1">
          <table className="table-shell">
            <thead>
              <tr>
                <th className="w-8">
                  <input
                    type="checkbox"
                    checked={semuaTampilTerpilih}
                    onChange={toggleSemuaTampil}
                    disabled={loading || rows.length === 0}
                  />
                </th>
                <th>Tanggal</th>
                <th>No. Bukti</th>
                <th>Uraian</th>
                <th>Kode Rekening</th>
                <th className="text-right">Pengeluaran</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="text-center py-8 text-ink-700/50">
                  <Loader2 size={18} className="animate-spin inline-block" /> Memuat data...
                </td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-ink-700/50">
                    <div className="flex flex-col items-center gap-2">
                      <Receipt size={28} className="text-ink-700/25" />
                      <span>Tidak ada baris pengeluaran BKU yang cocok.</span>
                    </div>
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={`cursor-pointer hover:bg-sage-50 ${dipilih.has(r.id) ? 'bg-sage-50' : ''}`}
                  onClick={() => toggleSatu(r.id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={dipilih.has(r.id)}
                      onChange={() => toggleSatu(r.id)}
                    />
                  </td>
                  <td>{formatTanggal(r.tanggal)}</td>
                  <td>{r.no_bukti || '-'}</td>
                  <td className="max-w-[260px] truncate">{r.uraian || '-'}</td>
                  <td>{r.kode_rekening || '-'}</td>
                  <td className="text-right font-medium">{formatRupiah(r.pengeluaran)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-ink-700/60">
            {barisTerpilih.length > 0
              ? `${barisTerpilih.length} baris dipilih • Total ${formatRupiah(totalTerpilih)}`
              : 'Belum ada baris dipilih'}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={onClose}>Batal</button>
            <button
              className="px-4 py-2 rounded bg-indigo-600 text-white text-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleTarik}
              disabled={barisTerpilih.length === 0}
            >
              <ArrowDownToLine size={15} /> Tarik ke Nota ({barisTerpilih.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
