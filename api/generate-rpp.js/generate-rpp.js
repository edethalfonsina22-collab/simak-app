export default async function handler(req, res) {
  // Atur header CORS dan JSON
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { mataPelajaran, kelas, materi } = req.body || {}

    if (!mataPelajaran || !materi) {
      return res.status(400).json({ error: 'Mata pelajaran dan materi wajib diisi' })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY belum dikonfigurasi di Vercel Environment Variables.' })
    }

    const prompt = `Anda adalah asisten ahli kurikulum pendidikan Indonesia. 
Buatkan draf RPP (Rencana Pelaksanaan Pembelajaran) ringkas dan terstruktur berdasarkan data berikut:
- Mata Pelajaran: ${mataPelajaran}
- Kelas/Semester: ${kelas || 'Sesuai'}
- Materi Pokok: ${materi}

Format RPP yang dihasilkan harus mencakup:
1. Tujuan Pembelajaran
2. Langkah-Langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
3. Metode & Media Pembelajaran
4. Penilaian / Asesmen`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Gagal merespons dari OpenAI API.',
      })
    }

    const hasilRPP = data.choices?.[0]?.message?.content || 'Gagal menghasilkan RPP.'
    return res.status(200).json({ result: hasilRPP })
  } catch (error) {
    return res.status(500).json({ error: 'Server Error: ' + error.message })
  }
}
