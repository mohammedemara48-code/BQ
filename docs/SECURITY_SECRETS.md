# Secrets that still need operator action

## Required after this hardening PR

### VAPID rotation (web push)
- Rotated on the Vercel project **bq** (production, preview, development) as part of the hardening work.
- Keys: `VITE_VAPID_PUBLIC_KEY` (client) and `VAPID_PRIVATE_KEY` (server, encrypted).
- If these were ever leaked again, generate a new pair with `npx web-push generate-vapid-keys` and upsert on Vercel, then redeploy.

### Optional / recommended
- `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET` — without these the app falls back to preview OAuth credentials in the repo. Set real broker credentials for production.
- `TURN_STATIC_SECRET` — without this, Open Relay’s public default secret is used. Fine for light traffic; set your own Metered/TURN secret for production scale.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for media; without it uploads fall back to limited data URLs.
- `DATABASE_URL` / Neon — already required for the app to run.

Do not commit secret values. Prefer Vercel project env (encrypted/sensitive) or a secrets manager.
