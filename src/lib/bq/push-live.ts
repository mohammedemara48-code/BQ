import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";

export const savePushSubscription = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((d: unknown) =>
    z
      .object({
        endpoint: z.string().min(8).max(2000),
        p256dh: z.string().max(400).optional(),
        auth: z.string().max(400).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    await sql`
      insert into push_subscriptions (user_id, endpoint, p256dh, auth)
      values (
        ${context.userId},
        ${data.endpoint},
        ${data.p256dh ?? ""},
        ${data.auth ?? ""}
      )
      on conflict (user_id, endpoint) do update set
        p256dh = excluded.p256dh,
        auth = excluded.auth
    `;
    return { ok: true as const };
  });
