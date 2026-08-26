create table if not exists live_calls (
  id           serial primary key,
  caller_id    text not null,
  callee_id    text not null,
  kind         text not null,
  status       text not null default 'ringing',
  created_at   timestamptz not null default now(),
  answered_at  timestamptz,
  ended_at     timestamptz,
  ended_by     text
);
create index if not exists live_calls_callee_idx on live_calls (callee_id, status, created_at desc);
create index if not exists live_calls_caller_idx on live_calls (caller_id, status);

create table if not exists call_signals (
  id          serial primary key,
  call_id     integer not null,
  from_id     text not null,
  kind        text not null,
  payload     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists call_signals_call_idx on call_signals (call_id, id);
