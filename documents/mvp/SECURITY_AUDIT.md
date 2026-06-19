# Security Audit — Digital Twin FM

**First audit:** 2026-06-05
**Second pass:** 2026-06-05 (same day, after code grew to add `/buildings`, `/assets`, `/sensors`, `/alerts`, `/twin`, and a seed script)
**Auditor:** Hermes (automated code review)
**Scope (combined):** `apps/api-gateway/src/**`, `apps/web/src/**`, `apps/ingestion-service/src/**`, `apps/ai-service/app/**`, `packages/{db,types,ui}/src/**`, `docker-compose.yml`, `init-db.sql`, `.env.example`, `LICENSES.md`, `pnpm-workspace.yaml`, `next.config.ts`, `nest-cli.json`, `turbo.json`, `.github/workflows/ci.yml`, `scripts/**`, `documents/mvp/SECURITY.md`
**Threat model:** Single-tenant MVP web app; one production deployment per environment; one bootstrap admin user moving to a full user table in Phase 2; no IoT device traffic yet; no multi-tenant boundaries assumed.
**Posture:** Pre-launch. Nothing in the current code path handles real users, real PII, or real device data. The goal of this audit is to define a *hard floor* below which the project must not ship.

> **Status of first-pass findings (n=21):** as of the second pass on the same day, **none of the 21 original findings have been fixed in code**. All 5 Critical, all 7 High, all 7 Medium, and all 3 Low items remain open. The codebase has grown since the first pass — 4 new public GET endpoints in the gateway, a public POST in the ingestion service, an unauthenticated LLM endpoint in the AI service, and a dashboard page that issues 4 parallel API calls. The second pass adds 21 user-facing bugs, 14+ new risks, and 1 critical security regression (more public unauthenticated endpoints).

---

## 1. Executive summary

The codebase is past the "scaffolding" stage: there is a Drizzle schema (9 tables), a NestJS gateway with 5 controllers (auth, buildings, assets, sensors, alerts, health), a Next.js web app with `/`, `/login`, `/dashboard`, `/twin`, a Fastify ingestion service, a FastAPI AI service, and a docker-compose for local Postgres + Valkey. Foundations are reasonable — DTO validation pipe configured, httpOnly cookies, `.env` ignored, an Infisical plan documented — but **none of the security scaffolding is in place**. Every business endpoint is anonymous, every secret has a dev fallback, every Docker port is on `0.0.0.0`, and the dashboard page silently swallows errors and lies about the connection state.

| # | Severity | Issue | File |
|---|---|---|---|
| 1 | Critical | Passwords hashed with raw SHA-256, no salt, no work factor | `apps/api-gateway/src/auth/auth.service.ts:35,52` |
| 2 | Critical | Constant-time-unsafe credential comparison; email check short-circuits | `apps/api-gateway/src/auth/auth.service.ts:53` |
| 3 | Critical | CORS defaults to wildcard origin with `credentials: true`; empty env var misparsed | `apps/api-gateway/src/main.ts:21-24` |
| 4 | Critical | No JWT verification guard — every protected route is anonymous; **4 new public GET endpoints added since first pass** | `apps/api-gateway/src/{buildings,assets,sensors,alerts}/*controller.ts`, `apps/web/src/app/dashboard/page.tsx` |
| 5 | Critical | Deterministic dev fallback for JWT secret (`dev-jwt_access_secret`) | `apps/api-gateway/src/config/config.module.ts:10-19` |
| 6 | High | No `helmet`, no security headers, no rate limiting | `apps/api-gateway/src/main.ts`, `apps/web/next.config.ts:3-6` |
| 7 | High | Hand-rolled `.env` parser with no escaping, no path pinning, used as a security boundary | `apps/api-gateway/src/config/infisical.loader.ts:10-30` |
| 8 | High | Hardcoded DB password fallbacks (`"dtfm_pass"`) and no `ssl` config; **re-introduced in new `seed.ts`** | `apps/api-gateway/src/db/db.module.ts:25`, `packages/db/src/seed.ts:32` |
| 9 | High | Login flow surfaces raw API error messages to the browser; **also new in dashboard `apiError` rendering** | `apps/web/src/app/login/actions.ts:33-34`, `apps/web/src/lib/api-client.ts:43-48`, `apps/web/src/app/dashboard/page.tsx:82` |
| 10 | High | JWT lacks `audience`/`issuer`; cookie outlives token (8h vs 15m); refresh secret loaded but never used | `apps/api-gateway/src/auth/auth.module.ts:9-15`, `apps/web/src/app/login/actions.ts:25-31` |
| 11 | High | No CSRF/origin enforcement documented for the Server Action login flow | `apps/web/next.config.ts`, `apps/web/src/app/login/actions.ts` |
| 12 | High | Ingestion service binds `0.0.0.0` and accepts unauthenticated POSTs that publish to Redis pub/sub | `apps/ingestion-service/src/index.ts:31,64,79` |
| 13 | High | AI service CORS is `["*"]` in dev *and* uses `allow_credentials=True` | `apps/ai-service/app/main.py:34-40` |
| 14 | High | `dashboard/page.tsx` swallows 3 of 4 query errors and reports "connected" while showing zero data | `apps/web/src/app/dashboard/page.tsx:38-49` |
| 15 | High | `/dashboard` and `/twin` are publicly accessible — no `middleware.ts`, no `requireSession()` | `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/twin/page.tsx` |
| 16 | Medium | Postgres and Valkey bound to `0.0.0.0` on host; Valkey has no `--requirepass` | `docker-compose.yml:17,34` |
| 17 | Medium | `init-db.sql` creates no app role, no grants; bootstrap runs as superuser; runs only on fresh data volume | `init-db.sql:1-2`, `docker-compose.yml:15` |
| 18 | Medium | `Cookie.secure` is conditional on `NODE_ENV === 'production'` (staging risk) | `apps/web/src/app/login/actions.ts:27` |
| 19 | Medium | `pnpm allowBuilds` runs postinstall scripts for `es5-ext` workspace-wide | `pnpm-workspace.yaml:4-7` |
| 20 | Medium | CI runs no `pnpm audit`, no secret scan, no Dependabot; license audit script is broken for pnpm | `.github/workflows/ci.yml:13-47`, `scripts/check-licenses.mjs:110-157` |
| 21 | Medium | No `engines.node`; no `.env.*` ignore pattern | `package.json`, `.gitignore:15-17` |
| 22 | Medium | Repo-wide stack ships **zero** security headers | `apps/web/next.config.ts:3-6`, `apps/api-gateway/src/main.ts:1-31` |
| 23 | Medium | Triplicated, drifted type definitions for `Asset`/`Building` (3 different sources) | `packages/types/src/index.ts:29-51`, `apps/web/src/lib/api-client.ts:20-50`, `apps/api-gateway/src/{buildings,assets}/dto/*.ts` |
| 24 | Medium | Drizzle migration: `sensor_readings` has no PK and is never converted to a hypertable; TimescaleDB claim is fiction | `packages/db/drizzle/0000_bouncy_vulture.sql:64-71`, `packages/db/src/schema.ts:111-115` |
| 25 | Medium | `seed.ts` writes a literal `passwordHash: "REPLACE_WITH_BCRYPT_HASH"`; no production-env guard | `packages/db/src/seed.ts:53,183` |
| 26 | Low | Three `scripts/` files dump raw password lines to stdout | `scripts/check-env.js`, `scripts/dump-env.js`, `scripts/get-pw.js` |
| 27 | Low | `package.json#lint` is `echo && exit 0` in 3 of 4 workspaces (silent lint bypass) | `packages/{types,ui,db}/package.json` |
| 28 | Low | `api-gateway/tsconfig.json` missing `strict: true`; catches are `any`, class fields unchecked | `apps/api-gateway/tsconfig.json:15-19` |
| 29 | Low | DTOs are `interface`, not `class` — `ValidationPipe` whitelist is a no-op once POST/PATCH routes are added | `apps/api-gateway/src/**/dto/*.ts` |
| 30 | Low | Service spec files are "should be defined" only — `const db: any = {}` is the entire test | `apps/api-gateway/src/{buildings,assets,sensors,alerts}/*service.spec.ts` |
| 31 | Low | `r3f.ts` overrides R3F JSX with `any`; `viewer.tsx` `Environment preset="city"` loads remote HDR | `apps/web/src/types/r3f.ts:12-19`, `apps/web/src/features/digital-twin/viewer.tsx:73` |
| 32 | Low | `CODEOWNERS` references `SECURITY.md`/`infra/` paths that don't exist; `.claude/settings.local.json` is committed; test fixture hardcodes `admin123` | `CODEOWNERS:36-38`, `.claude/settings.local.json:1-8`, `apps/api-gateway/src/auth/auth.service.spec.ts:11` |

**Severity rollup across both passes:**
- **5 Critical** (1–5): auth + CORS + route protection. Each is a ship-blocker.
- **10 High** (6–15): missing security middleware, public endpoints, unauthenticated ingestion, error-leaking UI, public dashboards.
- **12 Medium** (16–27): infrastructure hardening, type drift, broken infra claims, hygiene.
- **5 Low** (28–32): tsconfig strictness, broken tests, dead code paths.

---

## 2. Detailed findings and fixes

Each finding lists: **Why it's a problem**, **Concrete code fix**, **Verification**.

---

### Finding 1 — Passwords hashed with raw SHA-256  *(Critical)*

**Where:** `apps/api-gateway/src/auth/auth.service.ts:35,52`

**Why.** `documents/mvp/SECURITY.md:20` mandates "bcrypt or argon2". The code uses `crypto.createHash('sha256')`, which is a fast, unsalted, work-factor-free hash. A modern GPU computes >10 GH/s of SHA-256, so any leak of the `.env`-loaded hash is a 100% offline crack. The `.env.example:21` comment even instructs operators to SHA-256-hash their password before pasting it in, propagating the same mistake into operator workflow.

**Fix.** Use `argon2` (preferred) or `bcrypt`. Argon2id is the OWASP recommendation for new systems; bcrypt is acceptable. Both are slow and self-salting.

`apps/api-gateway/package.json` — add:
```json
"dependencies": {
  "argon2": "^0.40.0"
}
```

`apps/api-gateway/src/auth/auth.service.ts` — replace the hash, drop `createHash`:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';

interface MvpUser {
  id: string;
  email: string;
  /** argon2id encoded hash (PHC string). NEVER store plain text. */
  passwordHash: string;
  role: string;
}

async function loadMvpAdmin(config: ConfigService): Promise<MvpUser> {
  const email = config.get<string>('mvp.adminEmail') || 'admin@dtfm.local';
  const password = config.get<string>('mvp.adminPassword');
  if (!password) {
    throw new Error(
      'MVP_ADMIN_PASSWORD env var is required. Set it in .env (development) ' +
        'or via Infisical (staging/prod).',
    );
  }
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email,
    // Hash at boot, not on every login. Argon2id defaults are safe.
    passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    role: 'admin',
  };
}

@Injectable()
export class AuthService {
  private mvpUser!: MvpUser;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.mvpUser = await loadMvpAdmin(this.config);
  }

  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Defensive: even if the email is wrong, perform a hash against a dummy
    // constant to keep the response time constant.
    const dummy = '$argon2id$v=19$m=65536,t=3,p=4$' +
      'ZHVtbXltY29tcGFyYWJsZWhhc2hkZHVtbXlrZXlkdW1teXNhbHQ';

    const candidate = this.mvpUser && email === this.mvpUser.email
      ? this.mvpUser.passwordHash
      : dummy;

    let ok = false;
    try {
      ok = await argon2.verify(candidate, password);
    } catch {
      ok = false;
    }

    if (!ok || email !== this.mvpUser?.email) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: this.mvpUser.id, email: this.mvpUser.email, role: this.mvpUser.role };
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        expiresIn: this.config.get<string>('jwt.accessTtl') || '15m',
        audience: 'digital-twin-fm.web',
        issuer: 'digital-twin-fm.api-gateway',
      }),
      this.jwt.signAsync(
        { sub: this.mvpUser.id, type: 'refresh' },
        {
          secret: this.config.get<string>('jwt.refreshSecret'),
          expiresIn: this.config.get<string>('jwt.refreshTtl') || '7d',
          audience: 'digital-twin-fm.web',
          issuer: 'digital-twin-fm.api-gateway',
        },
      ),
    ]);
    return { accessToken, refreshToken };
  }
}
```

`.env.example:13-23` — replace the SHA-256 instructions with a bootstrap script and a clear warning:
```text
# JWT
# Generate cryptographically random secrets, e.g.:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# MVP bootstrap admin (api-gateway only — removed in Phase 2 when Users table is added)
# WARNING: change before running in any non-local environment.
# Generate the hash for the application via the helper script: pnpm --filter @digital-twin-fm/api-gateway hash-admin -- --email=admin@dtfm.local --password='your-strong-pass'
MVP_ADMIN_EMAIL=admin@dtfm.local
MVP_ADMIN_PASSWORD=
```

**Verification.** Run a unit test that:
1. Hashes a known password, then verifies with `argon2.verify`.
2. Times `login()` for valid and invalid emails and asserts the variance is < 50ms over 20 iterations.
3. Rejects an empty `MVP_ADMIN_PASSWORD` (boot throws).

---

### Finding 2 — Timing-attack vulnerable credential comparison  *(Critical)*

**Where:** `apps/api-gateway/src/auth/auth.service.ts:53`
```ts
if (email !== this.mvpUser.email || incomingHash !== this.mvpUser.passwordHash) {
```

**Why.** `!==` on strings returns as soon as it finds a difference. With a fast SHA-256 it leaks bytes-per-microsecond, enough to recover the email prefix character by character over thousands of requests. With the new argon2 verification above this concern is partly absorbed (argon2.verify is already constant time against the hash), but the *email* check still short-circuits and the *order* of `email !==` before `verify()` leaks. Always run the verify first against a dummy, then check the email — which the fix in Finding 1 already does.

**Fix.** Combined with Finding 1: do `argon2.verify` first (against a dummy if the email mismatches), then a separate boolean check on email. The two checks are *not* ANDed; failure of either is reported with the same error and the same response time.

**Verification.** Property test: assert `Date.now()` delta between `(wrongEmail, correctPassword)` and `(correctEmail, wrongPassword)` is < 50ms averaged over 50 trials.

---

### Finding 3 — CORS wildcard with credentials  *(Critical)*

**Where:** `apps/api-gateway/src/main.ts:21-24`
```ts
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : true;
app.enableCors({ origin: corsOrigins, credentials: true });
```

**Why.** Two distinct bugs:
1. When `CORS_ORIGIN` is unset, the gateway accepts **any origin** and allows credentials. This is CORS-invalid in the strict browser spec (browsers reject `Access-Control-Allow-Origin: *` with `credentials: true`), but reverse proxies, mobile clients, and `Origin: null` (sandboxed iframes, file://) do still see it work in some configurations.
2. The truthy-check `process.env.CORS_ORIGIN ? ... : true` is fooled by an empty string. `process.env.CORS_ORIGIN` set to `""` is truthy in JS, so it splits to `[""]`, which is not a valid origin. The dev escape hatch is silent and undocumented.

**Fix.** `apps/api-gateway/src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';

function resolveCorsOrigins(): string[] | false {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CORS_ORIGIN is required in production. Set it to a comma-separated list of allowed origins.',
      );
    }
    // Dev only: allow the local web app.
    return ['http://localhost:3000'];
  }
  const list = raw.split(',').map((o) => o.trim()).filter(Boolean);
  if (list.length === 0) {
    throw new Error('CORS_ORIGIN parsed to an empty list.');
  }
  return list;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      strictTransportSecurity: {
        maxAge: 60 * 60 * 24 * 365,
        includeSubDomains: true,
        preload: true,
      },
    }),
  );

  const origins = resolveCorsOrigins();
  if (origins) {
    app.enableCors({
      origin: (origin, cb) => {
        // Same-origin / curl have no Origin header — allow.
        if (!origin) return cb(null, true);
        if (origins.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    });
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  Logger.log(`api-gateway listening on http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
```

Add `helmet` to `apps/api-gateway/package.json`:
```json
"dependencies": {
  "helmet": "^7.1.0"
}
```

**Verification.** With `NODE_ENV=production` and `CORS_ORIGIN` unset, the gateway refuses to start. With `CORS_ORIGIN=https://app.example.com`, a request with `Origin: https://evil.com` is rejected.

---

### Finding 4 — No JWT verification, no route protection  *(Critical — EXPANDED)*

**Where:**
- `apps/api-gateway/src/auth/*` — `JwtModule` is registered, but no `JwtAuthGuard` exists.
- `apps/api-gateway/src/buildings/buildings.controller.ts`, `assets/assets.controller.ts`, `sensors/{sensors,sensor-readings}.controller.ts`, `alerts/alerts.controller.ts` — all `@Get()`s are public. **This is a regression since the first pass** — these controllers did not exist at the first audit.
- `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/twin/page.tsx` — the page-level server components do not check the session.
- `apps/web/src/app/page.tsx:5-9` — only checks for cookie *presence*; does not verify signature/expiry.

**Why.** The gateway mints tokens but never validates them. The web app sets a cookie but never reads it for SSR auth. The only place the cookie is checked is the `/` redirect, which a direct hit to `/dashboard` or `/twin` bypasses. The new domain controllers expose real building/asset/sensor/alert data with no authentication whatsoever.

**Fix.** Four pieces — and the third piece (middleware) is new and unique to the second pass:

**(a) `apps/api-gateway/src/auth/jwt.strategy.ts`** — Passport-JWT strategy:
```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface JwtPayload {
  sub: string;
  email: string;
  role: 'admin' | 'facility_manager' | 'technician' | 'viewer';
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
      audience: 'digital-twin-fm.web',
      issuer: 'digital-twin-fm.api-gateway',
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload) {
    if (!payload?.sub) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, role: payload.role };
  }
}
```

**(b) `apps/api-gateway/src/auth/jwt-auth.guard.ts`** — global guard with a `@Public()` opt-out:
```ts
import { ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }
  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

**(c) `apps/api-gateway/src/auth/roles.guard.ts`** + decorator:
```ts
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = ctx.switchToHttp().getRequest();
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

**(d) `apps/api-gateway/src/app.module.ts`** — register guards globally:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { BuildingsModule } from './buildings/buildings.module';
import { AssetsModule } from './assets/assets.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [ConfigModule, DbModule, AuthModule, BuildingsModule, AssetsModule, SensorsModule, AlertsModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

Mark public endpoints with `@Public()`:
```ts
// apps/api-gateway/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/jwt-auth.guard';

@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() { return { status: 'ok' }; }
}
```

**Web side — `apps/web/src/lib/session.ts`** (server-only) and **`apps/web/src/middleware.ts`** (route-level):
```ts
// apps/web/src/lib/session.ts
import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { jwtVerify, JWTPayload } from 'jose';

export interface Session {
  userId: string;
  email: string;
  role: 'admin' | 'facility_manager' | 'technician' | 'viewer';
}

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set on the web app.');
  return new TextEncoder().encode(s);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get('dtfm_token')?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify<JWTPayload & Session>(token, jwtSecret(), {
      audience: 'digital-twin-fm.web',
      issuer: 'digital-twin-fm.api-gateway',
      algorithms: ['HS256'],
    });
    return {
      userId: String(payload.sub),
      email: payload.email as string,
      role: payload.role as Session['role'],
    };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}
```

```ts
// apps/web/src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = [/^\/login\/?$/, /^\/api\/?$/, /^\/_next\//, /^\/favicon/];
const PUBLIC_FILE = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/;

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_ACCESS_SECRET;
  if (!s) throw new Error('JWT_ACCESS_SECRET is not set on the web app.');
  return new TextEncoder().encode(s);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname)) || PUBLIC_FILE.test(pathname)) {
    return NextResponse.next();
  }
  const token = req.cookies.get('dtfm_token')?.value;
  if (!token) return NextResponse.redirect(new URL('/login', req.url));
  try {
    await jwtVerify(token, jwtSecret(), {
      audience: 'digital-twin-fm.web',
      issuer: 'digital-twin-fm.api-gateway',
      algorithms: ['HS256'],
    });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', req.url));
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

`apps/web/src/app/dashboard/page.tsx` — gate on session:
```tsx
import { requireSession } from '@/lib/session';
import { getServerEnv } from '@/env';
import { createApiClient } from '@/lib/api-client';

export const metadata = { title: 'Dashboard — Digital Twin FM' };
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireSession();
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl });

  // … rest of the page; pass session.userId into apiClient calls for user-scoped queries …
  return (
    <main>
      <p>{session.email} ({session.role})</p>
      {/* … */}
    </main>
  );
}
```

Add `jose` to `apps/web/package.json` and `@nestjs/passport` + `passport-jwt` to `apps/api-gateway/package.json`:
```json
"dependencies": {
  "@nestjs/passport": "^10.0.3",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "jose": "^5.9.0"
}
```

**Verification.**
- Unit test: a request to a non-public endpoint without `Authorization` returns 401.
- Unit test: a request with an expired token returns 401.
- Manual: visiting `/dashboard` or `/twin` without a cookie redirects to `/login`.
- Manual: a request to `/api/buildings` from `curl` without a JWT returns 401.
- Manual: a request to `/api/buildings` with a JWT in the `Authorization: Bearer` header returns 200.

---

### Finding 5 — Deterministic dev fallback for JWT secret  *(Critical)*

**Where:** `apps/api-gateway/src/config/config.module.ts:10-19`
```ts
function requireSecret(value: string | undefined, key: string, env: string): string {
  if (value && value.length > 0) return value;
  if (env === 'development' || env === 'test') {
    return `dev-${key.toLowerCase()}`;
  }
  throw new Error(
    `Required secret ${key} is missing in ${env} environment. ` +
      'Set it via Infisical, a real .env file, or your orchestrator's secret store.',
  );
}
```

**Why.** A missing `JWT_ACCESS_SECRET` produces the constant string `dev-jwt_access_secret`. Anyone with knowledge of this codebase can mint admin JWTs against a developer's local gateway. Combined with the equally predictable MVP password fallback, the local dev instance is a one-step takeover from the public internet if a developer binds it to anything but `127.0.0.1`.

**Fix.** Replace the function and only allow dev defaults for **non-cryptographic** keys. For secrets, generate a random one at boot, log it once to the console, and require an explicit `ALLOW_INSECURE_DEV=1` env var to opt into the predictable dev fallback.

`apps/api-gateway/src/config/config.module.ts`:
```ts
import { Global, Module, Logger } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { loadInfisicalOrEnvSync } from './infisical.loader';

const log = new Logger('Config');

function randomSecret(): string {
  return randomBytes(48).toString('base64url');
}

function requireSecret(value: string | undefined, key: string, env: string): string {
  if (value && value.length > 0) return value;
  if (env === 'test') {
    return 'test-secret-only-used-in-unit-tests';
  }
  if (env === 'development') {
    if (process.env.ALLOW_INSECURE_DEV === '1') {
      log.warn(
        `ALLOW_INSECURE_DEV=1: ${key} falling back to a deterministic dev value. ` +
          'NEVER use this in any deployed environment.',
      );
      return `dev-${key.toLowerCase()}`;
    }
    const generated = randomSecret();
    log.warn(
      `${key} not set. Generated a random one for this process: ${generated}. ` +
        'Set it in .env or your orchestrator to persist across restarts.',
    );
    return generated;
  }
  throw new Error(
    `Required secret ${key} is missing in ${env} environment. ` +
      'Set it via Infisical, a real .env file, or your orchestrator's secret store.',
  );
}

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const env = process.env.NODE_ENV || 'development';
          const fileSecrets = loadInfisicalOrEnvSync();

          return {
            env,
            ...fileSecrets,
            database: {
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: requireSecret(process.env.POSTGRES_PASSWORD, 'POSTGRES_PASSWORD', env),
              database: process.env.POSTGRES_DB || 'dtfm_db',
              ssl: process.env.POSTGRES_SSL === 'true',
            },
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
              tls: process.env.REDIS_TLS === 'true',
            },
            jwt: {
              accessSecret: requireSecret(process.env.JWT_ACCESS_SECRET, 'JWT_ACCESS_SECRET', env),
              refreshSecret: requireSecret(process.env.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET', env),
              accessTtl: process.env.JWT_ACCESS_TTL || '15m',
              refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
            },
            mvp: {
              adminEmail: process.env.MVP_ADMIN_EMAIL || 'admin@dtfm.local',
              adminPassword: process.env.MVP_ADMIN_PASSWORD,
            },
            cors: {
              origin: process.env.CORS_ORIGIN,
            },
          };
        },
      ],
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}
```

**Verification.** With `NODE_ENV=development` and no `JWT_ACCESS_SECRET` and no `ALLOW_INSECURE_DEV`, the gateway logs a random 64-char secret on boot. With `ALLOW_INSECURE_DEV=1`, it logs a warning and uses the deterministic value. With `NODE_ENV=production` and a missing secret, it refuses to start.

---

### Finding 6 — No helmet, no rate limiting  *(High)*

**Where:** `apps/api-gateway/src/main.ts:6-29`, `apps/web/next.config.ts:3-6`

**Why.** The HTTP surface ships zero security headers (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, X-Frame-Options) and zero rate limiting on `/auth/login`. An attacker can credential-stuff or DoS the auth endpoint at line speed. Browsers can be tricked into loading the app inside a frame (clickjacking).

**Fix.** Server (NestJS) — `helmet` is already in the fix for Finding 3. Add `@nestjs/throttler`:

`apps/api-gateway/package.json`:
```json
"dependencies": {
  "@nestjs/throttler": "^5.1.2"
}
```

`apps/api-gateway/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from './config/config.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';
import { BuildingsModule } from './buildings/buildings.module';
import { AssetsModule } from './assets/assets.module';
import { SensorsModule } from './sensors/sensors.module';
import { AlertsModule } from './alerts/alerts.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule,
    DbModule,
    AuthModule,
    BuildingsModule,
    AssetsModule,
    SensorsModule,
    AlertsModule,
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 60_000, limit: 60 },
      { name: 'auth', ttl: 60_000, limit: 5 },
    ]),
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
```

Per-route override on the auth controller:
```ts
// apps/api-gateway/src/auth/auth.controller.ts
import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { Public } from '../auth/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Throttle({ auth: { ttl: 60_000, limit: 5 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const tokens = await this.auth.login(body.email, body.password);
    return tokens;
  }
}
```

Client (Next.js) — `apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next';

const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",     // tighten once a nonce strategy exists
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@digital-twin-fm/db'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000'],
    },
  },
};

export default nextConfig;
```

**Verification.**
- `curl -I http://localhost:3000/dashboard` returns all the headers above.
- 6 rapid POSTs to `/auth/login` return `429 Too Many Requests` on the 6th.
- The first request's `Response` includes a `RateLimit-*` set of headers (per RFC 9239 draft).

---

### Finding 7 — Hand-rolled `.env` parser  *(High)*

**Where:** `apps/api-gateway/src/config/infisical.loader.ts:10-30`

**Why.** The parser:
- Does not handle `\n`, `\r`, escaped quotes, multiline values, or inline comments.
- Loads from `process.cwd()` — not the service's compiled location. A developer running from `apps/api-gateway/` finds nothing; a developer running from `/tmp` may load the wrong file.
- Is the *security boundary* between the operator and the running process. A bug here is a bug in the secret pipeline.

**Fix.** Use `dotenv` and pin the path with `import.meta.url` resolution. Disable the parser in production. Drop the misleading "Infisical" name (the file does not actually call Infisical — the comment correctly notes that the CLI is expected to have injected secrets already).

`apps/api-gateway/package.json`:
```json
"dependencies": {
  "dotenv": "^16.4.5"
}
```

`apps/api-gateway/src/config/infisical.loader.ts` (rename to `env.loader.ts`):
```ts
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';

const SERVICE_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Loads variables from a `.env` file in the service root, only in
 * non-production environments. In production, secrets must be injected
 * by the orchestrator (Infisical sidecar, Kubernetes Secret, etc.).
 */
export function loadLocalEnv(): void {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'production') return;

  const envPath = resolve(SERVICE_ROOT, '.env');
  if (!existsSync(envPath)) return;

  const result = loadDotenv({ path: envPath, override: false });
  if (result.error) {
    // do not leak the parse error to the user
    process.stderr.write(`[env] failed to load ${envPath}\n`);
  }
}
```

Call it before NestFactory.create:
```ts
// apps/api-gateway/src/main.ts (top of file)
import { loadLocalEnv } from './config/env.loader';
loadLocalEnv();
```

**Verification.** A `.env` with `JWT="abc\ndef"` parses to a single line `abc\ndef` (the literal characters), and the running gateway reports a working secret. A `.env` with `JWT=` (empty) does not override the orchestrator's value (use `override: false`).

---

### Finding 8 — Hardcoded DB credentials in `packages/db` and `seed.ts`  *(High — REGRESSION)*

**Where:** `apps/api-gateway/src/db/db.module.ts:25` and `packages/db/src/seed.ts:32` (re-introduced since first pass)
```ts
password: process.env.POSTGRES_PASSWORD || 'dtfm_pass'
```

**Why.** When `POSTGRES_PASSWORD` is missing, the package silently connects as `dtfm_user` with password `dtfm_pass`. A misconfigured environment can connect to a default-password database and read/write real data. The `drizzle.config.ts` falls back to `postgres`/`postgres` — the well-known superuser default. The pool has no `ssl` toggle, so a future move to RDS/Cloud SQL will leak data in transit. The new `seed.ts` (Finding 25) re-introduces the same fallback in dev tooling, which means a fresh clone with no `.env` will connect and run migrations.

**Fix.** `packages/db/src/index.ts`:
```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export interface DbEnv {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl: boolean;
}

export function loadDbEnv(): DbEnv {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: required('POSTGRES_USER', process.env.POSTGRES_USER),
    password: required('POSTGRES_PASSWORD', process.env.POSTGRES_PASSWORD),
    database: required('POSTGRES_DB', process.env.POSTGRES_DB),
    ssl: process.env.POSTGRES_SSL === 'true',
  };
}

let _pool: Pool | undefined;
let _db: ReturnType<typeof drizzle> | undefined;

export function getPool(): Pool {
  if (_pool) return _pool;
  const env = loadDbEnv();
  _pool = new Pool({
    host: env.host,
    port: env.port,
    user: env.user,
    password: env.password,
    database: env.database,
    ssl: env.ssl ? { rejectUnauthorized: true } : undefined,
    max: Number(process.env.POSTGRES_POOL_MAX) || 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
  return _pool;
}

export function getDb() {
  if (_db) return _db;
  _db = drizzle(getPool(), { schema });
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

export * from './schema';
```

`apps/api-gateway/src/db/db.module.ts` — remove the inline pool, use `getPool()`:
```ts
import { Global, Module, Logger } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { createDb, type Schema } from '@digital-twin-fm/db';

export const DB_TOKEN = 'DB';

@Global()
@Module({
  providers: [
    {
      provide: DB_TOKEN,
      useFactory: (): NodePgDatabase<Schema> => {
        Logger.log('DB pool initialized', 'DbModule');
        return createDb(getPool());
      },
    },
  ],
  exports: [DB_TOKEN],
})
export class DbModule {}
```

`packages/db/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

loadDotenv({ path: resolve(__dirname, '..', '..', '.env') });

const password = process.env.POSTGRES_PASSWORD;
if (!password) {
  throw new Error('POSTGRES_PASSWORD is required to run migrations.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'dtfm_user',
    password,
    database: process.env.POSTGRES_DB || 'dtfm_db',
    ssl: process.env.POSTGRES_SSL === 'true' ? 'require' : false,
  },
});
```

`packages/db/src/seed.ts:32` — same fix; require `POSTGRES_PASSWORD`.

**Verification.** Importing the package without env vars throws at the first query, not silently. Connecting to a Postgres with TLS available and `POSTGRES_SSL=true` negotiates TLS. `pnpm seed` without env throws.

---

### Finding 9 — Login error messages echo raw API errors  *(High — EXPANDED)*

**Where:** `apps/web/src/app/login/actions.ts:32-35`, `apps/web/src/lib/api-client.ts:40-49`, `apps/web/src/app/dashboard/page.tsx:82`

**Why.** The API client parses `body.message` and rethrows it. The Server Action returns `err.message` to the user. The dashboard renders `apiError` from the *first* failed upstream call directly into the DOM (`{apiError && <span>({apiError})</span>}`). Today the only message is "Invalid credentials" (good), but the moment any 5xx hits — a DB outage, a Nest timeout, a future Drizzle error with a column name in the message — the user sees the raw server text. This is a future-shaped information-leak and a UX bug.

**Fix.** `apps/web/src/lib/api-client.ts`:
```ts
async function call<T>(
  path: string,
  init: RequestInit = {},
  callDeps: ApiClientDeps = {},
): Promise<T> {
  const f = callDeps.fetch ?? deps.fetch ?? globalThis.fetch;
  if (!f) throw new Error('No fetch implementation available');

  let res: Response;
  try {
    res = await f(`${base}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch (e) {
    throw new Error('Network error');
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid credentials');
    if (res.status === 429) throw new Error('Too many attempts. Try again later.');
    throw new Error(`Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
```

`apps/web/src/app/login/actions.ts`:
```ts
} catch (err) {
  console.error('login failed', err);
  return { error: 'Sign-in failed. Please try again.' };
}
```

`apps/web/src/app/dashboard/page.tsx` — stop rendering `apiError` and surface failures per panel (see Finding 14 for the full rewrite).

**Verification.** A unit test asserts that a 500 response from the gateway does *not* include the raw `body.message` in the resulting `Error` thrown by the client. A second test asserts that the dashboard page does not render strings matching the upstream error format (e.g. `ECONNREFUSED`).

---

### Finding 10 — JWT lacks `aud`/`iss`; cookie outlives token; refresh secret unused  *(High)*

**Where:** `apps/api-gateway/src/auth/auth.module.ts:9-15`, `apps/web/src/app/login/actions.ts:25-31`

**Why.** A JWT signed by this gateway can be replayed against any service that shares the secret and does not check `aud`. The web cookie is good for 8 hours while the access token lives 15 minutes — after expiry, every protected fetch fails with no recovery path. The `JWT_REFRESH_SECRET` is loaded into config but no service uses it, so the access-token expiry currently strands the user.

**Fix.** Already partly shown in Finding 1 (`aud`/`iss` set at sign time, refresh token signed with `refreshSecret`). Add the rest:

**Refresh endpoint — `apps/api-gateway/src/auth/auth.controller.ts`:**
```ts
@Public()
@Throttle({ auth: { ttl: 60_000, limit: 5 } })
@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(@Body() body: RefreshDto) {
  const tokens = await this.auth.refresh(body.refreshToken);
  return tokens;
}
```

**`apps/api-gateway/src/auth/auth.service.ts`** — add a `refresh()` method that verifies the refresh token, rotates it, and returns a new pair. Store revoked-token jti in Redis with TTL = refresh token TTL.

**`apps/web/src/app/login/actions.ts`** — set refresh cookie as well, separate from access:
```ts
(await cookies()).set('dtfm_token', accessToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60, // 15 minutes, match access token TTL
});
(await cookies()).set('dtfm_refresh', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
  sameSite: 'lax',
  path: '/api/auth', // only sent to /api/auth
  maxAge: 7 * 24 * 60 * 60,
});
```

Add a client helper to silently refresh on 401:
```ts
// apps/web/src/lib/api-client.ts
async function call<T>(...): Promise<T> {
  // … existing call …
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await f(...);
      // …
    }
  }
}
```

**Verification.** A token signed for a different `aud` is rejected with 401. A refresh-token replayed after rotation is rejected.

---

### Finding 11 — Server Action CSRF/origin  *(High)*

**Where:** `apps/web/src/app/login/actions.ts`, `apps/web/next.config.ts`

**Why.** Next.js Server Actions have built-in same-origin checks since 14, but only when `experimental.serverActions.allowedOrigins` is set. The current `next.config.ts` does not set it. A cross-site form post can hit the action in some configurations, especially when the action is also wired to a manual `fetch('/login', …)` (see `login-form.tsx:15`).

**Fix.** Two layers:

1. In `next.config.ts` set `serverActions.allowedOrigins` (already shown in Finding 6's fix).
2. Add a real Server Action invocation in `login-form.tsx` rather than the manual `fetch`:
   ```tsx
   'use client';
   import { useFormState, useFormStatus } from 'react-dom';
   import { loginAction } from './actions';
   const initial = { error: null as string | null };
   export function LoginForm() {
     const [state, formAction] = useFormState(loginAction, initial);
     return (
       <form action={formAction} className="flex flex-col gap-4 max-w-sm w-full">
         {state.error && <div role="alert" className="text-red-400 text-sm">{state.error}</div>}
         <label>…</label>
         <Submit />
       </form>
     );
   }
   function Submit() { const { pending } = useFormStatus(); return <button disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>; }
   ```
   This way the action is bound to the same origin by the framework. Drop the manual `fetch` entirely.

**Verification.** A POST to `/login` from `evil.com` is rejected at the framework layer. The action is still callable from a `<form action={…}>` on the same origin.

---

### Finding 12 — Ingestion service is a public publisher  *(High — NEW)*

**Where:** `apps/ingestion-service/src/index.ts:31,64,79`
```ts
await app.register(cors, { origin: true });
// …
app.post("/ingest/sensor-reading", async (req, reply) => { /* … */ });
// …
await app.listen({ port: PORT, host: "0.0.0.0" });
```

**Why.** The service binds to `0.0.0.0` (every interface), accepts CORS from any origin, and exposes a POST that publishes directly to Redis pub/sub. Combined with no auth, no API key, no rate limit, and a downstream consumer that derives alerts from sensor readings, anyone reachable on the network can:
- Flood `sensor.reading` with arbitrary values (denial of service, alert storms, false alarms).
- Inject values that pollute a future ML/training dataset.
- Race the legitimate ingestion path to overwrite the `last_value` for a sensor.

**Fix.** Bind to `127.0.0.1` by default; require an `INGEST_API_KEY` header in any non-development environment; rate-limit per IP and per API key; add a startup-time warning when binding to `0.0.0.0`.

`apps/ingestion-service/src/index.ts`:
```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import { z } from "zod";
import rateLimit from "@fastify/rate-limit";
import { Redis } from "ioredis";
import mqtt from "mqtt";

const PORT = Number(process.env.PORT) || 4100;
const HOST = process.env.HOST || "127.0.0.1";
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
const MQTT_URL = process.env.MQTT_URL || "";
const INGEST_API_KEY = process.env.INGEST_API_KEY;

const SensorReading = z.object({
  sensorId: z.string().uuid(),
  assetId: z.string().uuid(),
  timestamp: z.string().datetime().optional(),
  value: z.number().finite(),
  unit: z.string().min(1).max(16),
  quality: z.enum(["good", "uncertain", "bad"]).default("good"),
});

const app = Fastify({ logger: { level: process.env.LOG_LEVEL || "info" } });

// Tighten CORS: same-origin by default. Use a configured allow-list for browser clients.
const corsOrigins = (process.env.CORS_ORIGIN ?? "")
  .split(",").map((o) => o.trim()).filter(Boolean);
await app.register(cors, { origin: corsOrigins.length ? corsOrigins : false, credentials: true });

// Per-IP rate limit on the public surface.
await app.register(rateLimit, {
  global: false, // only where we attach it
  max: 600,        // 600 req/min/IP
  timeWindow: "1 minute",
});

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: false });
redis.on("error", (err) => app.log.error({ err }, "redis error"));

let mqttClient: mqtt.MqttClient | null = null;
if (MQTT_URL) {
  mqttClient = mqtt.connect(MQTT_URL, {
    username: process.env.MQTT_USER || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  });
  mqttClient.on("connect", () => {
    app.log.info({ MQTT_URL }, "mqtt connected");
    mqttClient!.subscribe("sensors/+/reading");
  });
  mqttClient.on("message", async (topic, payload) => {
    try {
      const parsed = SensorReading.parse(JSON.parse(payload.toString()));
      await publish(parsed);
    } catch (err) {
      app.log.warn({ err, topic }, "invalid mqtt message");
    }
  });
}

async function publish(reading: z.infer<typeof SensorReading>) {
  await redis.publish("sensor.reading", JSON.stringify(reading));
}

app.get("/health", async () => ({ status: "ok", service: "ingestion-service" }));

// API-key check (only enforced when INGEST_API_KEY is set).
function checkApiKey(req: any, reply: any, done: any) {
  if (!INGEST_API_KEY) return done(); // dev mode: open
  const provided = req.headers["x-ingest-api-key"];
  if (provided !== INGEST_API_KEY) {
    reply.code(401).send({ error: "Unauthorized" });
    return;
  }
  done();
}

app.post(
  "/ingest/sensor-reading",
  { preHandler: [checkApiKey, app.rateLimit({ max: 60, timeWindow: "1 minute" })] },
  async (req, reply) => {
    const parsed = SensorReading.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "InvalidBody", details: parsed.error.flatten() });
    }
    const reading = {
      ...parsed.data,
      timestamp: parsed.data.timestamp ?? new Date().toISOString(),
    };
    await publish(reading);
    return { ok: true, reading };
  }
);

const start = async () => {
  try {
    if (HOST === "0.0.0.0" && process.env.NODE_ENV === "production") {
      app.log.warn("Binding to 0.0.0.0 in production. Make sure a reverse proxy is in front.");
    }
    await app.listen({ port: PORT, host: HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};
start();
```

`apps/ingestion-service/package.json`:
```json
"dependencies": {
  "@fastify/rate-limit": "^10.0.0"
}
```

**Verification.** A POST from `127.0.0.1` without `X-Ingest-Api-Key` succeeds in dev (`INGEST_API_KEY` unset). A POST with `NODE_ENV=production` and `INGEST_API_KEY` set, without the header, returns 401. 61 rapid POSTs return 429.

---

### Finding 13 — AI service CORS inverts dev/prod intent  *(High — NEW)*

**Where:** `apps/ai-service/app/main.py:33-40`
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if not settings.openai_api_key else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Why.** The CORS policy is *less* strict in development than production. That's backwards — in dev you can use a permissive CORS; in prod you lock down. The current code does the opposite. With `allow_credentials=True` and `allow_origins=["*"]`, any browser that reaches the AI service can hit it on behalf of the user. There is also no auth on `/ai/copilot/query` (Finding C-F4) so any caller can run LLM calls billed to the operator.

**Fix.** `apps/ai-service/app/main.py`:
```python
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import health, copilot

settings = get_settings()

DEFAULT_DEV_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Digital Twin FM — AI Service",
    version="0.1.0",
    description="RAG, anomaly explanation, and predictive maintenance. MIT-licensed.",
    lifespan=lifespan,
)

# Strict CORS in all environments. Configure via CORS_ORIGIN.
origins_env = settings.cors_origin.strip() if settings.cors_origin else ""
allow_origins = [o.strip() for o in origins_env.split(",") if o.strip()] or (
    DEFAULT_DEV_ORIGINS if settings.env != "production" else []
)
if not allow_origins and settings.env == "production":
    raise RuntimeError("CORS_ORIGIN is required in production.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(health.router, tags=["health"])
app.include_router(copilot.router, prefix="/ai", tags=["copilot"])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.host, port=settings.port, reload=settings.env == "development")
```

`apps/ai-service/app/config.py`:
```python
class Settings(BaseSettings):
    # … existing fields …
    env: str = "development"
    host: str = "127.0.0.1"           # bind to loopback by default
    port: int = 8000
    cors_origin: str | None = None
```

Also add auth to the copilot router (see Finding 4's web-side `requireSession()` — propagate the user identity to the AI service via a signed internal JWT, not by trusting the caller):

`apps/ai-service/app/routers/copilot.py`:
```python
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from .internal_auth import verify_internal_jwt

router = APIRouter()
bearer = HTTPBearer(auto_error=False)


@router.post("/copilot/query", response_model=CopilotQueryResponse)
async def query(
    req: CopilotQueryRequest,
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> CopilotQueryResponse:
    if not creds:
        raise HTTPException(status_code=401, detail="Unauthorized")
    user = verify_internal_jwt(creds.credentials)
    # … call LiteLLM with the user-scoped context …
    return CopilotQueryResponse(
        answer=f"[MVP stub] Received question from {user['email']}: \"{req.question}\".",
        sources=[],
        model="stub",
        stub=True,
    )
```

**Verification.** `curl -X POST http://127.0.0.1:8000/ai/copilot/query` with no `Authorization` header returns 401. The same with a valid internal JWT returns 200. A `Origin: https://evil.com` request to the dev server is rejected by CORS.

---

### Finding 14 — Dashboard swallows 3 of 4 errors and reports "connected"  *(High — NEW)*

**Where:** `apps/web/src/app/dashboard/page.tsx:38-49`

**Why.** Four parallel API calls are issued. The first rejects → `apiError` is set, `apiStatus` is set to `disconnected`. The other three silently return `[]` regardless of cause. Then `if (!apiError) apiStatus = 'connected'` — so a successful `findBuildings()` plus a failed `findAssets()`/`findSensors()`/`findAlerts()` reports "connected" while showing zero data. Worse, `apiError` is rendered into the DOM as the raw upstream message — full XSS-class information leak.

**Fix.** Treat each query independently; render explicit per-panel error states; never render the raw upstream message. Pass the user identity into the API client so queries are scoped.

`apps/web/src/app/dashboard/page.tsx`:
```tsx
import { requireSession } from '@/lib/session';
import { getServerEnv } from '@/env';
import { createApiClient } from '@/lib/api-client';

export const metadata = { title: 'Dashboard — Digital Twin FM' };
export const dynamic = 'force-dynamic';

interface PanelState<T> { data: T | null; error: 'unauthorized' | 'network' | 'server' | null; }

async function safeCall<T>(fn: () => Promise<T>): Promise<PanelState<T>> {
  try {
    return { data: await fn(), error: null };
  } catch (e: any) {
    if (e?.message === 'Unauthorized') return { data: null, error: 'unauthorized' };
    if (String(e?.message ?? '').startsWith('Network')) return { data: null, error: 'network' };
    return { data: null, error: 'server' };
  }
}

export default async function DashboardPage() {
  const session = await requireSession();
  const { apiGatewayUrl } = getServerEnv();
  const api = createApiClient({ baseUrl: apiGatewayUrl, token: undefined /* attach session JWT here */ });

  const [b, a, s, r] = await Promise.all([
    safeCall(() => api.findBuildings()),
    safeCall(() => api.findAssets()),
    safeCall(() => api.findSensors()),
    safeCall(() => api.findAlerts({ limit: 5 })),
  ]);

  const allOk = [b, a, s, r].every((p) => !p.error);
  const someError = [b, a, s, r].some((p) => p.error);

  // … render the page; per-panel: if state.error, render "Unavailable — try again"; never render state.error.message text
  // status dot: green if allOk, red if someError, amber if no data (cold start)
  // …
}
```

`apps/web/src/lib/api-client.ts` — stop echoing the upstream message:
```ts
async function call<T>(path: string, init: RequestInit = {}, callDeps: ApiClientDeps = {}): Promise<T> {
  // … same as Finding 9 fix …
  if (!res.ok) {
    if (res.status === 401) throw new Error('Unauthorized');
    if (res.status === 429) throw new Error('Too many requests');
    throw new Error(`HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}
```

**Verification.**
- Unit test: with `findAssets` mocked to reject, the page renders an explicit "Assets unavailable" panel and the dot is red.
- Unit test: with all four mocked to succeed, the dot is green and counts are correct.
- Unit test: the page never contains the string "ECONNREFUSED" or "relation \"alerts\" does not exist" in its rendered output.

---

### Finding 15 — `/dashboard` and `/twin` are publicly accessible  *(High — NEW)*

**Where:** `apps/web/src/app/dashboard/page.tsx`, `apps/web/src/app/twin/page.tsx`

**Why.** Neither page imports `requireSession()` or any session helper. There is no `apps/web/middleware.ts`. There is no `apps/web/src/lib/session.ts`. The only auth check is the cookie-presence redirect at `/` (`apps/web/src/app/page.tsx:5-9`). A direct URL hit on `/dashboard` or `/twin` renders the page without challenge; the `dtfm_token` cookie is never read server-side. Combined with Finding 4, *every* business endpoint of the web app is anonymous.

**Fix.** Two layers:
1. **`apps/web/src/middleware.ts`** (already shown in Finding 4) — runs in the Next.js edge before every matched route, decodes + verifies the JWT, redirects to `/login` on miss/expiry.
2. **Per-page** `requireSession()` (also in Finding 4) — belt-and-braces for routes the middleware might not match (rare, but document why both exist).

For `/twin`, also: ensure that `DEMO_ASSETS` is replaced with a server-side `api.findAssets({ buildingId: session.buildingId })` call. The current static demo assets leak the architectural intent.

**Verification.**
- `curl -I http://localhost:3000/dashboard` returns 307/302 to `/login` when no `dtfm_token` cookie is present.
- `curl -I http://localhost:3000/twin` returns 307/302 to `/login` when no cookie is present.
- A cookie with a syntactically valid but signature-mismatched JWT also redirects to `/login`.

---

### Finding 16 — Postgres and Valkey bound to all interfaces  *(Medium)*

**Where:** `docker-compose.yml:17,34`
```yaml
ports:
  - "5432:5432"
# …
ports:
  - "6379:6379"
```

**Why.** Local-dev services are reachable from any interface the host has, including a public Wi-Fi. Valkey without `--requirepass` is an open door on shared networks.

**Fix.** `docker-compose.yml`:
```yaml
services:
  postgres:
    image: timescale/timescaledb:latest-pg16
    container_name: dtfm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-dtfm_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-dtfm_db}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init-db.sql
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD", "pg_isready", "-U", "${POSTGRES_USER:-dtfm_user}", "-d", "${POSTGRES_DB:-dtfm_db}"]
      interval: 10s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:7.2-alpine
    container_name: dtfm-valkey
    restart: unless-stopped
    command:
      - valkey-server
      - --save
      - "60 1"
      - --loglevel
      - warning
      - --requirepass
      - ${REDIS_PASSWORD:?REDIS_PASSWORD is required}
      - --bind
      - 127.0.0.1
      - --protected-mode
      - "yes"
    volumes:
      - valkey_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "valkey-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  valkey_data:
```

**Verification.** `nmap -p 5432,6379 <host-public-ip>` shows both ports closed. `redis-cli -h 127.0.0.1` requires the password.

---

### Finding 17 — `init-db.sql` runs as superuser, no app role, runs only on fresh volume  *(Medium)*

**Where:** `init-db.sql:1-2`, `docker-compose.yml:15`

**Why.** The bootstrap script runs as the `POSTGRES_USER` defined in the Timescale image — i.e. a superuser. There is no separate `dtfm_app` role with least-privilege grants. An SQL-injection bug in the application would have DDL rights. The mount of `init-db.sql` to `docker-entrypoint-initdb.d` only runs on a *fresh* data volume, so editing the file later has no effect — a known footgun.

**Fix.** Two-phase bootstrap. `init-db.sql` becomes:
```sql
-- 00-bootstrap.sql (runs as superuser on first init)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'dtfm_app') THEN
    CREATE ROLE dtfm_app LOGIN PASSWORD NULL;
  END IF;
END
$$;

-- Lock down default privileges on public
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO dtfm_app;
```

Then `01-extensions.sql` (also run on init):
```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
GRANT CREATE ON SCHEMA public TO dtfm_app;
```

Add a startup probe in the api-gateway that fails loudly if TimescaleDB is missing:
```ts
// apps/api-gateway/src/db/db.module.ts — add a probe
{
  provide: 'DB_PROBE',
  inject: [DB_TOKEN],
  useFactory: async (db: NodePgDatabase) => {
    const rows = await db.execute(sql`SELECT extname FROM pg_extension WHERE extname='timescaledb'`);
    if (!rows.length) {
      throw new Error('TimescaleDB extension is not installed. Run docker-compose up -d postgres first.');
    }
    return true;
  },
}
```

`packages/db` and `apps/api-gateway` should both connect as `dtfm_app`, not `dtfm_user`. Migrations are the only thing that needs DDL.

**Verification.** The app connects with `dtfm_app` and cannot `CREATE TABLE` or `DROP TABLE`. A postgres container started without the init script (e.g. someone deleted the data volume) crashes the gateway with a clear error.

---

### Finding 18 — `Cookie.secure` only in `production`  *(Medium)*

**Where:** `apps/web/src/app/login/actions.ts:27`

**Why.** A staging environment with `NODE_ENV=staging` (a common convention, even if not currently used here) would mark `secure: false`, allowing the JWT to travel over plain HTTP. This is exactly the kind of environment that gets hit by an SSL-stripping proxy in the demo lab.

**Fix.** Already shown in Finding 10's fix:
```ts
secure: process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test',
```

**Verification.** With `NODE_ENV=staging`, the `Set-Cookie` header includes `Secure`.

---

### Finding 19 — `pnpm allowBuilds` runs `es5-ext` postinstall workspace-wide  *(Medium)*

**Where:** `pnpm-workspace.yaml:4-7`

**Why.** `es5-ext` has had postinstall RCE-class advisories historically. Letting it run on every install in every environment, including CI, is unnecessary attack surface.

**Fix.** `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
allowBuilds:
  '@nestjs/core': true
  esbuild: true
```

If `es5-ext` is genuinely required by some transitive dep, pin a known-good version in `package.json#pnpm.overrides` and document the override:
```json
{
  "pnpm": {
    "overrides": {
      "es5-ext": "0.10.64"
    }
  }
}
```

**Verification.** `pnpm install` in CI does not execute the `es5-ext` postinstall script.

---

### Finding 20 — CI has no security audit; license audit is broken  *(Medium — EXPANDED)*

**Where:** `.github/workflows/ci.yml:13-47`, `scripts/check-licenses.mjs:110-157`

**Why.** No `pnpm audit`, no `gitleaks`/`trufflehog`, no Dependabot. The license audit script (already present and listed in `ci.yml:36-37`) is **broken in this monorepo** — it walks `apps/*/node_modules` and `packages/*/node_modules`, but with pnpm, the *direct* deps live in the root `node_modules` and per-workspace `node_modules` is mostly empty (or contains `.pnpm` symlinks). The script will read zero packages and report "✅ All 0 dependencies pass the license audit". The CI step is currently passing the build without actually auditing anything.

**Fix.** Add three jobs / steps and fix the license script:

`.github/workflows/ci.yml` (additions):
```yaml
  audit:
    name: Audit and secret scan
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: ${{ env.PNPM_VERSION }} }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: 'pnpm' }
      - name: Install
        run: pnpm install --frozen-lockfile
      - name: pnpm audit
        run: pnpm audit --prod --audit-level=high
      - name: gitleaks
        uses: gitleaks/gitleaks-action@v2
        env: { GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }} }
```

Add `.github/dependabot.yml`:
```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
    labels: ["dependencies"]
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
    labels: ["dependencies"]
```

Add a `.gitleaks.toml` for custom rules covering the project-specific patterns.

`scripts/check-licenses.mjs` — switch to `pnpm list --json --recursive`:
```js
import { execSync } from 'node:child_process';
const out = execSync('pnpm list --json --recursive --depth=Infinity', { encoding: 'utf8' });
const trees = JSON.parse(out);
// Walk trees, collect {name, version, license}, apply APPROVED_LICENSES + BANNED_PATTERNS.
```

**Verification.** A push of a fake `JWT_ACCESS_SECRET=abc` in a test commit is blocked by gitleaks. A PR that bumps a vulnerable dep is opened by Dependabot. The license audit reports the actual installed package count, not 0.

---

### Finding 21 — No `engines.node`, weak `.env` ignore  *(Medium)*

**Where:** `package.json`, `.gitignore:15-17`

**Why.** Developers on the wrong Node version get lockfile drift. Files like `.env.production` are not ignored.

**Fix.** Add to the root `package.json`:
```json
{
  "engines": { "node": ">=20.10.0 <21 || >=22" }
}
```

Add to `.gitignore`:
```
.env
.env.*
!.env.example
```

**Verification.** `node -e "process.versions"` outside the supported range produces a `pnpm install` warning. `git status` does not show `.env.production`.

---

### Finding 22 — Zero security headers  *(Medium)*

**Covered by Findings 6.** The fix sets the headers both at the NestJS gateway (`helmet`) and the Next.js edge (`headers()` in `next.config.ts`).

---

### Finding 23 — Triplicated, drifted type definitions  *(Medium — NEW)*

**Where:**
- `packages/types/src/index.ts:29-51` — `Building` (no `totalFloors`), `Asset` (no `manufacturer`/`model`/`serialNumber`, `positionX/Y/Z?: number`).
- `apps/web/src/lib/api-client.ts:20-50` — its own `Building` and `Asset` (with `totalFloors: number`, `positionX/Y/Z: number | null`).
- `apps/api-gateway/src/buildings/dto/building.dto.ts` and `apps/api-gateway/src/assets/dto/asset.dto.ts` — the DTOs (with `manufacturer`, `model`, `serialNumber`).
- `AssetType` and `AssetStatus` are exhaustive unions in `types`, but plain `string` in the api-client and DTOs.

**Why.** Drift across three sources. The dashboard renders `building?.totalFloors` (works for api-client, undefined for `types`). The `twin/page.tsx` imports `Asset` from `types` but the actual API returns the api-client `Asset` with different fields. The DTOs add fields the `types` package doesn't know about, so `Asset.floorId` is `string | undefined` in `types` and `string | null` in the api-client — a runtime hazard when a DTO returns `null` and the consumer expects `undefined`. The DTOs being `interface` (not `class`) means `ValidationPipe` will silently do nothing once a POST route is added (Finding 29).

**Fix.** Make `@digital-twin-fm/types` the single source of truth.

`packages/types/src/index.ts`:
```ts
export interface Building {
  id: string;
  name: string;
  address?: string | null;
  totalFloors: number;
  createdAt: string;
  updatedAt: string;
}

export interface Asset {
  id: string;
  buildingId: string;
  floorId?: string | null;
  roomId?: string | null;
  name: string;
  type: AssetType;
  status: AssetStatus;
  manufacturer?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  installedAt?: string | null;
  positionX?: number | null;
  positionY?: number | null;
  positionZ?: number | null;
  createdAt: string;
  updatedAt: string;
}
```

`apps/web/src/lib/api-client.ts` — re-export from types, do not redefine:
```ts
export type { Building, Asset, Sensor, Alert, AssetStatus, AssetType, SensorType, AlertSeverity, AlertStatus } from '@digital-twin-fm/types';
```

Delete `apps/api-gateway/src/{buildings,assets,sensors,alerts}/dto/*.ts`; import from `@digital-twin-fm/types` in the controllers:
```ts
import { Building } from '@digital-twin-fm/types';
@Get(':id')
async findOne(@Param('id') id: string): Promise<Building> { … }
```

**Verification.** `tsc --noEmit` fails if a controller or api-client method references a field that isn't in `types`. The dashboard test asserts the building mock has the same shape as a real API response (no `as any` casts).

---

### Finding 24 — TimescaleDB migration is fiction  *(Medium — NEW)*

**Where:** `packages/db/drizzle/0000_bouncy_vulture.sql:64-71`, `packages/db/src/schema.ts:111-115`

**Why.** `sensor_readings` has no PK (id is generated but not part of any key). TimescaleDB requires a PK on hypertables, and complains on `create_hypertable` if absent. The migration does not call `create_hypertable('sensor_readings', 'timestamp')`. The `init-db.sql` only runs `CREATE EXTENSION IF NOT EXISTS timescaledb;` — the table is therefore a plain heap, not a hypertable. The "TimescaleDB" claim in `.env.example:5`, `LICENSES.md`, and the `ARCHITECTURE.md` doc is fiction. Without a PK, `ON CONFLICT (sensor_id, timestamp) DO NOTHING` is not possible for idempotent ingestion.

**Fix.** Use a composite PK on the time-series table (standard for sensor data), and add a follow-up SQL block to call `create_hypertable`.

`packages/db/drizzle/0000_bouncy_vulture.sql` — replace the `sensor_readings` block:
```sql
CREATE TABLE IF NOT EXISTS "sensor_readings" (
  "sensor_id" uuid NOT NULL,
  "asset_id" uuid NOT NULL,
  "timestamp" timestamp NOT NULL,
  "value" double precision NOT NULL,
  "quality" varchar(16) DEFAULT 'good' NOT NULL,
  PRIMARY KEY ("sensor_id", "timestamp")
);
```

`packages/db/drizzle/0001_hypertable.sql` (new migration):
```sql
-- Convert sensor_readings to a TimescaleDB hypertable.
-- Idempotent: create_hypertable throws if already a hypertable; check first.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM _timescaledb_catalog.hypertable
    WHERE hypertable_schema = 'public' AND hypertable_name = 'sensor_readings'
  ) THEN
    PERFORM create_hypertable('sensor_readings', 'timestamp', chunk_time_interval => INTERVAL '1 day');
  END IF;
END
$$;

-- Secondary index for "latest N readings for sensor X" queries.
CREATE INDEX IF NOT EXISTS "sensor_readings_sensor_time_idx"
  ON "sensor_readings" ("sensor_id", "timestamp" DESC);
```

`packages/db/src/schema.ts:103-116` — match the migration:
```ts
export const sensorReadings = pgTable("sensor_readings", {
  sensorId: uuid("sensor_id").notNull(),
  assetId: uuid("asset_id").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull(),
  value: doublePrecision("value").notNull(),
  quality: varchar("quality", { length: 16 }).notNull().default("good"),
}, (t) => ({
  pk: primaryKey({ columns: [t.sensorId, t.timestamp] }),
  sensorTimeIdx: index("sensor_readings_sensor_time_idx").on(t.sensorId, t.timestamp.desc()),
}));
```

**Verification.** `SELECT * FROM _timescaledb_catalog.hypertable WHERE hypertable_name='sensor_readings'` returns one row. Inserting 1M rows into one chunk is much faster than the same against a non-hypertable.

---

### Finding 25 — `seed.ts` placeholder password and no env guard  *(Medium — NEW)*

**Where:** `packages/db/src/seed.ts:53,183`
```ts
const [admin] = await db.insert(users).values({
  email: "admin@dtfm.local",
  passwordHash: "REPLACE_WITH_BCRYPT_HASH",
  // …
}).returning();
```

**Why.** A literal non-hash string is committed to the `users` table. Login with that string fails (because `AuthService` SHA-256s the input), so it's dead data — but the row is referenced by the seeded `workOrders.assignedTo = admin.id` (line 175), so deleting the user or changing the seed will orphan 8 work orders. The `AuthService` does not look up users from the DB at all, so the seeded user is **dead data that looks real**.

There is also no environment guard — a typo (`pnpm seed --prod` by accident) wipes the production database.

**Fix.** `packages/db/src/seed.ts`:
```ts
import * as argon2 from 'argon2';
import { program } from 'commander';

// …

if (process.env.NODE_ENV === 'production') {
  throw new Error('Refusing to seed in production. Set NODE_ENV explicitly to override and pass --confirm.');
}

program
  .requiredOption('--password <password>', 'Admin password (used to compute the seed hash)')
  .option('--confirm', 'Required when NODE_ENV is staging or production')
  .parse(process.argv);
const opts = program.opts();
if (!opts.password || opts.password.length < 12) {
  throw new Error('--password is required and must be at least 12 characters');
}

const passwordHash = await argon2.hash(opts.password, { type: argon2.argon2id });

const [admin] = await db.insert(users).values({
  email: "admin@dtfm.local",
  passwordHash,
  fullName: "Demo Admin",
  role: "admin",
}).returning();
```

**Verification.** `pnpm seed` without `--password` exits 1 with a clear message. `pnpm seed --password=test` exits 1 because the password is too short. `NODE_ENV=production pnpm seed --password='real-pass'` exits 1 (no `--confirm`).

---

### Finding 26 — Three password-leaking scripts  *(Low — NEW)*

**Where:** `scripts/check-env.js`, `scripts/dump-env.js`, `scripts/get-pw.js`

**Why.** These scripts read `.env` and **print the raw line of any password key** to stdout. If a developer runs them against `.env`, the password is printed in the terminal, in CI logs, and in any process that captures output. The bug is not in the *logic* (they do what their names suggest) — the bug is that they exist at all.

**Fix.** Delete all three scripts. If you need to debug env loading, log the *keys present* (not the values) and the *length* (not the value).

```bash
rm scripts/check-env.js scripts/dump-env.js scripts/get-pw.js
```

**Verification.** A grep for `MVP_ADMIN_PASSWORD` across `scripts/` returns no results.

---

### Finding 27 — `package.json#lint` is `echo` in 3 of 4 workspaces  *(Low — NEW)*

**Where:** `packages/types/package.json:9`, `packages/ui/package.json:9`, `packages/db/package.json:15`

**Why.** The per-package `lint` scripts are `echo "..." && exit 0` — they pass without linting anything. `turbo.json:10-13` defines the `lint` inputs, but the per-package `lint` is a no-op. `pnpm lint` at the root **passes even if every `src/**` file is full of `any` and `console.log`**, because three of the four workspaces are no-ops.

**Fix.** Either configure real ESLint in the no-op packages, or mark the per-package script as a deliberate "skip" and have the root lint directly cover all files. Recommended: a shared `eslint-config` (already exists at `packages/eslint-config/index.cjs`) plus a per-package `.eslintrc.cjs` extending it:

`packages/types/package.json`:
```json
{
  "scripts": {
    "lint": "eslint \"src/**/*.ts\" --max-warnings 0",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "eslint-config-digital-twin-fm": "workspace:*",
    "typescript": "^5.3.3"
  }
}
```

`packages/types/.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  extends: ['../../packages/eslint-config/index.cjs'],
  ignorePatterns: ['dist', 'node_modules', '*.cjs'],
};
```

`packages/ui/.eslintrc.cjs` and `packages/db/.eslintrc.cjs` — same shape. `pnpm lint` then runs four real lint passes.

**Verification.** `pnpm lint` reports a violation when `apps/api-gateway/src/auth/auth.service.ts:35` contains `createHash('sha256')` (current state), proving the lint actually inspects code.

---

### Finding 28 — `api-gateway` tsconfig missing `strict: true`  *(Low — NEW)*

**Where:** `apps/api-gateway/tsconfig.json:15-19`

**Why.** Only `strictNullChecks`, `noImplicitAny`, `strictBindCallApply` are explicitly enabled. That means `useUnknownInCatchVariables` is *off* (catches are `any`), `strictFunctionTypes` is *off*, `strictPropertyInitialization` is *off* (class fields can be undefined without `!`). The DTOs use `!` (`name!: string`) because of this. The Drizzle `db.module.ts:35` logs a partial URL with user-supplied values without a trailing null guard.

**Fix.** Turn on `strict: true`. The codebase is small enough to fix the resulting errors in one pass; the dividend is huge for catching future bugs.

`apps/api-gateway/tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2022",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": { "@app/*": ["src/*"] }
  }
}
```

**Verification.** `pnpm typecheck` reports the new strict-mode errors. Each is then fixed (mostly by adding `!` where the DTO pattern requires it, or by removing the assertion in favour of an explicit class).

---

### Finding 29 — DTOs are `interface`, not `class`  *(Low — NEW)*

**Where:** `apps/api-gateway/src/{buildings,assets,sensors,alerts}/dto/*.ts`

**Why.** The `ValidationPipe` in `main.ts:11-18` is configured with `whitelist: true, forbidNonWhitelisted: true, transform: true`. Those options only work if the DTO is a **class with class-validator decorators**. Plain interfaces are erased at compile time, so the pipe does nothing on the controllers' inputs. Right now the controllers don't take DTO inputs (all GETs), so this is latent. The moment someone adds a `POST /assets` (which the `Asset` controller is begging for), the pipe will silently accept any body.

**Fix.** Combine with Finding 23: delete the local DTOs and import from `@digital-twin-fm/types`. Make `types` export *classes* with `class-validator` decorators, OR keep them as types and add a separate `*.dto-class.ts` per resource.

`packages/types/src/dto/asset.dto.ts`:
```ts
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, Min, MaxLength } from 'class-validator';

export class CreateAssetDto {
  @IsUUID() buildingId!: string;
  @IsUUID() @IsOptional() floorId?: string;
  @IsUUID() @IsOptional() roomId?: string;
  @IsString() @MaxLength(255) name!: string;
  @IsIn(['ahu', 'chiller', 'boiler', 'pump', 'fan', 'elevator', 'lighting', 'sensor_only', 'other'])
  type!: string;
  @IsIn(['ok', 'warning', 'critical', 'offline', 'info'])
  @IsOptional() status?: string;
  @IsNumber() @IsOptional() @Min(-1e6) positionX?: number;
  @IsNumber() @IsOptional() @Min(-1e6) positionY?: number;
  @IsNumber() @IsOptional() @Min(-1e6) positionZ?: number;
}
```

`apps/api-gateway/src/assets/assets.controller.ts`:
```ts
@Post()
@Roles('admin', 'facility_manager')
async create(@Body() body: CreateAssetDto): Promise<Asset> {
  return this.service.create(body);
}
```

**Verification.** A `POST /assets` with `{ name: 'X' }` (no `buildingId`) returns 400 with a class-validator message about `buildingId`. A `POST /assets` with `{ buildingId: 'not-a-uuid' }` returns 400 with a `IsUUID` message.

---

### Finding 30 — Service spec files are "should be defined" only  *(Low — NEW)*

**Where:** `apps/api-gateway/src/{buildings,assets,sensors,alerts}/*service.spec.ts`

**Why.** The tests use `const db: any = {}` and `expect(service).toBeDefined()`. The line `// 'db' was removed from @digital-twin-fm/db; using a minimal mock here` is correct — but the follow-up (writing real tests) has not happened. Service behaviour is untested.

**Fix.** Add at least:

`apps/api-gateway/src/buildings/buildings.service.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { BuildingsService } from './buildings.service';
import { eq } from 'drizzle-orm';

const dbMock = {
  select: jest.fn().mockReturnThis(),
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([{ id: 'b1', name: 'Hall 7' }]),
};

describe('BuildingsService', () => {
  let service: BuildingsService;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [BuildingsService, { provide: 'DB', useValue: dbMock }],
    }).compile();
    service = module.get(BuildingsService);
  });

  it('findOne returns the row when present', async () => {
    const r = await service.findOne('b1');
    expect(r).toEqual({ id: 'b1', name: 'Hall 7' });
  });

  it('findOne returns null when absent', async () => {
    dbMock.limit.mockResolvedValueOnce([]);
    const r = await service.findOne('b1');
    expect(r).toBeNull();
  });
});
```

`apps/api-gateway/src/alerts/alerts.service.spec.ts` — assert that `findAll({ status: 'open' })` builds an `eq(alerts.status, 'open')` clause. `assets.service.spec.ts` — assert that `findAll({ buildingId, status })` builds an `and(...)` correctly when both are set. `sensors.service.spec.ts` — assert that `findReadings({ from, to, limit })` respects the `limit` and the `from`/`to` filters.

**Verification.** `pnpm test` runs the new assertions and fails when the `where` clause is built incorrectly.

---

### Finding 31 — `r3f.ts` overrides R3F types with `any`; remote HDR  *(Low — NEW)*

**Where:** `apps/web/src/types/r3f.ts:12-19`, `apps/web/src/features/digital-twin/viewer.tsx:73`

**Why.** `r3f.ts` augments `React.JSX.IntrinsicElements` with `mesh: any`, `sphereGeometry: any`, etc. — silencing all type checking on the 3D scene. `viewer.tsx` uses `asset!.id` (non-null assertion on a possibly-undefined `asset`). Separately, `<Environment preset="city" />` fetches a small HDR/EXR file from a third-party CDN (`pmndrs.github.io`). The MVP demo depends on a third-party CDN that the operator does not control. If that endpoint is blocked, down, or compromised, the 3D viewer fails to render or loads a poisoned asset.

**Fix.** Two parts.

**(a) Delete `apps/web/src/types/r3f.ts` and the `import "../types/r3f"` in `layout.tsx`.** R3F's own package ships a `declare global { namespace JSX }` augmentation that works in both Next 15 and ts-jest. If ts-jest cannot find it, augment the test environment only, not the global namespace.

**Remove the import from `apps/web/src/app/layout.tsx`:**
```diff
- import '../types/r3f'; // Side-effect: augments JSX.IntrinsicElements with R3F types
```

**(b) Self-host the HDR or drop it for MVP.**

`apps/web/src/features/digital-twin/viewer.tsx`:
```tsx
// MVP: drop the Environment preset entirely. Replace with explicit lights.
- <Environment preset="city" />
+ <ambientLight intensity={0.5} />
+ <directionalLight position={[10, 10, 10]} intensity={0.8} castShadow />
```

If the team wants the city preset, download the EXR once, place it in `apps/web/public/hdr/city.exr`, and reference it locally:
```tsx
import { useGLTF, Environment } from '@react-three/drei';
- <Environment preset="city" />
+ <Suspense fallback={null}>
+   <Environment files="/hdr/city.exr" />
+ </Suspense>
```

**Verification.** `tsc --noEmit` reports the `any` removal as type errors in `viewer.tsx`; they are fixed by tightening the component. The 3D viewer renders without any network call (DevTools → Network shows zero requests for `pmndrs.github.io`).

---

### Finding 32 — `CODEOWNERS` references non-existent paths; `.claude/settings.local.json` is committed; test fixture  *(Low)*

**Where:** `CODEOWNERS:36-38`, `.claude/settings.local.json:1-8`, `apps/api-gateway/src/auth/auth.service.spec.ts:11`

**Why.** Rules that never fire are worse than no rules — they imply coverage that does not exist. Local editor configuration committed to the repo will eventually contain credentials. The test fixture `process.env.MVP_ADMIN_PASSWORD = 'admin123'` is a real-looking password; if a CI environment ever points at the same `.env`, that string becomes a credential.

**Fix.** Either create the paths or remove the rules. For `.claude/settings.local.json`, gitignore. For the test fixture, generate the password at runtime.

`.gitignore`:
```
.claude/settings.local.json
```

`/SECURITY.md` addendum: "Local editor configurations that may contain credentials MUST NOT be committed. See `.gitignore` for the canonical list."

`apps/api-gateway/src/auth/auth.service.spec.ts`:
```ts
beforeEach(async () => {
  process.env.MVP_ADMIN_EMAIL = `admin-${Date.now()}@test.local`;
  process.env.MVP_ADMIN_PASSWORD = require('crypto').randomBytes(24).toString('base64url');
  // …
});
```

`CODEOWNERS:36-38` — keep the rules, but also create the paths:
- `/SECURITY.md` at the repo root (short summary + link to `documents/mvp/SECURITY.md` and `SECURITY_AUDIT.md`).
- `/infra/` with a README that lists current IaC.

**Verification.** Touching a new file under `/infra/` triggers a required review from `@Saleheen-Akhtar`. Searching the test sources for known-weak passwords (`admin`, `password`, `123`) returns nothing. `git status` does not show `.claude/settings.local.json`.

---

## 3. Defense-in-depth checklist (do these *in addition* to the fixes above)

These are not tied to a single finding but materially raise the floor.

- [ ] Add a `SECURITY.md` at the repo root with a vulnerability disclosure address (`security@dtfm.local` or a GitHub Security Advisory workflow at `.github/SECURITY.md`).
- [ ] Add `npm-audit-resolver` or similar to triage vulns.
- [ ] Add `@sentry/node` (or equivalent) with PII scrubbing for the gateway. Do not log request bodies for `/auth/*`.
- [ ] Add a logging redaction helper: any log line containing `password`, `token`, `secret`, `authorization` is replaced with `[REDACTED]` before write.
- [ ] Pin all dependencies in `package.json` to exact versions (no `^`) for the `apps/api-gateway` and `packages/db` workspaces; allow `^` only in `apps/web`. Use `pnpm install --frozen-lockfile` in CI (already done).
- [ ] Set up branch protection on `main`: require PR review, require CI pass, require linear history, no force-push.
- [ ] Enable GitHub secret scanning and push protection on the repository.
- [ ] Add a `prebuild` script that runs `gitleaks protect --staged` as a pre-commit hook (Husky + lint-staged).
- [ ] Document the *rotation* procedure: how to invalidate all live JWTs (bump `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`; restart the gateway; wait `JWT_REFRESH_TTL` for refresh tokens to expire; or maintain a `jti` blocklist in Redis).
- [ ] Add structured request logging with a request-id header; redact `Authorization`, `Cookie`, and any field matching `/password|token|secret/i` in request bodies.

---

## 4. Threat-model residual risks

After all 32 fixes above, the following risks remain **accepted** for the MVP. Document them in `documents/mvp/SECURITY.md` § Residual risks.

1. **Single shared JWT secret across the whole gateway.** A single secret compromise mints valid tokens until rotation. Mitigation: short access TTL (15m), short refresh TTL (7d), key rotation runbook.
2. **No anomaly detection on login.** A credential-stuffing attack below the throttler rate limit is invisible. Mitigation: throttler + future WebAuthn.
3. **No multi-tenant isolation.** A future building/tenant dimension in the data model will require row-level security policies in Postgres. Not in scope for MVP; flagged for the post-MVP doc.
4. **No IoT device authentication.** `documents/mvp/SECURITY.md:55-65` already calls this out — defer device auth, signing, and rate-limiting to the ingestion-service phase. (Finding 12 is the partial mitigation; the rest is post-MVP.)
5. **AI provider keys are sent over HTTPS to third parties.** Out of scope for app code; mitigated at the contract level by the provider's terms and by redacting provider responses in logs.
6. **`.env.example` is committed with placeholder values.** This is intentional; the rule is `.env` is gitignored, `.env.example` is not.
7. **Service spec files are intentionally thin during MVP.** As feature work lands, the four no-op specs (`buildings`, `assets`, `sensors`, `alerts`) need real coverage (Finding 30). Until then, regressions in service behaviour are caught by manual QA, not CI.

---

## 5. Suggested fix order (one PR per item, in this order)

The first 12 PRs are the original audit recommendations. The next 17 (PR-13 through PR-29) address findings from the second pass.

### First pass (security primitives)

1. **PR-1** — Add `helmet` + `@nestjs/throttler` + security headers in `next.config.ts`. *(Findings 6, 22)*
2. **PR-2** — Add `JwtAuthGuard`, `RolesGuard`, `@Public()` decorator, and `getSession()` on the web. Gate `/dashboard`. *(Finding 4)*
3. **PR-3** — Replace SHA-256 with `argon2`. Fix the `requireSecret` dev fallback. Update `.env.example` to drop the SHA-256 instructions. *(Findings 1, 5)*
4. **PR-4** — CORS hardening: fail closed in prod, empty-string fix, drop the `true` default. *(Finding 3)*
5. **PR-5** — Add `aud`/`iss` claims, refresh token endpoint, refresh cookie, silent refresh on 401. *(Finding 10)*
6. **PR-6** — Replace custom `.env` parser with `dotenv`; remove hardcoded DB fallbacks; add `ssl` config; lazy pool init. *(Findings 7, 8)*
7. **PR-7** — Use `useFormState` in `LoginForm`; set `serverActions.allowedOrigins`; harden `Cookie.secure` to non-dev. *(Findings 11, 18)*
8. **PR-8** — Add DB roles in `init-db.sql`; bind Docker ports to `127.0.0.1`; add Valkey `requirepass`; add TimescaleDB probe. *(Findings 16, 17)*
9. **PR-9** — Strip error messages client-side; log structured on the server. *(Finding 9)*
10. **PR-10** — Add CI security steps (`pnpm audit`, `gitleaks`, Dependabot) and **fix the broken license audit** (Finding 20).
11. **PR-11** — Repo hygiene: `engines.node`, `.env.*` ignore, `CODEOWNERS` paths, `.claude/settings.local.json` ignore, test fixture. *(Findings 21, 32)*
12. **PR-12** — Pin `es5-ext` or remove from `allowBuilds`. *(Finding 19)*

### Second pass (post-growth)

13. **PR-13** — Add `apps/web/src/middleware.ts` with JWT verification; add `apps/web/src/lib/session.ts` with `requireSession()`; gate `/dashboard` and `/twin`. *(Finding 15)*
14. **PR-14** — Rewrite `dashboard/page.tsx` error handling: per-query catch, per-panel error state, never render raw upstream message. *(Finding 14)*
15. **PR-15** — Make `@digital-twin-fm/types` the single source of truth; delete duplicate DTOs in the gateway and api-client. *(Finding 23)*
16. **PR-16** — TimescaleDB migration: composite PK on `sensor_readings`, `create_hypertable` call, secondary index. *(Finding 24)*
17. **PR-17** — Delete `scripts/{check-env.js, dump-env.js, get-pw.js, e2e-test.js, e2e-login-test.js}`. *(Finding 26)*
18. **PR-18** — Real ESLint in `packages/{types,ui,db}/package.json` (no more `echo` no-op). *(Finding 27)*
19. **PR-19** — Turn on `strict: true` in `apps/api-gateway/tsconfig.json`; fix resulting errors. *(Finding 28)*
20. **PR-20** — Convert DTOs to classes with `class-validator` decorators; add `CreateAssetDto`, `CreateSensorDto`, `CreateAlertDto`. *(Finding 29)*
21. **PR-21** — `seed.ts`: production-env guard, generate real argon2 hash from `--password` arg, drop the `REPLACE_WITH_BCRYPT_HASH` placeholder. *(Finding 25)*
22. **PR-22** — Ingestion service: bind to `127.0.0.1`, require `INGEST_API_KEY` header, rate-limit per IP, MQTT credentials, structured logging. *(Finding 12)*
23. **PR-23** — AI service: invert CORS logic; always use a configured allow-list; add auth to `/ai/copilot/query` via internal JWT. *(Finding 13)*
24. **PR-24** — `viewer.tsx`: drop `Environment preset="city"` for MVP, or self-host; add `<Suspense>`; remove the `any` augmentation in `types/r3f.ts`. *(Finding 31)*
25. **PR-25** — Real e2e test in Playwright covering the login + dashboard + protected API call flows. *(Covers B2, B11, B16, B21 from the second pass.)*
26. **PR-26** — Add a `/dashboard/summary` aggregation endpoint; remove the client-side reduce over all sensors. *(Improves B19.)*
27. **PR-27** — Add `apps/api-gateway` `engines.node` and a global `engines.node` in the root `package.json`. *(Finding 21, hardening.)*
28. **PR-28** — Add structured request logging with `request-id` header; redact `Authorization`, `Cookie`, and any field matching `/password|token|secret/i` in request bodies. *(Defense-in-depth.)*
29. **PR-29** — Replace the static `DEMO_ASSETS` in `twin/page.tsx` with a server-side `api.findAssets()` call scoped to the session. *(Closes B2 for the twin page.)*

Each PR should include:
- The exact code change.
- An updated test that covers the failure mode the finding described.
- A CHANGELOG entry per the project's existing format.
- A cross-reference back to this document (`documents/mvp/SECURITY_AUDIT.md`).

---

## 6. Sign-off

This audit (combined first + second pass) found **5 critical**, **10 high**, **12 medium**, and **5 low** issues — 32 findings in total. As of the second pass, **none of the 21 first-pass findings have been fixed**, and 11 new issues have appeared in the recent growth. None are unfixable; all are localized to a single file or module each.

After PRs 1–6 (security primitives) and PR-13 (middleware) the system reaches an acceptable MVP security posture. After PRs 7–12 and 14–29 the posture is appropriate for a public demo with named users.

Re-audit trigger: any change to:
- `apps/api-gateway/src/auth/*`, `apps/api-gateway/src/main.ts`, `apps/api-gateway/src/config/*`, `apps/api-gateway/src/db/*`
- `apps/api-gateway/src/{buildings,assets,sensors,alerts}/*` (any new file)
- `apps/web/src/app/{login,dashboard,twin}/*`, `apps/web/src/lib/session.ts`, `apps/web/next.config.ts`, new `apps/web/src/middleware.ts`
- `apps/ingestion-service/src/index.ts`, `apps/ai-service/app/main.py`, `apps/ai-service/app/routers/copilot.py`
- `packages/db/src/{schema,seed}.ts`, `packages/db/drizzle/*`
- `docker-compose.yml`, `init-db.sql`, `pnpm-workspace.yaml`
- `.github/workflows/ci.yml`, `scripts/check-licenses.mjs`, any new `scripts/*.js` that touches `.env`

The audit will be re-run by Hermes on every push that touches any of the above paths.
