// src/lib/printTemplate.js
//
// Template cetak umum yang dipakai di seluruh aplikasi (Data Siswa, Rekap
// Ijazah, Formulir 8355, dll). Kop surat, logo, dan blok tanda tangan diambil
// otomatis dari tabel `profil_sekolah` — jadi kalau data sekolah diubah di
// halaman Profil Sekolah, semua dokumen cetak ikut ter-update tanpa perlu
// ubah kode.
//
// Cara pakai singkat (lihat contoh lengkap di bagian bawah file ini):
//
//   import { ambilProfilUntukCetak, bukaCetakTabel } from '../lib/printTemplate'
//
//   const profil = await ambilProfilUntukCetak()
//   bukaCetakTabel({
//     profil,
//     judul: 'Data Siswa',
//     kolom: ['No', 'Nama', 'Kelas'],
//     baris: [[1, 'Budi', 'VII A']],
//   })

import { supabase } from './supabaseClient'

/**
 * Ambil data profil sekolah (nama, logo, alamat, kepala sekolah, dll) berikut
 * URL publik logo & tanda tangan elektronik, siap dipakai di kop surat.
 */
export async function ambilProfilUntukCetak() {
  const { data } = await supabase.from('profil_sekolah').select('*').eq('id', 1).maybeSingle()
  if (!data) return null

  let logoUrl = ''
  if (data.logo_path) {
    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(data.logo_path)
    logoUrl = pub.publicUrl
  }

  let ttdUrl = ''
  if (data.ttd_kepala_sekolah_path) {
    const { data: pub } = supabase.storage.from('profil-sekolah').getPublicUrl(data.ttd_kepala_sekolah_path)
    ttdUrl = pub.publicUrl
  }

  return { ...data, logoUrl, ttdUrl }
}

function escapeHtml(val) {
  if (val === null || val === undefined) return ''
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatTanggalIndonesia(d = new Date()) {
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatTglSingkat(tgl) {
  if (!tgl) return ''
  const d = new Date(tgl)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: '2-digit' })
}

function hitungUsia(tglLahir) {
  if (!tglLahir) return ''
  const lahir = new Date(tglLahir)
  const now = new Date()
  let usia = now.getFullYear() - lahir.getFullYear()
  const belumUlangTahun =
    now.getMonth() < lahir.getMonth() ||
    (now.getMonth() === lahir.getMonth() && now.getDate() < lahir.getDate())
  if (belumUlangTahun) usia--
  return usia
}

// Kop surat: kalau Kabupaten/Dinas Pendidikan/Kecamatan diisi di Profil
// Sekolah, susunan pemerintahan lengkap ditampilkan di atas nama sekolah
// (gaya kop surat dinas resmi). Kalau kosong, langsung nama sekolah saja.
function kopSuratHtml(profil) {
  if (!profil) {
    return `<div class="kop-peringatan">Profil sekolah belum diisi — lengkapi di menu Profil Sekolah agar kop surat tampil otomatis.</div>`
  }

  const susunanAtas = [profil.kabupaten, profil.dinas_pendidikan, profil.kecamatan]
    .filter(Boolean)
    .map((t) => `<div class="kop-line-atas">${escapeHtml(t).toUpperCase()}</div>`)
    .join('')

  const alamatParts = [
    profil.alamat,
    [profil.kelurahan_desa, profil.kecamatan].filter(Boolean).join(', '),
    [profil.kabupaten, profil.provinsi, profil.kode_pos].filter(Boolean).join(' '),
  ].filter(Boolean)

  const kontakParts = [
    profil.telepon ? `Telp. ${escapeHtml(profil.telepon)}` : '',
    profil.email ? `Email: ${escapeHtml(profil.email)}` : '',
    profil.website ? `Website: ${escapeHtml(profil.website)}` : '',
  ].filter(Boolean)

  return `
    <div class="kop-surat">
      ${profil.logoUrl ? `<img src="${profil.logoUrl}" class="kop-logo" />` : '<div class="kop-logo kop-logo-kosong"></div>'}
      <div class="kop-teks">
        ${susunanAtas}
        <div class="kop-nama-sekolah">${escapeHtml(profil.nama_sekolah || '').toUpperCase()}</div>
        ${profil.npsn ? `<div class="kop-npsn">NPSN: ${escapeHtml(profil.npsn)}${profil.akreditasi ? ` &middot; Akreditasi ${escapeHtml(profil.akreditasi)}` : ''}</div>` : ''}
        ${alamatParts.length ? `<div class="kop-alamat">${escapeHtml(alamatParts.join(', '))}</div>` : ''}
        ${kontakParts.length ? `<div class="kop-kontak">${kontakParts.join(' &middot; ')}</div>` : ''}
      </div>
    </div>
    <div class="kop-garis-ganda"></div>
  `
}

// Blok tanda tangan kanan-bawah: tempat + tanggal, jabatan, ruang tanda
// tangan (otomatis tempel gambar TTD elektronik kepala sekolah kalau ada),
// nama bergaris bawah, dan NIP.
function blokTandaTanganHtml(profil, { jabatan = 'Kepala Sekolah', nama, nip, tempat, tanggal } = {}) {
  const tempatFinal = tempat || profil?.tempat_ttd || ''
  const tanggalFinal = tanggal ||
