-- =========================================================
-- SIMAK — Migrasi: Manajemen Keuangan (Kas & SPP Sekolah)
-- Supabase Dashboard > SQL Editor > New Query > tempel > Run
-- Aman dijalankan di database yang sudah ada isinya.
-- =========================================================

create table if not exists keuangan (
  id uuid primary key default uuid_generate_v4(),
  jenis text not null default 'masuk', -- 'masuk' | 'keluar'
  kategori text not null default 'Lainnya', -- SPP, Donasi, Gaji, ATK, Listrik, dll
  siswa_id uuid references siswa(id) on delete set null, -- diisi kalau kategori SPP
  jumlah numeric not null,
  tanggal date not null default current_date,
  catatan text,
  dibuat_pada timestamptz default now()
);

alter table keuangan enable row level security;

-- Data keuangan bersifat sensitif — hanya admin yang boleh akses sama sekali
-- (guru tidak diberi akses baca ataupun tulis)
drop policy if exists "admin_akses_penuh" on keuangan;
create policy "admin_akses_penuh" on keuangan
  for all using (is_admin()) with check (is_admin());

-- =========================================================
-- Catatan: fungsi is_admin() dipakai di sini berasal dari
-- migrasi sebelumnya (01_role_dan_fitur_baru.sql). Kalau file
-- itu belum pernah dijalankan, jalankan dulu sebelum file ini.
-- =========================================================
