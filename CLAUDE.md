# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rekt Sense Charts (rs-charts) is a financial charting library built with Lit web components. It provides real-time cryptocurrency candlestick charts with technical indicators, live price updates via Firebase, and a comprehensive Chart API for external control. The library is distributed via npm as `@anssipiirainen/sc-charts`.

## Build & Run Commands

```bash
bun install                  # Install dependencies
bun run dev                  # Development server with watch mode (client + server + app)
bun run build                # Build library + application for production
bun run build:lib            # Build library for distribution only
bun run build:lib:bundled    # Build library + bundled version
bun run start                # Start production server
bun test                     # Run all tests
bun test <test-file-path>    # Run specific test file
```

### Common Development Tasks

```bash
# Test specific modules
bun test client/api/__tests__/chart-api-simple.test.ts
bun test server/services/price-data/__tests__/price-history-model.test.ts

# Build and update linked projects
bun run update:linked        # Build bundled version for local development
```

## Architecture Overview

### Client-Server Split

**Client (`client/`)**: Lit web components for chart rendering
- Entry: `client/index.ts` (demo app), `client/lib.ts` (library exports)
- Core: `client/app.ts` - Main application controller
- Init: `client/init.ts` - Firebase initialization and Chart API setup
- Components: Chart canvas, indicators, interactions, overlays
- State: XinJS reactive proxy-based state management

**Server (`server/`)**: Bun HTTP server with price data API
- Entry: `server/index.ts` - HTTP server with CORS and static file serving
- Price Service: `server/services/price-data/coinbase.ts` - Coinbase API integration
- API: `/api/candles` endpoint for historical price data

### Key Components

**App Controller (`client/app.ts`)**
- Manages chart lifecycle and data fetching
- Handles live candle subscriptions via Firebase Firestore
- Coordinates time range updates and viewport panning
- Uses unique `chartId` for state isolation when multiple charts exist

**Chart Container (`client/components/chart/chart-container.ts`)**
- Top-level web component (`<chart-container>`)
- Manages canvas layers, interactions, and child components
- Coordinates drawing strategies and viewport calculations

**State Management (`client/init.ts`, `client/state/chart-state-manager.ts`)**
- Uses XinJS reactive proxies for state updates
- State namespaced by unique `chartId` to support multiple chart instances
- State includes: symbol, granularity, timeRange, priceRange, priceHistory, indicators, trendLines
- **Important**: State values are ES proxies - always convert to strings before comparisons

**Price History Model (`server/services/price-data/price-history-model.ts`)**
- Core data types: `Candle`, `PriceHistory`, `Granularity`
- `SimplePriceHistory` class with binary search for efficient lookups
- Supports gap detection and live candle updates

**Chart API (`client/api/chart-api.ts`)**
- External control interface for frameworks (React, Vue, Angular)
- Methods: symbol/granularity control, indicators, fullscreen, position overlays, trend lines
- Event system: `symbolChange`, `granularityChange`, `indicatorChange`, `fullscreenChange`

## State Management Important Notes

1. **XinJS Proxies**: The application state uses XinJS reactive proxies. String comparisons can fail if proxy values aren't first converted to strings:
   ```typescript
   // Incorrect
   if (state.symbol === "BTC-USD") { }

   // Correct
   if (String(state.symbol) === "BTC-USD") { }
   // or
   if (xinValue(state.symbol) === "BTC-USD") { }
   ```

2. **Chart ID Namespacing**: Each chart instance has a unique `chartId` stored in `_chartId` property and `data-chart-id` attribute. State is accessed via `xin[chartId]`.

3. **State Observers**: Use `observe()` with the full path including chartId:
   ```typescript
   observe(`${chartId}.symbol`, (newSymbol) => { /* ... */ });
   ```

## Code Style Guidelines

- **Naming**: Classes/Interfaces (PascalCase), Variables/Methods (camelCase), Constants (UPPER_SNAKE_CASE), Components (kebab-case)
- **Files**: Use kebab-case for filenames (e.g., `price-history-model.ts`)
- **Imports**: Group third-party libraries first, then app imports, then utilities
- **Types**: Use strict TypeScript typing, prefer interfaces for data structures
- **Components**: Use Lit framework with decorators (`@property`, `@state`)
- **Error Handling**: Use try/catch for async operations; provide fallbacks for undefined values
- **State Management**: Use private properties with underscore prefix (e.g., `_state`)
- **CSS**: Use Lit's `css` template literals for component styling
- **Testing**: Tests in `__tests__` directories, describe-test pattern with clear assertions
- **Logging**: Use the logger facility (`client/util/logger.ts`) for all debug, info, and error messages

## Important Files & Documentation

- `doc/CHART_API_REFERENCE.md` - Complete Chart API documentation
- `doc/paper-trading-plan.md` - Paper trading and backtesting features roadmap
- `client/lib.ts` - Main library exports
- `client/api/chart-api.ts` - External control API
- `server/services/price-data/price-history-model.ts` - Core data models

## Development Workflow

1. **Library Development**: Edit files in `client/`, run `bun run dev` to see changes
2. **Testing**: Write tests in `__tests__/` directories, use `bun test` to run
3. **Building for Distribution**: Run `bun run build:lib` to create `dist/lib/`
4. **Local Integration**: Use `bun run update:linked` to rebuild bundled version for linked projects

## Firebase Integration

- Firestore for live candle subscriptions and product metadata
- Repository pattern: `client/api/candle-repository.ts`, `client/api/firestore-client.ts`
- Live updates via `client/api/live-candle-subscription.ts` and `live-candle-subscription-manager.ts`

## Trading Features (In Progress)

The library supports paper trading visualization through:
- Trade markers (buy/sell execution flags)
- Price level lines (stop loss, take profit, limit orders)
- Position overlays (current position info)
- Trade zones (visual representation of trade duration)
- Click-to-trade interactions

See `doc/paper-trading-plan.md` for detailed API design and implementation plan.

## Common Patterns

### Adding a New Indicator

1. Create indicator component in `client/components/chart/indicators/`
2. Extend from `MarketIndicator` base class
3. Implement `draw()` method using canvas context
4. Register in indicator stack

### Handling State Changes

```typescript
// In App class - observe state with chartId namespace
observe(`${this._chartId}.symbol`, (newSymbol) => {
  if (!this.isInitializing) {
    this.refetchData();
  }
});
```

### Using the Chart API (External Integration)

```typescript
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

const { app, api } = initChartWithApi(chartContainer, firebaseConfig, {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
});

// Control the chart
await api.setSymbol("ETH-USD");
api.showIndicator({ id: "rsi", name: "RSI", visible: true });

// Listen to events
api.on('symbolChange', (data) => {
  console.log('Symbol changed:', data);
});
```

## Repository Structure

```
rs-charts/
├── client/               # Client-side code (Lit components)
│   ├── api/             # Chart API, Firestore client, repositories
│   ├── components/      # Chart components
│   │   └── chart/       # Canvas-based chart components
│   ├── state/           # State management
│   ├── types/           # TypeScript type definitions
│   ├── util/            # Utilities (logger, price range, etc.)
│   ├── app.ts           # Main application controller
│   ├── init.ts          # Initialization and Firebase setup
│   ├── lib.ts           # Library exports
│   └── index.ts         # Demo app entry point
├── server/              # Server-side code (Bun)
│   ├── services/        # Price data services
│   │   └── price-data/  # Coinbase integration, models
│   └── index.ts         # HTTP server
├── doc/                 # Documentation
├── dist/                # Build output
│   ├── lib/             # Library distribution
│   ├── lib-bundled/     # Bundled library with dependencies
│   ├── client/          # Demo app
│   └── server/          # Server build
└── scripts/             # Utility scripts
```

## Technical Debt & Known Issues

- State proxy comparisons require explicit string conversion
- Multiple chart instances need careful chartId management
- Live candle subscriptions should persist during page visibility changes (handled in `init.ts`)
