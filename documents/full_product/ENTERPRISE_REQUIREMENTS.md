# Enterprise Requirements — Digital Twin FM

## Purpose

This document captures requirements that become important when Digital Twin FM moves beyond demo/MVP into real customer pilots and enterprise deployments.

## Customer model

The full product should support multiple deployment/customer models:

1. Single customer, single facility.
2. Single customer, multiple sites/buildings.
3. Multi-customer SaaS, if business model requires it.
4. Customer-managed/on-prem deployment, if required for sensitive facilities.

## Organization hierarchy

Full product data model should support:

```text
organization
  -> site
    -> building
      -> floor
        -> room/zone
          -> asset
            -> sensor
```

Definitions:

| Entity | Meaning |
|---|---|
| organization | Customer or operating company |
| site | Campus/location containing one or more buildings |
| building | Physical building or hall |
| floor | Level within building |
| room/zone | Physical room, zone, hall area, plant room, corridor |
| asset | Maintainable equipment or infrastructure component |
| sensor | Data-producing measurement point |

## User and access requirements

Full product roles should evolve from simple MVP roles to resource-scoped permissions.

Baseline roles:
- `admin`
- `organization_admin`
- `facility_manager`
- `operator`
- `technician`
- `contractor`
- `executive`
- `viewer`

Resource scoping examples:
- User can access only assigned organization.
- User can access only selected sites/buildings.
- Technician can update only assigned work orders.
- Contractor can see only work orders assigned to their company.
- Executive can view KPIs but cannot change operational records.

## Identity requirements

Enterprise customers may require:

- OIDC.
- SAML.
- Microsoft Entra ID / Azure AD.
- Okta.
- Google Workspace.
- SCIM user provisioning.
- MFA through identity provider.
- Session timeout and revocation.

## Audit requirements

The full product must audit critical actions:

- login/logout,
- failed login attempts,
- user/role changes,
- asset creation/update/deletion,
- sensor mapping changes,
- alert acknowledge/resolve/dismiss,
- work order create/assign/status changes,
- AI-generated recommendation accepted/rejected,
- deployment/admin configuration changes.

Audit log fields:

```text
id
organization_id
site_id nullable
actor_user_id nullable
actor_service nullable
action
resource_type
resource_id
before jsonb nullable
after jsonb nullable
ip_address nullable
user_agent nullable
created_at
```

## SLA and reliability expectations

Define customer-facing targets only after operational capability exists. Internally, aim for:

- API uptime target: 99.5%+ for pilot, higher later.
- Sensor ingestion delay: under 5 seconds for normal streams.
- WebSocket update delay: under 2 seconds after processing.
- Alert creation after threshold breach: under 10 seconds for MVP/pilot.
- Recovery time objective: documented per deployment type.
- Recovery point objective: documented per deployment type.

## Data ownership and export

Enterprise customers may require:

- data export in CSV/JSON,
- scheduled reports,
- complete customer data export,
- deletion/anonymization procedures,
- evidence of data isolation,
- retention policy by data type.

## Compliance considerations

Depending on target customers and geography, consider:

- data residency,
- privacy regulations,
- access review logs,
- vulnerability management,
- backup encryption,
- least-privilege access,
- vendor security questionnaires.

## Support and operations

Full product should provide:

- admin dashboard,
- connector status dashboard,
- service health dashboard,
- user management,
- facility setup/import tooling,
- support access procedure,
- incident response playbook,
- backup/restore runbook.

## Enterprise acceptance checklist

- [ ] SSO available or roadmap-approved.
- [ ] Audit logs for critical actions.
- [ ] Backups are tested.
- [ ] Role/resource scoping works.
- [ ] Data export exists.
- [ ] Security documentation exists.
- [ ] Deployment architecture is documented.
- [ ] Operational support procedure exists.
- [ ] Observability dashboards exist.
