alter table profiles add column if not exists role text not null default '';
alter table profiles add column if not exists intent text not null default '';
alter table profiles add column if not exists phone text not null default '';
alter table profiles add column if not exists show_on_map boolean not null default true;
alter table profiles add column if not exists gallery text not null default '[]';
alter table profiles add column if not exists private_gallery text not null default '[]';

alter table messages add column if not exists duration_sec integer not null default 0;

create table if not exists notifications (
  id          serial primary key,
  user_id     text not null,
  kind        text not null,
  from_id     text not null default '',
  text        text not null default '',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc);

create table if not exists blocks (
  blocker_id  text not null,
  blocked_id  text not null,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists reports (
  id          serial primary key,
  reporter_id text not null,
  target_id   text not null,
  reason      text not null default '',
  created_at  timestamptz not null default now()
);

create table if not exists photo_access (
  owner_id    text not null,
  viewer_id   text not null,
  created_at  timestamptz not null default now(),
  primary key (owner_id, viewer_id)
);

create table if not exists photo_requests (
  owner_id    text not null,
  viewer_id   text not null,
  status      text not null default 'pending',
  created_at  timestamptz not null default now(),
  primary key (owner_id, viewer_id)
);
