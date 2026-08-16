import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { useAuth } from '../lib/AuthContext'

export default function RapatVideo() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [token, setToken] = useState(null)
  const [error, setError] = useState(null)

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

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <p>Menghubungkan ke rapat...</p>
      </div>
    )
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={import.meta.env.VITE_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: '100vh' }}
      onDisconnected={() => navigate('/')}
    >
      <VideoConference />
    </LiveKitRoom>
  )
}
