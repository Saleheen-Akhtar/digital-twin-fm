# Digital Twin FM — Licenses & Third-Party Software

> **One file, one source of truth.** This file is the canonical license and
> attribution record for the Digital Twin FM codebase, its product bundle, and
> its documentation site. It replaces a sprawl of `/LICENSES.md`,
> `/about/licenses`, `/docs/THIRD_PARTY.md`, `CONTRIBUTING.md`, and
> `package.json` license fields.

---

## 1. This Project

**Copyright © 2026 Digital Twin FM contributors**
**Licensed under the MIT License.**

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

### Contributions
By submitting a contribution (pull request, patch, code review suggestion) to
this repository, you agree to license your contribution under the MIT License
under the same terms as Section 1.

---

## 2. Third-Party Open Source Software

This product includes software developed by third parties. Full license text
for each dependency is generated at build time to `THIRD_PARTY_LICENSES.txt`
(see `pnpm licenses:report`).

The curated list of direct dependencies follows. All are MIT-licensed unless
otherwise noted.

### 2.1 Apps

| Package | License | Purpose |
|---|---|---|
| `next` | MIT | Web framework |
| `react`, `react-dom` | MIT | UI runtime |
| `typescript` | Apache-2.0 | Type system |
| `tailwindcss` | MIT | CSS framework |
| `@radix-ui/react-slot` | MIT | Headless UI primitive |
| `class-variance-authority` | Apache-2.0 | Variant styles |
| `clsx` | MIT | Class merging |
| `tailwind-merge` | MIT | Tailwind class merging |
| `lucide-react` | ISC | Icons |
| `three` | MIT | 3D engine |
| `@react-three/fiber` | MIT | React renderer for Three.js |
| `@react-three/drei` | MIT | R3F helpers (OrbitControls, useGLTF, Html) |
| `zustand` | MIT | UI state |
| `@tanstack/react-query` | MIT | Server state |
| `zod` | MIT | Schema validation |
| `react-hook-form` | MIT | Forms |
| `recharts` | MIT | Charts |
| `fastify` | MIT | Ingestion HTTP server |
| `@fastify/cors` | MIT | CORS plugin |
| `ioredis` | MIT | Redis client |
| `mqtt` | MIT | MQTT client |
| `pino` | MIT | Logger |
| `pino-pretty` | MIT | Pretty log output (dev) |
| `@nestjs/common`, `core`, `platform-express` | MIT | API framework |
| `@nestjs/config` | MIT | Env config |
| `@nestjs/jwt` | MIT | JWT auth |
| `@nestjs/swagger` | MIT | Live API docs |
| `@nestjs/throttler` | MIT | Rate limit |
| `@nestjs/websockets`, `@nestjs/platform-socket.io` | MIT | WebSocket gateway |
| `class-validator` | MIT | DTO validation |
| `class-transformer` | MIT | DTO mapping |
| `fastapi` | MIT | Python web framework |
| `uvicorn` | BSD | ASGI server |
| `pydantic` | MIT | Python schema validation |
| `pydantic-settings` | MIT | Env settings |
| `httpx` | BSD | Async HTTP client |
| `langchain` | MIT | LLM orchestration |
| `langchain-core` | MIT | LangChain core |
| `litellm` | MIT | Unified LLM provider API |
| `llama-index` | MIT | RAG framework |

### 2.2 Internal packages

| Package | License | Purpose |
|---|---|---|
| `@digital-twin-fm/types` | MIT | Shared TypeScript types |
| `@digital-twin-fm/ui` | MIT | shadcn-style UI components |
| `@digital-twin-fm/db` | MIT | Drizzle schema + client |
| `eslint-config-digital-twin-fm` | MIT | Shared ESLint config |

### 2.3 Databases & infrastructure (run-time, not bundled in our code)

| Component | License | Notes |
|---|---|---|
| PostgreSQL | PostgreSQL | Effectively BSD-style. |
| TimescaleDB | Apache-2.0 (community) | Cloud-only features are proprietary and **not used**. |
| Redis 7.2.x | BSD (last open version) | Recommended. For new deployments, prefer **Valkey** (BSD) which is a true drop-in fork. |
| Valkey | BSD | Recommended drop-in for Redis. |
| Mosquitto | EPL/EDL | MQTT broker (optional, post-MVP). EPL allows commercial use with notice. |
| EMQX | Apache-2.0 | MQTT broker (optional alternative). |
| Caddy | Apache-2.0 | Reverse proxy. |
| Ollama | MIT | Local LLM runtime (optional). |

---

## 3. License Policy (Option C: MIT-only with approved Apache-2.0 exceptions)

### 3.1 The rule
**MIT-only for new direct dependencies.** When adding any package, the
**first** choice must be MIT-licensed. This is the policy the team has
agreed on, and it is enforced by the CI license audit.

### 3.2 The reality
A small number of transitive dependencies in our toolchain are
Apache-2.0 because there is no MIT alternative that works. We document
each one as an **"Approved Exception"** and accept them because:

- **Apache-2.0 is non-copyleft** — it does NOT require us to publish our
  source code (unlike GPL/AGPL/SSPL).
- **Apache-2.0 is free for any use** — commercial, SaaS, internal, no fees.
- **Apache-2.0 includes an explicit patent grant** — any contributor who
  later sues us for patent infringement over their own code loses the
  grant. This is actually **safer** than MIT.
- We are NOT modifying any Apache-2.0 code, so we have no obligation
  beyond keeping the `LICENSE` and `NOTICE` files (already done in
  `node_modules` / this file).
- We do NOT use the upstream project's name, logo, or trademarks to
  endorse our product.

### 3.3 The 3 obligations for Apache-2.0 deps
1. **Keep the `LICENSE` file** in `node_modules` (automatic; node_modules
   is in `.gitignore`).
2. **If we MODIFY the code, state what we changed** (we don't modify any
   Apache-2.0 code, so N/A).
3. **Don't use the upstream project's name/logo** to endorse our product
   (we don't — see Section 6).

### 3.4 What we will NEVER use
A CI guard (`scripts/check-licenses.mjs`) fails the build if any of these
are introduced:

- **AGPL** — forces source publication of our entire product
- **SSPL** — same trap as AGPL, plus "competitive use" restrictions
- **GPL / LGPL** — copyleft, contaminates our product code
- **BSL** (Business Source License) — restricts production use
- **Elastic License v2** — same
- **"Sustainable Use" / "Confluent Community"** — restricts competitors
- **Commons Clause** — adds commercial restrictions
- **RPL, QPL, CPAL** — restrictive, no benefit

### 3.5 Current Approved Apache-2.0 Exceptions (in use today)

These are the transitive Apache-2.0 packages currently in our
`node_modules`. They are approved because no MIT alternative exists
that integrates with our required toolchain.

| Package | Why we use it | MIT alternative? |
|---|---|---|
| `typescript` | TypeScript compiler itself (Microsoft) | **None** — TS is Apache-2.0 only |
| `rxjs` | Reactive Extensions for JS (ReactiveX) | **None** — RxJS is Apache-2.0 only |
| `reflect-metadata` | Required by NestJS decorator system | **None** — required for NestJS |
| `class-variance-authority` | shadcn ecosystem variant utility | **None** widely adopted |
| `eslint-visitor-keys` | ESLint internals | **None** — required for ESLint |
| `drizzle-orm` | ORM (active use) | **Kysely** (MIT) — swap candidate |
| `vitest`, `vite` | Test runner (active use) | **None** widely adopted |
| `@vitest/*` | Test runner internals | **None** — required for Vitest |

### 3.6 Reviewing this list
This section is reviewed:
- Before every new dependency is added (`pnpm licenses:check` in CI)
- When TypeScript or RxJS publish a major version (rare)
- When we add a new service (ingestion, AI) that may pull new transitives

If a future package we want to use is Apache-2.0 AND has a viable MIT
alternative, **we choose the MIT alternative**. Apache-2.0 is accepted
**only** where MIT is genuinely unavailable.

---

## 4. How to update this file

When adding a dependency:

1. `pnpm add <pkg> -w` (or in the relevant package)
2. Confirm the license is on the **approved list** in
   `scripts/check-licenses.sh`
3. Add a row to Section 2 above
4. Open a PR — CI runs the license audit

To regenerate the full transitive list for the product's `/about/licenses`
page:

```bash
pnpm licenses:report
# → public/licenses.csv (auto-generated)
```

---

## 5. Product UI (for end users)

The deployed product exposes a single page at `/about/licenses` that lists all
bundled third-party packages, generated from `licenses.csv` at build time. This
is the only place end users see OSS attribution. There is no requirement to
display attribution on marketing pages or product chrome.

---

## 6. Trademark

"Digital Twin FM" and any associated logos are trademarks of the project
owners. Use of the project's name and logo in forks, marketing, or derivative
products must comply with standard trademark guidelines (no endorsement
implication). The MIT License grants rights to the **code**, not to the
**brand**.
