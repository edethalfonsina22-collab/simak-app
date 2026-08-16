export default async function handler(req, res) {
  // Atur header CORS dan JSON
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { mataPelajaran, kelas, materi, sertakanLampiran = true } = req.body || {}
    if (!mataPelajaran || !materi) {
      return res.status(400).json({ error: 'Mata pelajaran dan materi wajib diisi' })
    }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel Environment Variables.' })
    }

    const promptRppInti = `Anda adalah asisten ahli kurikulum pendidikan Indonesia. 
Buatkan draf RPP (Rencana Pelaksanaan Pembelajaran) ringkas dan terstruktur berdasarkan data berikut:
- Mata Pelajaran: ${mataPelajaran}
- Kelas/Semester: ${kelas || 'Sesuai'}
- Materi Pokok: ${materi}

PENTING — ATURAN FORMAT (berlaku untuk SELURUH jawaban, bukan hanya judul bagian):
- Tulis semuanya dalam teks polos (plain text) saja.
- JANGAN gunakan markdown dalam bentuk apa pun: tanpa tanda bintang untuk tebal (**teks**),
  tanpa tanda pagar untuk judul (#), tanpa tanda garis miring untuk miring (_teks_).
- Untuk memberi penekanan pada suatu istilah, gunakan kalimat biasa saja, jangan diberi
  format khusus.
- Setiap baris judul bagian, sub-bagian, maupun poin bernomor ditulis apa adanya tanpa
  simbol markdown apa pun di depan atau belakangnya.

Format RPP yang dihasilkan harus mencakup PERSIS 4 bagian berikut, masing-masing diawali baris bernomor
seperti contoh ini (jangan ubah judul bagiannya, jangan pakai tanda bintang/markdown lain):
1. Tujuan Pembelajaran
2. Langkah-Langkah Pembelajaran (Pendahuluan, Kegiatan Inti, Penutup)
3. Metode & Media Pembelajaran
4. Penilaian / Asesmen`

    const promptLampiran = `

Setelah 4 bagian RPP di atas, lanjutkan dengan LAMPIRAN berikut. Setiap lampiran WAJIB diawali baris
PERSIS seperti contoh di bawah (huruf besar semua di kata "LAMPIRAN", tanpa tanda bintang/markdown lain,
tanpa nomor tambahan di depannya):

LAMPIRAN A: LKPD (LEMBAR KERJA PESERTA DIDIK)
Isi: identitas siswa (Nama/Kelas/Kelompok), petunjuk pengerjaan, dan 3-5 soal/aktivitas latihan
untuk siswa terkait materi "${materi}", diberi nomor (1., 2., dst).

LAMPIRAN B: INSTRUMEN PENILAIAN / RUBRIK PENSKORAN
Isi: rubrik penilaian sikap/keterampilan/pengetahuan yang relevan, jelaskan tiap kriteria dan
rentang skornya dalam bentuk poin per baris (gunakan tanda "-" di depan tiap poin).

LAMPIRAN C: BAHAN AJAR / RANGKUMAN MATERI
Isi: rangkuman materi "${materi}" yang ringkas dan mudah dipahami siswa, dalam beberapa paragraf.

LAMPIRAN D: KISI-KISI & SOAL EVALUASI
Isi: tabel kisi-kisi sederhana (Indikator Soal - Level Kognitif - Bentuk Soal) ditulis per poin dengan
tanda "-", diikuti 5 soal evaluasi bernomor (1., 2., dst) beserta kunci jawaban singkat di setiap akhir soal.

INGAT: seluruh isi lampiran di atas juga harus teks polos, tanpa markdown apa pun (tanpa **tebal**,
tanpa #, tanpa _miring_), sama seperti aturan format di bagian RPP inti.`

    const prompt = sertakanLampiran ? promptRppInti + promptLampiran : promptRppInti

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
    const hasilRPP =
      data.candidates?.[0]?.content?.parts?.[0]?.text || 'Gagal menghasilkan RPP.'
    return res.status(200).json({ result: hasilRPP })
  } catch (error) {
    return res.status(500).json({ error: 'Server Error: ' + error.message })
  }
}
