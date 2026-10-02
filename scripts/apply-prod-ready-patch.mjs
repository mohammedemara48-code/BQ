#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "scripts/patches/manifest.txt");
if (!existsSync(manifest)) {
  console.log("no prod-ready patches; skip");
  process.exit(0);
}
for (const line of readFileSync(manifest, "utf8").split(/\n+/)) {
  const rel = line.trim();
  if (!rel) continue;
  const patch = join(root, rel);
  if (!existsSync(patch)) {
    console.warn("missing patch", rel);
    continue;
  }
  try {
    execFileSync("patch", ["-p1", "--forward", "--batch", "-i", patch], {
      cwd: root,
      stdio: "inherit",
    });
    console.log("applied", rel);
  } catch (e) {
    console.warn("patch soft-fail", rel, e.status);
  }
}
