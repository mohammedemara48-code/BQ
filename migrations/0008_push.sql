create table if not exists push_subscriptions (
  id          serial primary key,
  user_id     text not null,
  endpoint    text not null,
  p256dh      text not null default '',
  auth        text not null default '',
  fcm_token   text,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists push_sub_user_idx on push_subscriptions (user_id);
