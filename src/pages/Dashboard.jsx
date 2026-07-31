import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Users, GraduationCap, DoorOpen, Megaphone } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts'

const COLORS = ['#D9A441', '#4C7A6E', '#22315B', '#A87A1F']

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

export default function Dashboard() {
  const [stats, setStats] = useState({ siswa: 0, guru: 0, kelas: 0, pengumuman: 0 })
  const [genderData, setGenderData] = useState([])
  const [pengumuman, setPengumuman] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [siswaCount, guruCount, kelasCount, pengumumanCount, lakiCount, perempuanCount, pengumumanRecent] =
        await Promise.all([
          supabase.from('siswa').select('*', { count: 'exact', head: true }),
          supabase.from('guru').select('*', { count: 'exact', head: true }),
          supabase.from('kelas').select('*', { count: 'exact', head: true }),
          supabase.from('pengumuman').select('*', { count: 'exact', head: true }),
          supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('jenis_kelamin', 'L'),
          supabase.from('siswa').select('*', { count: 'exact', head: true }).eq('jenis_kelamin', 'P'),
          supabase.from('pengumuman').select('id, judul, kategori, dibuat_pada').order('dibuat_pada', { ascending: false }).limit(5),
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
    </Layout>
  )
}
