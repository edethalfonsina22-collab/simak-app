-- =========================================================
-- SIMAK — Migrasi: Log Riwayat Backup
-- Supabase Dashboard > SQL Editor > New Query > tempel > Run
-- Aman dijalankan di database yang sudah ada isinya.
-- =========================================================

create table if not exists backup_log (
  id uuid primary key default uuid_generate_v4(),
  dibuat_oleh text, -- email admin yang membuat backup
  jumlah_tabel integer,
  catatan text,
  dibuat_pada timestamptz default now()
);

alter table backup_log enable row level security;

drop policy if exists "admin_akses_penuh" on backup_log;
create policy "admin_akses_penuh" on backup_log
  for all using (is_admin()) with check (is_admin());

-- =========================================================
-- Catatan: butuh fungsi is_admin() dari migrasi role
-- (01_role_dan_fitur_baru.sql). Kalau itu sudah pernah
-- dijalankan, tidak perlu langkah tambahan.
-- =========================================================
