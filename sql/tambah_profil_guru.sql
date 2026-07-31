-- ============================================================
-- Fitur Profil Guru: data diri lengkap + foto profil
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tambah kolom baru ke tabel guru yang sudah ada
alter table guru
  add column if not exists alamat text,
  add column if not exists tanggal_lahir date,
  add column if not exists pendidikan_terakhir text,
  add column if not exists foto_profil_path text;

-- 2. Ganti kebijakan RLS tabel guru:
--    - SELECT tetap terbuka untuk semua yang login (tidak diubah)
--      supaya halaman lain yang sudah jalan (Kelas, Jadwal, RPP, dst
--      yang menampilkan nama guru) tidak ikut rusak.
--    - INSERT & DELETE: hanya admin (menambah/menghapus guru
--      memang seharusnya wewenang admin).
--    - UPDATE: admin boleh ubah baris siapa saja, guru hanya
--      boleh ubah barisnya sendiri (mengunci fitur edit profil
--      supaya guru tidak bisa ubah data guru lain).
drop policy if exists "akses_penuh_untuk_admin_login" on guru;

create policy "guru_lihat_semua" on guru
  for select using (auth.role() = 'authenticated');

create policy "guru_insert_admin_saja" on guru
  for insert with check (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
  );

create policy "guru_update_sendiri_atau_admin" on guru
  for update using (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
    or id = (select guru_id from profil where profil.id = auth.uid())
  );

create policy "guru_delete_admin_saja" on guru
  for delete using (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
  );

-- 3. Storage bucket untuk foto profil (publik, supaya gampang
--    ditampilkan langsung tanpa signed URL yang kedaluwarsa)
insert into storage.buckets (id, name, public)
values ('foto-profil', 'foto-profil', true)
on conflict (id) do nothing;

create policy "guru upload foto sendiri"
on storage.objects for insert
with check (
  bucket_id = 'foto-profil'
  and (storage.foldername(name))[1] = (select guru_id::text from profil where profil.id = auth.uid())
);

create policy "guru ganti foto sendiri"
on storage.objects for update
using (
  bucket_id = 'foto-profil'
  and (storage.foldername(name))[1] = (select guru_id::text from profil where profil.id = auth.uid())
);

create policy "semua bisa lihat foto profil"
on storage.objects for select
using (bucket_id = 'foto-profil');

-- Catatan: kalau "insert into storage.buckets" gagal karena izin,
-- buat bucket "foto-profil" manual lewat tab Storage di Supabase
-- Dashboard (CENTANG "Public bucket" kali ini), lalu jalankan ulang
-- bagian policy no. 3.
