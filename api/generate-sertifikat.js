function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Coba parse "Please retry in 27.8s" dari pesan error Gemini, kalau ada.
// Kalau tidak ketemu, pakai fallback delay dari argumen.
function parseRetryDelayMs(message, fallbackMs) {
  const match = /retry in (\d+(\.\d+)?)s/i.exec(message || '')
  if (match) {
    return Math.min(Math.ceil(parseFloat(match[1]) * 1000), 15000) // cap 15 detik biar request tidak menggantung lama
  }
  return fallbackMs
}

// Panggil Gemini API dengan retry otomatis khusus untuk 429 (rate limit/quota).
// Error lain (400, 401, 500, dst.) langsung dilempar tanpa retry.
async function callGeminiWithRetry(url, body, maxRetries = 2) {
  let lastData = null
  let lastStatus = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await response.json()

    if (response.ok) {
      return { ok: true, data }
    }

    lastData = data
    lastStatus = response.status

    const isRateLimited = response.status === 429
    const isLastAttempt = attempt === maxRetries
    if (!isRateLimited || isLastAttempt) {
      return { ok: false, status: response.status, data }
    }

    const delayMs = parseRetryDelayMs(data?.error?.message, 2000 * (attempt + 1))
    await sleep(delayMs)
  }

  return { ok: false, status: lastStatus, data: lastData }
}

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
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const result = await callGeminiWithRetry(url, {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7 },
    })

    if (!result.ok) {
      // Kuota/rate-limit habis walau sudah di-retry beberapa kali — kasih
      // pesan yang jelas untuk pengguna, bukan pesan teknis mentah dari Google.
      if (result.status === 429) {
        return res.status(429).json({
          error: 'Server AI sedang sibuk (kuota Gemini API tercapai). Coba lagi dalam beberapa saat, atau hubungi admin untuk menaikkan kuota.',
        })
      }
      return res.status(result.status).json({
        error: result.data?.error?.message || 'Gagal merespons dari Gemini API.',
      })
    }

    const hasil =
      result.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'Gagal menghasilkan teks.'
    return res.status(200).json({ result: hasil })
  } catch (error) {
    return res.status(500).json({ error: 'Server Error: ' + error.message })
  }
}
