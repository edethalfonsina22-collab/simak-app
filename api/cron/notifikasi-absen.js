import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function kirimWA(target, pesan) {
  const res = await fetch('https://api.fonnte.com/send', {
    method: 'POST',
    headers: {
      Authorization: process.env.FONNTE_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target, message: pesan }),
  })
  const hasil = await res.json()
  console.log('Fonnte response untuk target', target, ':', JSON.stringify(hasil))
  return hasil
}

export default async function handler(req, res) {
  // Lindungi endpoint ini supaya tidak bisa dipicu sembarang orang dari luar
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const hariIni = new Date().toISOString().slice(0, 10)

    // Ambil semua guru aktif
    const { data: semuaGuru, error: guruError } = await supabase
      .from('guru')
      .select('id, nama_lengkap, no_hp')
      .eq('status', 'aktif')

    if (guruError) throw guruError

    // Ambil guru yang SUDAH presensi hari ini
    const { data: sudahAbsen, error: presensiError } = await supabase
      .from('presensi_guru')
      .select('guru_id')
      .eq('tanggal', hariIni)

    if (presensiError) throw presensiError

    const idSudahAbsen = new Set((sudahAbsen || []).map((p) => p.guru_id))
    const belumAbsen = semuaGuru.filter((g) => !idSudahAbsen.has(g.id))

    if (belumAbsen.length === 0) {
      return res.status(200).json({ message: 'Semua guru sudah presensi hari ini.' })
    }

    const daftarNama = belumAbsen.map((g) => `- ${g.nama_lengkap}`).join('\n')
    const pesanGrup = `*Pengingat Presensi Guru*\nTanggal: ${hariIni}\n\nBerikut guru yang belum mengisi presensi hari ini:\n${daftarNama}\n\nMohon segera diisi melalui aplikasi SIMAK.`

    // 1. Kirim ke grup WA guru
    const hasilGrup = await kirimWA(process.env.FONNTE_GROUP_ID, pesanGrup)

    // 2. Kirim personal ke masing-masing guru yang belum absen
    const hasilPersonal = []
    for (const guru of belumAbsen) {
      if (!guru.no_hp) continue
      const pesanPersonal = `Halo ${guru.nama_lengkap}, Anda belum mengisi presensi hari ini (${hariIni}). Mohon segera diisi melalui aplikasi SIMAK. Terima kasih.`
      const hasil = await kirimWA(guru.no_hp, pesanPersonal)
      hasilPersonal.push({ nama: guru.nama_lengkap, hasil })
    }

    return res.status(200).json({
      total_belum_absen: belumAbsen.length,
      hasil_kirim_grup: hasilGrup,
      hasil_kirim_personal: hasilPersonal,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: err.message })
  }
}
