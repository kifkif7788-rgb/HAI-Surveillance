-- HAI Surveillance — Supabase schema (JSONB-per-row)
-- รันใน Supabase Dashboard → SQL Editor
--
-- แต่ละตารางเก็บ object ทั้งก้อนใน data (jsonb); id เป็น primary key (mirror จาก data.id)

create table if not exists records      ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists users        ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists monthly      ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists or_monthly   ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists departments  ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists wards        ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists kpi_manual    ( id text primary key, data jsonb not null, updated_at timestamptz default now() );
create table if not exists activity_log  ( id text primary key, data jsonb not null, updated_at timestamptz default now() );

-- เปิด Row Level Security
alter table records     enable row level security;
alter table users       enable row level security;
alter table monthly     enable row level security;
alter table or_monthly  enable row level security;
alter table departments enable row level security;
alter table wards       enable row level security;

-- NOTE: นโยบายด้านล่างเปิดให้ anon อ่าน/เขียนได้ทั้งหมด (เหมาะกับเครื่องมือภายใน/เดโม)
-- ระบบนี้ใช้ custom auth ฝั่ง client (ไม่ใช่ Supabase Auth) จึงไม่มี auth.uid()
-- หากต้องการความปลอดภัยจริง ควรย้ายไป Supabase Auth + RLS ตาม role
do $$
declare t text;
begin
  foreach t in array array['records','users','monthly','or_monthly','departments','wards','kpi_manual','activity_log'] loop
    execute format('drop policy if exists "anon_all_%1$s" on %1$s;', t);
    execute format('create policy "anon_all_%1$s" on %1$s for all to anon using (true) with check (true);', t);
  end loop;
end $$;
