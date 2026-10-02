# Secrets that still need operator action

## Required after this hardening PR

### VAPID rotation (web push)
- Set on the Vercel project **bq** for production, preview, and development:
  - `VITE_VAPID_PUBLIC_KEY` (public; safe to expose to the client bundle)
  - `VAPID_PRIVATE_KEY` (secret; server-only)
- An old private key may exist in git history — always rotate rather than reuse.
- After rotating, redeploy production so the client picks up the new public key.

### Optional / recommended
- `GROK_AUTH_ISSUER`, `GROK_AUTH_CLIENT_ID`, `GROK_AUTH_CLIENT_SECRET` — without these the app falls back to preview OAuth credentials in the repo. Set real broker credentials for production.
- `TURN_STATIC_SECRET` — without this, Open Relay’s public default secret is used. Fine for light traffic; set your own Metered/TURN secret for production scale.
- `BLOB_READ_WRITE_TOKEN` — Vercel Blob for media; without it uploads fall back to limited data URLs.
- `DATABASE_URL` / Neon — already required for the app to run.

Do not commit secret values. Prefer Vercel project env (encrypted/sensitive) or a secrets manager.
