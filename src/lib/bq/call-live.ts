import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { pairIds } from "@/lib/utils";
import { allowThread, blockedSet, ensureMe, notify } from "./server";

export type LiveCallRow = {
  id: number;
  callerId: string;
  calleeId: string;
  kind: "audio" | "video";
  status: "ringing" | "live" | "ended" | "missed" | "declined";
  callerName: string;
  callerPhoto: string;
  calleeName: string;
  calleePhoto: string;
  createdAt: string;
};

export type CallSignalRow = {
  id: number;
  fromId: string;
  kind: string;
  payload: string;
};

function fmtDur(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, Math.floor(sec % 60));
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function insertCallMessage(
  callerId: string,
  calleeId: string,
  kind: string,
  result: "ended" | "missed" | "declined",
  duration: number,
) {
  const sql = await getSql();
  const [a, b] = pairIds(callerId, calleeId);
  const video = kind === "video";
  const text =
    result === "declined"
      ? video
        ? "مكالمة فيديو مرفوضة"
        : "مكالمة مرفوضة"
      : result === "missed"
        ? video
          ? "مكالمة فيديو فائتة"
          : "مكالمة فائتة"
        : video
          ? `مكالمة فيديو · ${fmtDur(duration)}`
          : `مكالمة · ${fmtDur(duration)}`;
  await sql`
    insert into messages (user_a, user_b, sender_id, type, text, delivered)
    values (${a}, ${b}, ${callerId}, ${"call"}, ${text}, ${true})
  `;
  await allowThread(callerId, calleeId);
  await allowThread(calleeId, callerId);
}

async function expireStale() {
  const sql = await getSql();
  const missed = await sql<{
    id: number;
    caller_id: string;
    callee_id: string;
    kind: string;
  }>`
    update live_calls
    set status = 'missed', ended_at = now()
    where status = 'ringing'
      and created_at < now() - interval '70 seconds'
    returning id, caller_id, callee_id, kind
  `;
  for (const row of missed) {
    await sql`
      insert into calls (user_id, peer_id, kind, direction, duration_sec)
      values
        (${row.caller_id}, ${row.callee_id}, ${row.kind}, ${"out"}, ${0}),
        (${row.callee_id}, ${row.caller_id}, ${row.kind}, ${"in"}, ${0})
    `;
    await insertCallMessage(row.caller_id, row.callee_id, row.kind, "missed", 0);
  }
  await sql`
    update live_calls
    set status = 'ended', ended_at = coalesce(ended_at, now())
    where status = 'live'
      and coalesce(answered_at, created_at) < now() - interval '2 hours'
  `;
}

function mapCall(r: {
  id: number;
  caller_id: string;
  callee_id: string;
  kind: string;
  status: string;
  caller_name: string;
  caller_photo: string;
  callee_name: string;
  callee_photo: string;
  created_at: string;
}): LiveCallRow {
  return {
    id: r.id,
    callerId: r.caller_id,
    calleeId: r.callee_id,
    kind: r.kind === "video" ? "video" : "audio",
    status: r.status as LiveCallRow["status"],
    callerName: r.caller_name || "شخص",
    callerPhoto: r.caller_photo || "",
    calleeName: r.callee_name || "شخص",
    calleePhoto: r.callee_photo || "",
    createdAt: r.created_at,
  };
}

export const placeCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ peerId: z.string().min(1).max(120), kind: z.enum(["audio", "video"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.peerId === context.userId) return { ok: false as const, reason: "self" };
    const blocked = await blockedSet(context.userId);
    if (blocked.has(data.peerId)) return { ok: false as const, reason: "blocked" };
    const me = await ensureMe(context.userId);
    const sql = await getSql();
    const peer = await sql<{ n: number }>`
      select count(*)::int as n from profiles
      where user_id = ${data.peerId} and is_community = false
    `;
    if ((peer[0]?.n ?? 0) === 0) return { ok: false as const, reason: "missing" };
    await expireStale();
    const busy = await sql<{ n: number }>`
      select count(*)::int as n from live_calls
      where status in ('ringing', 'live')
        and (caller_id = ${data.peerId} or callee_id = ${data.peerId})
    `;
    if ((busy[0]?.n ?? 0) > 0) return { ok: false as const, reason: "busy" };
    await sql`
      update live_calls
      set status = 'ended', ended_at = now(), ended_by = ${context.userId}
      where status in ('ringing', 'live')
        and (caller_id = ${context.userId} or callee_id = ${context.userId})
    `;
    const inserted = await sql<{ id: number }>`
      insert into live_calls (caller_id, callee_id, kind, status)
      values (${context.userId}, ${data.peerId}, ${data.kind}, ${"ringing"})
      returning id
    `;
    const id = inserted[0]!.id;
    await notify(
      data.peerId,
      "call",
      context.userId,
      data.kind === "video" ? `مكالمة فيديو من ${me.name}` : `مكالمة من ${me.name}`,
    );
    return { ok: true as const, id };
  });

export const incomingCall = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await expireStale();
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      caller_id: string;
      callee_id: string;
      kind: string;
      status: string;
      caller_name: string;
      caller_photo: string;
      callee_name: string;
      callee_photo: string;
      created_at: string;
    }>`
      select lc.id, lc.caller_id, lc.callee_id, lc.kind, lc.status,
             coalesce(a.name, 'شخص') as caller_name, coalesce(a.photo_url, '') as caller_photo,
             coalesce(b.name, 'شخص') as callee_name, coalesce(b.photo_url, '') as callee_photo,
             lc.created_at::text as created_at
      from live_calls lc
      left join profiles a on a.user_id = lc.caller_id
      left join profiles b on b.user_id = lc.callee_id
      where lc.callee_id = ${context.userId} and lc.status = 'ringing'
      order by lc.id desc
      limit 1
    `;
    return rows[0] ? mapCall(rows[0]) : null;
  });

export const pollCall = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ callId: z.coerce.number().int(), since: z.coerce.number().int().min(0).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await expireStale();
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      caller_id: string;
      callee_id: string;
      kind: string;
      status: string;
      caller_name: string;
      caller_photo: string;
      callee_name: string;
      callee_photo: string;
      created_at: string;
    }>`
      select lc.id, lc.caller_id, lc.callee_id, lc.kind, lc.status,
             coalesce(a.name, 'شخص') as caller_name, coalesce(a.photo_url, '') as caller_photo,
             coalesce(b.name, 'شخص') as callee_name, coalesce(b.photo_url, '') as callee_photo,
             lc.created_at::text as created_at
      from live_calls lc
      left join profiles a on a.user_id = lc.caller_id
      left join profiles b on b.user_id = lc.callee_id
      where lc.id = ${data.callId}
        and (lc.caller_id = ${context.userId} or lc.callee_id = ${context.userId})
      limit 1
    `;
    const call = rows[0] ? mapCall(rows[0]) : null;
    if (!call) return { call: null, signals: [] as CallSignalRow[] };
    const since = data.since ?? 0;
    const sigs = await sql<{ id: number; from_id: string; kind: string; payload: string }>`
      select id, from_id, kind, payload from call_signals
      where call_id = ${data.callId} and id > ${since}
      order by id asc
      limit 200
    `;
    return {
      call,
      signals: sigs.map(
        (s): CallSignalRow => ({
          id: s.id,
          fromId: s.from_id,
          kind: s.kind,
          payload: s.payload,
        }),
      ),
    };
  });

export const answerCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ callId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      update live_calls
      set status = 'live', answered_at = now()
      where id = ${data.callId} and callee_id = ${context.userId} and status = 'ringing'
      returning id
    `;
    return { ok: Boolean(rows[0]) };
  });

export const endCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ callId: z.number().int(), reason: z.enum(["hang", "decline"]).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      caller_id: string;
      callee_id: string;
      kind: string;
      status: string;
      answered_at: string | null;
    }>`
      select id, caller_id, callee_id, kind, status, answered_at::text as answered_at
      from live_calls
      where id = ${data.callId}
        and (caller_id = ${context.userId} or callee_id = ${context.userId})
      limit 1
    `;
    const row = rows[0];
    if (!row) return { ok: false as const };
    if (row.status === "ended" || row.status === "missed" || row.status === "declined") {
      return { ok: true as const };
    }
    const reason =
      data.reason === "decline" ? "declined" : row.status === "ringing" ? "missed" : "ended";
    await sql`
      update live_calls
      set status = ${reason}, ended_at = now(), ended_by = ${context.userId}
      where id = ${data.callId}
    `;
    await sql`
      update live_calls
      set status = 'ended', ended_at = now(), ended_by = ${context.userId}
      where status in ('ringing', 'live')
        and id <> ${data.callId}
        and (caller_id = ${context.userId} or callee_id = ${context.userId})
    `;
    let duration = 0;
    if (row.answered_at && reason === "ended") {
      duration = Math.max(1, Math.round((Date.now() - new Date(row.answered_at).getTime()) / 1000));
    }
    await sql`
      insert into calls (user_id, peer_id, kind, direction, duration_sec)
      values
        (${row.caller_id}, ${row.callee_id}, ${row.kind}, ${"out"}, ${duration}),
        (${row.callee_id}, ${row.caller_id}, ${row.kind}, ${"in"}, ${duration})
    `;
    await insertCallMessage(row.caller_id, row.callee_id, row.kind, reason, duration);
    return { ok: true as const };
  });

export const postCallSignal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        callId: z.number().int(),
        kind: z.enum(["offer", "answer", "ice"]),
        payload: z.string().min(2).max(40_000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<{ n: number }>`
      select count(*)::int as n from live_calls
      where id = ${data.callId}
        and (caller_id = ${context.userId} or callee_id = ${context.userId})
        and status in ('ringing', 'live')
    `;
    if ((rows[0]?.n ?? 0) === 0) return { ok: false as const };
    await sql`
      insert into call_signals (call_id, from_id, kind, payload)
      values (${data.callId}, ${context.userId}, ${data.kind}, ${data.payload})
    `;
    return { ok: true as const };
  });
