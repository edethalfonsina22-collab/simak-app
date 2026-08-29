/**
 * api/ai-scan.js
 * Versi Gemini — pakai GEMINI_API_KEY yang sudah ada di environment variables,
 * jadi tidak perlu bikin akun/API key baru.
 *
 * Format: Next.js Pages Router (sama seperti generate-rpp.js, livekit-token.js, dll di repo ini)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const BAHASA_LABEL = {
  ind: 'Bahasa Indonesia',
  eng: 'Bahasa Inggris',
  'ind+eng': 'campuran Bahasa Indonesia dan Inggris',
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // gambar base64 bisa cukup besar
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan.' })
  }

  try {
    const { image, mimeType, bahasa } = req.body

    if (!image || !mimeType) {
      return res.status(400).json({ error: 'Gambar tidak ditemukan.' })
    }

    const labelBahasa = BAHASA_LABEL[bahasa] || 'bahasa aslinya'

    const model = genAI.getGenerativeModel({ model: 'gemini-3.7-flash' })

    const prompt = `Baca semua teks yang ada pada gambar dokumen ini dan tuliskan ulang persis apa adanya (dalam ${labelBahasa}), tanpa menerjemahkan, tanpa menambahkan komentar, tanpa markdown. Pertahankan urutan baris dan struktur paragraf semirip mungkin dengan aslinya. Jika ada tabel, susun sebagai teks rata dengan pemisah spasi/tab. Jika sebagian tulisan tidak terbaca, tulis [tidak terbaca] di bagian itu. Balas HANYA dengan teks hasil bacaan, tidak ada kalimat pembuka atau penutup.`

    const result = await model.generateContent([
      {
        inlineData: {
          data: image, // base64 tanpa prefix "data:...;base64,"
          mimeType,
        },
      },
      { text: prompt },
    ])

    const text = result.response.text()

    if (!text) {
      return res.status(502).json({ error: 'Gemini tidak mengembalikan teks.' })
    }

    return res.status(200).json({ text })
  } catch (err) {
    console.error('AI Scan (Gemini) error:', err)
    return res.status(500).json({ error: 'Gagal memproses gambar dengan AI.' })
  }
}
