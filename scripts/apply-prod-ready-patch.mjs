#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = join(root, "scripts/patches/manifest.txt");
if (!existsSync(manifest)) {
  console.log("no prod-ready patches; skip");
  process.exit(0);
}

function trySystemPatch(patchPath) {
  try {
    execFileSync("patch", ["-p1", "--forward", "--batch", "-i", patchPath], {
      cwd: root,
      stdio: "inherit",
    });
    return true;
  } catch {
    return false;
  }
}

function applyUnifiedBottomUp(diffText, fileText) {
  const raw = diffText.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < raw.length && (raw[i].startsWith("---") || raw[i].startsWith("+++") || raw[i] === "")) i++;
  const hunks = [];
  while (i < raw.length) {
    const m = raw[i].match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if (!m) {
      i++;
      continue;
    }
    const oldStart = Number(m[1]) - 1;
    i++;
    const lines = [];
    while (i < raw.length && !raw[i].startsWith("@@") && !raw[i].startsWith("--- ")) {
      lines.push(raw[i]);
      i++;
    }
    hunks.push({ oldStart, lines });
  }
  let out = fileText.replace(/\r\n/g, "\n").split("\n");
  const endsNl = fileText.endsWith("\n");
  if (out.length && out[out.length - 1] === "") out.pop();

  for (const hunk of [...hunks].reverse()) {
    let pos = hunk.oldStart;
    const before = out.slice(0, hunk.oldStart);
    const mid = [];
    for (const h of hunk.lines) {
      if (!h.length) continue;
      if (h.startsWith("\\")) continue;
      const tag = h[0];
      const body = h.slice(1);
      if (tag === " ") {
        if (out[pos] !== body) throw new Error(`ctx ${pos + 1}`);
        mid.push(out[pos]);
        pos++;
      } else if (tag === "-") {
        if (out[pos] !== body) throw new Error(`del ${pos + 1}`);
        pos++;
      } else if (tag === "+") {
        mid.push(body);
      }
    }
    out = before.concat(mid, out.slice(pos));
  }
  let result = out.join("\n");
  if (endsNl) result += "\n";
  return result;
}

for (const line of readFileSync(manifest, "utf8").split(/\n+/)) {
  const rel = line.trim();
  if (!rel) continue;
  const patchPath = join(root, rel);
  if (!existsSync(patchPath)) {
    console.warn("missing patch", rel);
    continue;
  }
  if (trySystemPatch(patchPath)) {
    console.log("applied(system)", rel);
    continue;
  }
  const diff = readFileSync(patchPath, "utf8");
  const targetLine = diff.split("\n").find((l) => l.startsWith("--- a/"));
  if (!targetLine) continue;
  const relFile = targetLine.slice("--- a/".length).trim();
  const abs = join(root, relFile);
  if (!existsSync(abs)) continue;
  const original = readFileSync(abs, "utf8");
  try {
    const next = applyUnifiedBottomUp(diff, original);
    if (next !== original) writeFileSync(abs, next);
    console.log("applied(js)", relFile);
  } catch (e) {
    console.warn("patch soft-fail", relFile, e.message);
  }
}
