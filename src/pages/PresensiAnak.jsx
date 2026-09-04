import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { ClipboardCheck, Loader2 } from 'lucide-react'

const STATUS_LABEL = {
  hadir: { label: 'Hadir', color: 'bg-sage-500/15 text-sage-500' },
  izin: { label: 'Izin', color: 'bg-brass-400/15 text-brass-600' },
  sakit: { label: 'Sakit', color: 'bg-blue-100 text-blue-700' },
  alpa: { label: 'Alpa', color: 'bg-red-100 text-red-700' },
}

function formatTanggal(tgl) {
  return new Date(tgl).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Rentang tanggal bulan berjalan, dipakai untuk filter default
function rentangBulanIni() {
  const now = new Date()
  const mulai = new Date(now.getFullYear(), now.getMonth(), 1)
  const selesai = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    mulai: mulai.toISOString().slice(0, 10),
    selesai: selesai.toISOString().slice(0, 10),
  }
}

export default function PresensiAnak() {
  const { session } = useAuth()

  const [anakList, setAnakList] = useState([])
  const [siswaId, setSiswaId] = useState('')
  const [rentang] = useState(rentangBulanIni())
  const [bulanLabel] = useState(
    new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  )

  const [riwayat, setRiwayat] = useState([])
  const [rekap, setRekap] = useState({ hadir: 0, izin: 0, sakit: 0, alpa: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function ambilAnak() {
      if (!session?.user?.id) return
      const { data, error } = await supabase
        .from('orang_tua_siswa')
        .select('siswa_id, siswa(id, nama_lengkap, kelas(nama_kelas))')
        .eq('orang_tua_id', session.user.id)
        .eq('status', 'aktif')

      if (!error && data) {
        const anak = data.map((d) => d.siswa).filter(Boolean)
        setAnakList(anak)
        if (anak.length > 0) setSiswaId(anak[0].id)
        else setLoading(false)
      } else {
        setLoading(false)
      }
    }
    ambilAnak()
  }, [session])

  useEffect(() => {
    if (siswaId) muatPresensi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siswaId])

  async function muatPresensi() {
    setLoading(true)
    const { data } = await supabase
      .from('presensi_siswa')
      .select('tanggal, status')
      .eq('siswa_id', siswaId)
      .gte('tanggal', rentang.mulai)
      .lte('tanggal', rentang.selesai)
      .order('tanggal', { ascending: false })

    setRiwayat(data || [])
    const r = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
    for (const row of data || []) if (r[row.status] !== undefined) r[row.status]++
    setRekap(r)
    setLoading(false)
  }

  const siswaTerpilih = anakList.find((s) => s.id === siswaId)

  if (!loading && anakList.length === 0) {
    return (
      <Layout title="Presensi Anak" subtitle="Lihat riwayat kehadiran anak Anda">
        <div className="card p-8 text-center text-ink-700/50">
          Akun Anda belum terhubung dengan data siswa manapun. Hubungi admin sekolah untuk menghubungkan akun Anda dengan data anak Anda.
        </div>
      </Layout>
    )
  }

  return (
    <Layout title="Presensi Anak" subtitle={`Riwayat kehadiran · ${bulanLabel}`}>
      <div className="relative overflow-hidden rounded-xl p-6 mb-6 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-white">
              {siswaTerpilih?.nama_lengkap || 'Presensi Anak'}
            </p>
            <p className="text-sm text-blue-200/70 mt-0.5">
              {siswaTerpilih?.kelas?.nama_kelas ? `Kelas ${siswaTerpilih.kelas.nama_kelas} · ` : ''}
              {bulanLabel}
            </p>
          </div>
        </div>
      </div>

      {anakList.length > 1 && (
        <div className="card p-4 mb-5">
          <label className="label-field">Pilih Anak</label>
          <select className="input-field max-w-xs" value={siswaId} onChange={(e) => setSiswaId(e.target.value)}>
            {anakList.map((s) => (
              <option key={s.id} value={s.id}>{s.nama_lengkap}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <div className="card p-8 text-center text-ink-700/50 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Memuat presensi...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="rounded-lg bg-sage-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-sage-500">{rekap.hadir}</p>
              <p className="text-xs text-ink-700/60">Hadir</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-amber-600">{rekap.izin}</p>
              <p className="text-xs text-ink-700/60">Izin</p>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-blue-600">{rekap.sakit}</p>
              <p className="text-xs text-ink-700/60">Sakit</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3 text-center">
              <p className="text-2xl font-display font-semibold text-red-700">{rekap.alpa}</p>
              <p className="text-xs text-ink-700/60">Alpa</p>
            </div>
          </div>

          <div className="card relative overflow-hidden overflow-x-auto">
            <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
            <table className="table-shell">
              <thead>
                <tr><th>Tanggal</th><th>Status</th></tr>
              </thead>
              <tbody>
                {riwayat.length === 0 && (
                  <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Belum ada data presensi bulan ini.</td></tr>
                )}
                {riwayat.map((row) => (
                  <tr key={row.tanggal}>
                    <td>{formatTanggal(row.tanggal)}</td>
                    <td>
                      <span className={`badge ${STATUS_LABEL[row.status]?.color || ''}`}>
                        {STATUS_LABEL[row.status]?.label || row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Layout>
  )
}
