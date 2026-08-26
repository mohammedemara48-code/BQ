-- Receipts, stories, rooms, verification, admin inbox, richer reports.

alter table messages add column if not exists delivered boolean not null default false;
alter table messages add column if not exists seen_at timestamptz;

alter table profiles add column if not exists verified boolean not null default false;

create table if not exists stories (
  id          serial primary key,
  user_id     text not null,
  type        text not null default 'image',
  text        text not null default '',
  file_url    text,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);
create index if not exists stories_user_idx on stories (user_id, created_at desc);

create table if not exists rooms (
  id          serial primary key,
  name        text not null,
  topic       text not null default '',
  photo_url   text not null default '',
  owner_id    text not null,
  created_at  timestamptz not null default now()
);

create table if not exists room_members (
  room_id     integer not null,
  user_id     text not null,
  joined_at   timestamptz not null default now(),
  speaker_on  boolean not null default false,
  primary key (room_id, user_id)
);
create index if not exists room_members_user_idx on room_members (user_id);

create table if not exists room_messages (
  id            serial primary key,
  room_id       integer not null,
  sender_id     text not null,
  type          text not null default 'text',
  text          text not null default '',
  file_url      text,
  duration_sec  integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists room_messages_room_idx on room_messages (room_id, id);

create table if not exists verify_requests (
  id          serial primary key,
  user_id     text not null,
  note        text not null default '',
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists verify_requests_status_idx on verify_requests (status, created_at desc);

create table if not exists admin_inbox (
  id          serial primary key,
  user_id     text not null,
  body        text not null,
  status      text not null default 'open',
  created_at  timestamptz not null default now()
);
create index if not exists admin_inbox_status_idx on admin_inbox (status, created_at desc);

alter table reports add column if not exists kind text not null default 'user';
alter table reports add column if not exists message_id integer;
alter table reports add column if not exists room_id integer;
alter table reports add column if not exists room_message_id integer;
alter table reports add column if not exists status text not null default 'open';
alter table reports add column if not exists peer_a text not null default '';
alter table reports add column if not exists peer_b text not null default '';
alter table reports add column if not exists snippet text not null default '';
