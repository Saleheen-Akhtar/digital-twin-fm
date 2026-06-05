import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';

interface MvpUser {
  id: string;
  email: string;
  /** SHA-256 hex of the password (NEVER store plain text). */
  passwordHash: string;
  role: string;
}

/**
 * MVP-only bootstrap user. Loaded from environment variables on boot so
 * no secrets are committed to source. Will be replaced with a Users table
 * (bcrypt-hashed) in Phase 2.
 *
 * - `MVP_ADMIN_EMAIL`    — defaults to `admin@dtfm.local`
 * - `MVP_ADMIN_PASSWORD` — REQUIRED, no default
 *   Generate the hash with:
 *     node -e "console.log(require('crypto').createHash('sha256').update('your-pass').digest('hex'))"
 */
function loadMvpAdmin(config: ConfigService): MvpUser {
  const email = config.get<string>('mvp.adminEmail') || 'admin@dtfm.local';
  const password = config.get<string>('mvp.adminPassword');
  if (!password) {
    throw new Error(
      'MVP_ADMIN_PASSWORD env var is required. Set it in .env (development) or via Infisical (staging/prod).',
    );
  }
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email,
    passwordHash: createHash('sha256').update(password).digest('hex'),
    role: 'admin',
  };
}

@Injectable()
export class AuthService {
  private readonly mvpUser: MvpUser;

  constructor(
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.mvpUser = loadMvpAdmin(config);
  }

  async login(email: string, password: string): Promise<string> {
    const incomingHash = createHash('sha256').update(password).digest('hex');
    if (email !== this.mvpUser.email || incomingHash !== this.mvpUser.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    // NOTE: SHA-256 + nonce-less comparison is intentionally not fixed in this
    // commit. It is a separate Critical finding (Finding 1, audit doc
    // documents/mvp/SECURITY_AUDIT.md) and is the next item on the queue.
    // This commit only wires up the JWT verification guards (Finding 4).
    return this.jwt.signAsync(
      {
        sub: this.mvpUser.id,
        email: this.mvpUser.email,
        role: this.mvpUser.role,
      },
      {
        // Per Finding 4: tokens are now scoped via aud/iss so a JWT minted
        // by this gateway cannot be replayed against any other service that
        // happens to share the same secret. The JwtStrategy verifies these.
        audience: 'digital-twin-fm.web',
        issuer: 'digital-twin-fm.api-gateway',
      },
    );
  }
}
