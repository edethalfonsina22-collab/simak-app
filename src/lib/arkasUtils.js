import { supabase } from './supabaseClient'

// Ambil daftar item ARKAS (is_item = true) lengkap dengan realisasi & sisa anggaran.
// Realisasi dihitung dari total transaksi berjenis "keluar" di tabel `keuangan`
// yang sudah dikaitkan ke item tsb lewat kolom `keuangan.arkas_item_id`.
//
// Dipakai bersama oleh halaman AnggaranArkas.jsx (rekap) dan Keuangan.jsx
// (dropdown pilih item saat tambah transaksi), supaya perhitungan sisa
// anggaran selalu konsisten di kedua tempat.
export async function loadArkasItemsDenganSisa() {
  const { data: arkasRows, error: errArkas } = await supabase
    .from('arkas_anggaran')
    .select('id, kode_rekening, item_no, uraian, jumlah, kode_kegiatan, status')
    .eq('is_item', true)
    .order('kode_rekening', { ascending: true })

  if (errArkas) throw errArkas

  const { data: realisasiRows, error: errReal } = await supabase
    .from('keuangan')
    .select('arkas_item_id, jumlah')
    .eq('jenis', 'keluar')
    .not('arkas_item_id', 'is', null)

  if (errReal) throw errReal

  const petaRealisasi = {}
  ;(realisasiRows || []).forEach((r) => {
    petaRealisasi[r.arkas_item_id] = (petaRealisasi[r.arkas_item_id] || 0) + Number(r.jumlah || 0)
  })

  return (arkasRows || []).map((it) => {
    const realisasi = petaRealisasi[it.id] || 0
    const anggaran = Number(it.jumlah || 0)
    return {
      ...it,
      realisasi,
      sisa: anggaran - realisasi,
      persen: anggaran > 0 ? Math.min(100, Math.round((realisasi / anggaran) * 100)) : 0,
    }
  })
}

export function formatRupiahArkas(angka) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(angka || 0)
}
