# Rekt Sense Charts Development Guide

## Build & Run Commands

```bash
bun install             # Install dependencies
bun run dev             # Run development server with watch mode
bun run build           # Build project for production
bun run start           # Start production server
bun test                # Run all tests
bun test server/services/price-data/__tests__/price-history-model.test.ts  # Run specific test
```

## Important files

- `doc/CHART_API_REFERENCE.md`

## Coding rules

- Use the logger facility to all debug, info and error messages. The logger is in `client/util/logger.ts`.

## Code Style Guidelines

- **Naming**: Classes/Interfaces (PascalCase), Variables/Methods (camelCase), Constants (UPPER_SNAKE_CASE), Components (kebab-case)
- **Files**: Use kebab-case for filenames (e.g., `price-history-model.ts`)
- **Imports**: Group third-party libraries first, followed by app imports, then utilities
- **Types**: Use strict TypeScript typing, prefer interfaces for data structures
- **Components**: Use Lit framework with decorators (@property, @state) for web components
- **Error Handling**: Use try/catch for async operations; provide fallbacks for undefined values
- **State Management**: Use private properties with underscore prefix (e.g., `_state`)
- **CSS**: Use Lit's css template literals for component styling
- **Testing**: Tests in `__tests__` directories, describe-test pattern with clear assertions
