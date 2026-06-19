#!/usr/bin/env node
/**
 * hash-admin.ts — generate a bootstrap value for MVP_ADMIN_PASSWORD.
 *
 * Usage:
 *   pnpm --filter @digital-twin-fm/api-gateway hash-admin -- 'your-strong-pass'
 *
 * Output: a single line containing a value you can paste into .env or
 * Infisical as MVP_ADMIN_PASSWORD. With the new auth.service.ts, you can
 * also just set the plain-text password and the service will hash it
 * with argon2id at boot — this script is for operators who want the
 * hash to live in their secret store instead of the plain text.
 */
import * as argon2 from 'argon2';

const args = process.argv.slice(2);
// Skip the -- separator that pnpm adds
const password = args.filter((a) => a !== '--').join(' ');

if (!password) {
  console.error('Usage: hash-admin -- \'<password>\'');
  process.exit(1);
}

if (password.length < 12) {
  console.error('Error: password must be at least 12 characters');
  process.exit(1);
}

async function main() {
  const hash = await argon2.hash(password, { type: argon2.argon2id });

  // Print to stderr so it's clearly visible in logs
  console.error('\n✓ Generated argon2id hash for MVP_ADMIN_PASSWORD');
  console.error('  Length:', hash.length, 'chars');
  console.error('\nPaste this into .env or your Infisical project:');
  console.error(`  MVP_ADMIN_PASSWORD=<see-line-below>\n`);
  
  const line = `MVP_ADMIN_PASSWORD=${hash}`;
  console.log(line);
}
main().catch(console.error);
