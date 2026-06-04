# Security — Digital Twin FM

## Security goals

Digital Twin FM manages facility operations data, sensor readings, alerts, assets, and AI-generated operational recommendations. Security must ensure that users can only access and change data appropriate to their role.

## MVP security model

Use JWT authentication with role-based access control.

Roles:
- `admin`
- `facility_manager`
- `technician`
- `viewer`

## Authentication

- Password-based login is acceptable for MVP/demo.
- Passwords must be hashed with bcrypt or argon2.
- JWTs must expire.
- Production should use secure HTTP-only cookies or a carefully reviewed bearer-token flow.
- Public endpoints should be limited to health checks and explicitly documented public routes.

## Authorization

All protected API routes must check user role and resource access.

Minimum rules:
- Viewers are read-only.
- Technicians can view assets, alerts, and assigned operational context in MVP.
- Facility managers can manage assets and alerts.
- Admins can manage users and all resources.
- Full work-order/technician update permissions are post-MVP.

## Permissions matrix

| Action | admin | facility_manager | technician | viewer |
|---|---|---|---|---|
| View dashboard | yes | yes | yes | yes |
| View assets/sensors | yes | yes | yes | yes |
| Create/update assets | yes | yes | no | no |
| View alerts | yes | yes | yes | yes |
| Acknowledge/resolve alerts | yes | yes | limited | no |
| Request AI explanation | yes | yes | yes | yes |
| Manage users | yes | no | no | no |

## API protection rules

- All `/api/*` business endpoints require authentication by default.
- `GET /health` and `GET /api/health` may be public.
- Role checks must happen server-side, never only in the frontend.
- Resource checks must verify that the user can access the building/asset/alert involved.

## Ingestion security

For MVP, sensor ingestion may support simulator mode. Production ingestion must not be public.

Post-MVP ingestion security options:
- Device API keys.
- MQTT username/password or certificates.
- Request signing.
- Allowlisted device IDs.
- Rate limiting.

## AI security boundaries

AI features must respect the same permissions as normal API responses.

Rules:
- The AI service should receive only scoped context the requesting user is allowed to access.
- The AI copilot must not expose secrets, raw environment values, hidden user data, or unauthorized facility data.
- AI-generated suggestions should be advisory; critical actions still require user confirmation.

## Secrets

Never commit:
- `.env`
- database passwords
- JWT secrets
- API keys
- LLM provider keys
- production credentials

Use `.env.example` for variable names only.

Required MVP env vars:

```text
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
OPENAI_API_KEY=
```

`OPENAI_API_KEY` may be empty in local development if AI provider calls are stubbed.

## Input validation

- Validate all REST bodies and query params.
- Validate ingestion payloads before writing sensor readings.
- Reject unknown sensor IDs unless explicitly allowing simulator mode.
- Use DTO validation in the API gateway and Pydantic validation in the AI service.

## Audit trail

For MVP, audit-relevant events should include alert acknowledgement/resolution, critical asset updates, and AI-generated recommendations that lead to operational action.

Later add dedicated audit logs for:
- user login,
- permission changes,
- alert resolution,
- asset critical updates,
- AI-generated recommendations that led to operational action.

## Production hardening later

- SSO/OIDC/SAML.
- Tenant isolation if multi-tenant.
- Rate limiting.
- API request signing for ingestion devices.
- Secret manager.
- Vulnerability scanning.
- Security headers and CSP.
- Backup encryption.
- Network segmentation.
