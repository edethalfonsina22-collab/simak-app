export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const {
      jenis, // 'sertifikat' | 'penghargaan'
      penerimaTipe, // 'guru' | 'siswa'
      namaPenerima,
      acaraPrestasi, // nama kegiatan (sertifikat) atau prestasi/alasan (penghargaan)
      penyelenggara,
      catatanTambahan,
    } = req.body || {}

    if (!jenis || !penerimaTipe || !namaPenerima || !acaraPrestasi) {
      return res.status(400).json({
        error: 'Jenis, penerima, nama penerima, dan acara/prestasi wajib diisi',
      })
    }

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel Environment Variables.' })
    }

    const labelJenis = jenis === 'sertifikat' ? 'Sertifikat' : 'Piagam Penghargaan'
    const labelPenerima = penerimaTipe === 'guru' ? 'guru' : 'siswa'

    const prompt = `Anda adalah asisten yang ahli menyusun kalimat resmi untuk ${labelJenis.toLowerCase()}
sekolah di Indonesia.

Data:
- Jenis dokumen: ${labelJenis}
- Diberikan kepada (${labelPenerima}): ${namaPenerima}
- ${jenis === 'sertifikat' ? 'Nama kegiatan/acara' : 'Prestasi/alasan penghargaan'}: ${acaraPrestasi}
- Penyelenggara: ${penyelenggara || '-'}
- Catatan tambahan dari pembuat: ${catatanTambahan || '-'}

Tugas Anda: tuliskan HANYA kalimat inti isi ${labelJenis.toLowerCase()} yang akan dicetak besar di
tengah dokumen, dalam 1-2 kalimat formal berbahasa Indonesia, dimulai dengan kata "atas" atau
"sebagai" (contoh gaya: "atas partisipasi aktif dan dedikasinya dalam kegiatan ${acaraPrestasi}"
atau "sebagai Juara 1 dalam ${acaraPrestasi}").

ATURAN FORMAT:
- Jawab HANYA dengan kalimat itu saja, tanpa basa-basi, tanpa penjelasan tambahan, tanpa tanda
  kutip, tanpa markdown apa pun (tanpa **tebal**, tanpa #).
- Satu paragraf pendek saja (maksimal 2 kalimat).
- Gunakan bahasa Indonesia formal yang lazim dipakai di sertifikat/piagam sekolah.`

    const model = 'gemini-3.5-flash'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        }),
      }
    )
    const data = await response.json()
    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Gagal merespons dari Gemini API.',
      })
    }
    const hasil =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Gagal menghasilkan teks.'
    return res.status(200).json({ result: hasil })
  } catch (error) {
    return res.status(500).json({ error: 'Server Error: ' + error.message })
  }
}
