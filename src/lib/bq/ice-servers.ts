import { createHmac } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";

/**
 * Open Relay Project free TURN (static-auth).
 * Public community secret documented for Nextcloud/Matrix integrations.
 * Quota ~20 GB/mo — fine for small apps; upgrade to Metered paid for scale.
 */
const OPEN_RELAY_SECRET = process.env.TURN_STATIC_SECRET?.trim() || "openrelayprojectsecret";
const OPEN_RELAY_HOST = "staticauth.openrelay.metered.ca";
const TTL_SEC = 12 * 3600;

export type IceServerDTO = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

function mintTurnCreds(): { username: string; credential: string } {
  const expiry = Math.floor(Date.now() / 1000) + TTL_SEC;
  const username = `${expiry}:bq`;
  const credential = createHmac("sha1", OPEN_RELAY_SECRET).update(username).digest("base64");
  return { username, credential };
}

export function buildTurnIceServers(): IceServerDTO[] {
  const { username, credential } = mintTurnCreds();
  return [
    { urls: "stun:openrelay.metered.ca:80" },
    { urls: `turn:${OPEN_RELAY_HOST}:80`, username, credential },
    { urls: `turn:${OPEN_RELAY_HOST}:443`, username, credential },
    { urls: `turn:${OPEN_RELAY_HOST}:443?transport=tcp`, username, credential },
    { urls: `turns:${OPEN_RELAY_HOST}:443`, username, credential },
  ];
}

export const getIceServers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    return {
      iceServers: buildTurnIceServers(),
      ttlSec: TTL_SEC,
      provider: "openrelay-staticauth",
    };
  });
