/**
 * api/ai-scan-kk.js
 * Endpoint khusus untuk membaca foto Kartu Keluarga (KK) dan mengembalikan
 * data terstruktur (Nomor KK, Alamat, daftar anggota keluarga) dalam JSON —
 * dipakai oleh fitur "Isi Otomatis dari Foto Kartu Keluarga" di form PPDB.
 *
 * Beda dengan api/ai-scan.js (yang mengembalikan teks polos untuk fitur
 * Scan Dokumen umum), endpoint ini secara khusus meminta Gemini membaca
 * KK dan langsung mengembalikan field-field yang relevan untuk formulir.
 *
 * Env var yang dibutuhkan: GEMINI_API_KEY
 */

import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
}

const PROMPT_KK = `Kamu membaca foto/scan dokumen Kartu Keluarga (KK) Indonesia.
Ekstrak informasi berikut dan balas HANYA dengan JSON valid (tanpa markdown, tanpa kalimat pembuka/penutup), dengan struktur persis seperti ini:

{
  "nomor_kk": "16 digit nomor KK, atau string kosong jika tidak terbaca",
  "alamat": "alamat lengkap sesuai KK (jalan/dusun, tanpa RT/RW/kode pos), atau string kosong jika tidak terbaca",
  "anggota": [
    { "nama": "nama lengkap sesuai KK", "nik": "16 digit NIK", "status_hubungan": "Kepala Keluarga / Istri / Anak / dll sesuai KK" }
  ]
}

Aturan:
- Baca SEMUA anggota keluarga yang tercantum di tabel KK, jangan hanya satu.
- NIK dan Nomor KK harus persis 16 digit angka. Jika suatu digit tidak jelas terbaca, JANGAN menebak — lebih baik kosongkan field nomor_kk untuk baris itu daripada salah.
- Jangan menerjemahkan atau mengubah ejaan nama.
- Jika dokumen yang difoto BUKAN Kartu Keluarga, balas dengan JSON: {"nomor_kk": "", "alamat": "", "anggota": [], "peringatan": "Dokumen tidak terdeteksi sebagai Kartu Keluarga"}`

const MODEL_CANDIDATES = ['gemini-3.7-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash']

async function scanKKWithFallback(image, mimeType) {
  let lastErr
  for (const modelName of MODEL_CANDIDATES) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
    })
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await model.generateContent([
          { inlineData: { data: image, mimeType } },
          { text: PROMPT_KK },
        ])
        return result.response.text()
      } catch (err) {
        lastErr = err
        const isOverloaded = err?.status === 503 || /high demand|overloaded/i.test(err?.message || '')
        if (!isOverloaded) throw err
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan.' })
  }

  try {
    const { image, mimeType } = req.body
    if (!image || !mimeType) {
      return res.status(400).json({ error: 'Gambar tidak ditemukan.' })
    }

    const rawJson = await scanKKWithFallback(image, mimeType)

    let parsed
    try {
      parsed = JSON.parse(rawJson)
    } catch {
      console.error('AI Scan KK: respons bukan JSON valid:', rawJson)
      return res.status(502).json({ error: 'AI tidak mengembalikan data yang bisa dibaca. Coba lagi atau gunakan OCR Cepat.' })
    }

    // Validasi ringan supaya field selalu ada bentuknya, walau kosong
    const nomorKK = typeof parsed.nomor_kk === 'string' ? parsed.nomor_kk.replace(/\D/g, '').slice(0, 16) : ''
    const alamat = typeof parsed.alamat === 'string' ? parsed.alamat.trim() : ''
    const anggota = Array.isArray(parsed.anggota)
      ? parsed.anggota
          .filter((a) => a && typeof a.nama === 'string')
          .map((a) => ({
            nama: a.nama.trim(),
            nik: typeof a.nik === 'string' ? a.nik.replace(/\D/g, '').slice(0, 16) : '',
            status_hubungan: typeof a.status_hubungan === 'string' ? a.status_hubungan.trim() : '',
          }))
      : []

    return res.status(200).json({ nomor_kk: nomorKK, alamat, anggota, peringatan: parsed.peringatan || null })
  } catch (err) {
    console.error('AI Scan KK error:', err)
    const isOverloaded = err?.status === 503 || /high demand|overloaded/i.test(err?.message || '')
    return res.status(isOverloaded ? 503 : 500).json({
      error: isOverloaded
        ? 'Server Gemini sedang sibuk. Coba lagi dalam beberapa saat.'
        : 'Gagal memproses gambar dengan AI.',
    })
  }
}
