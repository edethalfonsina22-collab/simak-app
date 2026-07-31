-- Tambah kolom kategori ke tabel pengumuman
-- Jalankan di Supabase SQL Editor

alter table pengumuman
  add column if not exists kategori text not null default 'Informasi';

alter table pengumuman
  add constraint pengumuman_kategori_check
  check (kategori in ('Informasi', 'Keuangan', 'Akademik'));

-- Data yang sudah ada otomatis dapat kategori 'Informasi'
-- Ubah manual kalau mau kategori lain, contoh:
-- update pengumuman set kategori = 'Keuangan' where id = '<id_pengumuman>';
