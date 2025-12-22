# Data Layer Restructure Design Document

## Overview

This design document outlines the restructuring of the English Learning System's data layer from scattered packages into a unified, well-organized component. The restructure will consolidate all data-related code under a single `data-layer/` directory while maintaining clear separation of concerns and providing proper documentation.

## Architecture

### Current Structure
```
packages/
├── domain/              # Types and business logic
├── database-service/    # HTTP API service
├── database-client/     # API client library
├── infra-supabase/     # Supabase implementation
└── infra-memory/       # In-memory implementation
```

### Target Structure
```
data-layer/
├── .component-board/
│   ├── todo/
│   ├── in-progress/
│   └── done/
├── README.md           # Component overview and usage
├── API.md             # API documentation
├── domain/            # Pure types and business logic
│   ├── src/
│   └── package.json
├── service/           # HTTP API service
│   ├── src/
│   └── package.json
├── client/            # API client library
│   ├── src/
│   └── package.json
└── implementations/
    ├── supabase/      # Supabase repository implementations
    │   ├── src/
    │   └── package.json
    └── memory/        # In-memory repository implementations
        ├── src/
        └── package.json
```

## Components and Interfaces

### Data Layer Component Structure

1. **Domain Package** (`data-layer/domain/`)
   - Contains pure TypeScript interfaces and types
   - Business logic without infrastructure dependencies
   - Repository interfaces that implementations must satisfy

2. **Service Package** (`data-layer/service/`)
   - HTTP API service providing REST endpoints
   - Uses repository implementations via dependency injection
   - Handles request validation and response formatting

3. **Client Package** (`data-layer/client/`)
   - HTTP client library for consuming the Database Service API
   - Used by web app and telegram bot instead of direct repository access
   - Provides typed methods matching the API endpoints

4. **Implementations Directory** (`data-layer/implementations/`)
   - **Supabase Implementation**: Concrete repository implementations using Supabase/Postgres
   - **Memory Implementation**: In-memory implementations for testing and development

### Component Board Structure

The `.component-board/` directory will contain:
- `todo/` - New tasks and feature requests
- `in-progress/` - Currently active tasks
- `done/` - Completed tasks for reference

Task files will follow the format: `YYYY-MM-DD-task-description.md`

## Data Models

The existing data models will remain unchanged during the restructure:
- Word entities with pronunciations and definitions
- User progress tracking
- SRS (Spaced Repetition System) scheduling data
- Quiz statistics and results

All models are defined in the domain package and used consistently across implementations.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, the following properties ensure the restructure maintains system integrity:

**Property 1: Import path consistency**
*For any* TypeScript file in the system, all import statements should resolve to valid modules after the restructure
**Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

**Property 2: Package dependency resolution**
*For any* package.json file in the workspace, all declared dependencies should be resolvable by the package manager
**Validates: Requirements 6.1, 6.2, 6.3, 6.4**

**Property 3: Component isolation**
*For any* file within the data-layer directory, it should only import from other data-layer packages or external dependencies, never from apps
**Validates: Requirements 1.1, 1.2, 1.3**

**Property 4: API documentation completeness**
*For any* endpoint in the Database Service, there should be corresponding documentation in API.md
**Validates: Requirements 2.1, 2.2, 2.4**

## Error Handling

The restructure process will include comprehensive error handling:

1. **Import Resolution Errors**: Systematic updating of all import paths with verification
2. **Package Manager Errors**: Validation of workspace configuration and dependency declarations
3. **Build Errors**: TypeScript compilation checks after each major move
4. **Runtime Errors**: Testing that applications start and function correctly

## Testing Strategy

### Unit Testing Approach
- Verify that existing unit tests continue to pass after restructure
- Update test import paths to match new package locations
- Ensure test utilities and fixtures are properly relocated

### Property-Based Testing Approach
- **Property 1**: Generate random TypeScript files and verify all imports resolve
- **Property 2**: Test package.json dependency resolution across workspace
- **Property 3**: Verify component isolation by checking import patterns
- **Property 4**: Cross-reference API endpoints with documentation entries

The testing will use the existing Vitest framework configured in the project. Each property-based test will run a minimum of 100 iterations to ensure comprehensive coverage.

Property-based tests will be tagged with comments referencing the design document properties:
- `**Feature: data-layer-restructure, Property 1: Import path consistency**`
- `**Feature: data-layer-restructure, Property 2: Package dependency resolution**`
- `**Feature: data-layer-restructure, Property 3: Component isolation**`
- `**Feature: data-layer-restructure, Property 4: API documentation completeness**`