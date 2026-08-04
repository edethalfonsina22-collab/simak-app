// src/lib/daftarHadirUtils.js
// Helper untuk membangun tabel Daftar Hadir bulanan (format kertas absensi resmi)

export function jumlahHariDalamBulan(tahun, bulan) {
  // bulan: 1-12
  return new Date(tahun, bulan, 0).getDate()
}

export function apakahHariMinggu(tahun, bulan, tanggal) {
  const d = new Date(tahun, bulan - 1, tanggal)
  return d.getDay() === 0
}

// Ubah "mata_pelajaran" (peran guru di tabel `guru`) menjadi singkatan JABATAN
export function singkatanJabatan(mataPelajaran) {
  const teks = (mataPelajaran || '').toLowerCase()
  if (teks.includes('kepala sekolah')) return 'K.S'
  if (teks.includes('agama')) return 'G.P'
  if (teks.includes('kelas')) return 'G.K'
  return '-'
}

// Susun baris-baris guru + rekap kehadiran harian dari data mentah presensi_guru
// daftarGuru: [{ id, nip, nama_lengkap, mata_pelajaran }]
// dataPresensi: [{ guru_id, tanggal: 'YYYY-MM-DD', status: 'hadir'|'izin'|'sakit'|'alpa' }]
export function susunDaftarHadir(daftarGuru, dataPresensi, tahun, bulan) {
  const totalHari = jumlahHariDalamBulan(tahun, bulan)

  // urutan: Kepala Sekolah dulu, lalu sisanya alfabetis
  const guruTerurut = [...daftarGuru].sort((a, b) => {
    const aKS = singkatanJabatan(a.mata_pelajaran) === 'K.S'
    const bKS = singkatanJabatan(b.mata_pelajaran) === 'K.S'
    if (aKS && !bKS) return -1
    if (!aKS && bKS) return 1
    return (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')
  })

  const petaStatus = {} // { [guru_id]: { [tanggal_angka]: 'izin'|'sakit'|'alpa' } }
  for (const row of dataPresensi || []) {
    if (row.status === 'hadir') continue // hadir = sel kosong
    const tgl = Number(row.tanggal.slice(8, 10))
    if (!petaStatus[row.guru_id]) petaStatus[row.guru_id] = {}
    petaStatus[row.guru_id][tgl] = row.status
  }

  const baris = guruTerurut.map((g, idx) => {
    const statusHarian = Array.from({ length: totalHari }, (_, i) => {
      const tgl = i + 1
      return petaStatus[g.id]?.[tgl] || 'hadir'
    })
    const sakit = statusHarian.filter((s) => s === 'sakit').length
    const izin = statusHarian.filter((s) => s === 'izin').length
    const alpa = statusHarian.filter((s) => s === 'alpa').length
    return {
      no: idx + 1,
      id: g.id,
      nama: g.nama_lengkap,
      nip: g.nip || '-',
      jabatan: singkatanJabatan(g.mata_pelajaran),
      statusHarian, // index 0 = tanggal 1
      sakit,
      izin,
      tanpaKeterangan: alpa,
      jumlahTidakHadir: sakit + izin + alpa,
    }
  })

  return { baris, totalHari }
}

// Kode singkat yang tampil di dalam sel tanggal
export function kodeSel(status) {
  if (status === 'sakit') return 'S'
  if (status === 'izin') return 'I'
  if (status === 'alpa') return 'A'
  return '' // hadir -> kosong
}
