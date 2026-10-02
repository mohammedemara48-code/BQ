# Secrets & operations notes (BQ standalone)

## Auth (no Grok sandbox)

BQ uses **Better Auth email/password** only. There is no Grok OAuth broker and
no baked preview client in the repo.

Already expected on Vercel project **bq**:
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL` (e.g. https://bq-waslapp.vercel.app)
- `DATABASE_URL`
- `VITE_AUTH_ENABLED` (should be `true` for production)

## Web push
- `VITE_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — rotated; rotate again if leaked.

## Optional (cannot invent without a paid/account signup)
- `TURN_STATIC_SECRET` — own TURN/Metered secret if free Open Relay quota is exceeded.
- `BLOB_READ_WRITE_TOKEN` — already provisioned when Blob store is linked.
- Google/X social login — not wired; needs product OAuth apps if desired later.

Do not commit secret values.
