import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Loader2, TrendingUp } from 'lucide-react'

// Jumlah minggu ke belakang yang ditampilkan
const JUMLAH_MINGGU = 8

// --- Konfigurasi sumber data ---
// Sesuaikan nama tabel & kolom di sini kalau berbeda dengan struktur database Anda.
const SUMBER_DATA = [
  { key: 'absensi', label: 'Absensi', table: 'presensi_siswa', kolom_guru: 'diisi_oleh', kolom_tanggal: 'tanggal', warna: '#14532d' },
  { key: 'nilai', label: 'Nilai', table: 'nilai', kolom_guru: 'diisi_oleh', kolom_tanggal: 'dibuat_pada', warna: '#111111' },
]

function awalMinggu(date) {
  const d = new Date(date)
  const hari = d.getDay() // 0 = Minggu
  const selisih = (hari === 0 ? 6 : hari - 1) // jadikan Senin sebagai awal minggu
  d.setDate(d.getDate() - selisih)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatLabelMinggu(date) {
  const akhir = new Date(date)
  akhir.setDate(akhir.getDate() + 6)
  const opt = { day: 'numeric', month: 'short' }
  return `${date.toLocaleDateString('id-ID', opt)} - ${akhir.toLocaleDateString('id-ID', opt)}`
}

export default function GrafikAktivitas({ guruId }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [dataGrafik, setDataGrafik] = useState([])

  useEffect(() => {
    async function muatData() {
      if (!guruId) {
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)

      try {
        // Siapkan bucket minggu (8 minggu terakhir)
        const mingguList = []
        const sekarang = awalMinggu(new Date())
        for (let i = JUMLAH_MINGGU - 1; i >= 0; i--) {
          const mulai = new Date(sekarang)
          mulai.setDate(mulai.getDate() - i * 7)
          mingguList.push(mulai)
        }
        const batasAwal = mingguList[0]

        const hasilPerSumber = await Promise.all(
          SUMBER_DATA.map(async (sumber) => {
            const { data: rows, error: err } = await supabase
              .from(sumber.table)
              .select(sumber.kolom_tanggal)
              .eq(sumber.kolom_guru, guruId)
              .gte(sumber.kolom_tanggal, batasAwal.toISOString().slice(0, 10))

            if (err) throw err
            return { key: sumber.key, rows: rows || [] }
          })
        )

        // Bucket-kan tiap baris ke minggu terdekat
        const grafik = mingguList.map((mulai) => ({
          minggu: formatLabelMinggu(mulai),
          _mulai: mulai,
          absensi: 0,
          nilai: 0,
        }))

        for (const sumber of SUMBER_DATA) {
          const hasil = hasilPerSumber.find((h) => h.key === sumber.key)
          if (!hasil) continue
          for (const row of hasil.rows) {
            const tanggal = row[sumber.kolom_tanggal]
            if (!tanggal) continue
            const mingguTanggal = awalMinggu(tanggal).getTime()
            const target = grafik.find((g) => g._mulai.getTime() === mingguTanggal)
            if (target) target[sumber.key] += 1
          }
        }

        setDataGrafik(grafik)
      } catch (e) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }

    muatData()
  }, [guruId])

  if (!guruId) return null

  return (
    <div className="card relative overflow-hidden p-6 space-y-4">
      <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-900 to-black" />
      <div className="flex items-center gap-2">
        <TrendingUp size={18} className="text-blue-900" />
        <h3 className="font-display font-semibold text-ink-950">Aktivitas Administrasi Kelas</h3>
      </div>
      <p className="text-xs text-ink-700/60 -mt-2">
        Ringkasan pengisian absensi dan nilai per minggu ({JUMLAH_MINGGU} minggu terakhir)
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-ink-700/50 py-8 justify-center">
          <Loader2 size={16} className="animate-spin" />
          Memuat data...
        </div>
      )}

      {!loading && error && (
        <p className="text-sm text-red-600">Gagal memuat grafik: {error}</p>
      )}

      {!loading && !error && (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dataGrafik} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="minggu" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {SUMBER_DATA.map((sumber) => (
                <Bar key={sumber.key} dataKey={sumber.key} name={sumber.label} stackId="a" fill={sumber.warna} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
