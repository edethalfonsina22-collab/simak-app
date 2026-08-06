import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, ClipboardCheck, WifiOff } from 'lucide-react'
import { tambahAntrian, ambilAntrian, sinkronAntrian } from '../lib/offlineQueue'

const STATUS_OPTS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-sage-500/15 text-sage-500' },
  { value: 'izin', label: 'Izin', color: 'bg-brass-400/15 text-brass-600' },
  { value: 'sakit', label: 'Sakit', color: 'bg-blue-100 text-blue-700' },
  { value: 'alpa', label: 'Alpa', color: 'bg-red-100 text-red-700' },
]

function fotoGuruUrl(path) {
  if (!path) return null
  return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
}

export default function Presensi() {
  const { profil } = useAuth()
  const [tab, setTab] = useState('siswa')
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10))
  const [kelasList, setKelasList] = useState([])
  const [kelasId, setKelasId] = useState('')
  const [siswaList, setSiswaList] = useState([])
  const [guruList, setGuruList] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    supabase.from('kelas').select('id, nama_kelas').order('nama_kelas').then(({ data }) => {
      setKelasList(data || [])
      if (data?.length) setKelasId(data[0].id)
    })
    supabase.from('guru').select('id, nama_lengkap, foto_profil_path').eq('status', 'aktif').order('nama_lengkap').then(({ data }) => setGuruList(data || []))
  }, [])

  // Pantau status koneksi & sinkronkan antrian otomatis saat online kembali
  useEffect(() => {
    ambilAntrian().then((items) => setQueueCount(items.length))

    async function handleOnline() {
      setIsOffline(false)
      const jumlahTerkirim = await sinkronAntrian(supabase)
      if (jumlahTerkirim > 0) {
        const sisa = await ambilAntrian()
        setQueueCount(sisa.length)
      }
    }
    function handleOffline() {
      setIsOffline(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    if (tab === 'siswa' && kelasId) loadSiswaPresensi()
    if (tab === 'guru') loadGuruPresensi()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, kelasId, tanggal])

  async function loadSiswaPresensi() {
    setLoading(true)
    setSaved(false)
    setSavedOffline(false)
    const { data: siswa } = await supabase.from('siswa').select('id, nama_lengkap').eq('kelas_id', kelasId).eq('status', 'aktif').order('nama_lengkap')
    const { data: existing } = await supabase.from('presensi_siswa').select('siswa_id, status').eq('tanggal', tanggal).in('siswa_id', (siswa || []).map((s) => s.id))
    const map = {}
    ;(existing || []).forEach((e) => { map[e.siswa_id] = e.status })
    ;(siswa || []).forEach((s) => { if (!map[s.id]) map[s.id] = 'hadir' })
    setSiswaList(siswa || [])
    setStatusMap(map)
    setLoading(false)
  }

  async function loadGuruPresensi() {
    setLoading(true)
    setSaved(false)
    setSavedOffline(false)
    const { data: existing } = await supabase.from('presensi_guru').select('guru_id, status').eq('tanggal', tanggal)
    const map = {}
    ;(existing || []).forEach((e) => { map[e.guru_id] = e.status })
    guruList.forEach((g) => { if (!map[g.id]) map[g.id] = 'hadir' })
    setStatusMap(map)
    setLoading(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSavedOffline(false)

    const rows = tab === 'siswa'
      ? siswaList.map((s) => ({ siswa_id: s.id, tanggal, status: statusMap[s.id] || 'hadir', diisi_oleh: profil?.guru_id || null }))
      : guruList.map((g) => ({ guru_id: g.id, tanggal, status: statusMap[g.id] || 'hadir' }))

    const table = tab === 'siswa' ? 'presensi_siswa' : 'presensi_guru'
    const conflictCol = tab === 'siswa' ? 'siswa_id,tanggal' : 'guru_id,tanggal'

    // Kalau memang sedang offline, langsung simpan ke antrian lokal
    if (!navigator.onLine) {
      await tambahAntrian({ table, conflictCol, rows })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      setSaving(false)
      setSavedOffline(true)
      return
    }

    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflictCol })
    if (!error) {
      setSaved(true)
    } else {
      // Kadang navigator.onLine bilang online tapi request tetap gagal (koneksi tidak stabil)
      // — amankan datanya ke antrian lokal supaya tidak hilang
      await tambahAntrian({ table, conflictCol, rows })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      setSavedOffline(true)
    }
    setSaving(false)
  }

  const list = tab === 'siswa' ? siswaList : guruList
  const kelasAktif = kelasList.find((k) => k.id === kelasId)
  const tanggalLabel = new Date(tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Layout title="Presensi" subtitle="Catat kehadiran siswa dan guru harian">
      {/* Banner biru — senada dengan halaman Dokumen/Profil */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-950 to-[#22315B] p-6 mb-6">
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-paper" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-paper">Presensi</p>
            <p className="text-sm text-paper/70 mt-0.5">
              {tab === 'siswa' && kelasAktif ? `Kelas ${kelasAktif.nama_kelas} · ` : tab === 'guru' ? 'Presensi guru · ' : ''}
              {tanggalLabel}
            </p>
          </div>
        </div>
        <ClipboardCheck size={120} className="absolute -right-4 -bottom-6 text-white/5 rotate-12" />
      </div>

      {/* Indikator status koneksi & antrian */}
      {(isOffline || queueCount > 0) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brass-400/15 text-brass-600 text-sm w-fit">
          <WifiOff size={15} />
          {isOffline
            ? 'Sedang offline — presensi akan tersimpan sementara di perangkat ini.'
            : `Menyinkronkan ${queueCount} data presensi yang tertunda...`}
          {!isOffline && queueCount > 0 && <span className="font-medium">({queueCount} tersisa)</span>}
        </div>
      )}

      <div className="flex items-center gap-4 mb-5">
        <div className="inline-flex rounded-lg bg-white border border-ink-900/10 p-1">
          {['siswa', 'guru'].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${tab === t ? 'bg-ink-900 text-paper' : 'text-ink-700/60 hover:text-ink-900'}`}>
              {t}
            </button>
          ))}
        </div>
        <input type="date" className="input-field w-auto" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
        {tab === 'siswa' && (
          <select className="input-field w-auto" value={kelasId} onChange={(e) => setKelasId(e.target.value)}>
            {kelasList.map((k) => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
          </select>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="table-shell">
          <thead>
            <tr><th>Nama</th><th>Status Kehadiran</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Memuat...</td></tr>}
            {!loading && list.length === 0 && (
              <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">
                {tab === 'siswa' ? 'Pilih kelas yang memiliki siswa aktif.' : 'Belum ada data guru aktif.'}
              </td></tr>
            )}
            {list.map((item) => (
              <tr key={item.id}>
                <td className="font-medium">
                  {tab === 'guru' ? (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-ink-900/10 ring-1 ring-ink-900/10 overflow-hidden flex items-center justify-center shrink-0">
                        {fotoGuruUrl(item.foto_profil_path) ? (
                          <img src={fotoGuruUrl(item.foto_profil_path)} alt={item.nama_lengkap} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-semibold text-ink-700/60">{item.nama_lengkap?.[0] || '?'}</span>
                        )}
                      </div>
                      <span>{item.nama_lengkap}</span>
                    </div>
                  ) : (
                    item.nama_lengkap
                  )}
                </td>
                <td>
                  <div className="flex gap-1.5">
                    {STATUS_OPTS.map((opt) => (
                      <button key={opt.value} type="button"
                        onClick={() => setStatusMap({ ...statusMap, [item.id]: opt.value })}
                        className={`badge cursor-pointer border ${statusMap[item.id] === opt.value ? opt.color + ' border-transparent' : 'border-ink-900/10 text-ink-700/40'}`}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {list.length > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Simpan Presensi
          </button>
          {saved && <span className="text-sm text-sage-500">Tersimpan.</span>}
          {savedOffline && <span className="text-sm text-brass-600">Tersimpan lokal — akan dikirim otomatis saat online.</span>}
        </div>
      )}
    </Layout>
  )
}
