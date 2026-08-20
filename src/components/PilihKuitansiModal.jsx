import { useEffect, useMemo, useState } from 'react'
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
 * Modal "Tarik dari Kuitansi" — dipakai di halaman Nota Belanja dan Kuitansi
 * Jasa supaya bisa langsung menarik data dari Kuitansi utama (tabel
 * `kuitansi`, jenis = 'kuitansi') tanpa perlu pindah ke halaman Kuitansi dulu.
 *
 * Dipanggil dari Nota.jsx / KuitansiJasa.jsx:
 *   <PilihKuitansiModal
 *     onPilih={(row) => { ...isi form pakai row...; setShowForm(true) }}
 *     onClose={() => setShowPilih(false)}
 *   />
 */
export default function PilihKuitansiModal({ onPilih, onClose }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [pencarian, setPencarian] = useState('')

  useEffect(() => {
    supabase
      .from('kuitansi')
      .select('*')
      .eq('jenis', 'kuitansi')
      .order('tanggal', { ascending: false })
      .order('id', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setData(data || [])
        setLoading(false)
      })
  }, [])

  const dataTersaring = useMemo(() => {
    if (!pencarian.trim()) return data
    const q = pencarian.toLowerCase()
    return data.filter((d) =>
      (d.nomor || '').toLowerCase().includes(q) ||
      (d.diterima_dari || '').toLowerCase().includes(q) ||
      (d.untuk_pembayaran || '').toLowerCase().includes(q)
    )
  }, [data, pencarian])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">Tarik dari Kuitansi</h2>
            <p className="text-xs text-ink-700/50">Pilih kuitansi yang datanya mau ditarik ke sini.</p>
          </div>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="relative mb-3 shrink-0">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700/40" />
          <input
            autoFocus
            className="input-field pl-9"
            placeholder="Cari nomor, nama, atau keterangan..."
            value={pencarian}
            onChange={(e) => setPencarian(e.target.value)}
          />
        </div>

        <div className="overflow-y-auto -mx-2 px-2">
          {loading && (
            <div className="text-center py-8 text-ink-700/50 text-sm">Memuat data...</div>
          )}
          {!loading && dataTersaring.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-ink-700/50">
              <Receipt size={28} className="text-ink-700/25" />
              <span className="text-sm">Tidak ada kuitansi yang cocok.</span>
            </div>
          )}
          {!loading && dataTersaring.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onPilih(d)}
              className="w-full text-left p-3 rounded-lg hover:bg-sage-500/10 border-b border-ink-950/5 flex items-center justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium">{d.nomor || '-'}</span>
                  <span className="text-ink-700/40">•</span>
                  <span className="text-ink-700/60">{formatTanggal(d.tanggal)}</span>
                </div>
                <div className="text-sm text-ink-950 truncate">{d.diterima_dari || '-'}</div>
                <div className="text-xs text-ink-700/50 truncate">{d.untuk_pembayaran || '-'}</div>
              </div>
              <div className="font-medium text-sm shrink-0">{formatRupiah(d.jumlah_total)}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
