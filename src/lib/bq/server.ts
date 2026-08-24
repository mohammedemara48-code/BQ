import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { haversineKm, pairIds } from "@/lib/utils";
import { COMMUNITY, communityById, isCommunityId } from "./community";
import type {
  CallLog,
  ChatPreview,
  ConnectRequest,
  Intent,
  Message,
  Notice,
  Profile,
  Role,
} from "./types";

type ProfileRow = {
  user_id: string;
  name: string;
  bio: string;
  pronouns: string;
  city: string;
  looking_for: string;
  interests: string;
  photo_url: string;
  cover_url: string;
  online: boolean;
  is_community: boolean;
  is_admin: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  role: string;
  intent: string;
  phone: string;
  show_on_map: boolean;
  gallery: string;
  private_gallery: string;
};

function parseList(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function toProfile(
  row: ProfileRow,
  opts: {
    includeCoords?: boolean;
    includePrivate?: boolean;
    granted?: boolean;
    distanceKm?: number | null;
  } = {},
): Profile {
  const gallery = parseList(row.gallery ?? "[]");
  const priv = parseList(row.private_gallery ?? "[]");
  const showPrivate = Boolean(opts.includePrivate);
  return {
    userId: row.user_id,
    name: row.name,
    bio: row.bio,
    pronouns: row.pronouns,
    city: row.city,
    lookingFor: row.looking_for,
    interests: parseList(row.interests),
    photoUrl: row.photo_url,
    coverUrl: row.cover_url,
    online: row.online,
    isCommunity: row.is_community,
    isAdmin: Boolean(row.is_admin),
    role: (row.role as Role) || "",
    intent: (row.intent as Intent) || "",
    phone: opts.includeCoords ? row.phone || "" : "",
    showOnMap: Boolean(row.show_on_map),
    gallery,
    privateGallery: showPrivate ? priv : [],
    hasPrivate: priv.length > 0,
    privateGranted: Boolean(opts.granted) || showPrivate,
    distanceKm: opts.distanceKm ?? null,
    latitude: opts.includeCoords ? row.latitude : null,
    longitude: opts.includeCoords ? row.longitude : null,
    createdAt: row.created_at,
  };
}

async function seedCommunity() {
  const sql = await getSql();
  const stale = await sql<{ user_id: string }>`
    select user_id from profiles
    where is_community = true and user_id like 'c:%'
  `;
  if (stale.length > 0) {
    await sql`delete from messages where user_a like 'c:%' or user_b like 'c:%'`;
    await sql`delete from requests where from_id like 'c:%' or to_id like 'c:%'`;
    await sql`delete from calls where peer_id like 'c:%'`;
    await sql`delete from profiles where is_community = true and user_id like 'c:%'`;
  }
  for (const p of COMMUNITY) {
    await sql`
      insert into profiles (
        user_id, name, bio, pronouns, city, looking_for, interests,
        photo_url, online, is_community, role, intent, latitude, longitude, show_on_map,
        gallery, private_gallery
      ) values (
        ${p.id}, ${p.name}, ${p.bio}, ${p.pronouns}, ${p.city}, ${p.lookingFor},
        ${JSON.stringify(p.interests)}, ${p.photoUrl}, ${p.online}, ${true},
        ${p.role}, ${p.intent}, ${p.latitude}, ${p.longitude}, ${true},
        ${JSON.stringify(p.photoUrl ? [p.photoUrl] : [])},
        ${JSON.stringify(p.hasPrivatePhotos && p.photoUrl ? [p.photoUrl] : [])}
      )
      on conflict (user_id) do update set
        name = excluded.name,
        bio = excluded.bio,
        photo_url = excluded.photo_url,
        online = excluded.online,
        city = excluded.city,
        looking_for = excluded.looking_for,
        interests = excluded.interests,
        pronouns = excluded.pronouns,
        role = excluded.role,
        intent = excluded.intent,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        gallery = excluded.gallery,
        private_gallery = excluded.private_gallery
    `;
  }
}

async function claimOwnerIfOpen(userId: string): Promise<boolean> {
  const sql = await getSql();
  await sql`
    update profiles set is_admin = true
    where user_id = ${userId}
      and is_community = false
      and not exists (
        select 1 from profiles p2 where p2.is_admin = true
      )
  `;
  const rows = await sql<{ is_admin: boolean }>`
    select is_admin from profiles where user_id = ${userId} limit 1
  `;
  return Boolean(rows[0]?.is_admin);
}

async function notify(userId: string, kind: string, fromId: string, text: string) {
  if (userId === fromId) return;
  const sql = await getSql();
  await sql`
    insert into notifications (user_id, kind, from_id, text)
    values (${userId}, ${kind}, ${fromId}, ${text})
  `;
}

async function blockedSet(userId: string): Promise<Set<string>> {
  const sql = await getSql();
  const rows = await sql<{ other: string }>`
    select blocked_id as other from blocks where blocker_id = ${userId}
    union
    select blocker_id as other from blocks where blocked_id = ${userId}
  `;
  return new Set(rows.map((r) => r.other));
}

async function ensureMe(
  userId: string,
  hint?: { name?: string | null; image?: string | null },
): Promise<Profile> {
  const sql = await getSql();
  await seedCommunity();
  const existing = await sql<ProfileRow>`
    select * from profiles where user_id = ${userId} limit 1
  `;
  if (existing[0]) {
    await sql`update profiles set online = true, updated_at = now() where user_id = ${userId}`;
    if (!existing[0].is_admin) await claimOwnerIfOpen(userId);
    const fresh = await sql<ProfileRow>`select * from profiles where user_id = ${userId} limit 1`;
    return toProfile({ ...fresh[0]!, online: true }, { includeCoords: true, includePrivate: true, granted: true });
  }
  const name = (hint?.name ?? "").trim() || "عضو جديد";
  const photo = hint?.image ?? "";
  await sql`
    insert into profiles (user_id, name, photo_url, online, is_community, looking_for, city, is_admin)
    values (${userId}, ${name}, ${photo}, ${true}, ${false}, ${"تعارف"}, ${""}, ${false})
  `;
  await claimOwnerIfOpen(userId);
  const created = await sql<ProfileRow>`select * from profiles where user_id = ${userId}`;
  return toProfile(created[0]!, { includeCoords: true, includePrivate: true, granted: true });
}

const idInput = z.object({ peerId: z.string().min(1).max(120) });

export const getMe = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return ensureMe(context.userId);
  });

export const listPeople = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await seedCommunity();
    const sql = await getSql();
    const meRow = await sql<ProfileRow>`
      select * from profiles where user_id = ${context.userId} limit 1
    `;
    const me = meRow[0];
    const blocked = await blockedSet(context.userId);
    const rows = await sql<ProfileRow>`
      select * from profiles
      where user_id <> ${context.userId}
        and (is_community = true or length(trim(bio)) > 0 or length(trim(photo_url)) > 0 or length(trim(role)) > 0)
      order by online desc, name asc
    `;
    return rows
      .filter((r) => !blocked.has(r.user_id))
      .map((r) => {
        let distanceKm: number | null = null;
        if (
          r.show_on_map &&
          r.latitude != null &&
          r.longitude != null &&
          me?.latitude != null &&
          me.longitude != null
        ) {
          distanceKm = haversineKm(me.latitude, me.longitude, r.latitude, r.longitude);
        }
        return toProfile(r, { distanceKm });
      });
  });

export const getPerson = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    if (data.id === context.userId) {
      return ensureMe(context.userId);
    }
    const blocked = await blockedSet(context.userId);
    if (blocked.has(data.id)) return null;
    const sql = await getSql();
    const rows = await sql<ProfileRow>`
      select * from profiles where user_id = ${data.id} limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const grant = await sql<{ n: number }>`
      select count(*)::int as n from photo_access
      where owner_id = ${data.id} and viewer_id = ${context.userId}
    `;
    const granted = (grant[0]?.n ?? 0) > 0;
    return toProfile(row, { includePrivate: granted, granted });
  });

const profilePatch = z.object({
  name: z.string().min(1).max(60).optional(),
  bio: z.string().max(280).optional(),
  pronouns: z.string().max(40).optional(),
  city: z.string().max(60).optional(),
  lookingFor: z.string().max(60).optional(),
  interests: z.array(z.string().max(24)).max(12).optional(),
  photoUrl: z.string().max(350_000).optional(),
  coverUrl: z.string().max(350_000).optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  role: z.enum(["سالب", "موجب", "تبادل", ""]).optional(),
  intent: z.enum(["مواعدة", "مقابلة", "دردشة", ""]).optional(),
  phone: z.string().max(24).optional(),
  showOnMap: z.boolean().optional(),
  gallery: z.array(z.string().max(350_000)).max(8).optional(),
  privateGallery: z.array(z.string().max(350_000)).max(8).optional(),
});

export const updateMe = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => profilePatch.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await ensureMe(context.userId);
    const interests = data.interests ? JSON.stringify(data.interests) : null;
    const gallery = data.gallery ? JSON.stringify(data.gallery) : null;
    const priv = data.privateGallery ? JSON.stringify(data.privateGallery) : null;
    const looking = data.intent ?? data.lookingFor ?? null;
    await sql`
      update profiles set
        name = coalesce(${data.name ?? null}, name),
        bio = coalesce(${data.bio ?? null}, bio),
        pronouns = coalesce(${data.pronouns ?? null}, pronouns),
        city = coalesce(${data.city ?? null}, city),
        looking_for = coalesce(${looking}, looking_for),
        interests = coalesce(${interests}, interests),
        photo_url = coalesce(${data.photoUrl ?? null}, photo_url),
        cover_url = coalesce(${data.coverUrl ?? null}, cover_url),
        role = coalesce(${data.role ?? null}, role),
        intent = coalesce(${data.intent ?? null}, intent),
        phone = coalesce(${data.phone ?? null}, phone),
        show_on_map = coalesce(${data.showOnMap ?? null}, show_on_map),
        gallery = coalesce(${gallery}, gallery),
        private_gallery = coalesce(${priv}, private_gallery),
        latitude = case when ${data.latitude !== undefined} then ${data.latitude ?? null} else latitude end,
        longitude = case when ${data.longitude !== undefined} then ${data.longitude ?? null} else longitude end,
        updated_at = now()
      where user_id = ${context.userId}
    `;
    const rows = await sql<ProfileRow>`select * from profiles where user_id = ${context.userId}`;
    return toProfile(rows[0]!, { includeCoords: true, includePrivate: true, granted: true });
  });

export const listChats = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = await sql<{
      peer_id: string;
      text: string;
      type: string;
      sender_id: string;
      created_at: string;
    }>`
      select
        case when user_a = ${me} then user_b else user_a end as peer_id,
        text, type, sender_id, created_at::text as created_at
      from messages
      where (user_a = ${me} or user_b = ${me})
        and id in (
          select max(id) from messages
          where user_a = ${me} or user_b = ${me}
          group by user_a, user_b
        )
      order by created_at desc
    `;
    const previews: ChatPreview[] = rows.map((r) => ({
      peerId: r.peer_id,
      lastText: r.text,
      lastType: r.type,
      lastSenderId: r.sender_id,
      lastAt: r.created_at,
      unread: 0,
    }));
    return previews;
  });

export const listMessages = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((d: { peerId: string }) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    const [a, b] = pairIds(context.userId, data.peerId);
    const sql = await getSql();
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
    }>`
      select id, sender_id, type, text, file_url, view_once, opened,
             duration_sec, created_at::text as created_at
      from messages
      where user_a = ${a} and user_b = ${b}
      order by id asc
    `;
    return rows.map(
      (r): Message => ({
        id: r.id,
        senderId: r.sender_id,
        type: r.type,
        text: r.view_once && !r.opened && r.sender_id !== context.userId
          ? ""
          : r.text,
        fileUrl:
          r.view_once && !r.opened && r.sender_id !== context.userId
            ? null
            : r.file_url,
        viewOnce: r.view_once,
        opened: r.opened,
        durationSec: r.duration_sec ?? 0,
        createdAt: r.created_at,
      }),
    );
  });

const sendInput = z.object({
  peerId: z.string().min(1).max(120),
  text: z.string().max(2000),
  type: z.enum(["text", "image", "video", "file", "voice"]).default("text"),
  fileUrl: z.string().max(450_000).nullable().optional(),
  viewOnce: z.boolean().optional(),
  durationSec: z.number().int().min(0).max(180).optional(),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => sendInput.parse(d))
  .handler(async ({ context, data }) => {
    const text = data.text.trim();
    if (!text && !data.fileUrl) return { ok: false as const };
    const blocked = await blockedSet(context.userId);
    if (blocked.has(data.peerId)) return { ok: false as const };
    const [a, b] = pairIds(context.userId, data.peerId);
    const sql = await getSql();
    await sql`
      insert into messages (user_a, user_b, sender_id, type, text, file_url, view_once, duration_sec)
      values (
        ${a}, ${b}, ${context.userId}, ${data.type}, ${text},
        ${data.fileUrl ?? null}, ${data.viewOnce ?? false}, ${data.durationSec ?? 0}
      )
    `;
    return { ok: true as const };
  });

export const openViewOnce = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number }) => z.object({ id: z.number().int() }).parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const me = context.userId;
    await sql`
      update messages set opened = true
      where id = ${data.id}
        and sender_id <> ${me}
        and (user_a = ${me} or user_b = ${me})
        and view_once = true
    `;
    return { ok: true as const };
  });

export const replyFromPeer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { peerId: string }) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    const seed = communityById(data.peerId);
    if (!seed) return { ok: false as const };
    const [a, b] = pairIds(context.userId, data.peerId);
    const sql = await getSql();
    const countRows = await sql<{ n: number }>`
      select count(*)::int as n from messages
      where user_a = ${a} and user_b = ${b} and sender_id = ${data.peerId}
    `;
    const n = countRows[0]?.n ?? 0;
    const text = seed.replies[n % seed.replies.length] ?? "تمام.";
    await sql`
      insert into messages (user_a, user_b, sender_id, type, text)
      values (${a}, ${b}, ${data.peerId}, ${"text"}, ${text})
    `;
    return { ok: true as const, text };
  });

export const listRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const me = context.userId;
    const rows = await sql<{
      id: number;
      from_id: string;
      to_id: string;
      status: "pending" | "accepted" | "declined";
      created_at: string;
    }>`
      select id, from_id, to_id, status, created_at::text as created_at
      from requests
      where from_id = ${me} or to_id = ${me}
      order by created_at desc
    `;
    return rows.map(
      (r): ConnectRequest => ({
        id: r.id,
        fromId: r.from_id,
        toId: r.to_id,
        status: r.status,
        createdAt: r.created_at,
        direction: r.from_id === me ? "out" : "in",
      }),
    );
  });

export const sendRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { peerId: string }) => idInput.parse(d))
  .handler(async ({ context, data }) => {
    if (data.peerId === context.userId) return { ok: false as const };
    const sql = await getSql();
    const auto = isCommunityId(data.peerId);
    const status = auto ? "accepted" : "pending";
    await sql`
      insert into requests (from_id, to_id, status)
      values (${context.userId}, ${data.peerId}, ${status})
      on conflict (from_id, to_id) do nothing
    `;
    if (status === "pending") {
      await notify(data.peerId, "request", context.userId, "طلب صداقة");
    } else if (status === "accepted") {
      await notify(context.userId, "accepted", data.peerId, "تم قبول طلبك");
    }
    return { ok: true as const, status };
  });

export const respondRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { id: number; accept: boolean }) =>
    z.object({ id: z.number().int(), accept: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const status = data.accept ? "accepted" : "declined";
    await sql`
      update requests set status = ${status}
      where id = ${data.id} and to_id = ${context.userId} and status = 'pending'
    `;
    const rows = await sql<{ from_id: string }>`
      select from_id from requests where id = ${data.id} limit 1
    `;
    const fromId = rows[0]?.from_id;
    if (fromId && data.accept) {
      await notify(fromId, "accepted", context.userId, "تم قبول طلبك");
    }
    return { ok: true as const };
  });

export const listCalls = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      peer_id: string;
      kind: "audio" | "video";
      direction: "in" | "out";
      duration_sec: number;
      created_at: string;
    }>`
      select id, peer_id, kind, direction, duration_sec,
             created_at::text as created_at
      from calls
      where user_id = ${context.userId}
      order by created_at desc
      limit 40
    `;
    return rows.map(
      (r): CallLog => ({
        id: r.id,
        peerId: r.peer_id,
        kind: r.kind,
        direction: r.direction,
        durationSec: r.duration_sec,
        createdAt: r.created_at,
      }),
    );
  });

const callInput = z.object({
  peerId: z.string().min(1).max(120),
  kind: z.enum(["audio", "video"]),
  direction: z.enum(["in", "out"]).default("out"),
  durationSec: z.number().int().min(0).max(36000),
});

export const logCall = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) => callInput.parse(d))
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into calls (user_id, peer_id, kind, direction, duration_sec)
      values (${context.userId}, ${data.peerId}, ${data.kind}, ${data.direction}, ${data.durationSec})
    `;
    return { ok: true as const };
  });

export const signOutPresence = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update profiles set online = false, updated_at = now() where user_id = ${context.userId}`;
    return { ok: true as const };
  });

export const listMembers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await ensureMe(context.userId);
    if (!me.isAdmin) return [] as Profile[];
    const sql = await getSql();
    const rows = await sql<ProfileRow>`
      select * from profiles
      where is_community = false
      order by is_admin desc, created_at asc
    `;
    return rows.map((r) => toProfile(r));
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string }) =>
    z.object({ userId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const me = await ensureMe(context.userId);
    if (!me.isAdmin) return { ok: false as const, reason: "forbidden" };
    if (data.userId === context.userId) {
      return { ok: false as const, reason: "self" };
    }
    const sql = await getSql();
    const target = await sql<ProfileRow>`
      select * from profiles where user_id = ${data.userId} limit 1
    `;
    const row = target[0];
    if (!row || row.is_community || row.is_admin) {
      return { ok: false as const, reason: "protected" };
    }
    await sql`delete from messages where user_a = ${data.userId} or user_b = ${data.userId}`;
    await sql`delete from requests where from_id = ${data.userId} or to_id = ${data.userId}`;
    await sql`delete from calls where user_id = ${data.userId} or peer_id = ${data.userId}`;
    await sql`delete from profiles where user_id = ${data.userId} and is_admin = false and is_community = false`;
    return { ok: true as const };
  });

export const listNotices = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      kind: string;
      from_id: string;
      text: string;
      read: boolean;
      created_at: string;
    }>`
      select id, kind, from_id, text, read, created_at::text as created_at
      from notifications
      where user_id = ${context.userId}
      order by id desc
      limit 40
    `;
    return rows.map(
      (r): Notice => ({
        id: r.id,
        kind: r.kind,
        fromId: r.from_id,
        text: r.text,
        read: r.read,
        createdAt: r.created_at,
      }),
    );
  });

export const markNoticesRead = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    await sql`update notifications set read = true where user_id = ${context.userId} and read = false`;
    return { ok: true as const };
  });

export const blockUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string }) =>
    z.object({ userId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.userId === context.userId) return { ok: false as const };
    const sql = await getSql();
    await sql`
      insert into blocks (blocker_id, blocked_id)
      values (${context.userId}, ${data.userId})
      on conflict do nothing
    `;
    await sql`
      delete from requests
      where (from_id = ${context.userId} and to_id = ${data.userId})
         or (from_id = ${data.userId} and to_id = ${context.userId})
    `;
    return { ok: true as const };
  });

export const unfriend = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string }) =>
    z.object({ userId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      delete from requests
      where (from_id = ${context.userId} and to_id = ${data.userId})
         or (from_id = ${data.userId} and to_id = ${context.userId})
    `;
    return { ok: true as const };
  });

export const reportUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { userId: string; reason: string }) =>
    z
      .object({
        userId: z.string().min(1).max(120),
        reason: z.string().min(1).max(280),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into reports (reporter_id, target_id, reason)
      values (${context.userId}, ${data.userId}, ${data.reason})
    `;
    const owners = await sql<{ user_id: string }>`
      select user_id from profiles where is_admin = true limit 3
    `;
    for (const o of owners) {
      await notify(o.user_id, "report", context.userId, `بلاغ: ${data.reason}`);
    }
    return { ok: true as const };
  });

export const requestPrivate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { ownerId: string }) =>
    z.object({ ownerId: z.string().min(1).max(120) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    if (data.ownerId === context.userId) return { ok: false as const };
    const sql = await getSql();
    if (isCommunityId(data.ownerId)) {
      await sql`
        insert into photo_access (owner_id, viewer_id)
        values (${data.ownerId}, ${context.userId})
        on conflict do nothing
      `;
      await notify(context.userId, "photo_ok", data.ownerId, "تم السماح بمشاهدة الصور الخاصة");
      return { ok: true as const };
    }
    await sql`
      insert into photo_requests (owner_id, viewer_id, status)
      values (${data.ownerId}, ${context.userId}, ${"pending"})
      on conflict (owner_id, viewer_id) do update set status = ${"pending"}
    `;
    await notify(data.ownerId, "photo_ask", context.userId, "طلب مشاهدة الصور الخاصة");
    return { ok: true as const };
  });

export const grantPrivate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: { viewerId: string; accept: boolean }) =>
    z.object({ viewerId: z.string().min(1).max(120), accept: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const status = data.accept ? "accepted" : "declined";
    await sql`
      update photo_requests set status = ${status}
      where owner_id = ${context.userId} and viewer_id = ${data.viewerId}
    `;
    if (data.accept) {
      await sql`
        insert into photo_access (owner_id, viewer_id)
        values (${context.userId}, ${data.viewerId})
        on conflict do nothing
      `;
      await notify(data.viewerId, "photo_ok", context.userId, "تم السماح بمشاهدة الصور الخاصة");
    }
    return { ok: true as const };
  });
