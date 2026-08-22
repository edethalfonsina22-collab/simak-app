import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { Radio, Square } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'

export default function RapatVideo() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)
  // BARU: pesan error khusus kegagalan koneksi LiveKit (bukan gagal ambil
  // token) — sebelumnya kegagalan ini "tertelan" oleh onDisconnected yang
  // langsung navigate('/') tanpa pesan apapun, sehingga user cuma lihat
  // halaman berkedip lalu balik ke dashboard.
  const [connError, setConnError] = useState(null)

  // State untuk live streaming
  const [showStreamForm, setShowStreamForm] = useState(false)
  const [rtmpUrl, setRtmpUrl] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [egressId, setEgressId] = useState(null)
  const [streamError, setStreamError] = useState(null)
  const [streamLoading, setStreamLoading] = useState(false)

  useEffect(() => {
    const fetchToken = async () => {
      if (!session?.user) {
        setError('Anda harus login dulu')
        return
      }
      try {
        const res = await fetch('/api/livekit-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomName: roomId,
            participantName: session.user.email || session.user.id,
          }),
        })
        if (!res.ok) {
          throw new Error('Gagal mengambil token')
        }
        const data = await res.json()
        setToken(data.token)
      } catch (err) {
        setError(err.message || 'Terjadi kesalahan saat menghubungkan')
      }
    }
    fetchToken()
  }, [roomId, session])

  async function mulaiStreaming(e) {
    e.preventDefault()
    if (!rtmpUrl.trim()) return

    setStreamLoading(true)
    setStreamError(null)

    try {
      const res = await fetch('/api/start-streaming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomId, rtmpUrl: rtmpUrl.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Gagal memulai streaming')
      }

      setEgressId(data.egressId)
      setStreaming(true)
      setShowStreamForm(false)
    } catch (err) {
      setStreamError(err.message)
    } finally {
      setStreamLoading(false)
    }
  }

  async function hentikanStreaming() {
    if (!egressId) return
    setStreamLoading(true)

    try {
      await fetch('/api/stop-streaming', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ egressId }),
      })
    } catch (err) {
      console.error('Gagal menghentikan streaming:', err)
    } finally {
      setStreaming(false)
      setEgressId(null)
      setRtmpUrl('')
      setStreamLoading(false)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper gap-4">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Kembali ke Dashboard
        </button>
      </div>
    )
  }

  // BARU: tampilkan pesan error koneksi LiveKit alih-alih auto-redirect diam-diam.
  if (connError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-paper gap-4">
        <p className="text-red-500 text-center max-w-md px-4">
          Gagal terhubung ke server rapat: {connError}
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
        >
          Kembali ke Dashboard
        </button>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p>Menghubungkan ke rapat...</p>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      {/* Panel kontrol live streaming, mengambang di atas video */}
      <div className="absolute top-3 right-3 z-50 flex flex-col items-end gap-2">
        {streaming ? (
          <button
            onClick={hentikanStreaming}
            disabled={streamLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-60 shadow-lg"
          >
            <Square className="w-4 h-4" />
            {streamLoading ? 'Menghentikan...' : 'Hentikan Live'}
          </button>
        ) : (
          <button
            onClick={() => setShowStreamForm((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-gray-800 text-sm font-medium hover:bg-gray-100 shadow-lg"
          >
            <Radio className="w-4 h-4 text-red-600" />
            Live Streaming
          </button>
        )}

        {showStreamForm && !streaming && (
          <form
            onSubmit={mulaiStreaming}
            className="bg-white rounded-lg shadow-xl p-3 w-80 flex flex-col gap-2"
          >
            <label className="text-xs font-medium text-gray-600">
              RTMP URL + Stream Key (Facebook/YouTube)
            </label>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder="rtmp://a.rtmp.youtube.com/live2/xxxx-xxxx-xxxx"
              className="px-2 py-1.5 rounded border border-gray-300 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {streamError && (
              <p className="text-xs text-red-500">{streamError}</p>
            )}
            <button
              type="submit"
              disabled={streamLoading}
              className="px-3 py-1.5 rounded bg-red-600 text-white text-xs font-medium hover:bg-red-700 disabled:opacity-60"
            >
              {streamLoading ? 'Memulai...' : 'Mulai Live Sekarang'}
            </button>
          </form>
        )}
      </div>

      <LiveKitRoom
        video={true}
        audio={true}
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL}
        data-lk-theme="default"
        style={{ height: '100vh' }}
        onDisconnected={() => navigate('/')}
        onError={(err) => {
          // BARU: kalau LiveKitRoom gagal connect (server URL salah, token
          // tidak valid, dsb), sebelumnya ini langsung memicu onDisconnected
          // dan navigate('/') tanpa pesan apapun. Sekarang errornya ditangkap
          // dan ditampilkan lewat connError, supaya penyebab aslinya kelihatan.
          console.error('LiveKit connection error:', err)
          setConnError(err?.message || String(err))
        }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}
