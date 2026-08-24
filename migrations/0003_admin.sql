-- First real account to sign in becomes the space owner.
alter table profiles
  add column if not exists is_admin boolean not null default false;

create index if not exists profiles_admin_idx on profiles (is_admin)
  where is_admin = true;
