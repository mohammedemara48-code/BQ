alter table profiles add column if not exists serial text;
create unique index if not exists profiles_serial_idx on profiles (serial) where serial is not null and serial <> '';

create table if not exists message_allow (
  user_id     text not null,
  peer_id     text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, peer_id)
);
