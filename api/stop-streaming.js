import { EgressClient } from 'livekit-server-sdk'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { egressId } = req.body

  if (!egressId) {
    return res.status(400).json({ error: 'egressId wajib diisi' })
  }

  const apiKey = process.env.LIVEKIT_API_KEY
  const apiSecret = process.env.LIVEKIT_API_SECRET
  const livekitHost = process.env.VITE_LIVEKIT_URL?.replace('wss://', 'https://')

  if (!apiKey || !apiSecret || !livekitHost) {
    return res.status(500).json({ error: 'LiveKit belum dikonfigurasi di server' })
  }

  try {
    const egressClient = new EgressClient(livekitHost, apiKey, apiSecret)
    await egressClient.stopEgress(egressId)

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('Gagal menghentikan egress:', err)
    return res.status(500).json({ error: err.message || 'Gagal menghentikan streaming' })
  }
}
