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
  const authHeader = req.headers['authorization']
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const now = new Date()
    const hariIni = now.toISOString().slice(0, 10)

    // 1. Skip kalau hari Minggu (jaga-jaga, walau schedule cron sudah dibatasi Senin-Sabtu)
    if (now.getDay() === 0) {
      return res.status(200).json({ message: 'Hari Minggu, notifikasi presensi dilewati.' })
    }

    // 2. Skip kalau tanggal ini terdaftar di tabel hari_libur
    const { data: libur, error: liburError } = await supabase
      .from('hari_libur')
      .select('tanggal, keterangan')
      .eq('tanggal', hariIni)
      .maybeSingle()

    if (liburError) throw liburError

    if (libur) {
      return res.status(200).json({
        message: `Hari ini tanggal merah (${libur.keterangan}), notifikasi presensi dilewati.`,
      })
    }

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

    const hasilGrup = await kirimWA(process.env.FONNTE_GROUP_ID, pesanGrup)

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
