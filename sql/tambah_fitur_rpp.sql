-- ============================================================
-- Fitur RPP: guru upload, admin setujui + lembar persetujuan
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. Tabel RPP
create table if not exists rpp (
  id uuid primary key default gen_random_uuid(),
  guru_id uuid not null references guru(id) on delete cascade,
  judul text not null,
  mata_pelajaran text,
  kelas text,
  semester text check (semester in ('Ganjil', 'Genap')),
  tahun_ajaran text,
  file_path text not null,          -- path file RPP asli (pdf/docx) di storage
  file_nama text not null,          -- nama file asli, untuk tombol download
  status text not null default 'menunggu'
    check (status in ('menunggu', 'disetujui', 'ditolak')),
  catatan_admin text,               -- alasan/komentar saat setuju atau tolak
  nama_penandatangan text,          -- diisi otomatis saat disetujui
  jabatan_penandatangan text,
  disetujui_oleh uuid references profil(id),
  disetujui_pada timestamptz,
  lembar_persetujuan_path text,     -- path PDF lembar persetujuan hasil generate
  dibuat_pada timestamptz not null default now()
);

alter table rpp enable row level security;

-- 2. RLS: guru lihat RPP miliknya sendiri, admin lihat semua
create policy "lihat rpp" on rpp
  for select using (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
    or guru_id = (select guru_id from profil where profil.id = auth.uid())
  );

-- 3. RLS: guru hanya boleh upload RPP atas namanya sendiri
create policy "guru upload rpp sendiri" on rpp
  for insert with check (
    guru_id = (select guru_id from profil where profil.id = auth.uid())
  );

-- 4. RLS: hanya admin boleh ubah status (setuju/tolak)
create policy "admin ubah status rpp" on rpp
  for update using (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
  );

-- 5. Storage bucket untuk file RPP (privat, tidak publik)
insert into storage.buckets (id, name, public)
values ('rpp-files', 'rpp-files', false)
on conflict (id) do nothing;

-- 6. RLS storage: guru upload ke folder <guru_id>/nya sendiri
create policy "guru upload file rpp sendiri"
on storage.objects for insert
with check (
  bucket_id = 'rpp-files'
  and (storage.foldername(name))[1] = (select guru_id::text from profil where profil.id = auth.uid())
);

-- 7. RLS storage: guru lihat file miliknya, admin lihat semua file rpp
create policy "lihat file rpp"
on storage.objects for select
using (
  bucket_id = 'rpp-files'
  and (
    exists (select 1 from profil where profil.id = auth.uid() and profil.role = 'admin')
    or (storage.foldername(name))[1] = (select guru_id::text from profil where profil.id = auth.uid())
  )
);

-- Catatan:
-- - Kalau perintah "insert into storage.buckets" di atas gagal karena izin,
--   buat bucket "rpp-files" manual lewat tab Storage di Supabase Dashboard
--   (uncheck "Public bucket"), lalu jalankan ulang bagian policy no. 6 & 7.
