-- ============================================================
-- Perbaikan: Galeri Kegiatan belum mengikuti sekolah_id
-- Jalankan skrip ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tambah kolom sekolah_id ke galeri_kegiatan (kalau belum ada)
alter table public.galeri_kegiatan
  add column if not exists sekolah_id uuid references public.sekolah(id);

-- 2. Backfill data lama: isi sekolah_id berdasarkan guru pembuat album
--    (profil.guru_id -> profil.sekolah_id). Album lama yang dibuat oleh
--    ADMIN (guru_id kosong) tidak akan otomatis terisi lewat cara ini.
update public.galeri_kegiatan gk
set sekolah_id = p.sekolah_id
from public.profil p
where gk.guru_id is not null
  and gk.guru_id = p.guru_id
  and gk.sekolah_id is null;

-- 2b. Cek dulu apakah masih ada album yang sekolah_id-nya kosong (biasanya
--     album buatan admin). Kalau ada, isi manual satu-satu lewat query
--     seperti contoh di bawah (ganti '...' dengan id sekolah & album yang
--     sesuai), baru lanjut ke langkah 3.
--
-- select id, judul, guru_id, sekolah_id from public.galeri_kegiatan where sekolah_id is null;
-- update public.galeri_kegiatan set sekolah_id = '...id-sekolah...' where id = '...id-album...';

-- 3. Aktifkan Row Level Security (aman dijalankan berulang)
alter table public.galeri_kegiatan enable row level security;
alter table public.galeri_foto enable row level security;

-- 4. Hapus policy lama bernama sama (biar skrip ini aman dijalankan ulang)
drop policy if exists "galeri_kegiatan_select_sekolah" on public.galeri_kegiatan;
drop policy if exists "galeri_kegiatan_insert_sekolah" on public.galeri_kegiatan;
drop policy if exists "galeri_kegiatan_update_sekolah" on public.galeri_kegiatan;
drop policy if exists "galeri_kegiatan_delete_sekolah" on public.galeri_kegiatan;
drop policy if exists "galeri_foto_select_sekolah" on public.galeri_foto;
drop policy if exists "galeri_foto_insert_sekolah" on public.galeri_foto;
drop policy if exists "galeri_foto_delete_sekolah" on public.galeri_foto;

-- 5. Policy galeri_kegiatan: hanya boleh lihat/ubah album sekolah sendiri.
--    Superadmin (profil.sekolah_id kosong / role = 'superadmin') boleh lihat semua.
create policy "galeri_kegiatan_select_sekolah" on public.galeri_kegiatan
  for select to authenticated
  using (
    exists (
      select 1 from public.profil p
      where p.id = auth.uid()
        and (p.role = 'superadmin' or p.sekolah_id = galeri_kegiatan.sekolah_id)
    )
  );

create policy "galeri_kegiatan_insert_sekolah" on public.galeri_kegiatan
  for insert to authenticated
  with check (
    exists (
      select 1 from public.profil p
      where p.id = auth.uid()
        and (p.role = 'superadmin' or p.sekolah_id = galeri_kegiatan.sekolah_id)
    )
  );

create policy "galeri_kegiatan_update_sekolah" on public.galeri_kegiatan
  for update to authenticated
  using (
    exists (
      select 1 from public.profil p
      where p.id = auth.uid()
        and (p.role = 'superadmin' or p.sekolah_id = galeri_kegiatan.sekolah_id)
    )
  );

create policy "galeri_kegiatan_delete_sekolah" on public.galeri_kegiatan
  for delete to authenticated
  using (
    exists (
      select 1 from public.profil p
      where p.id = auth.uid()
        and (p.role = 'superadmin' or p.sekolah_id = galeri_kegiatan.sekolah_id)
    )
  );

-- 6. Policy galeri_foto: ikut aturan album induknya (galeri_kegiatan),
--    karena galeri_foto sendiri tidak punya kolom sekolah_id.
create policy "galeri_foto_select_sekolah" on public.galeri_foto
  for select to authenticated
  using (
    exists (
      select 1 from public.galeri_kegiatan gk
      join public.profil p on p.id = auth.uid()
      where gk.id = galeri_foto.kegiatan_id
        and (p.role = 'superadmin' or p.sekolah_id = gk.sekolah_id)
    )
  );

create policy "galeri_foto_insert_sekolah" on public.galeri_foto
  for insert to authenticated
  with check (
    exists (
      select 1 from public.galeri_kegiatan gk
      join public.profil p on p.id = auth.uid()
      where gk.id = galeri_foto.kegiatan_id
        and (p.role = 'superadmin' or p.sekolah_id = gk.sekolah_id)
    )
  );

create policy "galeri_foto_delete_sekolah" on public.galeri_foto
  for delete to authenticated
  using (
    exists (
      select 1 from public.galeri_kegiatan gk
      join public.profil p on p.id = auth.uid()
      where gk.id = galeri_foto.kegiatan_id
        and (p.role = 'superadmin' or p.sekolah_id = gk.sekolah_id)
    )
  );
