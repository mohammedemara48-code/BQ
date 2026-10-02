#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function inflateFromLegacy() {
  const manifestPath = join(root, "scripts/blobs/manifest.json");
  if (!existsSync(manifestPath)) return false;
  const parts = JSON.parse(readFileSync(manifestPath, "utf8"));
  let any = false;
  for (const rel of parts) {
    const full = join(root, rel);
    if (!existsSync(full)) continue;
    const { path, b64 } = JSON.parse(readFileSync(full, "utf8"));
    const abs = join(root, path);
    mkdirSync(dirname(abs), { recursive: true });
    const buf = inflateSync(Buffer.from(b64, "base64"));
    writeFileSync(abs, buf);
    console.log("inflated", path, buf.length);
    any = true;
  }
  return any;
}

function inflateFromChunks() {
  const manifestPath = join(root, "scripts/blobs/manifest.chunks.json");
  if (!existsSync(manifestPath)) return false;
  const metas = JSON.parse(readFileSync(manifestPath, "utf8"));
  let any = false;
  for (const metaRel of metas) {
    const meta = JSON.parse(readFileSync(join(root, metaRel), "utf8"));
    const b64 = meta.chunks.map((c) => readFileSync(join(root, c), "utf8")).join("");
    const abs = join(root, meta.path);
    mkdirSync(dirname(abs), { recursive: true });
    const buf = inflateSync(Buffer.from(b64, "base64"));
    writeFileSync(abs, buf);
    console.log("inflated(chunks)", meta.path, buf.length);
    any = true;
  }
  return any;
}

const ok = inflateFromChunks() || inflateFromLegacy();
if (!ok) {
  console.log("no prod-ready blobs; skip inflate");
}
