import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import Layout from '../components/Layout'
import { Users, GraduationCap, DoorOpen, Megaphone, LayoutDashboard, ClipboardCheck, FileClock } from 'lucide-react'
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

// Palet kartu ringkasan — gaya bento (badge lingkaran + watermark + hover shadow berwarna)
// terinspirasi dari referensi desain, dipetakan ke tema brass/sage/ink/terracotta/blue yang sudah ada
const CARD_THEME = {
  brass: {
    tint: 'bg-brass-400/[0.06]',
    accent: 'bg-brass-400',
    badge: 'bg-brass-400/20 text-brass-600',
    watermark: 'text-brass-500',
    hover: 'hover:border-brass-400/50 hover:shadow-[0_20px_25px_-8px_rgba(217,164,65,0.25)]',
  },
  sage: {
    tint: 'bg-sage-500/[0.06]',
    accent: 'bg-sage-500',
    badge: 'bg-sage-500/20 text-sage-600',
    watermark: 'text-sage-500',
    hover: 'hover:border-sage-500/50 hover:shadow-[0_20px_25px_-8px_rgba(76,122,110,0.25)]',
  },
  ink: {
    tint: 'bg-ink-700/[0.05]',
    accent: 'bg-ink-700',
    badge: 'bg-ink-700/15 text-ink-700',
    watermark: 'text-ink-700',
    hover: 'hover:border-ink-700/40 hover:shadow-[0_20px_25px_-8px_rgba(34,49,91,0.22)]',
  },
  terracotta: {
    tint: 'bg-[#B4453A]/[0.06]',
    accent: 'bg-[#B4453A]',
    badge: 'bg-[#B4453A]/20 text-[#B4453A]',
    watermark: 'text-[#B4453A]',
    hover: 'hover:border-[#B4453A]/40 hover:shadow-[0_20px_25px_-8px_rgba(180,69,58,0.22)]',
  },
  blue: {
    tint: 'bg-blue-600/[0.06]',
    accent: 'bg-blue-600',
    badge: 'bg-blue-600/20 text-blue-700',
    watermark: 'text-blue-600',
    hover: 'hover:border-blue-600/50 hover:shadow-[0_20px_25px_-8px_rgba(37,99,235,0.22)]',
  },
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
  const [presensiHariIni, setPresensiHariIni] = useState({ terisi: 0, hadir: 0, izin: 0, alpa: 0 })
  const [pengajuanMenunggu, setPengajuanMenunggu] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date()
      since.setDate(since.getDate() - 13)
      const sinceStr = since.toISOString().slice(0, 10)
      const todayStr = new Date().toISOString().slice(0, 10)

      const [
        siswaCount, guruCount, kelasCount, pengumumanCount, lakiCount, perempuanCount, pengumumanRecent,
        presensiRows, nilaiRows, rppMenunggu, rppDisetujui, rppDitolak,
        presensiHariIniRows, pengajuanMenungguCount,
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
        supabase.from('presensi_siswa').select('status').eq('tanggal', todayStr),
        // Asumsi nilai status 'diajukan' dipakai untuk pengajuan izin yang menunggu persetujuan
        // kepala sekolah. Kalau nilai sebenarnya beda (misal 'menunggu'/'pending'), ganti string ini.
        supabase.from('pengajuan_izin').select('*', { count: 'exact', head: true }).eq('status', 'diajukan'),
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

      const rekapHariIni = { hadir: 0, izin: 0, alpa: 0 }
      for (const p of presensiHariIniRows.data || []) {
        if (rekapHariIni[p.status] !== undefined) rekapHariIni[p.status]++
      }
      setPresensiHariIni({ terisi: (presensiHariIniRows.data || []).length, ...rekapHariIni })
      setPengajuanMenunggu(pengajuanMenungguCount.count || 0)

      setLoading(false)
    }
    load()
  }, [])

  const cards = [
    { label: 'Total Siswa', value: stats.siswa, icon: Users, theme: 'brass' },
    { label: 'Total Guru', value: stats.guru, icon: GraduationCap, theme: 'sage' },
    { label: 'Jumlah Kelas', value: stats.kelas, icon: DoorOpen, theme: 'ink' },
    { label: 'Pengumuman', value: stats.pengumuman, icon: Megaphone, theme: 'terracotta' },
    {
      label: 'Presensi Hari Ini',
      value: `${presensiHariIni.terisi}/${stats.siswa}`,
      sublabel: `${presensiHariIni.hadir} hadir · ${presensiHariIni.izin} izin · ${presensiHariIni.alpa} alpa`,
      icon: ClipboardCheck,
      theme: 'blue',
    },
    {
      label: 'Pengajuan Menunggu',
      value: pengajuanMenunggu,
      sublabel: pengajuanMenunggu > 0 ? 'menunggu persetujuan Anda' : 'tidak ada yang menunggu',
      icon: FileClock,
      theme: pengajuanMenunggu > 0 ? 'terracotta' : 'sage',
    },
  ]

  return (
    <Layout title="Dasbor" subtitle="Ringkasan data sekolah Anda hari ini">
      {/* Keyframe animasi muncul bertahap, senada dengan halaman Login */}
      <style>{`
        @keyframes dashFadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dash-fade-in {
          animation: dashFadeInUp 0.5s ease-out forwards;
        }
      `}</style>

      <div className="relative">
        {/* Motif batik (gaya kawung) sebagai lapisan background samar, tidak mengganggu keterbacaan konten */}
        <svg
          className="absolute inset-0 -z-10 w-full h-full opacity-[0.08] pointer-events-none"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <pattern
              id="batikKawung"
              width="76"
              height="76"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(12)"
            >
              <g fill="none" stroke="#22315B" strokeWidth="1.1">
                <circle cx="38" cy="38" r="11" />
                <circle cx="0" cy="0" r="11" />
                <circle cx="76" cy="0" r="11" />
                <circle cx="0" cy="76" r="11" />
                <circle cx="76" cy="76" r="11" />
                <path d="M38 24 C46 30 46 46 38 52 C30 46 30 30 38 24 Z" />
                <path d="M24 38 C30 30 46 30 52 38 C46 46 30 46 24 38 Z" />
              </g>
              <circle cx="38" cy="38" r="2.5" fill="#D9A441" />
              <circle cx="0" cy="38" r="2" fill="#D9A441" />
              <circle cx="76" cy="38" r="2" fill="#D9A441" />
              <circle cx="38" cy="0" r="2" fill="#D9A441" />
              <circle cx="38" cy="76" r="2" fill="#D9A441" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#batikKawung)" />
        </svg>

      {/* Banner navy — background biru tua sama seperti kartu identitas di Profil Saya */}
      <div className="dash-fade-in opacity-0 relative overflow-hidden rounded-xl p-6 mb-6 flex items-center gap-4 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="relative w-12 h-12 rounded-full bg-white/10 ring-2 ring-white/20 text-white flex items-center justify-center shrink-0">
          <LayoutDashboard size={22} />
        </div>
        <div className="relative">
          <p className="font-display font-semibold text-lg text-white">Selamat datang kembali di SIMAK</p>
          <p className="text-sm text-blue-200/70">Semua ringkasan data sekolah ada di bawah ini.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {cards.map(({ label, value, icon: Icon, theme, sublabel }, i) => {
          const t = CARD_THEME[theme]
          return (
            <div
              key={label}
              className={`dash-fade-in opacity-0 group card relative overflow-hidden border border-transparent p-5 transition-all duration-300 ease-out hover:-translate-y-1 ${t.tint} ${t.hover}`}
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {/* Garis aksen warna di tepi atas kartu — pembeda visual langsung tanpa perlu hover */}
              <span className={`absolute top-0 left-0 w-full h-1 ${t.accent}`} />

              {/* Watermark ikon besar di pojok, membesar & miring halus saat hover */}
              <Icon
                size={112}
                strokeWidth={1.3}
                className={`absolute -right-6 -bottom-6 opacity-[0.10] pointer-events-none transition-all duration-300 ease-out group-hover:opacity-[0.16] group-hover:scale-110 group-hover:-rotate-6 ${t.watermark}`}
              />

              <div className="relative z-10">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 shadow-sm ${t.badge}`}>
                  <Icon size={22} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-700/50">{label}</p>
                <p className="text-3xl font-display font-extrabold text-ink-950 mt-1">
                  {loading ? '—' : value}
                </p>
                {sublabel && !loading && (
                  <p className="text-[11px] text-ink-700/50 mt-1">{sublabel}</p>
                )}
              </div>
            </div>
          )
        })}
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
      </div>
    </Layout>
  )
}
