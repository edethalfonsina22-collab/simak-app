import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

// Semua field TEKS pada form Kuitansi yang ingin dibuatkan rekomendasi/dropdown.
// (jumlah & tanggal sengaja tidak diikutkan — angka/tanggal beda tiap transaksi,
// tidak berguna diulang sebagai saran.)
export const FIELD_SARAN = [
  'no_bukti',
  'lembar',
  'mata_anggaran',
  'tahun_anggaran',
  'diterima_dari',
  'untuk_pembayaran',
  'disetujui_oleh',
  'jabatan_disetujui',
  'nip_disetujui',
  'dibayar_oleh',
  'jabatan_dibayar',
  'nip_dibayar',
  'nama_penerima',
  'alamat_penerima',
]

const MAKS_SARAN_PER_FIELD = 25
const BATAS_RIWAYAT = 500

/**
 * Rekomendasi isian form Kuitansi, digabung dari dua sumber:
 *   1. Riwayat kuitansi yang pernah dibuat (tabel `kuitansi`) — jadi field
 *      seperti "Mata Anggaran" atau "Untuk Pembayaran" yang sering dipakai
 *      ulang otomatis muncul sebagai saran, diurutkan dari yang paling sering
 *      dipakai.
 *   2. Daftar guru/pegawai (tabel `guru`, kolom `nama` & `nip`) — dipakai
 *      untuk menyarankan nama pada field "Disetujui Oleh", "Dibayar Oleh",
 *      dan "Yang Menerima", sekaligus untuk auto-isi NIP saat nama guru dipilih.
 *
 * CATATAN: kalau tabel `guru` tidak ada atau nama kolomnya berbeda dari
 * `nama`/`nip` di project Anda, bagian ini otomatis dilewati (try/catch) —
 * saran dari riwayat kuitansi tetap berjalan normal. Sesuaikan nama
 * tabel/kolom di bagian bawah kalau perlu.
 */
export function useSaranFormKuitansi() {
  const [saran, setSaran] = useState(() =>
    Object.fromEntries(FIELD_SARAN.map((f) => [f, []]))
  )
  const [namaKeNip, setNamaKeNip] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let batal = false

    async function muat() {
      const hitung = Object.fromEntries(FIELD_SARAN.map((f) => [f, new Map()]))
      const petaNip = {}

      function catat(field, value) {
        const v = String(value ?? '').trim()
        if (!v) return
        const m = hitung[field]
        m.set(v, (m.get(v) || 0) + 1)
      }

      // --- 1) Riwayat dari tabel kuitansi ---
      const { data: riwayat, error: errRiwayat } = await supabase
        .from('kuitansi')
        .select(FIELD_SARAN.join(','))
        .order('id', { ascending: false })
        .limit(BATAS_RIWAYAT)

      if (!errRiwayat && riwayat) {
        for (const row of riwayat) {
          for (const field of FIELD_SARAN) catat(field, row[field])
          if (row.disetujui_oleh && row.nip_disetujui) {
            petaNip[String(row.disetujui_oleh).trim()] = String(row.nip_disetujui).trim()
          }
          if (row.dibayar_oleh && row.nip_dibayar) {
            petaNip[String(row.dibayar_oleh).trim()] = String(row.nip_dibayar).trim()
          }
        }
      }

      // --- 2) Daftar guru/pegawai (opsional) ---
      try {
        const { data: guru, error: errGuru } = await supabase
          .from('guru')
          .select('nama, nip')
        if (!errGuru && guru) {
          for (const g of guru) {
            if (!g?.nama) continue
            catat('disetujui_oleh', g.nama)
            catat('dibayar_oleh', g.nama)
            catat('nama_penerima', g.nama)
            if (g.nip) {
              catat('nip_disetujui', g.nip)
              catat('nip_dibayar', g.nip)
              petaNip[String(g.nama).trim()] = String(g.nip).trim()
            }
          }
        }
      } catch {
        // Tabel `guru` tidak tersedia / struktur kolom beda — abaikan.
      }

      if (batal) return

      const hasil = {}
      for (const field of FIELD_SARAN) {
        hasil[field] = [...hitung[field].entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([v]) => v)
          .slice(0, MAKS_SARAN_PER_FIELD)
      }
      setSaran(hasil)
      setNamaKeNip(petaNip)
      setLoading(false)
    }

    muat()
    return () => {
      batal = true
    }
  }, [])

  return { saran, namaKeNip, loading }
}
