# API Gateway Scaffolding & Infisical Integration Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Scaffold the `apps/api-gateway` NestJS service with full Infisical secrets integration, JWT auth, Drizzle database connection, and a smoke test endpoint — all wired into the Turborepo monorepo and runnable locally.

**Architecture:** We will create a NestJS 10 application at `apps/api-gateway` using TypeScript, configured to load secrets via Infisical at startup (with a local `.env` fallback for development). It will connect to PostgreSQL/TimescaleDB through the shared `@digital-twin-fm/db` Drizzle package, expose a `/health` endpoint and a `/auth/login` JWT-based auth module, and export scripts via `turbo.json` for `dev`, `build`, `lint`, and `test`. Domain modules (buildings, assets, sensors, alerts) will be registered as empty NestJS modules for now — they will be filled in by future plans.

**Tech Stack:** NestJS 10, TypeScript 5, `@nestjs/jwt`, `@nestjs/config`, `pg`, `@digital-twin-fm/db` (local package), Infisical CLI / SDK, `pnpm`, `turbo`.

---

## Task 1: Initialize `apps/api-gateway` package

**Objective:** Create the base `package.json` and NestJS entrypoint for the API gateway.

**Files:**
- Create: `apps/api-gateway/package.json`
- Create: `apps/api-gateway/tsconfig.json`
- Create: `apps/api-gateway/nest-cli.json`

**Step 1: Write failing test (file-existence check)**
Run: `ls apps/api-gateway/package.json`
Expected: FAIL — No such file or directory

**Step 2: Write minimal implementation**
```bash
mkdir -p apps/api-gateway/src
```

Write `apps/api-gateway/package.json`:
```json
{
  "name": "@digital-twin-fm/api-gateway",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "nest start --watch",
    "build": "nest build",
    "start": "node dist/main.js",
    "lint": "eslint \"src/**/*.ts\"",
    "test": "jest --passWithNoTests"
  },
  "dependencies": {
    "@digital-twin-fm/db": "workspace:*",
    "@nestjs/common": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/core": "^10.3.0",
    "@nestjs/jwt": "^10.2.0",
    "@nestjs/platform-express": "^10.3.0",
    "drizzle-orm": "^0.30.0",
    "pg": "^8.11.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.3.0",
    "@nestjs/testing": "^10.3.0",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.0",
    "@types/pg": "^8.10.9",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.1",
    "ts-loader": "^9.5.1",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.3.3"
  }
}
```

Write `apps/api-gateway/tsconfig.json`:
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
    "strictNullChecks": true,
    "noImplicitAny": false,
    "strictBindCallApply": false,
    "forceConsistentCasingInFileNames": false,
    "noFallthroughCasesInSwitch": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@app/*": ["src/*"]
    }
  }
}
```

Write `apps/api-gateway/nest-cli.json`:
```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

**Step 3: Run test to verify pass**
Run: `ls apps/api-gateway/package.json apps/api-gateway/tsconfig.json apps/api-gateway/nest-cli.json`
Expected: PASS — all files exist

**Step 4: Commit**
```bash
git add apps/api-gateway/package.json apps/api-gateway/tsconfig.json apps/api-gateway/nest-cli.json
git commit -m "feat(api-gateway): initialize nestjs package with tsconfig"
```

---

## Task 2: Add Infisical integration module

**Objective:** Create a NestJS ConfigModule that loads secrets from Infisical in non-development environments and from `.env` in development, with the API gateway's required secret keys.

**Files:**
- Create: `apps/api-gateway/src/config/config.module.ts`
- Create: `apps/api-gateway/src/config/infisical.loader.ts`

**Step 1: Write failing test**

Create `apps/api-gateway/src/config/config.module.spec.ts`:
```typescript
import { ConfigModule } from './config.module';

describe('ConfigModule', () => {
  it('is defined', () => {
    expect(ConfigModule).toBeDefined();
  });
});
```

**Step 2: Run test to verify failure**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- config.module.spec`
Expected: FAIL — Cannot find module './config.module'

**Step 3: Write minimal implementation**

Write `apps/api-gateway/src/config/infisical.loader.ts`:
```typescript
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Loads secrets from .env file locally, or from Infisical in higher environments.
 * In production / staging, the Infisical CLI is expected to have already
 * injected secrets into the process environment (e.g. via a sidecar / init container).
 * This loader provides a local-dev fallback.
 */
export function loadInfisicalOrEnvSync(): Record<string, string> {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'development' || env === 'test') {
    const envPath = resolve(process.cwd(), '.env');
    if (!existsSync(envPath)) {
      // In development, missing .env is acceptable; return empty and rely on process env.
      return {};
    }
    const content = readFileSync(envPath, 'utf-8');
    const parsed: Record<string, string> = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      parsed[key] = value;
    }
    return parsed;
  }

  // In staging/prod, Infisical CLI is expected to have populated process.env.
  // Returning empty here causes @nestjs/config to fall through to process.env.
  return {};
}
```

Write `apps/api-gateway/src/config/config.module.ts`:
```typescript
import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { loadInfisicalOrEnvSync } from './infisical.loader';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const fileSecrets = loadInfisicalOrEnvSync();
          return {
            ...fileSecrets,
            // In non-dev, Infisical has already injected these into process.env.
            database: {
              host: process.env.POSTGRES_HOST || 'localhost',
              port: Number(process.env.POSTGRES_PORT) || 5432,
              user: process.env.POSTGRES_USER || 'dtfm_user',
              password: process.env.POSTGRES_PASSWORD || 'dtfm_pass',
              database: process.env.POSTGRES_DB || 'dtfm_db',
            },
            redis: {
              host: process.env.REDIS_HOST || 'localhost',
              port: Number(process.env.REDIS_PORT) || 6379,
              password: process.env.REDIS_PASSWORD || undefined,
            },
            jwt: {
              accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
              refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
              accessTtl: process.env.JWT_ACCESS_TTL || '15m',
              refreshTtl: process.env.JWT_REFRESH_TTL || '7d',
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

**Step 4: Run test to verify pass**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- config.module.spec`
Expected: PASS — 1 test passed

**Step 5: Commit**
```bash
git add apps/api-gateway/src/config
git commit -m "feat(api-gateway): add infisical-aware config module with dev fallback"
```

---

## Task 3: Add main.ts, AppModule, and health endpoint

**Objective:** Bootstrap a NestJS app with the ConfigModule registered, plus a `GET /health` endpoint that returns `{ status: 'ok' }`.

**Files:**
- Create: `apps/api-gateway/src/main.ts`
- Create: `apps/api-gateway/src/app.module.ts`
- Create: `apps/api-gateway/src/health/health.controller.ts`
- Create: `apps/api-gateway/src/health/health.controller.spec.ts`

**Step 1: Write failing test**

Write `apps/api-gateway/src/health/health.controller.spec.ts`:
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('returns ok status', () => {
    expect(controller.check()).toEqual({ status: 'ok' });
  });
});
```

**Step 2: Run test to verify failure**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- health.controller.spec`
Expected: FAIL — Cannot find module './health.controller'

**Step 3: Write minimal implementation**

Write `apps/api-gateway/src/health/health.controller.ts`:
```typescript
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok' };
  }
}
```

Write `apps/api-gateway/src/app.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule],
  controllers: [HealthController],
})
export class AppModule {}
```

Write `apps/api-gateway/src/main.ts`:
```typescript
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on http://localhost:${port}`);
}

bootstrap();
```

**Step 4: Run test to verify pass**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- health.controller.spec`
Expected: PASS — 1 test passed

**Step 5: Commit**
```bash
git add apps/api-gateway/src
git commit -m "feat(api-gateway): bootstrap nestjs app with health endpoint"
```

---

## Task 4: Add JWT auth module with /auth/login

**Objective:** Implement a minimal but production-shaped JWT auth module: a `JwtModule` registered globally with the configured secret, and a `POST /auth/login` endpoint that accepts a hardcoded MVP admin user and returns a signed JWT.

**Files:**
- Create: `apps/api-gateway/src/auth/auth.module.ts`
- Create: `apps/api-gateway/src/auth/auth.service.ts`
- Create: `apps/api-gateway/src/auth/auth.controller.ts`
- Create: `apps/api-gateway/src/auth/auth.service.spec.ts`

**Step 1: Write failing test**

Write `apps/api-gateway/src/auth/auth.service.spec.ts`:
```typescript
import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '../config/config.module';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule,
        JwtModule.register({
          secret: 'test-secret',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [AuthService],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('returns a token for valid credentials', async () => {
    const token = await service.login('admin@dtfm.local', 'admin123');
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);
  });

  it('throws for invalid credentials', async () => {
    await expect(
      service.login('admin@dtfm.local', 'wrong-password'),
    ).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify failure**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- auth.service.spec`
Expected: FAIL — Cannot find module './auth.service'

**Step 3: Write minimal implementation**

Write `apps/api-gateway/src/auth/auth.service.ts`:
```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// MVP-only hardcoded admin. Will be replaced with a Users table in Phase 2.
const MVP_USERS = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'admin@dtfm.local',
    password: 'admin123', // MVP-only; replaced with bcrypt + DB lookup later
    role: 'admin',
  },
];

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async login(email: string, password: string): Promise<string> {
    const user = MVP_USERS.find((u) => u.email === email && u.password === password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.jwt.signAsync({ sub: user.id, email: user.email, role: user.role });
  }
}
```

Write `apps/api-gateway/src/auth/auth.controller.ts`:
```typescript
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const accessToken = await this.auth.login(body.email, body.password);
    return { accessToken };
  }
}
```

Write `apps/api-gateway/src/auth/auth.module.ts`:
```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
        signOptions: { expiresIn: config.get<string>('jwt.accessTtl') || '15m' },
      }),
    }),
  ],
  providers: [AuthService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

**Step 4: Register AuthModule in AppModule**

Patch `apps/api-gateway/src/app.module.ts` (add the AuthModule import):
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [HealthController],
})
export class AppModule {}
```

**Step 5: Run test to verify pass**
Run: `pnpm --filter @digital-twin-fm/api-gateway test -- auth.service.spec`
Expected: PASS — 2 tests passed

**Step 6: Commit**
```bash
git add apps/api-gateway/src
git commit -m "feat(api-gateway): add jwt auth module with /auth/login"
```

---

## Task 5: Add smoke test script via turbo

**Objective:** Make the `api-gateway` runnable through `turbo run dev` from the repo root by ensuring `turbo.json` knows about its scripts and the package is installable through the workspace.

**Files:**
- Modify: `package.json` (root) — ensure turbo runs the new app
- Verify: `pnpm-workspace.yaml` already lists `apps/*` (no change needed)

**Step 1: Write failing test**

Run from repo root: `pnpm --filter @digital-twin-fm/api-gateway build`
Expected: FAIL — pnpm cannot resolve workspace package or build script missing

**Step 2: Write minimal implementation**

From the repo root, install workspace dependencies:
```bash
pnpm install
```

Verify `pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```
(no change required — already correct)

**Step 3: Run test to verify pass**
Run: `pnpm --filter @digital-twin-fm/api-gateway build`
Expected: PASS — TypeScript compiles to `apps/api-gateway/dist`

**Step 4: Commit (if any new files were generated)**
```bash
git status
# If pnpm-lock.yaml changed, commit it
git add pnpm-lock.yaml
git commit -m "chore: update lockfile for api-gateway workspace package"
```

---

## Task 6: Update documentation to reflect api-gateway + Infisical

**Objective:** Document the new app in the architecture docs and the secrets strategy.

**Files:**
- Modify: `documents/mvp/ARCHITECTURE.md` — note that api-gateway is now scaffolded
- Modify: `documents/full_product/DATABASE_AND_SECRETS_STRATEGY.md` — note Infisical wiring pattern used by api-gateway

**Step 1: Write failing test**
Run: `grep -n "Infisical" documents/full_product/DATABASE_AND_SECRETS_STRATEGY.md`
Expected: PASS (file already mentions Infisical, but we will add the loader pattern reference)

**Step 2: Write minimal implementation**
Add a short section near the bottom of `DATABASE_AND_SECRETS_STRATEGY.md` titled `### Infisical integration pattern in NestJS` summarizing:
- `loadInfisicalOrEnvSync` loader
- Fallback to process.env in non-dev environments
- All services use the same ConfigModule shape

**Step 3: Commit**
```bash
git add documents/
git commit -m "docs: document api-gateway scaffolding and infisical loader pattern"
```

---

## Summary

After completing these tasks, you will have:

- **`apps/api-gateway`** — a real, runnable NestJS 10 service in the monorepo
- **Infisical-aware ConfigModule** — reads `.env` in dev, expects Infisical-injected env in higher envs
- **`/health`** — smoke endpoint
- **`/auth/login`** — JWT login that proves the secret wiring works end-to-end
- **Jest unit tests** — 3 passing tests covering ConfigModule, HealthController, and AuthService
- **Documentation updated** — the architecture and secrets docs reference the new wiring

**The next plan** (separate doc) would scaffold `apps/web` to talk to this gateway, then `apps/ingestion-service` to push simulated sensor data through it.

---

**Shall I proceed to execute this plan using subagent-driven-development?**
