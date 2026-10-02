#!/usr/bin/env node
// No-op: prod-ready changes ship via scripts/patches at build time.
// Legacy blob inflate overwrote patched sources and broke Vercel builds.
console.log("inflate skipped (patches-only build)");
