# Reporting and Analytics — Digital Twin FM

## Purpose

This document defines the full-product reporting and analytics direction for Digital Twin FM.

MVP dashboards show current status. Full product reporting should help managers understand trends, compliance, maintenance performance, energy usage, and operational risk.

## Reporting audiences

| Audience | Needs |
|---|---|
| Facility manager | incidents, work orders, asset health, SLA performance |
| Executive | KPIs, cost/energy trends, risk score, portfolio overview |
| Technician supervisor | team workload, overdue work, completion rates |
| Energy analyst | consumption trends, anomalies, benchmarking |
| Compliance/audit | historical actions, incident timelines, maintenance evidence |

## Report types

### Operational reports

- active incidents,
- resolved incidents,
- alert frequency,
- equipment downtime,
- repeated fault assets,
- open/overdue work orders,
- technician workload.

### Maintenance reports

- preventive vs corrective maintenance,
- mean time to acknowledge,
- mean time to repair,
- SLA compliance,
- asset maintenance history,
- recurring failures,
- maintenance cost fields later.

### Energy reports

- daily/weekly/monthly energy consumption,
- zone/building comparison,
- after-hours energy use,
- peak demand,
- abnormal consumption periods,
- energy per occupancy if occupancy data exists.

### Executive reports

- building health score,
- incident trend,
- critical asset count,
- work order SLA summary,
- energy trend,
- risk summary across sites.

## Dashboard vs report

Dashboard:
- live/near-real-time,
- interactive,
- operational.

Report:
- historical,
- exportable,
- scheduled,
- shareable,
- evidence-oriented.

## Export formats

Full product should support:
- CSV for raw tabular export,
- PDF for formatted management reports,
- JSON export for integration later.

## Scheduled reports

Potential scheduled reports:
- daily operations summary,
- weekly maintenance report,
- monthly energy report,
- monthly executive report,
- incident postmortem package.

Scheduled delivery options:
- email,
- downloadable from app,
- webhook later.

## Analytics data model

Use TimescaleDB continuous aggregates for sensor analytics.

Potential aggregate views:

```text
sensor_readings_1m
sensor_readings_1h
energy_usage_daily
alert_counts_daily
work_order_sla_daily
asset_health_daily
```

## KPI definitions

Define KPIs precisely before implementation.

Examples:

### Building health score

Possible inputs:
- percentage of assets in `ok`,
- number/severity of active alerts,
- overdue critical work orders,
- offline sensors,
- recent anomaly count.

### MTTA

Mean time to acknowledge:

```text
average(alert.acknowledged_at - alert.triggered_at)
```

### MTTR

Mean time to repair/resolve:

```text
average(work_order.completed_at - work_order.created_at)
```

### SLA compliance

```text
completed work orders before due_date / total completed work orders
```

## Data quality concerns

Analytics must account for:
- missing sensor data,
- offline sensors,
- estimated values,
- changed thresholds,
- changed asset mappings,
- model/version changes.

Reports should show data quality warnings where relevant.

## Permissions

Reports must respect access scope.

Examples:
- Executive may see all sites in organization.
- Facility manager sees assigned sites/buildings.
- Technician sees own work order history.
- Viewer sees read-only reports only.

## Acceptance criteria

- Core KPI definitions are documented.
- Reports are permission-scoped.
- CSV export exists for key tables.
- PDF/report generation strategy is chosen before implementation.
- Scheduled report requirements are defined with stakeholders.
- Analytics accounts for missing/offline sensor data.
