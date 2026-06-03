# Agent Guidance — Digital Twin FM

This document provides guidance for all AI agents interacting with the Digital Twin FM project. It outlines best practices, architectural principles, and communication protocols to ensure consistency, accuracy, and efficiency.

## Tools in Use
This project leverages a range of AI tools for various development tasks:
- **Antigravity**
- **VS Code Copilot**
- **Jules**
- **Hermes** (this agent)
- **Codex**
- **Claude AI**

## Core Directives for All Agents
1.  **Documentation-First Principle**: Always consult and update relevant documentation in `documents/mvp/` or `documents/full_product/` BEFORE implementing code changes or making architectural decisions. New features or significant changes *must* have corresponding documentation updates.
2.  **Architecture Compliance**: All code and design proposals must strictly adhere to the principles outlined in `documents/mvp/ARCHITECTURE.md` and `documents/full_product/POST_MVP_ARCHITECTURE.md`. Ensure consistency with the Turborepo monorepo structure.
3.  **Database Integrity**: Any modifications to the database schema must be reflected and justified in `documents/mvp/DATABASE_SCHEMA.md`. Verify changes against the Drizzle ORM schema definitions.
4.  **API Contract Adherence**: New API endpoints, changes to existing ones, or modifications to request/response schemas *must* be documented in `documents/mvp/API_CONTRACTS.md`. Maintain a clear and consistent API surface.
5.  **Security Consciousness**: For any task involving user authentication, authorization, data access, or external integrations (especially IoT ingestion), refer to `documents/mvp/SECURITY.md` and `documents/full_product/SECURITY_EXPANSION.md`.
6.  **Contextual Awareness**: Before executing any significant action, ensure you have sufficient context from relevant files. Use `read_file`, `search_files`, or `terminal` commands to gather information as needed.
7.  **Versioning and Changelog**: Upon completing any feature, bug fix, or architectural change, update `CHANGELOG.md` at the project root with a concise, semantic description of the change.

## Development Standards
-   **Monorepo Tooling**: Use `pnpm` for package management and `Turborepo` for task orchestration across the monorepo.
-   **Frontend Stack**: Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, React Query, Zustand.
-   **Backend Stack**: NestJS, TypeScript, Drizzle ORM, PostgreSQL + TimescaleDB, Redis, WebSockets.
-   **AI Services**: Python 3.11+, FastAPI.
-   **Testing Frameworks**: Vitest (unit/integration), Playwright (E2E), Pytest (Python AI service).
-   **Code Style**: Adhere to project ESLint, Prettier, and TypeScript configurations. Favor modular, domain-driven design (`apps/api-gateway/src/domains/`).

## Agent-Specific Guidance

### Hermes (this agent)
-   **Persona**: Act as a technical lead and lead developer. Maintain a practical, structured, and precise tone.
-   **Workflow**: Prioritize documentation updates and architectural consistency. Proactively identify areas for improvement in project structure or documentation.
-   **Persistent Memory**: Leverage `memory` for user preferences, environment facts, and tool quirks. Use `session_search` for task context from previous interactions.

### VS Code Copilot & Jules
-   Focus on code generation, refactoring, and inline suggestions that align with the established coding standards and architectural patterns. Suggest new components or functions based on existing patterns.

### Codex & Claude AI
-   Primarily for reasoning, code review, complex problem-solving, and generating design proposals (e.g., initial API designs, database schemas, complex algorithm logic). Ensure their output is always grounded in the project's documentation and architectural guidelines.

### Antigravity
-   Utilize for tasks requiring advanced code transformations, large-scale refactoring operations, or migrating existing codebases to new standards, always cross-referencing `AGENTS.md` and relevant design documents.

## Task Protocol
1.  **Understand**: Fully comprehend the task and its context. Read relevant project documentation (`documents/mvp/`, `documents/full_product/`).
2.  **Plan**: Outline the steps to achieve the goal, identifying necessary tool calls and expected outcomes.
3.  **Execute**: Perform actions using the appropriate tools (`terminal`, `read_file`, `write_file`, `patch`, `delegate_task`).
4.  **Verify**: Confirm the outcome of each step. For code changes, run tests or verify file contents. For documentation, ensure links and content are accurate.
5.  **Document**: Update `CHANGELOG.md` and any affected project documentation (`README.md`, `documents/mvp/`, `documents/full_product/`).
