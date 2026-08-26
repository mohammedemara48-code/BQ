import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { pairIds } from "@/lib/utils";
import {
  ensureMe,
  notify,
  notifyAdmins,
  toProfile,
  type ProfileRow,
} from "./server";
import type {
  AdminMail,
  Message,
  ReportRow,
  Room,
  RoomMessage,
  Story,
  VerifyRequest,
} from "./types";

async function isAdmin(userId: string): Promise<boolean> {
  const me = await ensureMe(userId);
  return me.isAdmin;
}

export const listStories = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      user_id: string;
      type: string;
      text: string;
      file_url: string | null;
      created_at: string;
    }>`
      select s.id, s.user_id, s.type, s.text, s.file_url, s.created_at::text as created_at
      from stories s
      join profiles p on p.user_id = s.user_id
      where s.expires_at > now()
        and p.is_community = false
      order by (s.user_id = ${context.userId}) desc, s.created_at desc
    `;
    return rows.map(
      (r): Story => ({
        id: r.id,
        userId: r.user_id,
        type: r.type,
        text: r.text,
        fileUrl: r.file_url,
        createdAt: r.created_at,
      }),
    );
  });

export const addStory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        type: z.enum(["image", "video", "text"]),
        text: z.string().max(180).optional(),
        fileUrl: z.string().max(450_000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.type !== "text" && !data.fileUrl) return { ok: false as const };
    const sql = await getSql();
    await ensureMe(context.userId);
    await sql`
      insert into stories (user_id, type, text, file_url)
      values (${context.userId}, ${data.type}, ${data.text ?? ""}, ${data.fileUrl ?? null})
    `;
    return { ok: true as const };
  });

export const deleteStory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`delete from stories where id = ${data.id} and user_id = ${context.userId}`;
    return { ok: true as const };
  });

async function ensurePublicRoom(ownerId: string, ownerName: string) {
  const sql = await getSql();
  const existing = await sql<{ id: number }>`select id from rooms order by id asc limit 1`;
  if (existing[0]) return existing[0].id;
  const inserted = await sql<{ id: number }>`
    insert into rooms (name, topic, owner_id)
    values (${"الغرفة العامة"}, ${"تعارف ودردشة للجميع"}, ${ownerId})
    returning id
  `;
  const id = inserted[0]!.id;
  await sql`
    insert into room_members (room_id, user_id) values (${id}, ${ownerId})
    on conflict do nothing
  `;
  await sql`
    insert into room_messages (room_id, sender_id, type, text)
    values (${id}, ${"system"}, ${"text"}, ${`${ownerName || "Manager"} يحيكم`})
  `;
  return id;
}

export const listRooms = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await ensureMe(context.userId);
    await ensurePublicRoom(me.isAdmin ? me.userId : me.userId, me.isAdmin ? me.name : "Manager");
    const sql = await getSql();
    if (me.isAdmin) {
      const named = await sql<{ user_id: string; name: string }>`
        select user_id, name from profiles where is_admin = true limit 1
      `;
      const owner = named[0];
      if (owner) await ensurePublicRoom(owner.user_id, owner.name || "Manager");
    } else {
      const owner = await sql<{ user_id: string; name: string }>`
        select user_id, name from profiles where is_admin = true limit 1
      `;
      if (owner[0]) await ensurePublicRoom(owner[0].user_id, owner[0].name || "Manager");
      else await ensurePublicRoom(context.userId, "Manager");
    }
    const rows = await sql<{
      id: number;
      name: string;
      topic: string;
      photo_url: string;
      owner_id: string;
      member_count: number;
      joined: boolean;
      speaker_on: boolean;
      last_text: string | null;
      last_at: string | null;
    }>`
      select
        r.id, r.name, r.topic, r.photo_url, r.owner_id,
        (select count(*)::int from room_members m where m.room_id = r.id) as member_count,
        exists(select 1 from room_members m where m.room_id = r.id and m.user_id = ${context.userId}) as joined,
        coalesce((
          select speaker_on from room_members m
          where m.room_id = r.id and m.user_id = ${context.userId}
        ), false) as speaker_on,
        (
          select text from room_messages rm where rm.room_id = r.id order by id desc limit 1
        ) as last_text,
        (
          select created_at::text from room_messages rm where rm.room_id = r.id order by id desc limit 1
        ) as last_at
      from rooms r
      order by r.id asc
    `;
    return rows.map(
      (r): Room => ({
        id: r.id,
        name: r.name,
        topic: r.topic,
        photoUrl: r.photo_url,
        ownerId: r.owner_id,
        memberCount: r.member_count,
        joined: Boolean(r.joined),
        speakerOn: Boolean(r.speaker_on),
        lastText: r.last_text ?? "",
        lastAt: r.last_at,
      }),
    );
  });

export const createRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z.object({ name: z.string().min(2).max(40), topic: z.string().max(80).optional() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await ensureMe(context.userId);
    const sql = await getSql();
    const inserted = await sql<{ id: number }>`
      insert into rooms (name, topic, owner_id)
      values (${data.name.trim()}, ${data.topic?.trim() ?? ""}, ${context.userId})
      returning id
    `;
    const id = inserted[0]!.id;
    await sql`
      insert into room_members (room_id, user_id) values (${id}, ${context.userId})
    `;
    await sql`
      insert into room_messages (room_id, sender_id, type, text)
      values (${id}, ${"system"}, ${"text"}, ${`${me.name || "Manager"} يحيكم`})
    `;
    return { ok: true as const, id };
  });

export const joinRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number }) => z.object({ roomId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await ensureMe(context.userId);
    const sql = await getSql();
    const room = await sql<{ id: number }>`select id from rooms where id = ${data.roomId} limit 1`;
    if (!room[0]) return { ok: false as const };
    const already = await sql<{ n: number }>`
      select count(*)::int as n from room_members
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    if ((already[0]?.n ?? 0) > 0) return { ok: true as const, joined: true };
    await sql`
      insert into room_members (room_id, user_id)
      values (${data.roomId}, ${context.userId})
      on conflict do nothing
    `;
    await sql`
      insert into room_messages (room_id, sender_id, type, text)
      values (
        ${data.roomId}, ${"system"}, ${"text"},
        ${`${me.name} دخل الغرفة. Manager يحيكم`}
      )
    `;
    return { ok: true as const, joined: true };
  });

export const leaveRoom = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number }) => z.object({ roomId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from room_members
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    return { ok: true as const };
  });

export const setRoomSpeaker = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number; on: boolean }) =>
    z.object({ roomId: z.number().int(), on: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      update room_members set speaker_on = ${data.on}
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    return { ok: true as const, on: data.on };
  });

export const listRoomMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { roomId: number }) => z.object({ roomId: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const member = await sql<{ n: number }>`
      select count(*)::int as n from room_members
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    const admin = await isAdmin(context.userId);
    if ((member[0]?.n ?? 0) === 0 && !admin) return [] as RoomMessage[];
    const rows = await sql<{
      id: number;
      room_id: number;
      sender_id: string;
      type: string;
      text: string;
      file_url: string | null;
      duration_sec: number;
      created_at: string;
      name: string | null;
      photo_url: string | null;
    }>`
      select rm.id, rm.room_id, rm.sender_id, rm.type, rm.text, rm.file_url,
             rm.duration_sec, rm.created_at::text as created_at,
             p.name, p.photo_url
      from room_messages rm
      left join profiles p on p.user_id = rm.sender_id
      where rm.room_id = ${data.roomId}
      order by rm.id asc
    `;
    return rows.map(
      (r): RoomMessage => ({
        id: r.id,
        roomId: r.room_id,
        senderId: r.sender_id,
        senderName: r.sender_id === "system" ? "BQ" : r.name || "عضو",
        senderPhoto: r.photo_url || "",
        type: r.type,
        text: r.text,
        fileUrl: r.file_url,
        durationSec: r.duration_sec ?? 0,
        createdAt: r.created_at,
        system: r.sender_id === "system",
      }),
    );
  });

export const sendRoomMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        roomId: z.number().int(),
        text: z.string().max(2000),
        type: z.enum(["text", "image", "video", "file", "voice"]).default("text"),
        fileUrl: z.string().max(450_000).nullable().optional(),
        durationSec: z.number().int().min(0).max(180).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const member = await sql<{ n: number }>`
      select count(*)::int as n from room_members
      where room_id = ${data.roomId} and user_id = ${context.userId}
    `;
    if ((member[0]?.n ?? 0) === 0) return { ok: false as const };
    const text = data.text.trim();
    if (!text && !data.fileUrl) return { ok: false as const };
    await sql`
      insert into room_messages (room_id, sender_id, type, text, file_url, duration_sec)
      values (
        ${data.roomId}, ${context.userId}, ${data.type}, ${text},
        ${data.fileUrl ?? null}, ${data.durationSec ?? 0}
      )
    `;
    return { ok: true as const };
  });

export const requestVerify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ note: z.string().max(200).optional() }).parse(d))
  .handler(async ({ context, data }) => {
    const me = await ensureMe(context.userId);
    if (me.verified) return { ok: true as const, already: true };
    const sql = await getSql();
    const pending = await sql<{ n: number }>`
      select count(*)::int as n from verify_requests
      where user_id = ${context.userId} and status = 'pending'
    `;
    if ((pending[0]?.n ?? 0) > 0) return { ok: true as const, already: true };
    await sql`
      insert into verify_requests (user_id, note, status)
      values (${context.userId}, ${data.note ?? ""}, ${"pending"})
    `;
    await notifyAdmins("verify", context.userId, "طلب توثيق");
    return { ok: true as const, already: false };
  });

export const contactAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => z.object({ body: z.string().min(2).max(500) }).parse(d))
  .handler(async ({ context, data }) => {
    await ensureMe(context.userId);
    const sql = await getSql();
    await sql`
      insert into admin_inbox (user_id, body, status)
      values (${context.userId}, ${data.body.trim()}, ${"open"})
    `;
    await notifyAdmins("mail", context.userId, "طلب تواصل مع الإدارة");
    return { ok: true as const };
  });

export const listAdminReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return [] as ReportRow[];
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      kind: string;
      reporter_id: string;
      reporter_name: string;
      target_id: string;
      target_name: string;
      reason: string;
      snippet: string;
      message_id: number | null;
      room_id: number | null;
      room_message_id: number | null;
      peer_a: string;
      peer_b: string;
      status: string;
      created_at: string;
    }>`
      select r.id, r.kind, r.reporter_id, coalesce(a.name, 'عضو') as reporter_name,
             r.target_id, coalesce(b.name, 'عضو') as target_name,
             r.reason, r.snippet, r.message_id, r.room_id, r.room_message_id,
             r.peer_a, r.peer_b, r.status, r.created_at::text as created_at
      from reports r
      left join profiles a on a.user_id = r.reporter_id
      left join profiles b on b.user_id = r.target_id
      order by (r.status = 'open') desc, r.id desc
      limit 80
    `;
    return rows.map(
      (r): ReportRow => ({
        id: r.id,
        kind: r.kind,
        reporterId: r.reporter_id,
        reporterName: r.reporter_name,
        targetId: r.target_id,
        targetName: r.target_name,
        reason: r.reason,
        snippet: r.snippet,
        messageId: r.message_id,
        roomId: r.room_id,
        roomMessageId: r.room_message_id,
        peerA: r.peer_a,
        peerB: r.peer_b,
        status: r.status,
        createdAt: r.created_at,
      }),
    );
  });

export const listVerifyRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return [] as VerifyRequest[];
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      user_id: string;
      name: string;
      photo_url: string;
      note: string;
      status: string;
      created_at: string;
    }>`
      select v.id, v.user_id, coalesce(p.name, 'عضو') as name,
             coalesce(p.photo_url, '') as photo_url,
             v.note, v.status, v.created_at::text as created_at
      from verify_requests v
      left join profiles p on p.user_id = v.user_id
      order by (v.status = 'pending') desc, v.id desc
      limit 80
    `;
    return rows.map(
      (r): VerifyRequest => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        photoUrl: r.photo_url,
        note: r.note,
        status: r.status,
        createdAt: r.created_at,
      }),
    );
  });

export const listAdminMail = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    if (!(await isAdmin(context.userId))) return [] as AdminMail[];
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      user_id: string;
      name: string;
      photo_url: string;
      body: string;
      status: string;
      created_at: string;
    }>`
      select m.id, m.user_id, coalesce(p.name, 'عضو') as name,
             coalesce(p.photo_url, '') as photo_url,
             m.body, m.status, m.created_at::text as created_at
      from admin_inbox m
      left join profiles p on p.user_id = m.user_id
      order by (m.status = 'open') desc, m.id desc
      limit 80
    `;
    return rows.map(
      (r): AdminMail => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        photoUrl: r.photo_url,
        body: r.body,
        status: r.status,
        createdAt: r.created_at,
      }),
    );
  });

export const decideVerify = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; accept: boolean }) =>
    z.object({ id: z.number().int(), accept: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) return { ok: false as const };
    const sql = await getSql();
    const rows = await sql<{ user_id: string }>`
      select user_id from verify_requests where id = ${data.id} limit 1
    `;
    const uid = rows[0]?.user_id;
    if (!uid) return { ok: false as const };
    const status = data.accept ? "accepted" : "declined";
    await sql`update verify_requests set status = ${status} where id = ${data.id}`;
    if (data.accept) {
      await sql`update profiles set verified = true where user_id = ${uid}`;
      await notify(uid, "verify_ok", context.userId, "تم توثيق حسابك");
    } else {
      await notify(uid, "verify_no", context.userId, "رُفض طلب التوثيق");
    }
    return { ok: true as const };
  });

export const closeAdminMail = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) return { ok: false as const };
    const sql = await getSql();
    await sql`update admin_inbox set status = ${"closed"} where id = ${data.id}`;
    return { ok: true as const };
  });

export const resolveReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        id: z.number().int(),
        action: z.enum(["dismiss", "delete_message", "remove_user"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) return { ok: false as const };
    const sql = await getSql();
    const rows = await sql<{
      target_id: string;
      message_id: number | null;
      room_message_id: number | null;
    }>`
      select target_id, message_id, room_message_id from reports where id = ${data.id} limit 1
    `;
    const row = rows[0];
    if (!row) return { ok: false as const };
    if (data.action === "delete_message") {
      if (row.message_id) await sql`delete from messages where id = ${row.message_id}`;
      if (row.room_message_id) await sql`delete from room_messages where id = ${row.room_message_id}`;
    }
    if (data.action === "remove_user" && row.target_id !== context.userId) {
      await sql`delete from messages where user_a = ${row.target_id} or user_b = ${row.target_id}`;
      await sql`delete from room_members where user_id = ${row.target_id}`;
      await sql`delete from profiles where user_id = ${row.target_id} and is_admin = false`;
    }
    await sql`update reports set status = ${"closed"} where id = ${data.id}`;
    return { ok: true as const };
  });

export const adminListThread = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        peerA: z.string().min(1).optional(),
        peerB: z.string().min(1).optional(),
        roomId: z.number().int().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) {
      return { kind: "none" as const, messages: [] as Message[], room: [] as RoomMessage[] };
    }
    const sql = await getSql();
    if (data.roomId) {
      const rows = await sql<{
        id: number;
        room_id: number;
        sender_id: string;
        type: string;
        text: string;
        file_url: string | null;
        duration_sec: number;
        created_at: string;
        name: string | null;
        photo_url: string | null;
      }>`
        select rm.id, rm.room_id, rm.sender_id, rm.type, rm.text, rm.file_url,
               rm.duration_sec, rm.created_at::text as created_at, p.name, p.photo_url
        from room_messages rm
        left join profiles p on p.user_id = rm.sender_id
        where rm.room_id = ${data.roomId}
        order by rm.id asc
      `;
      return {
        kind: "room" as const,
        messages: [] as Message[],
        room: rows.map(
          (r): RoomMessage => ({
            id: r.id,
            roomId: r.room_id,
            senderId: r.sender_id,
            senderName: r.sender_id === "system" ? "BQ" : r.name || "عضو",
            senderPhoto: r.photo_url || "",
            type: r.type,
            text: r.text,
            fileUrl: r.file_url,
            durationSec: r.duration_sec ?? 0,
            createdAt: r.created_at,
            system: r.sender_id === "system",
          }),
        ),
      };
    }
    if (!data.peerA || !data.peerB) {
      return { kind: "none" as const, messages: [] as Message[], room: [] as RoomMessage[] };
    }
    const [a, b] = pairIds(data.peerA, data.peerB);
    const rows = await sql<{
      id: number;
      sender_id: string;
      type: string;
      text: string;
      file_url: string | null;
      view_once: boolean;
      opened: boolean;
      duration_sec: number;
      created_at: string;
      delivered: boolean;
      seen_at: string | null;
    }>`
      select id, sender_id, type, text, file_url, view_once, opened,
             duration_sec, created_at::text as created_at,
             delivered, seen_at::text as seen_at
      from messages
      where user_a = ${a} and user_b = ${b}
      order by id asc
    `;
    return {
      kind: "dm" as const,
      messages: rows.map(
        (r): Message => ({
          id: r.id,
          senderId: r.sender_id,
          type: r.type,
          text: r.text,
          fileUrl: r.file_url,
          viewOnce: r.view_once,
          opened: r.opened,
          durationSec: r.duration_sec ?? 0,
          createdAt: r.created_at,
          delivered: Boolean(r.delivered),
          seenAt: r.seen_at,
          receipt: r.seen_at ? "seen" : r.delivered ? "delivered" : "sent",
        }),
      ),
      room: [] as RoomMessage[],
    };
  });

export const adminGetPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { ids: string[] }) =>
    z.object({ ids: z.array(z.string()).max(4) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (!(await isAdmin(context.userId))) return [];
    const sql = await getSql();
    const out = [];
    for (const id of data.ids) {
      const rows = await sql<ProfileRow>`select * from profiles where user_id = ${id} limit 1`;
      if (rows[0]) out.push(toProfile(rows[0]));
    }
    return out;
  });
