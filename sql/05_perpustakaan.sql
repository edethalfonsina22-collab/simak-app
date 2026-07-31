-- =========================================================
-- SIMAK — Migrasi: Perpustakaan Sekolah
-- Supabase Dashboard > SQL Editor > New Query > tempel > Run
-- Aman dijalankan di database yang sudah ada isinya.
-- =========================================================

-- ---------- DATA BUKU ----------
create table if not exists buku (
  id uuid primary key default uuid_generate_v4(),
  judul text not null,
  penulis text,
  penerbit text,
  tahun_terbit text,
  kategori text,
  rak text,
  jumlah_total integer not null default 1,
  jumlah_tersedia integer not null default 1,
  dibuat_pada timestamptz default now()
);

alter table buku enable row level security;

drop policy if exists "admin_akses_penuh" on buku;
create policy "admin_akses_penuh" on buku
  for all using (is_admin()) with check (is_admin());

drop policy if exists "guru_boleh_baca" on buku;
create policy "guru_boleh_baca" on buku
  for select using (auth.role() = 'authenticated');

-- ---------- PEMINJAMAN BUKU ----------
create table if not exists peminjaman_buku (
  id uuid primary key default uuid_generate_v4(),
  buku_id uuid references buku(id) on delete cascade,
  nama_peminjam text not null,
  jenis_peminjam text not null default 'siswa', -- siswa | guru
  siswa_id uuid references siswa(id) on delete set null,
  tanggal_pinjam date not null default current_date,
  tanggal_wajib_kembali date not null,
  tanggal_kembali date, -- null = belum dikembalikan
  catatan text,
  dibuat_pada timestamptz default now()
);

alter table peminjaman_buku enable row level security;

drop policy if exists "admin_akses_penuh" on peminjaman_buku;
create policy "admin_akses_penuh" on peminjaman_buku
  for all using (is_admin()) with check (is_admin());

drop policy if exists "guru_boleh_baca" on peminjaman_buku;
create policy "guru_boleh_baca" on peminjaman_buku
  for select using (auth.role() = 'authenticated');

-- =========================================================
-- Catatan: butuh fungsi is_admin() dari migrasi role
-- (01_role_dan_fitur_baru.sql). Kalau itu sudah pernah
-- dijalankan, tidak perlu langkah tambahan.
-- =========================================================
