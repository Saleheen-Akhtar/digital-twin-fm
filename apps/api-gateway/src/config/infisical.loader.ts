/**
 * Loads variables from a local `.env` file in development/test.
 *
 * Per Finding 7 (High): the previous hand-rolled parser did not handle
 * `\n`, `\r`, escaped quotes, multiline values, or inline comments, and
 * loaded from `process.cwd()` (not the service's compiled location).
 * The parser was the security boundary between operator and process, so
 * any bug here was a bug in the secret pipeline.
 *
 * The new implementation uses `dotenv` (already a transitive NestJS
 * dependency; pinned in `package.json`) and is disabled in production.
 *
 * In production / staging, the Infisical CLI (or another secret
 * orchestrator) is expected to have already injected secrets into
 * `process.env` — this loader does not attempt network calls.
 */
import { config as loadDotenv } from 'dotenv';
import { existsSync, statSync } from 'fs';
import { resolve } from 'path';

/**
 * Find the monorepo root by walking up from the current working directory
 * until we find a `pnpm-workspace.yaml`, `turbo.json`, or `package.json`
 * with `"workspaces"` set. The previous `SERVICE_ROOT = __dirname/../../..`
 * approach was fragile: it depended on the compiled `__dirname` matching the
 * source layout (true in dev, false after any `nest build` + `tsc --rootDir`
 * change) and, for the api-gateway, walked up past the repo entirely to
 * `C:\Users\sahil\Projects`. Walking from cwd is robust to both the dev
 * (`pnpm dev` → cwd is the service) and compiled (`node dist/main.js` from
 * service root) layouts.
 */
function findMonorepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  // Bound the walk so a misconfigured repo can't infinite-loop on a symlink
  // cycle or a / mount. 16 levels is more than enough for any sane layout.
  for (let i = 0; i < 16; i++) {
    if (
      existsSync(resolve(dir, 'pnpm-workspace.yaml')) ||
      existsSync(resolve(dir, 'turbo.json'))
    ) {
      return dir;
    }
    // Plain Node package.json with a `workspaces` field is also a monorepo
    // marker (covers npm/yarn workspaces).
    const pkgPath = resolve(dir, 'package.json');
    if (existsSync(pkgPath) && statSync(pkgPath).isFile()) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require(pkgPath) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        // ignore — read failure on a package.json is not fatal here
      }
    }
    const parent = resolve(dir, '..');
    if (parent === dir) break; // reached filesystem root
    dir = parent;
  }
  // Fallback: cwd. Better to try a known-bad path than to throw during
  // boot — `existsSync` below will skip it harmlessly.
  return resolve(startDir);
}

const MONOREPO_ROOT = findMonorepoRoot(process.cwd());

export function loadInfisicalOrEnvSync(): void {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return;

  // Prefer a service-local `.env` if present (e.g. apps/api-gateway/.env)
  // so a developer can override one service without touching the shared
  // file. Fall back to the monorepo-root `.env` so a single shared file
  // works out of the box.
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(MONOREPO_ROOT, '.env'),
  ];

  for (const envPath of candidates) {
    if (!existsSync(envPath)) continue;
    const result = loadDotenv({ path: envPath, override: false });
    if (result.error) {
      // Don't leak the parse error to the user — just log to stderr.
      process.stderr.write(`[env] failed to load ${envPath}\n`);
      return;
    }
    process.stderr.write(`[env] loaded ${envPath}\n`);
    return;
  }
  process.stderr.write(
    `[env] no .env found in ${candidates.join(' or ')}; relying on process.env\n`,
  );
}
