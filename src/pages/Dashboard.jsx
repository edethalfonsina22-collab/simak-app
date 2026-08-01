import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Users, GraduationCap, DoorOpen, Megaphone } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'

const COLORS = ['#D9A441', '#4C7A6E', '#22315B', '#A87A1F']

const RPP_STATUS_COLOR = {
  menunggu: '#D9A441',
  disetujui: '#4C7A6E',
  ditolak: '#B4453A',
}
const RPP_STATUS_LABEL = { menunggu: 'Menunggu', disetujui: 'Disetujui', ditolak: 'Ditolak' }

const KATEGORI_STYLE = {
  Informasi: 'bg-ink-700/10 text-ink-700',
  Keuangan: 'bg-brass-400/15 text-brass-600',
  Akademik: 'bg-sage-500/15 text-sage-500',
}

function formatRelativeDate(iso) {
  const date = new Date(iso)
  const today = new Date()
  const diffDays = Math.floor((today.setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86400000)
  if (diffDays === 0) return 'Hari ini'
  if (diffDays === 1) return 'Kemarin'
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })
}

function aggregateAttendance(rows) {
  const map = {}
  rows.forEach((r) => {
    if (!map[r.tanggal]) map[r.tanggal] = { total: 0, hadir: 0 }
    map[r.tanggal].total += 1
    if (r.status === 'hadir') map[r.tanggal].hadir += 1
  })
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tanggal, v]) => ({
      tanggal: new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }),
      persen: v.total ? Math.round((v.hadir / v.total) * 100) : 0,
    }))
}

function aggregateNilai(rows) {
  const map = {}
  rows.forEach((r) => {
    if (!r.mata_pelajaran) return
    if (!map[r.mata_pelajaran]) map[r.mata_pelajaran] = { total: 0, count: 0 }
    map[r.mata_pelajaran].total += Number(r.nilai) || 0
    map[r.mata_pelajaran].count += 1
  })
  return Object.entries(map)
    .map(([mapel, v]) => ({ mapel, rata: Math.round((v.total / v.count) * 10) / 10 }))
    .sort((a, b) => b.rata - a.rata)
    .slice(0, 8)
}

export default function Dashboard() {
  const [stats, setStats] = useState({ siswa: 0, guru: 0, kelas: 0, pengumuman: 0 })
  const [genderData, setGenderData] = useState([])
  const [pengumuman, setPengumuman] = useState([])
  const [attendanceTrend, setAttendanceTrend] = useState([])
  const [nilaiPerMapel, setNilaiPerMapel] = useState([])
  const [rppStatus, setRppStatus] = useState({ menunggu: 0, disetujui: 0, ditolak: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 13)
      const sinceStr = since.toISOString().slice(0, 10)

      const [
        siswaCount, guruCount, kelasCount, pengumumanCount, lakiCount, perempuanCount, pengumumanRecent,
        presensiRows, nilaiRows, rppMenunggu, rppDisetujui, rppDitolak,
      ] = await Promise.all([
        supabase.from('siswa').select('*', { count: 'exact', head: true }),
        supabase.from('guru').select('*', { count: 'exact', head: true }),
        supabase.from('kelas').select('*', { count: 'exact', head: true }),
        supabase.from('pengumuman').select('*', { count: 'exact', head: true }),
        supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('jenis_kelamin', 'L'),
        supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('jenis_kelamin', 'P'),
        supabase.from('pengumuman').select('id, judul, kategori, dibuat_pada').order('dibuat_pada', { ascending: false }).limit(5),
        supabase.from('presensi_siswa').select('tanggal, status').gte('tanggal', sinceStr),
        supabase.from('nilai').select('mata_pelajaran, nilai'),
        supabase.from('rpp').select('*', { count: 'exact', head: true }).eq('status', 'menunggu'),
        supabase.from('rpp').select('*', { count: 'exact', head: true }).eq('status', 'disetujui'),
        supabase.from('rpp').select('*', { count: 'exact', head: true }).eq('status', 'ditolak'),
      ])

      setStats({
        siswa: siswaCount.count || 0,
        guru: guruCount.count || 0,
        kelas: kelasCount.count || 0,
        pengumuman: pengumumanCount.count || 0,
      })
      setGenderData([
        { name: 'Laki-laki', value: lakiCount.count || 0 },
        { name: 'Perempuan', value: perempuanCount.count || 0 },
      ])
      setPengumuman(pengumumanRecent.data || [])
      setAttendanceTrend(aggregateAttendance(presensiRows.data || []))
      setNilaiPerMapel(aggregateNilai(nilaiRows.data || []))
      setRppStatus({
        menunggu: rppMenunggu.count || 0,
        disetujui: rppDisetujui.count || 0,
        ditolak: rppDitolak.count || 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Total Siswa', value: stats.siswa, icon: Users, color: 'bg-brass-400/15 text-brass-600' },
    { label: 'Total Guru', value: stats.guru, icon: GraduationCap, color: 'bg-sage-500/15 text-sage-500' },
    { label: 'Jumlah Kelas', value: stats.kelas, icon: DoorOpen, color: 'bg-ink-700/10 text-ink-700' },
    { label: 'Pengumuman', value: stats.pengumuman, icon: Megaphone, color: 'bg-brass-400/15 text-brass-600' },
  ]

  return (
    <Layout title="Dasbor" subtitle="Ringkasan data sekolah Anda hari ini">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div
            key={label}
            className="card p-5 transition-shadow hover:shadow-sm"
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${color}`}>
              <Icon size={19} />
            </div>
            <p className="text-2xl font-display font-semibold text-ink-950">
              {loading ? '—' : value}
            </p>
            <p className="text-sm text-ink-700/60 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-4">Komposisi Siswa</h3>
          {stats.siswa === 0 ? (
            <p className="text-sm text-ink-700/50">Belum ada data siswa.</p>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={3}>
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute top-[92px] left-1/2 -translate-x-1/2 text-center pointer-events-none">
                <p className="text-xl font-display font-semibold text-ink-950">{stats.siswa}</p>
                <p className="text-[11px] text-ink-700/50">siswa</p>
              </div>
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-3">
          <h3 className="font-display text-lg font-semibold mb-4">Pengumuman Terbaru</h3>
          {pengumuman.length === 0 ? (
            <p className="text-sm text-ink-700/50">Belum ada pengumuman.</p>
          ) : (
            <ul className="divide-y divide-ink-900/[0.06]">
              {pengumuman.map((p) => (
                <li key={p.id} className="py-3 flex items-center gap-3">
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-md shrink-0 ${
                      KATEGORI_STYLE[p.kategori] || KATEGORI_STYLE.Informasi
                    }`}
                  >
                    {p.kategori || 'Informasi'}
                  </span>
                  <span className="text-sm text-ink-900 truncate flex-1">{p.judul}</span>
                  <span className="text-xs text-ink-700/40 shrink-0">
                    {formatRelativeDate(p.dibuat_pada)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <h2 className="font-display text-xl font-semibold text-ink-950 mt-8 mb-4">Analitik</h2>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="card p-6 lg:col-span-3">
          <h3 className="font-display text-lg font-semibold mb-4">Tren Kehadiran Siswa (14 Hari Terakhir)</h3>
          {attendanceTrend.length === 0 ? (
            <p className="text-sm text-ink-700/50">Belum ada data presensi.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={attendanceTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" width={40} />
                <Tooltip formatter={(v) => [`${v}%`, 'Kehadiran']} />
                <Line type="monotone" dataKey="persen" stroke="#4C7A6E" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card p-6 lg:col-span-2">
          <h3 className="font-display text-lg font-semibold mb-4">Status RPP</h3>
          {rppStatus.menunggu + rppStatus.disetujui + rppStatus.ditolak === 0 ? (
            <p className="text-sm text-ink-700/50">Belum ada RPP diupload.</p>
          ) : (
            <div className="space-y-3 pt-1">
              {Object.entries(rppStatus).map(([key, value]) => {
                const total = rppStatus.menunggu + rppStatus.disetujui + rppStatus.ditolak
                const pct = total ? (value / total) * 100 : 0
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-ink-700">{RPP_STATUS_LABEL[key]}</span>
                      <span className="font-medium text-ink-950">{value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-900/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: RPP_STATUS_COLOR[key] }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="card p-6 lg:col-span-5">
          <h3 className="font-display text-lg font-semibold mb-4">Rata-rata Nilai per Mata Pelajaran</h3>
          {nilaiPerMapel.length === 0 ? (
            <p className="text-sm text-ink-700/50">Belum ada data nilai.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={nilaiPerMapel}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="mapel" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={30} />
                <Tooltip />
                <Bar dataKey="rata" fill="#D9A441" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Layout>
  )
}
