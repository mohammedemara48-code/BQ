#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const patch = join(root, "scripts/patches/prod-ready.patch");
if (!existsSync(patch)) {
  console.log("no prod-ready.patch; skip");
  process.exit(0);
}
try {
  execFileSync("patch", ["-p1", "--forward", "--batch", "-i", patch], {
    cwd: root,
    stdio: "inherit",
  });
  console.log("applied prod-ready.patch");
} catch (e) {
  // Already applied or reverse - try to detect
  console.warn("patch apply soft-fail (may already be applied)", e.status);
}
