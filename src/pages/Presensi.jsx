import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, ClipboardCheck, WifiOff, Camera, X, RotateCcw, Check } from 'lucide-react'
import { tambahAntrian, ambilAntrian, sinkronAntrian } from '../lib/offlineQueue'

const STATUS_OPTS = [
  { value: 'hadir', label: 'Hadir', color: 'bg-sage-500/15 text-sage-500' },
  { value: 'izin', label: 'Izin', color: 'bg-brass-400/15 text-brass-600' },
  { value: 'sakit', label: 'Sakit', color: 'bg-blue-100 text-blue-700' },
  { value: 'alpa', label: 'Alpa', color: 'bg-red-100 text-red-700' },
]

const BUCKET_BUKTI = 'bukti-presensi'

// Motif batik (kawung + parang) — sama persis dengan Profil Saya, Dasbor, Galeri, Dokumen & Data Siswa,
// warna garis menyesuaikan latar (emas di atas navy).
function BatikOverlay({ patternId, strokeColor = '#d4af37', opacity = 1, size = 72 }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id={patternId}
          x="0"
          y="0"
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(8)"
        >
          <g fill="none" stroke={strokeColor} strokeWidth="1.1" opacity={opacity}>
            <ellipse cx={size / 2} cy={size * 0.333} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size / 2} cy={size * 0.667} rx={size * 0.125} ry={size * 0.194} opacity="0.55" />
            <ellipse cx={size * 0.333} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <ellipse cx={size * 0.667} cy={size / 2} rx={size * 0.194} ry={size * 0.125} opacity="0.55" />
            <circle cx={size / 2} cy={size / 2} r={size * 0.042} opacity="0.7" />
          </g>
          <path
            d={`M0 ${size} L${size * 0.25} ${size * 0.75} L${size * 0.5} ${size} L${size * 0.75} ${size * 0.75} L${size} ${size}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.35}
          />
          <path
            d={`M0 0 L${size * 0.25} ${size * 0.25} L0 ${size * 0.5}`}
            fill="none"
            stroke={strokeColor}
            strokeWidth="0.8"
            opacity={opacity * 0.3}
          />
          <circle cx={size * 0.11} cy={size * 0.11} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.89} cy={size * 0.22} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
          <circle cx={size * 0.22} cy={size * 0.89} r="1.3" fill={strokeColor} opacity={opacity * 0.4} />
        </pattern>
      </defs>
      <rect x="0" y="0" width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

function fotoGuruUrl(path) {
  if (!path) return null
  return supabase.storage.from('foto-profil').getPublicUrl(path).data.publicUrl
}

function fotoBuktiUrl(path) {
  if (!path) return null
  return supabase.storage.from(BUCKET_BUKTI).getPublicUrl(path).data.publicUrl
}

function jamLabel(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

// ============================================================
// Modul Kamera: ambil satu foto bukti kehadiran untuk satu guru.
// Tidak ada scan QR — murni ambil foto lalu simpan.
// ============================================================
function CameraFotoGuru({ guru, tanggal, onSaved, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [facingMode, setFacingMode] = useState('user')
  const [status, setStatus] = useState('starting') // starting | live | preview | saving | cam-error
  const [errorMsg, setErrorMsg] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [capturedBlob, setCapturedBlob] = useState(null)

  useEffect(() => {
    startCamera(facingMode)
    return stopCamera
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  async function startCamera(mode) {
    stopCamera()
    setStatus('starting')
    setErrorMsg('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 960 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('live')
    } catch (err) {
      setStatus('cam-error')
      setErrorMsg('Tidak bisa mengakses kamera: ' + (err.message || 'izin ditolak.'))
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }

  function ambilFoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        setCapturedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        setStatus('preview')
        stopCamera()
      },
      'image/jpeg',
      0.85
    )
  }

  function ambilUlang() {
    setCapturedBlob(null)
    setPreviewUrl('')
    startCamera(facingMode)
  }

  async function gunakanFoto() {
    if (!capturedBlob) return
    setStatus('saving')
    const path = `${guru.id}/${tanggal}.jpg`

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_BUKTI)
      .upload(path, capturedBlob, { upsert: true, contentType: 'image/jpeg' })

    if (uploadError) {
      setStatus('preview')
      setErrorMsg('Gagal upload foto: ' + uploadError.message)
      return
    }

    const jamAbsen = new Date().toISOString()
    await onSaved({ guru, fotoPath: path, jamAbsen })
    onClose()
  }

  function switchCamera() {
    setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/70 backdrop-blur-sm p-4">
      <div className="card relative overflow-hidden w-full max-w-md p-5">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-blue-900/10 text-blue-900 flex items-center justify-center shrink-0">
              <Camera size={17} />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold leading-tight truncate">Foto Bukti Kehadiran</h2>
              <p className="text-xs text-ink-700/50 truncate">{guru.nama_lengkap}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-ink-700/40 hover:text-ink-900 shrink-0">
            <X size={20} />
          </button>
        </div>

        <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-ink-950">
          {status === 'preview' ? (
            <img src={previewUrl} alt="Pratinjau foto" className="w-full h-full object-cover" />
          ) : (
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          )}
          <canvas ref={canvasRef} className="hidden" />

          {status === 'starting' && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-white text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Membuka kamera...
            </div>
          )}

          {status === 'saving' && (
            <div className="absolute inset-0 flex items-center justify-center bg-ink-950/60 text-white text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Menyimpan...
            </div>
          )}

          {status === 'cam-error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/90 text-white text-sm gap-3 text-center px-6">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => startCamera(facingMode)}
                className="px-3 py-1.5 rounded-lg bg-brass-400 text-ink-950 text-xs font-medium"
              >
                Coba lagi
              </button>
            </div>
          )}
        </div>

        {errorMsg && status === 'preview' && (
          <p className="text-xs text-red-700 mt-2">{errorMsg}</p>
        )}

        <div className="flex items-center justify-between mt-4">
          {status === 'live' && (
            <>
              <button
                type="button"
                onClick={switchCamera}
                className="flex items-center gap-1.5 text-xs text-ink-700/60 hover:text-ink-900"
              >
                <RotateCcw size={13} /> Ganti kamera
              </button>
              <button type="button" onClick={ambilFoto} className="btn-primary text-sm">
                <Camera size={15} /> Ambil Foto
              </button>
            </>
          )}

          {status === 'preview' && (
            <>
              <button type="button" onClick={ambilUlang} className="btn-secondary text-sm">
                Ambil Ulang
              </button>
              <button type="button" onClick={gunakanFoto} className="btn-primary text-sm">
                <Check size={15} /> Gunakan Foto
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
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
  const [buktiMap, setBuktiMap] = useState({}) // { [guru_id]: { foto_bukti_path, jam_absen } }
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savedOffline, setSavedOffline] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [queueCount, setQueueCount] = useState(0)
  const [cameraForGuru, setCameraForGuru] = useState(null) // objek guru yang sedang difoto, atau null

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
    const { data: existing } = await supabase
      .from('presensi_guru')
      .select('guru_id, status, foto_bukti_path, jam_absen')
      .eq('tanggal', tanggal)

    const map = {}
    const bukti = {}
    ;(existing || []).forEach((e) => {
      map[e.guru_id] = e.status
      if (e.foto_bukti_path || e.jam_absen) {
        bukti[e.guru_id] = { foto_bukti_path: e.foto_bukti_path, jam_absen: e.jam_absen }
      }
    })
    guruList.forEach((g) => { if (!map[g.id]) map[g.id] = 'hadir' })
    setStatusMap(map)
    setBuktiMap(bukti)
    setLoading(false)
  }

  // Dipanggil dari modul kamera setelah foto diambil untuk satu guru.
  // Langsung disimpan ke database (tidak menunggu tombol "Simpan Presensi"),
  // supaya foto & status tercatat seketika itu juga.
  async function handleFotoTersimpan({ guru, fotoPath, jamAbsen }) {
    setStatusMap((prev) => ({ ...prev, [guru.id]: 'hadir' }))
    setBuktiMap((prev) => ({ ...prev, [guru.id]: { foto_bukti_path: fotoPath, jam_absen: jamAbsen } }))

    const row = {
      guru_id: guru.id,
      tanggal,
      status: 'hadir',
      foto_bukti_path: fotoPath,
      jam_absen: jamAbsen,
    }

    if (!navigator.onLine) {
      await tambahAntrian({ table: 'presensi_guru', conflictCol: 'guru_id,tanggal', rows: [row] })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      return
    }

    const { error } = await supabase.from('presensi_guru').upsert([row], { onConflict: 'guru_id,tanggal' })
    if (error) {
      await tambahAntrian({ table: 'presensi_guru', conflictCol: 'guru_id,tanggal', rows: [row] })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
    }
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setSavedOffline(false)

    const rows = tab === 'siswa'
      ? siswaList.map((s) => ({ siswa_id: s.id, tanggal, status: statusMap[s.id] || 'hadir', diisi_oleh: profil?.guru_id || null }))
      : guruList.map((g) => ({
          guru_id: g.id,
          tanggal,
          status: statusMap[g.id] || 'hadir',
          foto_bukti_path: buktiMap[g.id]?.foto_bukti_path ?? null,
          jam_absen: buktiMap[g.id]?.jam_absen ?? null,
        }))

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
      {/* Banner navy — sama seperti Dasbor, Profil Saya, Galeri, Dokumen & Data Siswa, dengan corak batik emas */}
      <div className="relative overflow-hidden rounded-xl p-6 mb-6 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <BatikOverlay patternId="batikPresensiBanner" strokeColor="#d4af37" />

        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0">
            <ClipboardCheck size={20} className="text-white" />
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-white">Presensi</p>
            <p className="text-sm text-blue-200/70 mt-0.5">
              {tab === 'siswa' && kelasAktif ? `Kelas ${kelasAktif.nama_kelas} · ` : tab === 'guru' ? 'Presensi guru · ' : ''}
              {tanggalLabel}
            </p>
          </div>
        </div>
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

      <div className="flex items-center gap-4 mb-5 flex-wrap">
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

      <div className="card relative overflow-hidden overflow-x-auto">
        <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
        <table className="table-shell">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Status Kehadiran</th>
              {tab === 'guru' && <th>Foto Bukti</th>}
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={tab === 'guru' ? 3 : 2} className="text-center py-8 text-ink-700/50">Memuat...</td></tr>}
            {!loading && list.length === 0 && (
              <tr><td colSpan={tab === 'guru' ? 3 : 2} className="text-center py-8 text-ink-700/50">
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
                {tab === 'guru' && (
                  <td>
                    {buktiMap[item.id]?.foto_bukti_path ? (
                      <button
                        type="button"
                        onClick={() => setCameraForGuru(item)}
                        className="flex items-center gap-2 group"
                        title="Ambil ulang foto"
                      >
                        <img
                          src={fotoBuktiUrl(buktiMap[item.id].foto_bukti_path)}
                          alt="Bukti presensi"
                          className="w-9 h-9 rounded-lg object-cover ring-1 ring-ink-900/10 group-hover:ring-blue-900/40"
                        />
                        <span className="text-xs text-ink-700/50">{jamLabel(buktiMap[item.id].jam_absen) || '—'}</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCameraForGuru(item)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-900/10 text-blue-900 text-xs font-medium hover:bg-blue-900/15"
                      >
                        <Camera size={13} /> Ambil Foto
                      </button>
                    )}
                  </td>
                )}
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

      {cameraForGuru && (
        <CameraFotoGuru
          guru={cameraForGuru}
          tanggal={tanggal}
          onSaved={handleFotoTersimpan}
          onClose={() => setCameraForGuru(null)}
        />
      )}
    </Layout>
  )
}
