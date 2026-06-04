# Changelog — Digital Twin FM

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] - 2026-06-04

### Added
- Added `documents/mvp/EXPO_EXECUTION_PLAN.md` for the Singapore Expo execution strategy.

### Changed
- Revised MVP roadmap to prioritize Dashboard → Digital Twin Viewer → Realtime Sensors → Alerts → AI Copilot.
- Deferred full CMMS/work-order workflows to post-MVP.
- Updated MVP scope to focus on Digital Twin + live monitoring + AI insight + asset registry.
- Updated maintenance documentation to keep asset registry in MVP and move work orders/technician workflow later.
- Updated API contracts to mark work-order endpoints as deferred and add asset-health/AI explanation endpoints.
- Updated full-product roadmap to put AI intelligence before full maintenance/CMMS.

## [0.1.3] - 2026-06-04

### Added
- Created `documents/mvp/EXPO_EXECUTION_PLAN.md` to define the demo-first strategy for the Singapore Expo.

### Changed
- Revised `MVP_SCOPE.md` to deprioritize maintenance modules and focus on Digital Twin and AI as hero features for the MVP.
- Revised `ROADMAP.md` to execute in order: Foundation -> Dashboard/Twin -> Realtime -> AI -> Maintenance.
- Updated `AI_SERVICE_SPEC.md` to highlight AI Copilot as the core product differentiator.
- Updated `documents/README.md` to include the Expo execution plan.

## [0.1.2] - 2026-06-04

### Added
- Added MVP secrets-management documentation in `documents/mvp/SECRETS_MANAGEMENT.md`.
- Added full-product database and secrets-management strategy in `documents/full_product/DATABASE_AND_SECRETS_STRATEGY.md`.
- Recommended Infisical for MVP/team secrets management and OpenBao/Vault-style evaluation for enterprise deployments.

### Updated
- Updated documentation indexes to include the database and secrets strategy documents.

## [0.1.0] - 2026-06-04

### Added
- Created foundational documentation structure in `documents/`.
- Defined architecture, database schema, and API contracts for MVP.
- Established full-product documentation in `documents/full_product/`.
- Added detailed specifications for post-MVP integration, security, AI, and operations.
- Initialized `ROADMAP.md` covering phases from Expo MVP to full enterprise scale.
- Added `CHANGELOG.md` to track project history.
- Initialized agent automation configuration files.
