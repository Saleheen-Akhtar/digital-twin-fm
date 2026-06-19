// List deps by license for review
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const ROOT = join(dirname(__filename), "..");

const buckets = { MIT: [], "Apache-2.0": [], ISC: [], "BSD-*": [], Other: [] };

function walk(dir) {
  for (const f of readdirSync(dir)) {
    if (f === ".bin" || f === ".pnpm") continue;
    const p = join(dir, f);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (f === "node_modules") {
        scanNm(p);
      } else {
        walk(p);
      }
    }
  }
}

function scanNm(nm) {
  for (const dep of readdirSync(nm)) {
    const p = join(nm, dep, "package.json");
    if (!existsSync(p)) continue;
    try {
      const pkg = JSON.parse(readFileSync(p, "utf8"));
      const lic = pkg.license || "Unknown";
      const name = pkg.name || dep;
      if (lic.includes("MIT")) buckets["MIT"].push(`${name}@${pkg.version}`);
      else if (lic.includes("Apache")) buckets["Apache-2.0"].push(`${name}@${pkg.version}`);
      else if (lic.includes("ISC")) buckets["ISC"].push(`${name}@${pkg.version}`);
      else if (lic.includes("BSD")) buckets["BSD-*"].push(`${name}@${pkg.version}`);
      else buckets["Other"].push(`${name}@${pkg.version} (${lic})`);
    } catch (e) {
      // skip
    }
  }
}

walk(ROOT);

for (const [lic, list] of Object.entries(buckets)) {
  if (list.length === 0) continue;
  console.log(`\n=== ${lic} (${list.length}) ===`);
  for (const pkg of list.sort()) console.log(`  ${pkg}`);
}
