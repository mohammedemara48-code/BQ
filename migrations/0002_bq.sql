-- BQ social / dating schema
create table if not exists profiles (
  user_id       text primary key,
  name          text not null,
  bio           text not null default '',
  pronouns      text not null default '',
  city          text not null default '',
  looking_for   text not null default '',
  interests     text not null default '[]',
  photo_url     text not null default '',
  cover_url     text not null default '',
  latitude      double precision,
  longitude     double precision,
  online        boolean not null default false,
  is_community  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists messages (
  id            serial primary key,
  user_a        text not null,
  user_b        text not null,
  sender_id     text not null,
  type          text not null default 'text',
  text          text not null default '',
  file_url      text,
  view_once     boolean not null default false,
  opened        boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists messages_pair_idx on messages (user_a, user_b, created_at desc);

create table if not exists requests (
  id            serial primary key,
  from_id       text not null,
  to_id         text not null,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  unique (from_id, to_id)
);
create index if not exists requests_from_idx on requests (from_id);
create index if not exists requests_to_idx on requests (to_id);

create table if not exists calls (
  id            serial primary key,
  user_id       text not null,
  peer_id       text not null,
  kind          text not null,
  direction     text not null,
  duration_sec  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists calls_user_idx on calls (user_id, created_at desc);
