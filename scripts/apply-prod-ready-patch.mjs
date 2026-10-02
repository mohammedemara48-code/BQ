#!/usr/bin/env node
/**
 * Historically applied security/UX diffs from scripts/patches/ at build time.
 * Those changes are now merged into source — this script is intentionally a no-op
 * so builds never soft-fail and silently drop messaging/block protections.
 */
console.log("prod-ready patches already in source; skip");
process.exit(0);
