-- =========================================================
-- SIMAK — Migrasi: Sistem Role (Admin/Guru) + Fitur Baru
-- Cara pakai: Supabase Dashboard > SQL Editor > New Query
-- Tempel SELURUH isi file ini, lalu klik "Run".
-- Aman dijalankan di database yang sudah ada isinya —
-- tidak menghapus data lama.
-- =========================================================

-- ---------- 1. TABEL PROFIL (menghubungkan akun login <-> role) ----------
create table if not exists profil (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'guru', -- 'admin' | 'guru'
  guru_id uuid references guru(id) on delete set null,
  dibuat_pada timestamptz default now()
);

alter table profil enable row level security;

drop policy if exists "lihat_profil_sendiri" on profil;
create policy "lihat_profil_sendiri" on profil
  for select using (auth.uid() = id);

drop policy if exists "admin_kelola_profil" on profil;
create policy "admin_kelola_profil" on profil
  for all using (
    exists (select 1 from profil p where p.id = auth.uid() and p.role = 'admin')
  );

-- Fungsi bantu: cek apakah user yang login adalah admin
create or replace function is_admin() returns boolean as $$
  select exists (select 1 from profil where id = auth.uid() and role = 'admin');
$$ language sql security definer stable;

-- Fungsi bantu: ambil guru_id milik user yang login
create or replace function guru_id_saya() returns uuid as $$
  select guru_id from profil where id = auth.uid();
$$ language sql security definer stable;

-- ---------- 2. PENTING: JADIKAN AKUN ANDA SEBAGAI ADMIN ----------
-- Ganti 'EMAIL_ADMIN_ANDA' di bawah dengan email login Anda saat ini,
-- lalu jalankan baris ini SATU KALI (boleh dijalankan bareng file ini).
insert into profil (id, role)
select id, 'admin' from auth.users where email = 'EMAIL_ADMIN_ANDA'
on conflict (id) do update set role = 'admin';

-- ---------- 3. INVENTARIS SARANA & PRASARANA ----------
create table if not exists inventaris (
  id uuid primary key default uuid_generate_v4(),
  nama_barang text not null,
  kategori text,
  jumlah integer not null default 1,
  kondisi text not null default 'baik', -- baik | rusak_ringan | rusak_berat
  lokasi text,
  tanggal_masuk date,
  catatan text,
  dibuat_pada timestamptz default now()
);
alter table inventaris enable row level security;

-- ---------- 4. AGENDA / KALENDER KEGIATAN SEKOLAH ----------
create table if not exists agenda (
  id uuid primary key default uuid_generate_v4(),
  judul text not null,
  deskripsi text,
  tanggal_mulai timestamptz not null,
  tanggal_selesai timestamptz,
  lokasi text,
  penanggung_jawab text,
  dibuat_pada timestamptz default now()
);
alter table agenda enable row level security;

-- ---------- 5. SURAT MASUK & KELUAR ----------
create table if not exists surat (
  id uuid primary key default uuid_generate_v4(),
  jenis text not null default 'masuk', -- masuk | keluar
  nomor_surat text,
  perihal text not null,
  pengirim_tujuan text,
  tanggal date not null default current_date,
  file_url text,
  catatan text,
  dibuat_pada timestamptz default now()
);
alter table surat enable row level security;

-- =========================================================
-- 6. KEBIJAKAN AKSES (RLS) — ADMIN vs GURU
-- Admin: akses penuh ke semua tabel.
-- Guru: hanya boleh lihat data umum, dan hanya boleh
--       mengisi presensi & nilai untuk kelas/mapel yang
--       memang dia ajar (dicek lewat tabel jadwal).
-- =========================================================

-- --- Tabel yang admin-only untuk tulis, guru boleh baca ---
do $$
declare
  t text;
begin
  for t in select unnest(array['guru','kelas','siswa','jadwal','pengumuman','inventaris','agenda','surat'])
  loop
    execute format('drop policy if exists "admin_akses_penuh" on %I', t);
    execute format('drop policy if exists "guru_boleh_baca" on %I', t);
    execute format(
      'create policy "admin_akses_penuh" on %I for all using (is_admin()) with check (is_admin())', t
    );
    execute format(
      'create policy "guru_boleh_baca" on %I for select using (auth.role() = ''authenticated'')', t
    );
  end loop;
end $$;

-- --- Presensi & Nilai: admin bebas, guru hanya untuk kelas/mapel yang dia ajar ---
drop policy if exists "admin_akses_penuh" on presensi_siswa;
create policy "admin_akses_penuh" on presensi_siswa for all using (is_admin()) with check (is_admin());

drop policy if exists "guru_akses_kelasnya" on presensi_siswa;
create policy "guru_akses_kelasnya" on presensi_siswa for all using (
  exists (
    select 1 from siswa s join jadwal j on j.kelas_id = s.kelas_id
    where s.id = presensi_siswa.siswa_id and j.guru_id = guru_id_saya()
  )
) with check (
  exists (
    select 1 from siswa s join jadwal j on j.kelas_id = s.kelas_id
    where s.id = presensi_siswa.siswa_id and j.guru_id = guru_id_saya()
  )
);

drop policy if exists "admin_akses_penuh" on nilai;
create policy "admin_akses_penuh" on nilai for all using (is_admin()) with check (is_admin());

drop policy if exists "guru_akses_mapelnya" on nilai;
create policy "guru_akses_mapelnya" on nilai for all using (
  exists (
    select 1 from siswa s join jadwal j on j.kelas_id = s.kelas_id
    where s.id = nilai.siswa_id and j.guru_id = guru_id_saya() and j.mata_pelajaran = nilai.mata_pelajaran
  )
) with check (
  exists (
    select 1 from siswa s join jadwal j on j.kelas_id = s.kelas_id
    where s.id = nilai.siswa_id and j.guru_id = guru_id_saya() and j.mata_pelajaran = nilai.mata_pelajaran
  )
);

-- Presensi guru sendiri: admin penuh, guru hanya lihat/isi presensinya sendiri
drop policy if exists "admin_akses_penuh" on presensi_guru;
create policy "admin_akses_penuh" on presensi_guru for all using (is_admin()) with check (is_admin());

drop policy if exists "guru_presensi_sendiri" on presensi_guru;
create policy "guru_presensi_sendiri" on presensi_guru for all using (
  guru_id = guru_id_saya()
) with check (
  guru_id = guru_id_saya()
);

-- =========================================================
-- SELESAI.
-- Langkah setelah menjalankan file ini:
-- 1. Pastikan baris "JADIKAN AKUN ANDA SEBAGAI ADMIN" di atas
--    sudah diisi email Anda yang benar sebelum di-Run.
-- 2. Untuk tiap akun guru yang login, buat juga baris di
--    tabel profil (role='guru', guru_id=id guru terkait) —
--    ini bisa dilakukan lewat halaman "Data Guru" yang sudah
--    diperbarui, lihat PANDUAN_FITUR_BARU.md.
-- =========================================================
