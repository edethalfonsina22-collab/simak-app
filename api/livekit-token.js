import { AccessToken } from 'livekit-server-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { roomName, participantName } = req.body

  if (!roomName || !participantName) {
    return res.status(400).json({ error: 'roomName dan participantName wajib diisi' })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET

  if (!apiKey || !apiSecret) {
    return res.status(500).json({ error: 'LiveKit belum dikonfigurasi di server' })
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
  })
  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  })

  const token = await at.toJwt()

  return res.status(200).json({ token })
}
