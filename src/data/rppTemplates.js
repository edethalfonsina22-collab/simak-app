// src/data/rppTemplates.js
//
// "Bank" template RPP. Setiap entri di sini otomatis bisa dipilih di
// halaman RPP begitu guru memilih Mata Pelajaran + Kelas yang cocok.
//
// CARA TAMBAH TEMPLATE BARU:
//   1. Copy salah satu blok di bawah (mis. yang "matematika-5").
//   2. Ganti semua isinya sesuai mapel/kelas/materi yang baru.
//   3. Tambahkan blok itu ke object RPP_TEMPLATES di bagian bawah file,
//      dengan key: `${mataPelajaran}|${kelas}`.
//   4. Commit & push ke GitHub — Vercel otomatis build ulang, tidak ada
//      langkah instalasi tambahan yang perlu kamu jalankan.

const matematikaKelas5 = {
  satuanPendidikan: 'SD ...................................',
  mataPelajaran: 'Matematika',
  kelas: '5',
  semester: 'Ganjil',
  tahunAjaran: '2026/2027',
  materiPokok: 'Operasi Hitung Pecahan',
  alokasiWaktu: '2 x 35 menit (1 x pertemuan)',

  kompetensiInti: [
    'KI-1  Menerima, menjalankan, dan menghargai ajaran agama yang dianutnya.',
    'KI-2  Menunjukkan perilaku jujur, disiplin, tanggung jawab, santun, peduli, dan percaya diri dalam berinteraksi dengan keluarga, teman, guru, dan tetangga.',
    'KI-3  Memahami pengetahuan faktual dan konseptual dengan cara mengamati, menanya, dan mencoba berdasarkan rasa ingin tahu tentang dirinya, makhluk ciptaan Tuhan dan kegiatannya.',
    'KI-4  Menyajikan pengetahuan faktual dan konseptual dalam bahasa yang jelas, sistematis, logis dan kritis.',
  ],

  kompetensiDasar: [
    {
      kd: '3.1 Menjelaskan dan melakukan penjumlahan dan pengurangan pecahan berpenyebut berbeda.',
      indikator: [
        '3.1.1 Menjelaskan konsep penyamaan penyebut pecahan.',
        '3.1.2 Menentukan hasil penjumlahan dan pengurangan pecahan berpenyebut berbeda.',
      ],
    },
    {
      kd: '4.1 Menyelesaikan masalah yang berkaitan dengan penjumlahan dan pengurangan pecahan.',
      indikator: ['4.1.1 Menyelesaikan soal cerita yang berkaitan dengan penjumlahan dan pengurangan pecahan dalam kehidupan sehari-hari.'],
    },
  ],

  tujuanPembelajaran: [
    'Melalui kegiatan mengamati contoh pada media pembelajaran, peserta didik dapat menjelaskan konsep penyamaan penyebut pecahan dengan tepat.',
    'Melalui diskusi kelompok, peserta didik dapat menentukan hasil penjumlahan dan pengurangan pecahan berpenyebut berbeda dengan benar.',
    'Melalui latihan soal, peserta didik dapat menyelesaikan masalah sehari-hari yang berkaitan dengan penjumlahan dan pengurangan pecahan secara mandiri.',
  ],

  materiPembelajaran: [
    'Pengertian pecahan berpenyebut berbeda.',
    'Cara menyamakan penyebut pecahan menggunakan KPK (Kelipatan Persekutuan Terkecil).',
    'Penjumlahan pecahan berpenyebut berbeda.',
    'Pengurangan pecahan berpenyebut berbeda.',
    'Penerapan operasi hitung pecahan dalam soal cerita sehari-hari.',
  ],

  pendekatanModelMetode: {
    pendekatan: 'Saintifik (mengamati, menanya, mencoba, menalar, mengomunikasikan)',
    model: 'Problem Based Learning',
    metode: 'Diskusi kelompok, tanya jawab, dan penugasan',
  },

  media: ['Kartu pecahan', 'papan tulis', 'PPT sederhana / gambar pecahan'],
  alat: ['Spidol', 'penggaris', 'potongan kertas berbentuk lingkaran/persegi'],
  sumberBelajar: ['Buku Siswa Matematika Kelas 5 Kurikulum 2013 (Kemendikbud)', 'Buku Guru Matematika Kelas 5', 'lingkungan sekitar'],

  langkah: {
    pendahuluan: {
      waktu: '10 menit',
      kegiatan: [
        'Guru membuka pelajaran dengan salam, doa, dan mengecek kehadiran peserta didik.',
        'Guru menyampaikan apersepsi dengan mengaitkan materi pecahan pada kehidupan sehari-hari (mis. membagi kue).',
        'Guru menyampaikan tujuan pembelajaran dan garis besar kegiatan yang akan dilakukan.',
      ],
    },
    inti: {
      waktu: '45 menit',
      kegiatan: [
        'Peserta didik mengamati contoh soal penjumlahan pecahan berpenyebut berbeda yang ditampilkan guru. (Mengamati)',
        'Peserta didik diberi kesempatan bertanya mengenai cara menyamakan penyebut pecahan. (Menanya)',
        'Peserta didik dibagi ke dalam kelompok kecil untuk berdiskusi menyelesaikan Lembar Kerja Peserta Didik (LKPD). (Mencoba)',
        'Setiap kelompok menganalisis dan menyelesaikan soal cerita terkait pecahan menggunakan kartu pecahan sebagai alat bantu. (Menalar)',
        'Perwakilan kelompok mempresentasikan hasil diskusi di depan kelas, kelompok lain menanggapi. (Mengomunikasikan)',
        'Guru memberikan penguatan dan meluruskan konsep yang masih keliru.',
      ],
    },
    penutup: {
      waktu: '15 menit',
      kegiatan: [
        'Peserta didik bersama guru menyimpulkan materi pembelajaran hari ini.',
        'Peserta didik mengerjakan soal evaluasi mandiri sebagai penilaian pengetahuan.',
        'Guru menyampaikan rencana pembelajaran pertemuan berikutnya.',
        'Pembelajaran ditutup dengan doa dan salam.',
      ],
    },
  },

  penilaian: [
    { aspek: 'Sikap (spiritual & sosial)', teknik: 'Observasi', instrumen: 'Jurnal sikap', waktu: 'Selama pembelajaran' },
    { aspek: 'Pengetahuan', teknik: 'Tes tertulis', instrumen: 'Soal uraian & isian singkat', waktu: 'Akhir pembelajaran' },
    { aspek: 'Keterampilan', teknik: 'Unjuk kerja', instrumen: 'Rubrik penilaian kinerja', waktu: 'Saat diskusi & presentasi' },
  ],

  lampiran: ['Lembar Kerja Peserta Didik (LKPD)', 'Soal evaluasi dan kunci jawaban', 'Rubrik penilaian sikap dan keterampilan'],

  namaKepalaSekolah: '',
  namaGuru: '',
  kotaTanggal: '..................., ......................... 2026',
}

// Object kosong sebagai contoh struktur — duplikasi untuk mapel/kelas baru.
// const ipaKelas5 = { satuanPendidikan: '...', mataPelajaran: 'IPA', kelas: '5', ... }

export const RPP_TEMPLATES = {
  'Matematika|5': matematikaKelas5,
  // 'IPA|5': ipaKelas5,
}

/** Cari template yang cocok untuk kombinasi mapel + kelas yang dipilih di dropdown. */
export function findRppTemplate(mataPelajaran, kelas) {
  return RPP_TEMPLATES[`${mataPelajaran}|${kelas}`] || null
}
