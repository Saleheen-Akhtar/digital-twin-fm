import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import * as argon2 from 'argon2';

interface MvpUser {
  id: string;
  email: string;
  passwordHash: string;
  role: 'admin' | 'facility_manager' | 'technician' | 'viewer';
}

interface AccessTokenPayload {
  sub: string;
  email: string;
  role: MvpUser['role'];
}
interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

const SHA256_HEX_RE = /^[0-9a-f]{64}$/;

const DUMMY_ARGO2_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$' +
  'ZHVtbXltY29tcGFyYWJsZWhhc2hkZHVtbXlrZXlkdW1teXNhbHQ';

function isLikelySha256Hex(s: string): boolean {
  return SHA256_HEX_RE.test(s);
}

async function loadMvpAdmin(config: ConfigService): Promise<MvpUser> {
  const email = config.get<string>('mvp.adminEmail') || 'admin@dtfm.local';
  const password = config.get<string>('mvp.adminPassword');
  if (!password) {
    throw new Error(
      'MVP_ADMIN_PASSWORD env var is required. Set it in .env (development) or via Infisical (staging/prod).',
    );
  }

  const passwordHash = isLikelySha256Hex(password)
    ? `sha256:${password}`
    : await argon2.hash(password, { type: argon2.argon2id });

  return {
    id: '00000000-0000-0000-0000-000000000001',
    email,
    passwordHash,
    role: 'admin',
  };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private mvpUser!: MvpUser;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.mvpUser = await loadMvpAdmin(this.config);
  }

  async login(email: string, password: string): Promise<string> {
    const isLegacy = this.mvpUser.passwordHash.startsWith('sha256:');
    const realHash = isLegacy
      ? this.mvpUser.passwordHash.slice('sha256:'.length)
      : this.mvpUser.passwordHash;

    const hashToVerify = email === this.mvpUser.email ? realHash : DUMMY_ARGO2_HASH;

    let hashOk = false;
    try {
      if (isLegacy) {
        const incoming = createHash('sha256').update(password).digest('hex');
        if (email === this.mvpUser.email) {
          hashOk = timingSafeEqualHex(incoming, hashToVerify);
        } else {
          hashOk = timingSafeEqualHex(incoming, '0'.repeat(64));
        }
      } else {
        hashOk = await argon2.verify(hashToVerify, password);
      }
    } catch {
      hashOk = false;
    }

    if (email !== this.mvpUser.email || !hashOk) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.signAccessToken({
      sub: this.mvpUser.id,
      email: this.mvpUser.email,
      role: this.mvpUser.role,
    });
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    if (!refreshSecret) {
      throw new UnauthorizedException('Refresh secret not configured');
    }

    let payload: RefreshTokenPayload;
    try {
      const verified = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: refreshSecret,
        audience: 'digital-twin-fm.web',
        issuer: 'digital-twin-fm.api-gateway',
        algorithms: ['HS256'],
      });
      if (verified.type !== 'refresh' || !verified.sub) {
        throw new UnauthorizedException('Not a refresh token');
      }
      payload = verified;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.sub !== this.mvpUser.id) {
      throw new UnauthorizedException('Unknown subject');
    }

    const accessToken = await this.signAccessToken({
      sub: this.mvpUser.id,
      email: this.mvpUser.email,
      role: this.mvpUser.role,
    });
    const newRefreshToken = await this.signRefreshToken();

    return { accessToken, refreshToken: newRefreshToken };
  }

  private signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwt.signAsync(payload, {
      expiresIn: this.config.get<string>('jwt.accessTtl') || '15m',
      audience: 'digital-twin-fm.web',
      issuer: 'digital-twin-fm.api-gateway',
    });
  }

  private signRefreshToken(): Promise<string> {
    const refreshSecret = this.config.get<string>('jwt.refreshSecret');
    if (!refreshSecret) {
      throw new Error('jwt.refreshSecret is not configured');
    }
    return this.jwt.signAsync(
      { sub: this.mvpUser.id, type: 'refresh' as const },
      {
        secret: refreshSecret,
        expiresIn: this.config.get<string>('jwt.refreshTtl') || '7d',
        audience: 'digital-twin-fm.web',
        issuer: 'digital-twin-fm.api-gateway',
      },
    );
  }
}
