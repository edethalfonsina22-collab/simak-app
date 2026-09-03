import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../lib/AuthContext'
import Layout from '../components/Layout'
import { Loader2, Save, ClipboardCheck, WifiOff, Camera, X, RotateCcw, Check, Printer } from 'lucide-react'
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

// ============================================================
// Panel Presensi Pribadi — ditampilkan untuk akun dengan role
// 'guru' (bukan admin). Menampilkan:
// 1) Presensi diri sendiri hari ini (status + foto bukti)
// 2) Kalau guru adalah wali kelas, presensi siswa DI KELASNYA
//    SAJA (tidak bisa lihat/edit kelas lain).
// ============================================================
function PresensiPribadi({ profil }) {
  const hariIni = new Date().toISOString().slice(0, 10)
  const tanggalLabel = new Date(hariIni).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  const guruId = profil?.guru_id

  // --- Presensi pribadi (guru itu sendiri) ---
  const [dataSaya, setDataSaya] = useState({ status: 'hadir', foto_bukti_path: null, jam_absen: null })
  const [loadingSaya, setLoadingSaya] = useState(true)
  const [savingSaya, setSavingSaya] = useState(false)
  const [savedSaya, setSavedSaya] = useState(false)
  const [savedOfflineSaya, setSavedOfflineSaya] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  // --- Kelas yang diampu (wali kelas) & presensi siswanya ---
  const [kelasWali, setKelasWali] = useState(undefined) // undefined = belum dicek, null = bukan wali kelas
  const [siswaList, setSiswaList] = useState([])
  const [statusSiswaMap, setStatusSiswaMap] = useState({})
  const [loadingSiswa, setLoadingSiswa] = useState(false)
  const [savingSiswa, setSavingSiswa] = useState(false)
  const [savedSiswa, setSavedSiswa] = useState(false)
  const [savedOfflineSiswa, setSavedOfflineSiswa] = useState(false)

  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [queueCount, setQueueCount] = useState(0)

  useEffect(() => {
    if (guruId) {
      loadPresensiSaya()
      loadKelasWali()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guruId])

  useEffect(() => {
    if (kelasWali) loadPresensiSiswa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kelasWali])

  useEffect(() => {
    ambilAntrian().then((items) => setQueueCount(items.length))
    function handleOnline() { setIsOffline(false) }
    function handleOffline() { setIsOffline(true) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function loadPresensiSaya() {
    setLoadingSaya(true)
    const { data: existing } = await supabase
      .from('presensi_guru')
      .select('status, foto_bukti_path, jam_absen')
      .eq('guru_id', guruId)
      .eq('tanggal', hariIni)
      .maybeSingle()
    setDataSaya(existing || { status: 'hadir', foto_bukti_path: null, jam_absen: null })
    setLoadingSaya(false)
  }

  // Cari kelas di mana guru ini menjadi wali_kelas_id — kalau tidak ada,
  // guru tersebut bukan wali kelas dan bagian presensi siswa disembunyikan.
  async function loadKelasWali() {
    const { data } = await supabase
      .from('kelas')
      .select('id, nama_kelas')
      .eq('wali_kelas_id', guruId)
      .maybeSingle()
    setKelasWali(data || null)
  }

  async function loadPresensiSiswa() {
    if (!kelasWali) return
    setLoadingSiswa(true)
    setSavedSiswa(false)
    setSavedOfflineSiswa(false)
    const { data: siswa } = await supabase
      .from('siswa')
      .select('id, nama_lengkap')
      .eq('kelas_id', kelasWali.id)
      .eq('status', 'aktif')
      .order('nama_lengkap')
    const { data: existing } = await supabase
      .from('presensi_siswa')
      .select('siswa_id, status')
      .eq('tanggal', hariIni)
      .in('siswa_id', (siswa || []).map((s) => s.id))
    const map = {}
    ;(existing || []).forEach((e) => { map[e.siswa_id] = e.status })
    ;(siswa || []).forEach((s) => { if (!map[s.id]) map[s.id] = 'hadir' })
    setSiswaList(siswa || [])
    setStatusSiswaMap(map)
    setLoadingSiswa(false)
  }

  async function simpanBaris(table, conflictCol, row) {
    if (!navigator.onLine) {
      await tambahAntrian({ table, conflictCol, rows: [row] })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      return { offline: true }
    }
    const { error } = await supabase.from(table).upsert([row], { onConflict: conflictCol })
    if (error) {
      await tambahAntrian({ table, conflictCol, rows: [row] })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      return { offline: true }
    }
    return { offline: false }
  }

  async function handleFotoTersimpan({ fotoPath, jamAbsen }) {
    const next = { ...dataSaya, status: 'hadir', foto_bukti_path: fotoPath, jam_absen: jamAbsen }
    setDataSaya(next)
    await simpanBaris('presensi_guru', 'guru_id,tanggal', {
      guru_id: guruId, tanggal: hariIni, status: 'hadir', foto_bukti_path: fotoPath, jam_absen: jamAbsen,
    })
  }

  async function handleSimpanStatusSaya() {
    setSavingSaya(true)
    setSavedSaya(false)
    setSavedOfflineSaya(false)
    const hasil = await simpanBaris('presensi_guru', 'guru_id,tanggal', {
      guru_id: guruId,
      tanggal: hariIni,
      status: dataSaya.status,
      foto_bukti_path: dataSaya.foto_bukti_path ?? null,
      jam_absen: dataSaya.jam_absen ?? null,
    })
    setSavingSaya(false)
    if (hasil.offline) setSavedOfflineSaya(true)
    else setSavedSaya(true)
  }

  async function handleSimpanPresensiSiswa() {
    if (!kelasWali) return
    setSavingSiswa(true)
    setSavedSiswa(false)
    setSavedOfflineSiswa(false)
    const rows = siswaList.map((s) => ({
      siswa_id: s.id,
      tanggal: hariIni,
      status: statusSiswaMap[s.id] || 'hadir',
      diisi_oleh: guruId,
    }))

    if (!navigator.onLine) {
      await tambahAntrian({ table: 'presensi_siswa', conflictCol: 'siswa_id,tanggal', rows })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      setSavingSiswa(false)
      setSavedOfflineSiswa(true)
      return
    }

    const { error } = await supabase.from('presensi_siswa').upsert(rows, { onConflict: 'siswa_id,tanggal' })
    if (!error) {
      setSavedSiswa(true)
    } else {
      await tambahAntrian({ table: 'presensi_siswa', conflictCol: 'siswa_id,tanggal', rows })
      const sisa = await ambilAntrian()
      setQueueCount(sisa.length)
      setSavedOfflineSiswa(true)
    }
    setSavingSiswa(false)
  }

  // Cetak daftar hadir siswa kelas yang diampu (wali kelas) — pakai print dialog browser.
  function handlePrintSiswa() {
    window.print()
  }

  return (
    <Layout title="Presensi" subtitle="Kehadiran Anda hari ini">
      {/* Aturan cetak: sembunyikan seluruh halaman kecuali area #print-area-siswa saat mencetak */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-area-siswa, #print-area-siswa * { visibility: visible; }
          #print-area-siswa {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 24px;
          }
        }
      `}</style>

      <div className="relative overflow-hidden rounded-xl p-6 mb-6 bg-gradient-to-br from-blue-900 to-blue-950">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <BatikOverlay patternId="batikPresensiSayaBanner" strokeColor="#d4af37" />

        <div className="relative flex items-center gap-4">
          <div className="w-11 h-11 rounded-full bg-white/10 ring-2 ring-white/20 flex items-center justify-center shrink-0 overflow-hidden">
            {fotoGuruUrl(profil?.foto_profil_path) ? (
              <img src={fotoGuruUrl(profil.foto_profil_path)} alt={profil?.nama_lengkap} className="w-full h-full object-cover" />
            ) : (
              <ClipboardCheck size={20} className="text-white" />
            )}
          </div>
          <div>
            <p className="font-display font-semibold text-lg text-white">{profil?.nama_lengkap || 'Presensi Saya'}</p>
            <p className="text-sm text-blue-200/70 mt-0.5">
              {kelasWali ? `Wali Kelas ${kelasWali.nama_kelas} · ` : ''}
              {tanggalLabel}
            </p>
          </div>
        </div>
      </div>

      {(isOffline || queueCount > 0) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg bg-brass-400/15 text-brass-600 text-sm w-fit">
          <WifiOff size={15} />
          {isOffline
            ? 'Sedang offline — presensi akan tersimpan sementara di perangkat ini.'
            : `Menyinkronkan ${queueCount} data presensi yang tertunda...`}
          {!isOffline && queueCount > 0 && <span className="font-medium">({queueCount} tersisa)</span>}
        </div>
      )}

      {!guruId ? (
        <div className="card p-6 text-center text-ink-700/60">
          Akun Anda belum terhubung ke data guru. Hubungi admin untuk menautkan akun.
        </div>
      ) : (
        <>
          {/* ===== Presensi Pribadi ===== */}
          <div className="mb-3">
            <h2 className="font-display text-base font-semibold text-ink-900">Presensi Saya</h2>
          </div>
          {loadingSaya ? (
            <div className="card p-6 text-center text-ink-700/50 mb-6">Memuat...</div>
          ) : (
            <div className="card relative overflow-hidden p-5 mb-6">
              <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />

              <div className="mb-5">
                <label className="block text-xs font-semibold text-ink-700/60 mb-2">Status Kehadiran</label>
                <div className="flex gap-1.5 flex-wrap">
                  {STATUS_OPTS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDataSaya((d) => ({ ...d, status: opt.value }))}
                      className={`badge cursor-pointer border ${dataSaya.status === opt.value ? opt.color + ' border-transparent' : 'border-ink-900/10 text-ink-700/40'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <label className="block text-xs font-semibold text-ink-700/60 mb-2">Foto Bukti Kehadiran</label>
                {dataSaya.foto_bukti_path ? (
                  <button type="button" onClick={() => setShowCamera(true)} className="flex items-center gap-3 group" title="Ambil ulang foto">
                    <img
                      src={fotoBuktiUrl(dataSaya.foto_bukti_path)}
                      alt="Bukti presensi"
                      className="w-14 h-14 rounded-lg object-cover ring-1 ring-ink-900/10 group-hover:ring-blue-900/40"
                    />
                    <span className="text-xs text-ink-700/50">
                      Diambil pukul {jamLabel(dataSaya.jam_absen) || '—'} · klik untuk ambil ulang
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCamera(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-900/10 text-blue-900 text-sm font-medium hover:bg-blue-900/15"
                  >
                    <Camera size={15} /> Ambil Foto
                  </button>
                )}
              </div>

              <div className="flex items-center gap-3">
                <button onClick={handleSimpanStatusSaya} disabled={savingSaya} className="btn-primary">
                  {savingSaya ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Simpan Presensi
                </button>
                {savedSaya && <span className="text-sm text-sage-500">Tersimpan.</span>}
                {savedOfflineSaya && <span className="text-sm text-brass-600">Tersimpan lokal — akan dikirim otomatis saat online.</span>}
              </div>
            </div>
          )}

          {/* ===== Presensi Siswa — hanya untuk wali kelas, hanya kelasnya sendiri ===== */}
          {kelasWali && (
            <>
              <div className="mb-3">
                <h2 className="font-display text-base font-semibold text-ink-900">
                  Presensi Siswa Kelas {kelasWali.nama_kelas}
                </h2>
              </div>
              <div className="card relative overflow-hidden overflow-x-auto">
                <span className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-900 to-brass-400" />
                <table className="table-shell">
                  <thead>
                    <tr>
                      <th>Nama Siswa</th>
                      <th>Status Kehadiran</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingSiswa && (
                      <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Memuat...</td></tr>
                    )}
                    {!loadingSiswa && siswaList.length === 0 && (
                      <tr><td colSpan={2} className="text-center py-8 text-ink-700/50">Belum ada siswa aktif di kelas ini.</td></tr>
                    )}
                    {siswaList.map((s) => (
                      <tr key={s.id}>
                        <td className="font-medium">{s.nama_lengkap}</td>
                        <td>
                          <div className="flex gap-1.5">
                            {STATUS_OPTS.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                onClick={() => setStatusSiswaMap({ ...statusSiswaMap, [s.id]: opt.value })}
                                className={`badge cursor-pointer border ${statusSiswaMap[s.id] === opt.value ? opt.color + ' border-transparent' : 'border-ink-900/10 text-ink-700/40'}`}
                              >
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

              {siswaList.length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <button onClick={handleSimpanPresensiSiswa} disabled={savingSiswa} className="btn-primary">
                    {savingSiswa ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Simpan Presensi Siswa
                  </button>
                  <button type="button" onClick={handlePrintSiswa} className="btn-secondary">
                    <Printer size={16} />
                    Cetak Daftar Hadir
                  </button>
                  {savedSiswa && <span className="text-sm text-sage-500">Tersimpan.</span>}
                  {savedOfflineSiswa && <span className="text-sm text-brass-600">Tersimpan lokal — akan dikirim otomatis saat online.</span>}
                </div>
              )}

              {/* Area khusus cetak — hanya muncul saat dialog print terbuka (lihat @media print di atas) */}
              <div id="print-area-siswa" className="hidden">
                <h1 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '2px' }}>
                  Daftar Hadir Siswa
                </h1>
                <p style={{ fontSize: '13px', marginBottom: '16px', color: '#333' }}>
                  Kelas {kelasWali.nama_kelas} · {tanggalLabel}
                </p>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '40px' }}>No</th>
                      <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left' }}>Nama Siswa</th>
                      <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '110px' }}>Status</th>
                      <th style={{ border: '1px solid #000', padding: '6px 8px', textAlign: 'left', width: '110px' }}>Tanda Tangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siswaList.map((s, idx) => (
                      <tr key={s.id}>
                        <td style={{ border: '1px solid #000', padding: '6px 8px' }}>{idx + 1}</td>
                        <td style={{ border: '1px solid #000', padding: '6px 8px' }}>{s.nama_lengkap}</td>
                        <td style={{ border: '1px solid #000', padding: '6px 8px' }}>
                          {STATUS_OPTS.find((o) => o.value === statusSiswaMap[s.id])?.label || '-'}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '6px 8px' }}></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {showCamera && guruId && (
        <CameraFotoGuru
          guru={{ id: guruId, nama_lengkap: profil?.nama_lengkap }}
          tanggal={hariIni}
          onSaved={handleFotoTersimpan}
          onClose={() => setShowCamera(false)}
        />
      )}
    </Layout>
  )
}

// ============================================================
// Halaman Presensi umum (admin): kelola presensi siswa per kelas
// dan presensi guru untuk semua guru. Tidak berubah dari sebelumnya.
// ============================================================
function PresensiAdmin() {
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

// ============================================================
// Entry point: pilih tampilan berdasarkan peran yang login.
// admin -> tampilan umum (semua siswa/guru, bisa pilih tanggal & kelas)
// guru  -> tampilan pribadi (presensi diri sendiri + presensi siswa
//          kelas yang diampu sebagai wali kelas, kalau ada)
// ============================================================
export default function Presensi() {
  const { profil, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <Layout title="Presensi" subtitle="Catat kehadiran siswa dan guru harian">
        <div className="card p-6 text-center text-ink-700/50">Memuat...</div>
      </Layout>
    )
  }

  return isAdmin ? <PresensiAdmin /> : <PresensiPribadi profil={profil} />
}
