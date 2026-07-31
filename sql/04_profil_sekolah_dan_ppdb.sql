-- =========================================================
-- SIMAK — Migrasi: Profil Sekolah & PPDB Online
-- Supabase Dashboard > SQL Editor > New Query > tempel > Run
-- Aman dijalankan di database yang sudah ada isinya.
-- =========================================================

-- ---------- PROFIL SEKOLAH (1 baris saja, data umum sekolah) ----------
create table if not exists profil_sekolah (
  id integer primary key default 1,
  nama_sekolah text default '',
  npsn text default '',
  alamat text default '',
  telepon text default '',
  email text default '',
  kepala_sekolah text default '',
  tahun_berdiri text default '',
  akreditasi text default '',
  visi text default '',
  misi text default '', -- satu baris per poin misi
  sejarah text default '',
  diperbarui_pada timestamptz default now(),
  constraint profil_sekolah_satu_baris check (id = 1)
);

-- Pastikan selalu ada 1 baris data
insert into profil_sekolah (id) values (1) on conflict (id) do nothing;

alter table profil_sekolah enable row level security;

-- Profil sekolah boleh dibaca siapa saja (termasuk halaman publik PPDB)
drop policy if exists "siapa_saja_boleh_baca" on profil_sekolah;
create policy "siapa_saja_boleh_baca" on profil_sekolah
  for select using (true);

-- Tapi hanya admin yang boleh mengubahnya
drop policy if exists "admin_boleh_ubah" on profil_sekolah;
create policy "admin_boleh_ubah" on profil_sekolah
  for update using (is_admin()) with check (is_admin());

-- ---------- PPDB — PENDAFTAR SISWA BARU ----------
create table if not exists ppdb_pendaftar (
  id uuid primary key default uuid_generate_v4(),
  nama_lengkap text not null,
  tempat_lahir text,
  tanggal_lahir date,
  jenis_kelamin text default 'L',
  nama_ayah text,
  nama_ibu text,
  alamat text,
  no_hp_orang_tua text not null,
  asal_sekolah text, -- TK/PAUD asal, opsional
  status text not null default 'menunggu', -- menunggu | diterima | ditolak
  catatan_admin text,
  dibuat_pada timestamptz default now()
);

alter table ppdb_pendaftar enable row level security;

-- Siapa saja (termasuk orang tua yang belum login) boleh MENDAFTAR
drop policy if exists "siapa_saja_boleh_daftar" on ppdb_pendaftar;
create policy "siapa_saja_boleh_daftar" on ppdb_pendaftar
  for insert with check (true);

-- Tapi hanya admin yang boleh melihat & mengelola daftar pendaftar
drop policy if exists "admin_boleh_kelola" on ppdb_pendaftar;
create policy "admin_boleh_kelola" on ppdb_pendaftar
  for select using (is_admin());

drop policy if exists "admin_boleh_update" on ppdb_pendaftar;
create policy "admin_boleh_update" on ppdb_pendaftar
  for update using (is_admin()) with check (is_admin());

drop policy if exists "admin_boleh_hapus" on ppdb_pendaftar;
create policy "admin_boleh_hapus" on ppdb_pendaftar
  for delete using (is_admin());

-- =========================================================
-- Catatan: butuh fungsi is_admin() dari migrasi role
-- (01_role_dan_fitur_baru.sql). Kalau itu sudah pernah
-- dijalankan, tidak perlu langkah tambahan.
-- =========================================================
