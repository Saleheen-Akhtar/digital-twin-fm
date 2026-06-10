# Database Schema — Digital Twin FM

## Database choice

Use PostgreSQL 16 with TimescaleDB extension.

- Normal relational data uses regular PostgreSQL tables.
- Sensor readings use a TimescaleDB hypertable partitioned by time.

## Naming rules

- Table names: snake_case plural, for example `work_orders`.
- Primary keys: UUID `id`.
- Timestamps: `created_at`, `updated_at`.
- Status values should be enums or constrained text.

## Core tables

### `users`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| email | text unique | login identifier |
| role | text | `admin`, `facility_manager`, `technician`, `viewer` |
| password_hash | text nullable | can be null for mock/SSO later |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `buildings`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
|| name | text | e.g. Singapore Hall 1 |
| address | text nullable | |
| timezone | text | e.g. `Asia/Singapore` |
| status | text | `ok`, `warn`, `crit`, `offline` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `floors`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| building_id | uuid fk buildings.id | |
| name | text | e.g. Level 1 |
| level_number | integer | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `rooms`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| building_id | uuid fk buildings.id | denormalized for filtering |
| floor_id | uuid fk floors.id | |
| name | text | |
| type | text nullable | hall, plant_room, office, corridor |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `assets`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| building_id | uuid fk buildings.id | |
| floor_id | uuid fk floors.id nullable | |
| room_id | uuid fk rooms.id nullable | |
| name | text | |
| asset_type | text | hvac, pump, chiller, elevator, lighting, meter |
| status | text | `ok`, `warn`, `crit`, `offline`, `maintenance` |
| manufacturer | text nullable | |
| model | text nullable | |
| serial_number | text nullable | |
| installed_at | date nullable | |
| metadata | jsonb | flexible MVP field |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `sensors`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| asset_id | uuid fk assets.id nullable | some sensors may be room-level |
| room_id | uuid fk rooms.id nullable | |
| name | text | |
| sensor_type | text | temperature, humidity, energy, vibration, occupancy |
| unit | text | °C, %, kWh, mm/s |
| status | text | `ok`, `warn`, `crit`, `offline` |
| min_threshold | numeric nullable | |
| max_threshold | numeric nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `sensor_readings`

TimescaleDB hypertable.

| Column | Type | Notes |
|---|---|---|
| time | timestamptz | hypertable time column |
| sensor_id | uuid fk sensors.id | |
| value | numeric | |
| unit | text | captured with reading |
| quality | text | `good`, `estimated`, `bad` |
| metadata | jsonb | optional raw payload/context |

Recommended indexes:

```sql
CREATE INDEX ON sensor_readings (sensor_id, time DESC);
CREATE INDEX ON sensor_readings (time DESC);
```

### `alerts`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| building_id | uuid fk buildings.id | |
| asset_id | uuid fk assets.id nullable | |
| sensor_id | uuid fk sensors.id nullable | |
| severity | text | `info`, `warn`, `crit` |
| status | text | `open`, `acknowledged`, `resolved`, `dismissed` |
| title | text | |
| description | text | |
| triggered_at | timestamptz | |
| acknowledged_at | timestamptz nullable | |
| acknowledged_by | uuid fk users.id nullable | |
| resolved_at | timestamptz nullable | |
| resolved_by | uuid fk users.id nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `work_orders`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| building_id | uuid fk buildings.id | |
| asset_id | uuid fk assets.id nullable | |
| alert_id | uuid fk alerts.id nullable | created from alert if applicable |
| title | text | |
| description | text | |
| priority | text | `low`, `medium`, `high`, `critical` |
| status | text | `open`, `assigned`, `in_progress`, `blocked`, `completed`, `cancelled` |
| assigned_to | uuid fk users.id nullable | technician |
| created_by | uuid fk users.id | |
| due_date | timestamptz nullable | |
| completed_at | timestamptz nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `maintenance_logs`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| work_order_id | uuid fk work_orders.id | |
| user_id | uuid fk users.id | |
| action | text | status_changed, comment_added, attachment_added |
| notes | text nullable | |
| from_status | text nullable | |
| to_status | text nullable | |
| created_at | timestamptz | |

## MVP seed data

Seed at least:
- 1 building.
- 2 floors.
- 6 rooms.
- 10 assets.
- 20 sensors.
- 500 historical sensor readings.
- 5 alerts.
- 5 work orders.
- 4 users, one per role.
