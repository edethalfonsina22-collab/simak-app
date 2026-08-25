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

function blokTandaTanganHtml(profil, { jabatan = 'Kepala Sekolah', nama, nip, tempat, tanggal } = {}) {
  const tempatFinal = tempat || profil?.tempat_ttd || ''
  const tanggalFinal = tanggal || formatTanggalIndonesia()
  const namaFinal = nama ?? (jabatan === 'Pengawas Sekolah' ? profil?.pengawas : profil?.kepala_sekolah) ?? ''
  const nipFinal = nip ?? (jabatan === 'Pengawas Sekolah' ? profil?.nip_pengawas : profil?.nip_kepala_sekolah) ?? ''
  const tampilkanTtdGambar = profil?.ttdUrl && jabatan === 'Kepala Sekolah'

  return `
    <div class="ttd-blok">
      <div class="ttd-tempat-tanggal">${escapeHtml([tempatFinal, tanggalFinal].filter(Boolean).join(', '))}</div>
      <div class="ttd-jabatan">${escapeHtml(jabatan)},</div>
      <div class="ttd-ruang">
        ${tampilkanTtdGambar ? `<img src="${profil.ttdUrl}" class="ttd-gambar" />` : ''}
      </div>
      <div class="ttd-nama"><u>${escapeHtml(namaFinal || '.........................................')}</u></div>
      ${nipFinal ? `<div class="ttd-nip">NIP. ${escapeHtml(nipFinal)}</div>` : '<div class="ttd-nip">&nbsp;</div>'}
    </div>
  `
}

const CSS_DASAR = `
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; padding: 20mm 18mm; color: #111; font-size: 12pt; line-height: 1.4; }
  .kop-peringatan { border: 1px dashed #c00; color: #c00; padding: 8px 12px; font-size: 10.5pt; margin-bottom: 16px; font-family: Arial, sans-serif; }
  .kop-surat { display: flex; align-items: center; gap: 16px; }
  .kop-logo { width: 70px; height: 70px; object-fit: contain; flex-shrink: 0; }
  .kop-logo-kosong { visibility: hidden; }
  .kop-teks { flex: 1; text-align: center; }
  .kop-line-atas { font-weight: bold; font-size: 12pt; letter-spacing: 0.3px; }
  .kop-nama-sekolah { font-weight: bold; font-size: 16pt; letter-spacing: 0.5px; margin-top: 2px; }
  .kop-npsn { font-size: 10.5pt; margin-top: 1px; }
  .kop-alamat, .kop-kontak { font-size: 10pt; margin-top: 1px; }
  .kop-garis-ganda { border-top: 3px double #111; margin: 8px 0 16px; }
  h1.judul-dokumen { text-align: center; font-size: 13pt; text-decoration: underline; text-transform: uppercase; margin: 0 0 4px; }
  p.sub-judul { text-align: center; font-size: 10.5pt; color: #444; margin: 0 0 18px; }
  table.tabel-cetak { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-bottom: 8px; }
  table.tabel-cetak th, table.tabel-cetak td { border: 1px solid #444; padding: 5px 7px; text-align: left; vertical-align: top; }
  table.tabel-cetak th { background: #eee; font-weight: bold; text-align: center; }
  table.tabel-cetak.tabel-8355 { font-size: 9pt; }
  .halaman-8355:not(:last-child) { page-break-after: always; }
  .ttd-wrapper { display: flex; justify-content: flex-end; margin-top: 36px; }
  .ttd-wrapper.ttd-dua { justify-content: space-between; }
  .ttd-blok { text-align: center; width: 260px; }
  .ttd-tempat-tanggal { margin-bottom: 2px; }
  .ttd-jabatan { margin-bottom: 4px; }
  .ttd-ruang { height: 60px; display: flex; align-items: center; justify-content: center; }
  .ttd-gambar { max-height: 60px; max-width: 200px; object-fit: contain; }
  .ttd-nama { font-weight: bold; margin-top: 2px; }
  .ttd-nip { font-size: 10.5pt; }
`

export function bukaCetakTabel({
  profil,
  judul,
  subJudul = '',
  kolom,
  baris,
  orientasi = 'portrait',
  tandaTangan = {},
  tandaTanganKedua = null,
  htmlTambahan = '',
}) {
  const theadHtml = `<tr>${kolom.map((k) => `<th>${escapeHtml(k)}</th>`).join('')}</tr>`
  const tbodyHtml = baris
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${cell === '' || cell === null || cell === undefined ? '-' : escapeHtml(cell)}</td>`)
          .join('')}</tr>`
    )
    .join('')

  let ttdHtml = ''
  if (tandaTangan !== false) {
    if (tandaTanganKedua) {
      ttdHtml = `<div class="ttd-wrapper ttd-dua">${blokTandaTanganHtml(profil, tandaTanganKedua)}${blokTandaTanganHtml(profil, tandaTangan)}</div>`
    } else {
      ttdHtml = `<div class="ttd-wrapper">${blokTandaTanganHtml(profil, tandaTangan)}</div>`
    }
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(judul)}</title>
      <style>
        ${CSS_DASAR}
        @media print { @page { size: A4 ${orientasi}; margin: 0; } }
      </style>
    </head>
    <body>
      ${kopSuratHtml(profil)}
      <h1 class="judul-dokumen">${escapeHtml(judul)}</h1>
      ${subJudul ? `<p class="sub-judul">${escapeHtml(subJudul)}</p>` : ''}
      ${htmlTambahan}
      <table class="tabel-cetak">
        <thead>${theadHtml}</thead>
        <tbody>${tbodyHtml || `<tr><td colspan="${kolom.length}" style="text-align:center;color:#888;">Belum ada data.</td></tr>`}</tbody>
      </table>
      ${ttdHtml}
      <script>
        window.onload = function () { window.print(); };
      </script>
    </body>
    </html>
  `

  const jendela = window.open('', '_blank')
  if (!jendela) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak dokumen ini.')
    return
  }
  jendela.document.write(html)
  jendela.document.close()
}

const KOL_NO = ['No', (s, i) => i + 1]
const KOL_NISN = ['NISN', (s) => s.nisn]
const KOL_NAMA = ['Nama Peserta', (s) => s.nama_lengkap]

const BLOK_8355 = [
  [
    KOL_NO,
    ['Kode Prov.', (s) => s.kode_provinsi],
    ['Kode Rayon', (s) => s.kode_rayon],
    ['Kode Sek.', (s) => s.kode_sekolah],
    ['Paralel', (s) => s.paralel],
    ['Absen', (s) => s.absen],
    ['Kode Peserta', (s) => s.kode_peserta],
    ['Cek Kode', (s) => s.cek_kode_peserta],
    ['No Peserta', (s) => s.no_peserta],
    KOL_NISN,
    ['NIS', (s) => s.nis],
    KOL_NAMA,
    ['Tempat Lahir', (s) => s.tempat_lahir],
    ['Tgl Lahir', (s) => formatTglSingkat(s.tanggal_lahir)],
  ],
  [
    KOL_NO,
    KOL_NISN,
    KOL_NAMA,
    ['Tgl Lahir', (s) => formatTglSingkat(s.tanggal_lahir)],
    ['L/P', (s) => (s.jenis_kelamin === 'L' ? 'L' : 'P')],
    ['Nama Ayah', (s) => s.nama_ayah],
    ['Alamat 1', (s) => s.alamat_1],
    ['Alamat 2', (s) => s.alamat_2],
    ['Kode Pos', (s) => s.kode_pos],
    ['Ket Mengulang', (s) => s.ket_mengulang],
    ['No Pst. Mengulang', (s) => s.no_peserta_mengulang],
    ['Agama', (s) => s.agama],
    ['Pekerjaan Ayah', (s) => s.pekerjaan_ayah],
  ],
  [
    KOL_NO,
    KOL_NISN,
    KOL_NAMA,
    ['Nama Ibu', (s) => s.nama_ibu],
    ['Pekerjaan Ibu', (s) => s.pekerjaan_ibu],
    ['Hobi Anak', (s) => s.hobi_anak],
    ['Cita-cita', (s) => s.cita_cita_anak],
    ['Pend. Ayah', (s) => s.pendidikan_ayah],
    ['Pend. Ibu', (s) => s.pendidikan_ibu],
    ['Gaji Ortu', (s) => s.gaji_ortu],
    ['Jarak ke Sekolah', (s) => s.jarak_rumah_sekolah],
    ['Transportasi', (s) => s.transportasi],
    ['Jml Saudara', (s) => s.jumlah_saudara],
    ['Usia', (s) => hitungUsia(s.tanggal_lahir)],
    ['No SKHUN', (s) => s.no_skhun],
  ],
]

export const KOLOM_8355 = [
  ...BLOK_8355[0],
  ...BLOK_8355[1].filter(([label]) => !['No', 'NISN', 'Nama Peserta'].includes(label)),
  ...BLOK_8355[2].filter(([label]) => !['No', 'NISN', 'Nama Peserta'].includes(label)),
]

export function bukaCetak8355({ profil, siswaList, tahunPelajaran }) {
  const subJudul = tahunPelajaran ? `Tahun Pelajaran ${tahunPelajaran}` : ''

  const lembarHtml = BLOK_8355.map((kolomBlok, idx) => {
    const theadHtml = `<tr>${kolomBlok.map(([label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>`
    const tbodyHtml = siswaList
      .map((s, i) => {
        const sel = kolomBlok
          .map(([, get]) => {
            const val = get(s, i)
            return `<td>${val === '' || val === null || val === undefined ? '-' : escapeHtml(val)}</td>`
          })
          .join('')
        return `<tr>${sel}</tr>`
      })
      .join('')

    const isTerakhir = idx === BLOK_8355.length - 1
    const ttdHtml = isTerakhir
      ? `<div class="ttd-wrapper">${blokTandaTanganHtml(profil, { jabatan: 'Kepala Sekolah' })}</div>`
      : ''

    return `
      <section class="halaman-8355">
        ${kopSuratHtml(profil)}
        <h1 class="judul-dokumen">Daftar Calon Peserta Ujian (8355)</h1>
        <p class="sub-judul">${escapeHtml(subJudul)}${subJudul ? ' &middot; ' : ''}Lembar ${idx + 1} dari ${BLOK_8355.length}</p>
        <table class="tabel-cetak tabel-8355">
          <thead>${theadHtml}</thead>
          <tbody>${tbodyHtml || `<tr><td colspan="${kolomBlok.length}" style="text-align:center;color:#888;">Belum ada data.</td></tr>`}</tbody>
        </table>
        ${ttdHtml}
      </section>
    `
  }).join('')

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Formulir 8355</title>
      <style>
        ${CSS_DASAR}
        @media print { @page { size: A4 portrait; margin: 0; } }
      </style>
    </head>
    <body>
      ${lembarHtml}
      <script>
        window.onload = function () { window.print(); };
      </script>
    </body>
    </html>
  `

  const jendela = window.open('', '_blank')
  if (!jendela) {
    alert('Popup diblokir browser. Izinkan popup untuk mencetak dokumen ini.')
    return
  }
  jendela.document.write(html)
  jendela.document.close()
}
