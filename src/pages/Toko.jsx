-- =========================================================
-- Tabel: barang
-- Relasi: barang.toko_id -> toko.id
-- =========================================================
create table if not exists public.barang (
  id uuid primary key default gen_random_uuid(),
  toko_id uuid not null references public.toko(id) on delete cascade,
  nama_barang text not null,
  kategori text,
  harga numeric(14, 2),
  stok integer,
  satuan text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index untuk mempercepat query per toko
create index if not exists idx_barang_toko_id on public.barang(toko_id);

-- ---------------------------------------------------------
-- Trigger: auto-update kolom updated_at setiap kali diedit
-- ---------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_barang_updated_at on public.barang;
create trigger trg_barang_updated_at
before update on public.barang
for each row
execute function public.set_updated_at();

-- ---------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------
alter table public.barang enable row level security;

-- Semua user yang login boleh LIHAT semua barang
drop policy if exists "barang_select_all_logged_in" on public.barang;
create policy "barang_select_all_logged_in"
on public.barang
for select
to authenticated
using (true);

-- Semua user yang login boleh TAMBAH barang
drop policy if exists "barang_insert_all_logged_in" on public.barang;
create policy "barang_insert_all_logged_in"
on public.barang
for insert
to authenticated
with check (true);

-- Semua user yang login boleh EDIT barang
drop policy if exists "barang_update_all_logged_in" on public.barang;
create policy "barang_update_all_logged_in"
on public.barang
for update
to authenticated
using (true)
with check (true);

-- Semua user yang login boleh HAPUS barang
drop policy if exists "barang_delete_all_logged_in" on public.barang;
create policy "barang_delete_all_logged_in"
on public.barang
for delete
to authenticated
using (true);
