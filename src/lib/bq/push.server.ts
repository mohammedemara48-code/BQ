import webpush from "web-push";
import { getSql } from "@/lib/db";

const VAPID_PUBLIC =
  process.env.VITE_VAPID_PUBLIC_KEY ||
  "BKlA1SI4HiGzkdTHGhelH4VmAcD4vf5Y0BJtB52hdfqpUyKsR08GpWoRzqhhdNfXz0p-UXvZCtDd2L6Gno3LLYU";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "cDLK_D8V9PSqzSPkMZV-CCokRJ0SzvND3859dhVqg6M";

webpush.setVapidDetails("mailto:bq@wasl.app", VAPID_PUBLIC, VAPID_PRIVATE);

export type PushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
  kind?: string;
};

export async function sendPushToUser(userId: string, payload: PushPayload) {
  try {
    const sql = await getSql();
    const rows = await sql<{
      endpoint: string;
      p256dh: string;
      auth: string;
    }>`
      select endpoint, p256dh, auth from push_subscriptions
      where user_id = ${userId}
    `;
    const body = JSON.stringify(payload);
    await Promise.all(
      rows.map(async (row) => {
        if (!row.endpoint.startsWith("http") || !row.p256dh || !row.auth) return;
        try {
          await webpush.sendNotification(
            {
              endpoint: row.endpoint,
              keys: { p256dh: row.p256dh, auth: row.auth },
            },
            body,
            { TTL: payload.kind === "call" ? 120 : 60, urgency: "high" },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await sql`
              delete from push_subscriptions
              where user_id = ${userId} and endpoint = ${row.endpoint}
            `;
          }
        }
      }),
    );
  } catch {
    /* push is best-effort */
  }
}
