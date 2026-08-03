export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { mataPelajaran, kelas, materi, alokasiWaktu } = req.body

  if (!mataPelajaran || !materi) {
    return res.status(400).json({ error: 'Mata pelajaran dan materi wajib diisi' })
  }

  const prompt = `Anda adalah asisten ahli kurikulum pendidikan Indonesia. 
Buatkan draf RPP (Rencana Pelaksanaan Pembelajaran) ringkas dan terstruktur berdasarkan data berikut:
- Mata Pelajaran: ${mataPelajaran}
- Kelas/Semester: ${kelas || 'Sesuai'}
- Materi Pokok: ${materi}
- Alokasi Waktu: ${alokasiWaktu || '2 x 45 Menit'}

Format RPP yang dihasilkan harus mencakup:
1. Tujuan Pembelajaran
2. Langkah-Langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
3. Metode & Media Pembelajaran
4. Penilaian / Asesmen`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
      }),
    })

    const data = await response.json()
    const hasilRPP = data.choices[0]?.message?.content || 'Gagal menghasilkan RPP.'

    return res.status(200).json({ result: hasilRPP })
  } catch (error) {
    return res.status(500).json({ error: 'Gagal menghubungkan ke layanan AI: ' + error.message })
  }
}
