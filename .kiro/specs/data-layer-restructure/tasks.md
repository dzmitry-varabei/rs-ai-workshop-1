# Implementation Plan

- [x] 1. Create new data-layer directory structure
  - Create `data-layer/` directory with subdirectories
  - Create component board structure with todo/in-progress/done folders
  - Create placeholder README.md and API.md files
  - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [ ] 2. Move domain package
  - [x] 2.1 Copy `packages/domain/` to `data-layer/domain/`
    - Copy all source files and package.json
    - Preserve git history where possible
    - _Requirements: 1.1, 1.3_
  
  - [x] 2.2 Update domain package.json
    - Update package name to `@english-learning/data-layer-domain`
    - Update any internal references
    - _Requirements: 6.1, 6.2_

- [ ] 3. Move database service package
  - [x] 3.1 Copy `packages/database-service/` to `data-layer/service/`
    - Copy all source files and configuration
    - Update package.json with new name
    - _Requirements: 1.1, 1.2_
  
  - [x] 3.2 Update service import paths
    - Update imports from domain package to use new path
    - Update imports from infrastructure packages
    - _Requirements: 5.3, 5.4_

- [ ] 4. Move database client package
  - [x] 4.1 Copy `packages/database-client/` to `data-layer/client/`
    - Copy all source files and package.json
    - Update package name in package.json
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.2 Update client import paths
    - Update any imports from domain package
    - Verify client interface consistency
    - _Requirements: 5.3, 5.4_

- [ ] 5. Move implementation packages
  - [x] 5.1 Copy `packages/infra-supabase/` to `data-layer/implementations/supabase/`
    - Copy all repository implementations
    - Update package.json with new name
    - _Requirements: 3.1, 3.2_
  
  - [x] 5.2 Copy `packages/infra-memory/` to `data-layer/implementations/memory/`
    - Copy all in-memory implementations
    - Update package.json with new name
    - _Requirements: 3.1, 3.3_
  
  - [x] 5.3 Update implementation import paths
    - Update imports from domain package in both implementations
    - Verify repository interface compliance
    - _Requirements: 5.3, 5.4_

- [ ] 6. Update workspace configuration
  - [x] 6.1 Update pnpm-workspace.yaml
    - Remove old package paths from packages array
    - Add new data-layer package paths
    - _Requirements: 6.1, 6.3_
  
  - [x] 6.2 Update root package.json scripts
    - Update any scripts that reference moved packages
    - Verify dev commands still work
    - _Requirements: 6.1, 6.4_

- [ ] 7. Update application imports
  - [x] 7.1 Update web app imports
    - Update imports from database-client to new path
    - Update any direct imports from other data layer packages
    - _Requirements: 5.1, 5.4_
  
  - [x] 7.2 Update telegram bot imports
    - Update imports from database-client to new path
    - Update any direct imports from other data layer packages
    - _Requirements: 5.2, 5.4_

- [ ] 8. Create documentation
  - [x] 8.1 Write data-layer README.md
    - Document component architecture and purpose
    - Explain how to use the client library
    - Include development setup instructions
    - _Requirements: 2.3_
  
  - [x] 8.2 Write API.md documentation
    - Document all Database Service endpoints
    - Include request/response examples
    - Document authentication requirements
    - _Requirements: 2.1, 2.2_

- [ ] 9. Verification and cleanup
  - [x] 9.1 Run TypeScript compilation
    - Verify no import resolution errors
    - Fix any remaining path issues
    - _Requirements: 5.4_
  
  - [x] 9.2 Run package manager install
    - Verify workspace dependencies resolve correctly
    - Test that pnpm commands work
    - _Requirements: 6.3, 6.4_
  
  - [x] 9.3 Test application startup
    - Start web app and verify it loads
    - Start telegram bot and verify it connects
    - Start database service and verify endpoints
    - _Requirements: 5.5_

- [ ] 10. Remove old packages
  - [x] 10.1 Remove old package directories
    - Delete `packages/domain/`
    - Delete `packages/database-service/`
    - Delete `packages/database-client/`
    - Delete `packages/infra-supabase/`
    - Delete `packages/infra-memory/`
    - _Requirements: 1.4_

- [x] 11. Final verification
  - Ensure all tests pass, ask the user if questions arise