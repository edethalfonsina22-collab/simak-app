import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { X, Search, Loader2, Receipt } from 'lucide-react'

function formatRupiah(angka) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(angka || 0)
}

function formatTanggal(tgl) {
  if (!tgl) return '-'
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Modal untuk mencari & memilih SATU baris pengeluaran dari BKU (tabel bku_kas),
 * dipakai untuk mengisi otomatis form Kuitansi lewat tombol "Tarik Data dari BKU".
 *
 * Hanya menampilkan baris dengan pengeluaran > 0 (baris penerimaan tidak relevan
 * untuk kuitansi pengeluaran).
 *
 * Dipanggil dari Kuitansi.jsx:
 *   <PilihBkuModal
 *     onPilih={(row) => { ...isi form pakai row... }}
 *     onClose={() => setShowPilihBku(false)}
 *   />
 */
export default function PilihBkuModal({ onPilih, onClose }) {
  const [pencarian, setPencarian] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 no-print">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-semibold">Tarik Data dari BKU</h2>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <p className="text-sm text-ink-700/60 mb-3">
          Pilih satu baris pengeluaran BKU. Tanggal, jumlah, uraian, dan kode rekening akan
          otomatis mengisi form kuitansi — tinggal lengkapi nama-nama yang tanda tangan.
        </p>

        <div className="relative mb-3">
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
                <th>Tanggal</th>
                <th>No. Bukti</th>
                <th>Uraian</th>
                <th>Kode Rekening</th>
                <th className="text-right">Pengeluaran</th>
                <th></th>
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
                  className="cursor-pointer hover:bg-sage-50"
                  onClick={() => onPilih(r)}
                >
                  <td>{formatTanggal(r.tanggal)}</td>
                  <td>{r.no_bukti || '-'}</td>
                  <td className="max-w-[260px] truncate">{r.uraian || '-'}</td>
                  <td>{r.kode_rekening || '-'}</td>
                  <td className="text-right font-medium">{formatRupiah(r.pengeluaran)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={(e) => { e.stopPropagation(); onPilih(r) }}
                    >
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end pt-4">
          <button className="btn-secondary" onClick={onClose}>Batal</button>
        </div>
      </div>
    </div>
  )
}
