# Requirements Document

## Introduction

This document describes the requirements for restructuring the data layer components of the English Learning System into a unified, well-organized component structure. Currently, data layer code is scattered across multiple packages, making it difficult to understand boundaries, manage changes, and maintain isolation between components.

## Glossary

- **Data Layer**: The component responsible for all data access, storage, and persistence operations in the system
- **Database Service**: HTTP API service that provides controlled database access
- **Repository**: Interface defining data access operations for a specific entity
- **Implementation**: Concrete realization of repository interfaces (Supabase or in-memory)
- **Domain**: Pure TypeScript types and business logic without infrastructure dependencies
- **Component Board**: Task management system using markdown files organized in todo/in-progress/done folders

## Requirements

### Requirement 1

**User Story:** As a developer, I want all data layer code consolidated in one location, so that I can easily understand the component boundaries and navigate the codebase.

#### Acceptance Criteria

1. WHEN a developer looks at the project structure THEN the system SHALL have a single `data-layer/` directory containing all data-related packages
2. WHEN examining the data layer THEN the system SHALL organize code into clear subdirectories: domain, service, client, and implementations
3. WHEN a developer needs to find data layer code THEN the system SHALL provide all related code within the `data-layer/` directory tree
4. WHEN viewing the repository root THEN the system SHALL NOT have data layer packages scattered in the `packages/` directory

### Requirement 2

**User Story:** As a developer, I want clear API documentation for the data layer, so that I can understand what operations are available without reading implementation code.

#### Acceptance Criteria

1. WHEN a developer opens the data layer directory THEN the system SHALL provide an `API.md` file documenting all available operations
2. WHEN reading API documentation THEN the system SHALL describe each endpoint with request/response formats
3. WHEN a developer needs to integrate with the data layer THEN the system SHALL provide a `README.md` explaining the architecture and how to use the client
4. WHEN API changes occur THEN the system SHALL require documentation updates in `API.md`

### Requirement 3

**User Story:** As a developer, I want implementations (Supabase and in-memory) clearly separated, so that I can understand which code is infrastructure-specific.

#### Acceptance Criteria

1. WHEN examining implementations THEN the system SHALL organize them under `data-layer/implementations/` directory
2. WHEN a developer looks for the Supabase implementation THEN the system SHALL provide it at `data-layer/implementations/supabase/`
3. WHEN a developer looks for the in-memory implementation THEN the system SHALL provide it at `data-layer/implementations/memory/`
4. WHEN adding a new implementation THEN the system SHALL place it under `data-layer/implementations/`

### Requirement 4

**User Story:** As a developer, I want a component board for the data layer, so that I can track tasks and changes specific to this component.

#### Acceptance Criteria

1. WHEN the data layer directory is created THEN the system SHALL include a `.component-board/` subdirectory
2. WHEN organizing tasks THEN the system SHALL provide `todo/`, `in-progress/`, and `done/` subdirectories within the component board
3. WHEN a developer needs to create a task for the data layer THEN the system SHALL store it as a markdown file in the appropriate board subdirectory
4. WHEN tasks are completed THEN the system SHALL move task files from `todo/` to `in-progress/` to `done/`

### Requirement 5

**User Story:** As a developer, I want all import paths updated after restructuring, so that the application continues to work without errors.

#### Acceptance Criteria

1. WHEN packages are moved THEN the system SHALL update all import statements in web app code
2. WHEN packages are moved THEN the system SHALL update all import statements in telegram bot code
3. WHEN packages are moved THEN the system SHALL update all internal imports within data layer packages
4. WHEN running TypeScript compilation THEN the system SHALL produce no errors related to missing modules
5. WHEN running the application THEN the system SHALL resolve all module paths correctly

### Requirement 6

**User Story:** As a developer, I want package.json files updated with correct paths, so that the monorepo workspace configuration remains valid.

#### Acceptance Criteria

1. WHEN packages are moved THEN the system SHALL update the root `pnpm-workspace.yaml` with new package paths
2. WHEN packages reference each other THEN the system SHALL update dependency declarations in package.json files
3. WHEN running `pnpm install` THEN the system SHALL successfully resolve all workspace dependencies
4. WHEN building packages THEN the system SHALL correctly resolve inter-package dependencies

### Requirement 7

**User Story:** As a developer, I want database migrations to remain accessible, so that schema changes are properly tracked and applied.

#### Acceptance Criteria

1. WHEN the data layer is restructured THEN the system SHALL keep migration files in their current location at `supabase/migrations/`
2. WHEN documentation references migrations THEN the system SHALL update paths to point to the correct location
3. WHEN running migrations THEN the system SHALL apply them from the correct directory
4. WHEN the Supabase CLI runs THEN the system SHALL find migration files without configuration changes
