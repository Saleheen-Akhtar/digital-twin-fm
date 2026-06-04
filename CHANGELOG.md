# Changelog — Digital Twin FM

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2026-06-04

### Changed
- Finalized PostgreSQL + TimescaleDB as the official database direction.
- Finalized Infisical as the preferred MVP/team secrets manager.
- Removed third-party backend-platform evaluation language from the active strategy docs.
- Renamed MVP secrets documentation to `documents/mvp/SECRETS_MANAGEMENT.md`.
- Renamed full-product database/secrets documentation to `documents/full_product/DATABASE_AND_SECRETS_STRATEGY.md`.

## [0.1.1] - 2026-06-04

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
