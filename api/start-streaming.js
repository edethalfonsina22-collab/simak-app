import { EgressClient, EncodedFileType } from 'livekit-server-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { roomName, rtmpUrl } = req.body

  if (!roomName || !rtmpUrl) {
    return res.status(400).json({ error: 'roomName dan rtmpUrl wajib diisi' })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitHost = process.env.VITE_LIVEKIT_URL?.replace('wss://', 'https://')

  if (!apiKey || !apiSecret || !livekitHost) {
    return res.status(500).json({ error: 'LiveKit belum dikonfigurasi di server' })
  }

  try {
    const egressClient = new EgressClient(livekitHost, apiKey, apiSecret)

    // RoomCompositeEgress menggabungkan semua peserta jadi satu tampilan video,
    // lalu mengirimkannya ke tujuan RTMP (Facebook/YouTube/Twitch/dll)
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      {
        stream: {
          urls: [rtmpUrl],
        },
      },
      {
        layout: 'grid', // tampilan video: grid semua peserta
      }
    )

    return res.status(200).json({
      egressId: egressInfo.egressId,
      status: egressInfo.status,
    })
  } catch (err) {
    console.error('Gagal memulai egress:', err)
    return res.status(500).json({ error: err.message || 'Gagal memulai streaming' })
  }
}
