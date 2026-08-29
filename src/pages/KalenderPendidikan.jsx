import { useEffect, useMemo, useState } from 'react'
import { CalendarRange, ChevronLeft, ChevronRight, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'
import Loader from '../components/Loader'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabaseClient'
import {
  TAHUN_AJARAN,
  BULAN,
  SEMESTER,
  JML_HBE,
  KETERANGAN,
  toISODate,
  jumlahHariDalamBulan,
  getStatusTanggal,
} from '../lib/kalenderPendidikan'

// Tabel Supabase yang dipakai (buat dulu lewat SQL Editor jika belum ada):
//
// create table kalender_overrides (
//   tanggal date primary key,
//   kode text not null,
//   keterangan text not null,
//   updated_at timestamptz default now()
// );

const NAMA_HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']

export default function KalenderPendidikan() {
  const { isAdmin } = useAuth()
  const [bulanIndex, setBulanIndex] = useState(0)
  const [overrides, setOverrides] = useState({})
  const [loading, setLoading] = useState(true)
  const [supabaseReady, setSupabaseReady] = useState(true)
  const [editingDate, setEditingDate] = useState(null)
  const [saving, setSaving] = useState(false)

  const bulanAktif = BULAN[bulanIndex]

  useEffect(() => {
    let mounted = true
    async function loadOverrides() {
      setLoading(true)
      try {
        const { data, error } = await supabase.from('kalender_overrides').select('*')
        if (error) throw error
        if (!mounted) return
        const map = {}
        ;(data || []).forEach((row) => {
          map[row.tanggal] = { kode: row.kode, keterangan: row.keterangan }
        })
        setOverrides(map)
        setSupabaseReady(true)
      } catch (err) {
        console.warn('Tidak bisa memuat kalender_overrides:', err.message)
        if (mounted) setSupabaseReady(false)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    loadOverrides()
    return () => {
      mounted = false
    }
  }, [])

  const grid = useMemo(() => {
    const { tahun, bulan } = bulanAktif
    const totalHari = jumlahHariDalamBulan(tahun, bulan)
    const hariPertama = new Date(tahun, bulan - 1, 1).getDay()

    const sel = []
    for (let i = 0; i < hariPertama; i++) sel.push(null)
    for (let tgl = 1; tgl <= totalHari; tgl++) {
      const iso = toISODate(tahun, bulan, tgl)
      sel.push({ tanggal: tgl, iso, status: getStatusTanggal(iso, overrides) })
    }
    return sel
  }, [bulanAktif, overrides])

  const semesterAktif = SEMESTER.GANJIL.bulan.includes(bulanAktif.key) ? SEMESTER.GANJIL : SEMESTER.GENAP

  async function simpanStatus(iso, kode, keteranganText) {
    setSaving(true)
    const kodeTrim = kode?.trim()

    if (!kodeTrim) {
      setOverrides((prev) => {
        const next = { ...prev }
        delete next[iso]
        return next
      })
      if (supabaseReady) await supabase.from('kalender_overrides').delete().eq('tanggal', iso)
      setSaving(false)
      setEditingDate(null)
      return
    }

    const value = { kode: kodeTrim, keterangan: keteranganText || KETERANGAN[kodeTrim]?.label || kodeTrim }
    setOverrides((prev) => ({ ...prev, [iso]: value }))

    if (supabaseReady) {
      const { error } = await supabase
        .from('kalender_overrides')
        .upsert({ tanggal: iso, kode: value.kode, keterangan: value.keterangan })
      if (error) console.warn('Gagal menyimpan ke Supabase:', error.message)
    }

    setSaving(false)
    setEditingDate(null)
  }

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-400 flex items-center justify-center text-white shrink-0">
            <CalendarRange size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-slate-800">Kalender Pendidikan</h1>
            <p className="text-sm text-slate-500">Tahun Pelajaran {TAHUN_AJARAN}</p>
          </div>
        </div>

        {!supabaseReady && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
            ⚠️ Tabel <code className="font-mono">kalender_overrides</code> belum tersedia di Supabase — perubahan
            hanya tersimpan sementara di browser ini (hilang saat refresh).
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader />
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6">
            {/* Navigasi bulan */}
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => setBulanIndex((i) => Math.max(0, i - 1))}
                disabled={bulanIndex === 0}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>

              <select
                value={bulanIndex}
                onChange={(e) => setBulanIndex(Number(e.target.value))}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                {BULAN.map((b, i) => (
                  <option key={b.key} value={i}>
                    {b.nama} {b.tahun}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setBulanIndex((i) => Math.min(BULAN.length - 1, i + 1))}
                disabled={bulanIndex === BULAN.length - 1}
                className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            <p className="text-sm text-slate-500 mb-4">
              {semesterAktif.label} &middot; Hari Belajar Efektif bulan ini:{' '}
              <span className="font-semibold text-slate-700">{JML_HBE[bulanAktif.key]}</span> hari &middot; Total HBE
              semester: <span className="font-semibold text-slate-700">{semesterAktif.totalHbe}</span>
            </p>

            {/* Grid kalender */}
            <div className="grid grid-cols-7 gap-1.5">
              {NAMA_HARI.map((h) => (
                <div key={h} className="text-center text-xs font-display font-bold uppercase tracking-wide text-slate-400 py-1">
                  {h}
                </div>
              ))}
              {grid.map((cell, idx) =>
                cell === null ? (
                  <div key={`empty-${idx}`} className="min-h-[60px]" />
                ) : (
                  <button
                    key={cell.iso}
                    onClick={() => isAdmin && setEditingDate(cell.iso)}
                    title={cell.status ? cell.status.keterangan : 'Hari sekolah'}
                    className={`min-h-[72px] rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                      cell.status
                        ? `${KETERANGAN[cell.status.kode]?.badge || 'bg-slate-200 text-slate-700'} border-transparent`
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    } ${isAdmin ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <span className="font-display font-extrabold text-2xl leading-none tracking-tight">
                      {cell.tanggal}
                    </span>
                    {cell.status && (
                      <span className="font-display font-bold text-[11px] uppercase tracking-wide leading-none px-1.5 py-0.5 rounded bg-black/10">
                        {cell.status.kode}
                      </span>
                    )}
                  </button>
                )
              )}
            </div>

            {/* Legenda */}
            <div className="mt-6 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Keterangan</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-slate-600">
                {Object.entries(KETERANGAN).map(([kode, v]) => (
                  <div key={kode} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm shrink-0 ${v.dot}`} />
                    <span>
                      <strong className="text-slate-800">{kode}</strong> — {v.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!isAdmin && (
              <p className="mt-4 text-xs text-slate-400">
                Hanya admin yang dapat mengubah status tanggal pada kalender ini.
              </p>
            )}
          </div>
        )}
      </main>

      {editingDate && isAdmin && (
        <EditModal
          iso={editingDate}
          current={overrides[editingDate]}
          saving={saving}
          onClose={() => setEditingDate(null)}
          onSave={simpanStatus}
        />
      )}
    </div>
  )
}

function EditModal({ iso, current, saving, onClose, onSave }) {
  const [kode, setKode] = useState(current?.kode || '')
  const [keterangan, setKeterangan] = useState(current?.keterangan || '')

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-slate-800">Edit tanggal {iso}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={18} />
          </button>
        </div>

        <label className="block text-xs font-medium text-slate-500 mb-1">Kode keterangan</label>
        <select
          value={kode}
          onChange={(e) => setKode(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">— Hari sekolah biasa (hapus status) —</option>
          {Object.entries(KETERANGAN).map(([k, v]) => (
            <option key={k} value={k}>
              {k} — {v.label}
            </option>
          ))}
        </select>

        <label className="block text-xs font-medium text-slate-500 mb-1">Keterangan (opsional)</label>
        <input
          type="text"
          value={keterangan}
          onChange={(e) => setKeterangan(e.target.value)}
          placeholder="Kosongkan untuk pakai label default"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50"
          >
            Batal
          </button>
          <button
            onClick={() => onSave(iso, kode, keterangan)}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-400 text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? 'Menyimpan…' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  )
}
