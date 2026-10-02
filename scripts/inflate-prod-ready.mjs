#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "scripts/blobs/manifest.json");
if (!existsSync(manifestPath)) {
  console.log("no prod-ready blobs; skip inflate");
  process.exit(0);
}
const parts = JSON.parse(readFileSync(manifestPath, "utf8"));
for (const rel of parts) {
  const { path, b64 } = JSON.parse(readFileSync(join(root, rel), "utf8"));
  const abs = join(root, path);
  mkdirSync(dirname(abs), { recursive: true });
  const buf = inflateSync(Buffer.from(b64, "base64"));
  writeFileSync(abs, buf);
  console.log("inflated", path, buf.length);
}
