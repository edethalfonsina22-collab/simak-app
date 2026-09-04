import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { ClipboardCheck, Loader2, Info } from 'lucide-react'

// ============================================================
// Halaman khusus ORANG TUA — read-only sepenuhnya.
// Beda dengan Presensi.jsx (punya Guru): tidak ada dropdown pilih kelas,
// tidak ada tombol tandai hadir/izin/sakit/alpa, tidak ada kamera absen.
// Anak hanya diambil lewat getAnakSaya() (AuthContext) yang dibatasi ke
// tabel `orang_tua_siswa` milik akun orang tua yang login.
// ============================================================

const STATUS_OPTS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-sage-500/15 text-sage-600' },
  { value: 'izin', label: 'Izin', color: 'bg-amber-500/15 text-amber-600' },
  { value: 'sakit', label: 'Sakit', color: 'bg-blue-100 text-blue-700' },
  { value: 'alpa', label: 'Alpa', color: 'bg-red-100 text-red-700' },
]

function rentangTanggalPeriode(tahunAjaran, semester) {
  if (!tahunAjaran) return null
  const bagian = tahunAjaran.split('/')
  if (bagian.length !== 2) return null
  const tahunAwal = parseInt(bagian[0], 10)
  const tahunAkhir = parseInt(bagian[1], 10)
  if (isNaN(tahunAwal) || isNaN(tahunAkhir)) return null
  if (semester === 'Genap') {
    return { mulai: `${tahunAkhir}-01-01`, selesai: `${tahunAkhir}-06-30` }
  }
  return { mulai: `${tahunAwal}-07-01`, selesai: `${tahunAwal}-12-31` }
}

function tanggalLabel(iso) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

const TAHUN_SEKARANG = new Date().getFullYear()
const DAFTAR_TAHUN_AJARAN = Array.from({ length: 5 }, (_, i) => {
  const awal = TAHUN_SEKARANG - 2 + i
  return `${awal}/${awal + 1}`
})
const TAHUN_AJARAN_BERJALAN = DAFTAR_TAHUN_AJARAN[2]

export default function PresensiAnak() {
  const { getAnakSaya } = useAuth()

  const [anakList, setAnakList] = useState([])
  const [anakId, setAnakId] = useState('')
  const [loadingAnak, setLoadingAnak] = useState(true)

  const [semester, setSemester] = useState('Ganjil')
  const [tahunAjaran, setTahunAjaran] = useState(TAHUN_AJARAN_BERJALAN)
  const [loading, setLoading] = useState(false)
  const [riwayat, setRiwayat] = useState([])

  // Ambil daftar anak HANYA lewat tabel orang_tua_siswa (via getAnakSaya).
  useEffect(() => {
    async function muatAnak() {
      setLoadingAnak(true)
      const { data } = await getAnakSaya()
      const list = data || []
      setAnakList(list)
      const pertama = list.find((a) => a.status === 'aktif')
      if (pertama) setAnakId(pertama.siswa.id)
      setLoadingAnak(false)
    }
    muatAnak()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const anakTerpilih = anakList.find((a) => a.siswa.id === anakId)
  const siswa = anakTerpilih?.siswa
  const anakDisetujui = anakList.filter((a) => a.status === 'aktif')

  useEffect(() => {
    if (anakId && tahunAjaran) muatPresensi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anakId, semester, tahunAjaran])

  async function muatPresensi() {
    setLoading(true)
    const periode = rentangTanggalPeriode(tahunAjaran, semester)
    let query = supabase.from('presensi_siswa').select('tanggal, status').eq('siswa_id', anakId)
    if (periode) {
      query = query.gte('tanggal', periode.mulai).lte('tanggal', periode.selesai)
    }
    const { data, error } = await query.order('tanggal', { ascending: false })
    if (error) {
      console.error(error)
      setRiwayat([])
      setLoading(false)
      return
    }
    setRiwayat(data || [])
    setLoading(false)
  }

  const rekap = { hadir: 0, izin: 0, sakit: 0, alpa: 0 }
  for (const r of riwayat) {
    if (rekap[r.status] !== undefined) rekap[r.status]++
  }
  const totalHari = riwayat.length
  const persenHadir = totalHari > 0 ? Math.round((rekap.hadir / totalHari) * 100) : null

  return (
    <Layout title="Presensi Anak" subtitle="Riwayat kehadiran anak Anda per semester">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#4a0e0e] to-[#7a1515] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Presensi Anak</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {siswa
                ? `${siswa.nama_lengkap} · ${siswa.kelas?.nama_kelas || '-'} · Semester ${semester} ${tahunAjaran}`
                : 'Memuat data anak...'}
            </p>
          </div>
        </div>
        <ClipboardCheck size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      <div className="card p-5 mb-5">
        {loadingAnak ? (
          <p className="text-sm text-ink-700/50 flex items-center gap-2">
            <Loader2 size={15} className="animate-spin" /> Memuat data anak...
          </p>
        ) : anakList.length === 0 ? (
          <p className="text-sm text-ink-700/50">
            Akun Anda belum terhubung dengan siswa manapun. Silakan hubungi admin sekolah.
          </p>
        ) : anakDisetujui.length === 0 ? (
          <p className="text-sm text-amber-600 flex items-center gap-2">
            <Info size={15} /> Hubungan Anda dengan anak masih menunggu persetujuan admin sekolah.
          </p>
        ) : (
          <div className="grid sm:grid-cols-4 gap-3">
            {anakDisetujui.length > 1 && (
              <div className="sm:col-span-2">
                <label className="label-field">Pilih Anak</label>
                <select className="input-field" value={anakId} onChange={(e) => setAnakId(e.target.value)}>
                  {anakDisetujui.map((a) => (
                    <option key={a.siswa.id} value={a.siswa.id}>
                      {a.siswa.nama_lengkap} {a.siswa.kelas?.nama_kelas ? `(${a.siswa.kelas.nama_kelas})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label-field">Semester</label>
              <select className="input-field" value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="Ganjil">Ganjil</option>
                <option value="Genap">Genap</option>
              </select>
            </div>
            <div>
              <label className="label-field">Tahun Ajaran</label>
              <select className="input-field" value={tahunAjaran} onChange={(e) => setTahunAjaran(e.target.value)}>
                {DAFTAR_TAHUN_AJARAN.map((ta) => (
                  <option key={ta} value={ta}>
                    {ta}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {siswa && anakDisetujui.length > 0 && (
        <>
          <div className="card p-5 mb-5">
            <h4 className="font-display font-semibold text-ink-950 mb-3">Rekap Semester Ini</h4>
            <div className="grid grid-cols-4 gap-3 mb-3">
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
            {persenHadir !== null && (
              <p className="text-xs text-ink-700/50">
                Tingkat kehadiran: <span className="font-semibold text-ink-950">{persenHadir}%</span> dari {totalHari} hari tercatat.
              </p>
            )}
          </div>

          <div className="card p-5">
            <h4 className="font-display font-semibold text-ink-950 mb-3">Riwayat Harian</h4>
            {loading ? (
              <p className="text-sm text-ink-700/50 flex items-center gap-2">
                <Loader2 size={15} className="animate-spin" /> Memuat riwayat...
              </p>
            ) : riwayat.length === 0 ? (
              <p className="text-sm text-ink-700/50">Belum ada data presensi untuk periode ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riwayat.map((r, i) => {
                      const opt = STATUS_OPTS.find((o) => o.value === r.status)
                      return (
                        <tr key={`${r.tanggal}-${i}`}>
                          <td>{tanggalLabel(r.tanggal)}</td>
                          <td>
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${opt?.color || 'bg-ink-950/5 text-ink-700'}`}>
                              {opt?.label || r.status}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </Layout>
  )
}
