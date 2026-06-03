# Security Expansion — Digital Twin FM

## Purpose

This document extends the MVP `documents/SECURITY.md` for the full commercial product.

MVP security uses JWT + RBAC. Full-product security must support enterprise identity, resource-scoped permissions, device authentication, audit logs, and stronger operational controls.

## Security principles

- Authenticate every user and device.
- Authorize every business action server-side.
- Apply least privilege.
- Scope access by organization/site/building.
- Never expose secrets to logs or AI context.
- Audit critical actions.
- Prefer secure defaults.

## Identity and SSO

Full product should support:

- OIDC.
- SAML.
- Microsoft Entra ID / Azure AD.
- Okta.
- Google Workspace.
- Optional SCIM provisioning.

MVP local password auth can remain for development/demo, but enterprise deployments should use customer identity provider when required.

## Authorization model

Start with RBAC, then add resource scoping.

Example:

```text
role = technician
allowed_sites = [site_a, site_b]
can_update_work_order if work_order.assigned_to = user.id and work_order.site_id in allowed_sites
```

Potential future model:
- RBAC for broad permissions.
- Resource scoping for organization/site/building.
- Attribute checks for ownership/assignment.

## Roles

Possible full-product roles:

| Role | Description |
|---|---|
| platform_admin | Internal/platform operator if SaaS |
| organization_admin | Customer admin |
| facility_manager | Runs facility operations |
| operator | Monitors alerts and dashboard |
| technician | Performs assigned work |
| contractor | External limited technician |
| executive | KPI/report access |
| viewer | Read-only |

## Device and ingestion security

Production ingestion sources must authenticate.

Options:
- per-device API keys,
- connector-level secrets,
- MQTT username/password,
- MQTT client certificates,
- signed HTTP requests,
- private network/VPN,
- source IP allowlisting as an additional control.

Security requirements:
- rotate device credentials,
- disable compromised devices,
- log failed ingestion auth attempts,
- reject unknown device IDs unless in explicit onboarding mode.

## API security

- All business APIs authenticated by default.
- Rate limit login and ingestion endpoints.
- Validate all input.
- Use CORS allowlist in production.
- Use secure headers.
- Use HTTPS everywhere outside local dev.
- Do not trust frontend role checks.

## Secrets management

MVP may use `.env` locally.

Full product should use:
- cloud secret manager,
- Kubernetes secrets with external secret operator,
- encrypted deployment secrets,
- strict access controls.

Secrets include:
- database URLs,
- Redis credentials,
- JWT signing keys,
- SSO client secrets,
- AI provider keys,
- connector credentials,
- SMTP/email provider keys.

## Audit logs

Audit these actions:
- login/logout/failures,
- user/role changes,
- SSO configuration changes,
- asset critical changes,
- sensor mapping changes,
- alert acknowledge/resolve,
- work order status changes,
- connector credentials updated,
- AI recommendation accepted,
- data export requested,
- deployment/admin settings changed.

Audit logs should be append-only from the application perspective.

## AI security

AI must not bypass permissions.

Rules:
- retrieval filters by user organization/site/building access,
- no secrets in prompts,
- no environment/config exposure,
- critical action requires confirmation,
- AI output should be logged carefully without leaking sensitive context.

## Data isolation

If SaaS/multi-tenant:
- every customer-owned row must include organization/customer ID,
- queries must enforce organization scope,
- background jobs must enforce scope,
- tests must verify cross-tenant access is impossible.

## Security testing

Add tests for:
- unauthorized endpoint access,
- role permission failures,
- resource-scope failures,
- technician cannot update unassigned work order,
- viewer cannot mutate data,
- AI cannot answer unauthorized data,
- ingestion rejects invalid credentials.

## Production checklist

- [ ] HTTPS enforced.
- [ ] SSO configured where required.
- [ ] JWT/session expiration configured.
- [ ] Role/resource authorization tests pass.
- [ ] Secrets not committed.
- [ ] Security headers configured.
- [ ] Rate limiting configured.
- [ ] Audit logs enabled.
- [ ] Ingestion authentication enabled.
- [ ] Backups encrypted if required.
