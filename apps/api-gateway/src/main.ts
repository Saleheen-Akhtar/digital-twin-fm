import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Use Socket.IO adapter for WebSocket gateway namespaces
  app.useWebSocketAdapter(new IoAdapter(app));

  // Per Finding 6 (High): add helmet for security headers.
  // The web app (`apps/web/next.config.ts`) ships its own security headers
  // for the Next.js response surface; helmet covers the api-gateway's
  // REST + WebSocket surface.
  //
  // CSP is enabled with a permissive default policy (no inline scripts
  // expected on the api-gateway — it serves JSON, not HTML). The COEP
  // default is disabled because the api-gateway's /ai/copilot/query may
  // return image/PDF citations in the future, which need cross-origin
  // isolation relaxed.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // HSTS — only meaningful when behind HTTPS. In dev (http) this is a
      // no-op but in staging/prod it forces HTTPS for one year.
      strictTransportSecurity: {
        maxAge: 60 * 60 * 24 * 365,
        includeSubDomains: true,
        preload: true,
      },
      // Block MIME sniffing (e.g. serving text/plain with a .js extension).
      noSniff: true,
      // Modern browsers only — blocks legacy XSS Auditor and reflected
      // XSS vectors that no longer apply.
      xXssProtection: false,
    }),
  );

  // Global request validation — every @Body() / @Query() / @Param() is validated
  // against its DTO (class-validator). Reject unknown properties, coerce types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // CORS — strict allowlist (per Finding 3, Critical).
  // - Fails closed in production: CORS_ORIGIN is required.
  // - Defaults to http://localhost:3000 in development only.
  // - Rejects empty string (the old truthy check on `process.env.CORS_ORIGIN`
  //   treated "" as truthy and silently fell back to wildcard).
  const origins = resolveCorsOrigins();
  app.enableCors({
    origin: (origin, cb) => {
      // Same-origin / curl / server-to-server have no Origin header — allow.
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
  });

  const port = Number(process.env.PORT) || 4000;
  await app.listen(port);
  Logger.log(`api-gateway listening on http://localhost:${port}`, 'Bootstrap');
}

/**
 * Resolves the CORS allowlist from the CORS_ORIGIN env var.
 *
 * - If CORS_ORIGIN is unset/empty and NODE_ENV=production → throws (fail
 *   closed: a misconfigured production must not silently accept wildcard
 *   origins).
 * - If CORS_ORIGIN is unset/empty and NODE_ENV!=production → dev-only
 *   default of `http://localhost:3000`.
 * - If CORS_ORIGIN is a non-empty comma-separated list → returns the
 *   parsed, trimmed, non-empty origins.
 * - If CORS_ORIGIN is set but parses to an empty list (e.g. `,,,`) → throws.
 */
function resolveCorsOrigins(): string[] {
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
  const list = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (list.length === 0) {
    throw new Error('CORS_ORIGIN parsed to an empty list.');
  }
  return list;
}

bootstrap();
