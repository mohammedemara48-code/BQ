Build-time security patches (hard-fail). Applied by `scripts/apply-prod-ready-patch.mjs` during `npm run build`.
If any patch fails to apply, the build exits non-zero — never soft-skip messaging/block protections.
`src/lib/safe-url.ts` and `vercel.json` security headers live in source directly.
