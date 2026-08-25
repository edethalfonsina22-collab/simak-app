// Definisi kolom Formulir 8355, disusun per-blok sesuai 3 lembar di file Word
// aslinya. Kolom No/NISN/Nama diulang di awal blok 2 & 3 supaya tiap lembar
// tetap bisa dicocokkan barisnya meski dipisah kertas.
const KOL_NO = ['No', (s, i) => i + 1]
const KOL_NISN = ['NISN', (s) => s.nisn]
const KOL_NAMA = ['Nama Peserta', (s) => s.nama_lengkap]

const BLOK_8355 = [
  // Lembar 1 — setara kolom 1–14 di file Word
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
  // Lembar 2 — setara kolom 15–25 di file Word
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
  // Lembar 3 — setara kolom 26–38 di file Word
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

// Versi datar (flat) dipakai untuk tabel di layar (halaman 8355.jsx) —
// gabungan semua kolom unik dari 3 blok di atas, tanpa duplikasi No/NISN/Nama.
export const KOLOM_8355 = [
  ...BLOK_8355[0],
  ...BLOK_8355[1].filter(([label]) => !['No', 'NISN', 'Nama Peserta'].includes(label)),
  ...BLOK_8355[2].filter(([label]) => !['No', 'NISN', 'Nama Peserta'].includes(label)),
]

/**
 * Cetak Formulir 8355 — Daftar Calon Peserta Ujian, dipisah jadi 3 lembar
 * terpisah (blok kolom 1–14, 15–25, 26–38) persis susunan file Word aslinya.
 * Setiap lembar punya kop surat sendiri; tanda tangan kepala sekolah hanya
 * muncul di lembar terakhir.
 *
 * @param {object}      opsi
 * @param {object|null} opsi.profil        - hasil ambilProfilUntukCetak()
 * @param {Array}       opsi.siswaList     - daftar siswa (baris data lengkap dari Supabase)
 * @param {string}      [opsi.tahunPelajaran] - mis. "2025 / 2026"
 */
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
        table.tabel-cetak.tabel-8355 { font-size: 9pt; }
        .halaman-8355:not(:last-child) { page-break-after: always; }
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
