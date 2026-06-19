#!/usr/bin/env node
// scripts/check-licenses.mjs
// Cross-platform license audit. Enforces the "MIT-only with approved
// Apache-2.0 exceptions" policy (Option C, see LICENSES.md §3).
//
// Run via:  pnpm licenses:check
// Or:       node scripts/check-licenses.mjs
//
// Banned: AGPL, GPL, LGPL, SSPL, BSL, Elastic, Sustainable Use, Commons Clause
// Approved: MIT, Apache-2.0 (only for packages on the explicit exception list),
//           BSD-2/3-Clause, ISC, MPL-2.0, PostgreSQL, CC0, Unlicense, 0BSD, Python-2.0
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), "..");

// ─── Approved license list ───────────────────────────────────────────────
const APPROVED_LICENSES = new Set([
  "MIT",
  "Apache-2.0",
  "BSD",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "MPL-2.0",
  "CC0-1.0",
  "Unlicense",
  "0BSD",
  "Python-2.0",
  "PostgreSQL",
  "Apache-2.0 OR MIT",
  "Apache-2.0 AND MIT",
  "(MIT OR Apache-2.0)",
  "MIT OR Apache-2.0",
  "MIT AND Apache-2.0",
  "BlueOak-1.0.0",
  "Unlicense OR MIT",
]);

// ─── Explicit Apache-2.0 exceptions (LICENSES.md §3.5) ───────────────────
// New Apache-2.0 packages are FAIL unless they're on this list. If you
// need to add a new Apache-2.0 dep, update this list AND LICENSES.md.
const APACHE_2_0_EXCEPTIONS = new Set([
  "typescript",          // Microsoft TS compiler, no MIT alternative
  "rxjs",                // ReactiveX, no MIT alternative
  "reflect-metadata",    // Required by NestJS decorator system
  "class-variance-authority", // shadcn ecosystem
  "eslint-visitor-keys", // ESLint internals
  "drizzle-orm",         // ORM (swap candidate: Kysely)
  "drizzle-kit",         // Drizzle migrations (swap candidate: Kysely)
  "vitest",              // Test runner
  "vite",                // Bundler
  "@vitest/*",           // Vitest internals
  "@vitejs/*",           // Vite internals
  "rollup",              // Vite's bundler
  "esbuild",             // Vite's transformer
  "tsx",                 // Node TS executor
]);

// ─── Banned patterns (case-insensitive substring match) ──────────────────
const BANNED_PATTERNS = [
  "AGPL",        // forces source publication
  "GPL",         // GPL/LGPL copyleft
  "SSPL",        // Server Side Public License
  "BSL",         // Business Source License
  "Elastic",     // Elastic License v2
  "Sustainable", // "Sustainable Use" / Confluent Community
  "Commons Clause",
  "RPL",         // RealNetworks Public License
  "QPL",         // Q Public License
  "CPAL",        // Common Public Attribution License
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".pnpm" || entry === ".bin" || entry.startsWith(".")) continue;
    const p = join(dir, entry);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) out.push(...walk(p));
  }
  return out;
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

function isBanned(license) {
  if (!license) return false;
  for (const b of BANNED_PATTERNS) if (license.toUpperCase().includes(b.toUpperCase())) return true;
  return false;
}

function isApproved(license) {
  if (!license) return false;
  return license.split(" OR ").every((part) => APPROVED_LICENSES.has(part.trim()));
}

console.log("🔍 Auditing dependency licenses (Option C: MIT-only + Apache-2.0 exceptions)\n");

const seen = new Map(); // pkg@version -> license
const buckets = { MIT: [], APACHE_EXC: [], APACHE_OTHER: [], OTHER_APPROVED: [] };
const bad = [];

for (const ws of ["apps", "packages"]) {
  const wsPath = join(ROOT, ws);
  if (!existsSync(wsPath)) continue;
  for (const pkg of readdirSync(wsPath)) {
    const pkgJson = join(wsPath, pkg, "package.json");
    if (!existsSync(pkgJson)) continue;
    const meta = readJson(pkgJson);
    if (!meta) continue;
    const nodeModules = join(wsPath, pkg, "node_modules");
    if (!existsSync(nodeModules)) continue;
    for (const dep of readdirSync(nodeModules)) {
      if (dep.startsWith(".")) continue;
      const depPkgJson = join(nodeModules, dep, "package.json");
      const depMeta = readJson(depPkgJson);
      if (!depMeta) continue;
      const key = `${depMeta.name}@${depMeta.version}`;
      if (seen.has(key)) continue;
      const lic = depMeta.license || "UNKNOWN";
      seen.set(key, lic);

      if (isBanned(lic)) {
        bad.push({ pkg: key, license: lic, reason: "banned" });
        continue;
      }
      if (!isApproved(lic)) {
        bad.push({ pkg: key, license: lic, reason: "not on approved list" });
        continue;
      }

      // Approved — but is it MIT, an exception, or other approved?
      if (lic.includes("MIT") && !lic.includes("Apache")) {
        buckets.MIT.push(key);
      } else if (lic.includes("Apache")) {
        // Is this on the explicit exception list?
        const pkgRoot = depMeta.name;
        const isException = APACHE_2_0_EXCEPTIONS.has(pkgRoot) ||
          [...APACHE_2_0_EXCEPTIONS].some((p) => p.endsWith("*") && pkgRoot.startsWith(p.slice(0, -1)));
        if (isException) {
          buckets.APACHE_EXC.push(`${key} (exception: ${pkgRoot})`);
        } else {
          // Apache-2.0 but NOT on exception list → fail
          bad.push({ pkg: key, license: lic, reason: "Apache-2.0 not on exception list" });
        }
      } else {
        buckets.OTHER_APPROVED.push(`${key} (${lic})`);
      }
    }
  }
}

const total = seen.size;

if (bad.length) {
  console.log("❌ License audit FAILED:\n");
  for (const b of bad) {
    console.log(`   - ${b.pkg}  →  ${b.license}  (${b.reason})`);
  }
  console.log("\nFix:");
  console.log("  1. If the license is on the BANNED list → REMOVE the dependency");
  console.log("  2. If the license is Apache-2.0 and you need it:");
  console.log("     a) Find an MIT alternative (preferred), OR");
  console.log("     b) Add it to APACHE_2_0_EXCEPTIONS in scripts/check-licenses.mjs");
  console.log("        AND to LICENSES.md §3.5 with a justification.");
  console.log("\nBanned: AGPL, GPL, LGPL, SSPL, BSL, Elastic, 'Sustainable Use', Commons Clause.");
  process.exit(1);
}

console.log(`✅ All ${total} dependencies pass the license audit:\n`);
console.log(`   🟢 MIT (the goal):                 ${buckets.MIT.length} packages`);
console.log(`   🟡 Apache-2.0 (approved exception): ${buckets.APACHE_EXC.length} packages`);
console.log(`   🔵 Other approved (BSD/ISC/etc.):   ${buckets.OTHER_APPROVED.length} packages\n`);

if (buckets.APACHE_EXC.length > 0) {
  console.log("   Apache-2.0 exceptions in use:");
  for (const p of buckets.APACHE_EXC.sort()) console.log(`     - ${p}`);
  console.log("\n   See LICENSES.md §3.5 for the full list and justifications.");
}
