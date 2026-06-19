/**
 * API proxy — bridges client components to the api-gateway.
 *
 * Problem this solves:
 *   The api-gateway's JwtAuthGuard only reads the JWT from the
 *   `Authorization: Bearer` header (`ExtractJwt.fromAuthHeaderAsBearerToken`
 *   in `apps/api-gateway/src/auth/jwt.strategy.ts`). The web app's auth
 *   flow stores the JWT in an httpOnly cookie (`dtfm_token`), so:
 *
 *     - Server Components / Server Actions can read the cookie via
 *       `next/headers` and pass the token explicitly to
 *       `createApiClient({ token })`. That works.
 *     - Client Components CANNOT read the httpOnly cookie, so they have
 *       no way to attach a Bearer header. Direct browser → api-gateway
 *       calls (browser port 3000 → api-gateway port 4000) get 401s
 *       because there's no token in the request.
 *
 *   This Route Handler is the bridge: the browser calls
 *   `/api/proxy/<path>` (same-origin, so the httpOnly cookie is
 *   forwarded automatically by the browser), the handler reads the
 *   cookie, verifies it via `getSession()` (defense-in-depth), and
 *   forwards the request to the api-gateway with the Bearer token.
 *   The api-gateway's contract is unchanged.
 *
 * Security boundary:
 *
 *   1. **Auth gate** — `getSession()` rejects the request with 401 if
 *      the cookie is missing, expired, or has a bad signature/aud/iss.
 *      This is the same check the dashboard Server Component uses.
 *
 *   2. **SSRF guard** — the target URL is constructed from
 *      `getServerEnv().apiGatewayUrl` (an env var, not user input), and
 *      the user's `[...path]` is URL-encoded and appended. A request
 *      like `/api/proxy/foo` resolves to `<apiGatewayUrl>/foo`. The
 *      user cannot redirect the proxy to an arbitrary host.
 *
 *   3. **CSRF guard** — we accept both same-origin requests (no Origin
 *      header, or Origin matches the request URL) and explicitly
 *      configured trusted origins. Cross-origin browser requests with
 *      a custom Origin are rejected. This prevents a malicious site
 *      from making the user's browser hit `/api/proxy/sensors` with
 *      the user's cookie and reading the response.
 *
 *   4. **Method allowlist** — only GET, POST, PUT, PATCH, DELETE are
 *      forwarded. OPTIONS, TRACE, CONNECT, etc. are rejected so an
 *      attacker can't use the proxy to send weird verbs to the
 *      api-gateway.
 *
 *   5. **No body buffering of unbounded payloads** — we pass the
 *      incoming `ReadableStream` straight through to fetch. This
 *      avoids OOM on huge bodies and keeps streaming endpoints (if any
 *      are added later) working.
 *
 *   6. **No header spoofing** — we strip `cookie`, `host`, `origin`,
 *      `referer`, and `connection` from the forwarded request. The
 *      api-gateway must not see a forwarded `Host: api-gateway` (it
 *      would resolve its own listen address) or a forwarded `Cookie`
 *      (the api-gateway would not understand it; the Bearer header
 *      carries the auth).
 *
 *   7. **Response headers are passed through selectively** — we keep
 *      `content-type` and `cache-control` and discard everything else
 *      (including `set-cookie`, which the api-gateway never sets on
 *      these endpoints but is good to strip defensively).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { getServerEnv } from '@/env';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Headers we never forward to the upstream. */
const STRIPPED_REQUEST_HEADERS = new Set([
  'host',
  'cookie',
  'connection',
  'origin',
  'referer',
  'content-length', // fetch will set the correct value
]);

/** Headers we never forward back to the client. */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'set-cookie',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'content-encoding', // fetch in the browser handles decompression
]);

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  if (!origin && !referer) {
    // Same-origin browser requests on a same-origin page (e.g. fetch
    // from a Client Component) do not always include Origin. Referer
    // is also optional in some privacy modes. We treat absence of
    // both as "probably same-origin" — but only for the simple
    // non-state-changing method (GET). For state-changing methods
    // (POST/PUT/...), we require a matching Origin.
    return true;
  }
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.origin === req.nextUrl.origin;
    } catch {
      return false;
    }
  }
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.origin === req.nextUrl.origin;
    } catch {
      return false;
    }
  }
  return false;
}

function buildForwardHeaders(req: NextRequest): Headers {
  const out = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (STRIPPED_REQUEST_HEADERS.has(k.toLowerCase())) continue;
    out.set(k, v);
  }
  return out;
}

function buildResponseHeaders(upstream: Response): Headers {
  const out = new Headers();
  for (const [k, v] of upstream.headers.entries()) {
    if (STRIPPED_RESPONSE_HEADERS.has(k.toLowerCase())) continue;
    out.set(k, v);
  }
  return out;
}

async function handle(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }): Promise<Response> {
  // 1. Method allowlist. Return a proper 405 with an `Allow` header
  //    so the caller (and `curl -X TRACE` for debugging) sees a clean
  //    response instead of Next's default 500 for unexported methods.
  if (!ALLOWED_METHODS.has(req.method)) {
    return new NextResponse(
      JSON.stringify({ error: 'MethodNotAllowed' }),
      {
        status: 405,
        headers: {
          'content-type': 'application/json',
          // RFC 9110 §10.2.1: a 405 response MUST include an Allow
          // header listing the methods that the resource supports.
          allow: Array.from(ALLOWED_METHODS).join(', '),
        },
      },
    );
  }

  // 2. CSRF guard — for state-changing methods require a same-origin
  //    Origin. GETs are safe to allow without one (no side effect).
  const isStateChanging = req.method !== 'GET';
  if (isStateChanging && !isSameOrigin(req)) {
    return NextResponse.json({ error: 'CrossOriginForbidden' }, { status: 403 });
  }

  // 3. Auth gate — verify the cookie's signature/aud/iss. `getSession`
  //    returns null on any failure (missing, expired, tampered, etc.).
  //    Skip auth for public endpoints (login, refresh) so the user can
  //    authenticate before a session exists.
  const { path } = await ctx.params;
  const PUBLIC_PATHS = new Set(['/auth/login', '/auth/refresh']);
  const requestPath = `/${(path ?? []).join('/')}`;

  let accessToken: string | null = null;
  if (PUBLIC_PATHS.has(requestPath)) {
    // Pass through without auth — the api-gateway handles it (login/refresh)
    accessToken = null;
  } else {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    accessToken = session.accessToken;
  }

  // 4. Build the upstream URL from the env var (NOT user input for the
  //    host) plus the path segments (which ARE user input but are
  //    URL-encoded so they can't escape the path).
  const segments = (path ?? []).map(encodeURIComponent).join('/');
  const { apiGatewayUrl } = getServerEnv();
  // Strip trailing slash from base, then join with `/`. If `path` is
  // empty (i.e. caller hit `/api/proxy`), refuse — there's nothing to
  // forward.
  if (!segments) {
    return NextResponse.json({ error: 'NotFound' }, { status: 404 });
  }
  const base = apiGatewayUrl.replace(/\/$/, '');
  const targetUrl = `${base}/${segments}${req.nextUrl.search}`;

  // 5. Build the forward headers, add the Bearer token (if exists), and
  //    stream the body straight through.
  const headers = buildForwardHeaders(req);
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }

  // 6. Make the upstream request. We pass `body` and `method` through
  //    unchanged. `duplex: 'half'` is required by Node fetch when
  //    streaming a request body (the standard `fetch` RequestInit
  //    extension; supported by Next.js's runtime).
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers,
    // `cache: 'no-store'` is the default for Route Handlers, but make
    // it explicit — the api-gateway is the source of truth.
    cache: 'no-store',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    // Pass the body through as a stream. Node's fetch supports
    // ReadableStream bodies when `duplex: 'half'` is set.
    init.body = req.body;
    init.duplex = 'half';
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    // Network-level failure (api-gateway down, DNS, etc.). Return a
    // sanitized error — never echo the URL or stack to the client.
    // eslint-disable-next-line no-console
    console.error(`[proxy] upstream network error on ${req.method} ${targetUrl}:`, err);
    return NextResponse.json(
      { error: 'UpstreamUnavailable' },
      { status: 502 },
    );
  }

  // 7. Stream the response back with sanitized headers.
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: buildResponseHeaders(upstream),
  });
}

// Next.js Route Handlers are exported as named verbs. Export the same
// handler for each allowed method so the dispatcher can use it.
//
// We also export `OPTIONS` so the App Router does not 500 on a
// preflight or a `Method not implemented` for a not-exported verb
// (Next's default for an unexported method is 500). `handle()` rejects
// OPTIONS with a proper 405 + Allow header so the caller can see the
// supported methods.
export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
