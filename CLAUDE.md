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
- Orchestrates specialized controllers and visual layers through delegation pattern
- Uses factory functions (`initializeControllers`, `initializeInteractionLayers`) for controller setup
- Delegates responsibilities to specialized classes:
  - **TradingOverlaysManager**: Manages trade markers, price lines, and trade zones
  - **BrowserIntegration**: Handles zoom prevention, focus, and mobile detection
  - **LayerUpdateCoordinator**: Coordinates updates across all visual layers
  - **ChartEventHandlers**: Centralized event handling logic
- Manages multiple specialized controllers (see Controllers & Layers section below)
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

## Controllers & Layers Architecture

The chart-container has been refactored to use a modular architecture with specialized controllers and visual layers. This separation of concerns makes the codebase more maintainable and allows features to be developed independently.

### Controller Initialization

Controllers are initialized using factory functions from `client/components/chart/interaction/controller-factory.ts`:
- `initializeControllers()`: Sets up all feature-specific controllers
- `initializeInteractionLayers()`: Initializes the main ChartInteractionController and registers interactive layers

### Specialized Controllers

Each controller manages a specific chart feature:

**`ClickToTradeController`** (`./interaction/click-to-trade-controller.ts`)
- Handles click-to-trade interactions for paper trading
- Emits `order-request` and `price-hover` events
- Can be enabled/disabled via configuration

**`EquityCurveController`** (`./interaction/equity-curve-controller.ts`)
- Manages equity curve visualization for backtesting
- Updates equity curve canvas layer

**`RiskZonesController`** (`./interaction/risk-zones-controller.ts`)
- Manages risk zone overlays (invalidation zones, risk/reward areas)
- Handles risk zone interactions (click, hover)

**`TimeMarkersController`** (`./interaction/time-markers-controller.ts`)
- Manages vertical time markers on the chart
- Coordinates with TimeMarkersLayer for rendering

**`AnnotationsController`** (`./interaction/annotations-controller.ts`)
- Manages chart annotations (text labels, notes)
- Handles annotation dragging and updates

**`PositionOverlayController`** (`./interaction/position-overlay-controller.ts`)
- Manages position overlay visualization for paper trading
- Shows entry price, P&L, and position size

**`PatternHighlightsController`** (`./interaction/pattern-highlights-controller.ts`)
- Manages pattern recognition highlights
- Provides methods to set/clear pattern highlights

**`TrendLineController`** (`./interaction/trend-line-controller.ts`)
- Manages trend line drawing and editing
- Handles trend line tool activation/deactivation
- Coordinates with TrendLineLayer for rendering

### Visual Layers

Visual layers are Lit web components that render specific chart elements. They are coordinated by the `LayerUpdateCoordinator`:

**Canvas-based Layers:**
- **`risk-zones-canvas-layer`**: Renders risk zones using canvas for performance
- **`equity-curve-canvas-layer`**: Renders equity curve at bottom of chart

**DOM-based Layers:**
- **`TrendLineLayer`** (`trend-line-layer`): Interactive trend line rendering
- **`PatternLabelsLayer`** (`pattern-labels-layer`): Pattern recognition labels
- **`TradingMarkersLayer`** (`trading-markers-layer`): Buy/sell trade markers
- **`PriceLinesLayer`** (`price-lines-layer`): Horizontal price level lines
- **`TradeZonesLayer`** (`trade-zones-layer`): Visual trade duration zones
- **`AnnotationsLayer`** (`annotations-layer`): Text annotations and notes
- **`TimeMarkersLayer`** (`time-markers-layer`): Vertical time markers

### Supporting Classes

**`TradingOverlaysManager`** (`./trading-overlays-manager.ts`)
- Centralized manager for trading-related overlays
- Provides methods to add/remove/update trade markers, price lines, and trade zones
- ChartContainer delegates trading overlay methods to this manager

**`BrowserIntegration`** (`./browser-integration.ts`)
- Handles browser-specific functionality
- Zoom prevention on mobile devices
- Focus/visibility change handling
- Mobile detection with media query listeners

**`LayerUpdateCoordinator`** (`./layer-update-coordinator.ts`)
- Coordinates updates across all visual layers
- Ensures layers are updated with consistent state
- Provides methods for updating specific layers or all layers at once

**`ChartEventHandlers`** (`./chart-event-handlers.ts`)
- Centralized event handling for the chart container
- Handles events: candle clicks, context menu, fullscreen, indicator toggles, trend line updates, etc.
- Keeps event handling logic separate from chart container orchestration

### Delegation Pattern

The ChartContainer uses a delegation pattern where public API methods delegate to specialized managers:

```typescript
// Example: Trade marker methods delegate to TradingOverlaysManager
public addTradeMarker(marker: TradeMarker): void {
  this.tradingOverlaysManager?.addTradeMarker(marker);
}

// Example: Event handlers delegate to ChartEventHandlers
this.addEventListener('candle-click',
  this.eventHandlers.handleCandleClick as EventListener
);
```

This pattern:
- Reduces complexity in ChartContainer
- Makes testing easier (test managers in isolation)
- Improves code organization and maintainability
- Allows features to be developed independently

## Interaction Layer System

**Chart Interaction Controller (`client/components/chart/interaction/chart-interaction-controller.ts`)**

The chart uses a priority-based interaction layer system to handle mouse and touch events. This architecture allows multiple interactive elements (annotations, trend lines, price lines, etc.) to coexist and claim interactions without interfering with default chart panning/zooming.

### How It Works

1. **Layer Registration**: Interactive components register themselves as layers with a priority level
   ```typescript
   controller.registerLayer({
     id: "my-layer",
     priority: 100, // Higher priority layers are queried first
     hitTest: (event) => { /* ... */ },
     handleInteraction: (event) => { /* ... */ },
     onTransform: (transform) => { /* ... */ }
   });
   ```

2. **Hit Testing**: When a user interacts (mousedown, touchstart), the controller queries all registered layers in priority order
   - Each layer's `hitTest()` method determines if it should handle the interaction
   - The first layer to return a truthy `HitTestResult` claims the interaction
   - If no layer claims it, the default chart panning behavior is used

3. **Interaction Handling**: Once a layer claims an interaction:
   - All subsequent drag/move/end events are routed to that layer's `handleInteraction()` method
   - The cursor can be updated based on the hit result
   - Other layers and default chart behavior are bypassed during this interaction

4. **Viewport Broadcasting**: When the chart pans or zooms:
   - The controller broadcasts `ViewportTransform` updates to all registered layers
   - Layers use this to update their coordinate calculations and redraw if needed

### Key Interfaces

**InteractionLayer**:
```typescript
interface InteractionLayer {
  id: string;
  priority: number;
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null;
  handleInteraction(event: InteractionEvent): void;
  onTransform?(transform: ViewportTransform): void;
  destroy?(): void;
}
```

**HitTestResult**:
```typescript
interface HitTestResult {
  type: string;          // Type of interaction (e.g., "drag-annotation", "resize-line")
  cursor?: string;       // Optional cursor style (e.g., "move", "ns-resize")
  data?: any;            // Optional data about what was hit
}
```

**InteractionEvent**:
```typescript
interface InteractionEvent {
  type: "dragstart" | "drag" | "dragend" | "click" | "hover";
  originalEvent: MouseEvent | TouchEvent;
  position: { x: number; y: number };           // Screen coordinates
  canvasPosition: { x: number; y: number };     // Canvas coordinates (with DPR)
  modifiers: { shift, ctrl, alt, meta };
}
```

**ViewportTransform**:
```typescript
interface ViewportTransform {
  timeRange: { start: number; end: number };
  priceRange: { min: number; max: number };
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
}
```

### Event Flow

1. **User initiates interaction** (mousedown/touchstart)
2. **Controller queries layers** by priority (highest first)
3. **Layer claims interaction** via `hitTest()` returning a result
4. **Controller routes events** to the active layer's `handleInteraction()`
5. **User completes interaction** (mouseup/touchend)
6. **Controller resets** active layer and cursor

### Default Chart Behavior

If no layer claims an interaction:
- **Pan**: Drag moves the chart horizontally (timeline) and vertically (price axis)
- **Zoom**: Mouse wheel or pinch gestures zoom timeline and price axis
- **Click**: Emits `chart-clicked` event with price and timestamp
- **Context Menu**: Emits `chart-context-menu` event with price and timestamp

### Backward Compatibility

The controller includes legacy support for draggable elements detected via composed path:
- Elements with classes `annotation.draggable`, `trend-line`, or `price-line.draggable`
- This is maintained for backward compatibility but new features should use the layer system

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
- `client/components/chart/chart-container.ts` - Main chart orchestrator
- `client/components/chart/interaction/controller-factory.ts` - Controller initialization
- `client/components/chart/trading-overlays-manager.ts` - Trading overlay delegation
- `client/components/chart/layer-update-coordinator.ts` - Layer update coordination
- `client/components/chart/chart-event-handlers.ts` - Centralized event handling
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

### Adding a New Controller

To add a new feature controller:

1. Create controller class in `client/components/chart/interaction/`
2. Define controller interface with initialization config
3. Implement feature-specific methods
4. Register controller in `controller-factory.ts` within `initializeControllers()`
5. Add controller property to ChartContainer
6. Add any necessary event listeners in ChartEventHandlers

Example:
```typescript
// my-feature-controller.ts
export class MyFeatureController {
  constructor(private config: MyFeatureConfig) {}

  enable(): void { /* ... */ }
  disable(): void { /* ... */ }
  destroy(): void { /* ... */ }
}

// controller-factory.ts - add to initializeControllers()
container.myFeatureController = new MyFeatureController({
  state,
  updateLayer: callbacks.updateMyFeatureLayer,
});
```

### Adding a New Visual Layer

To add a new visual layer component:

1. Create layer component in `client/components/chart/` (e.g., `my-feature-layer.ts`)
2. Extend from `LitElement` with `Layer` interface
3. Implement rendering logic in `render()` method
4. Add layer update method to `LayerUpdateCoordinator`
5. Register layer in ChartContainer's `firstUpdated()` using `initLayer()` helper
6. Add layer to render template in ChartContainer

Example:
```typescript
// my-feature-layer.ts
@customElement('my-feature-layer')
export class MyFeatureLayer extends LitElement implements Layer {
  @property({ type: Array }) items: MyItem[] = [];
  @property({ type: Object }) state!: ChartState;

  render() {
    return html`${this.items.map(item => html`...`)}`;
  }
}

// Add to chart-container.ts render():
<my-feature-layer
  .items=${this._state.myItems || []}
  .state=${this._state}
></my-feature-layer>
```

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

### Implementing an Interaction Layer

To create a new interactive feature (e.g., draggable annotation, resizable shape):

```typescript
import { InteractionLayer, HitTestResult, InteractionEvent } from './interaction-layer';

class MyInteractionLayer implements InteractionLayer {
  id = "my-layer";
  priority = 100; // Higher priority = queried first

  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    // Determine if this layer should handle the interaction
    const { x, y } = this.getEventPosition(event);

    if (this.isOverMyElement(x, y)) {
      return {
        type: "drag-my-element",
        cursor: "move",
        data: { elementId: "..." }
      };
    }

    return null; // Don't claim this interaction
  }

  handleInteraction(event: InteractionEvent): void {
    switch (event.type) {
      case "dragstart":
        // Initialize drag operation
        break;
      case "drag":
        // Update element position
        break;
      case "dragend":
        // Finalize drag, save state
        break;
    }
  }

  onTransform(transform: ViewportTransform): void {
    // Update coordinate calculations when chart pans/zooms
    this.updatePositions(transform);
  }

  destroy(): void {
    // Cleanup resources
  }
}

// Register the layer
const layer = new MyInteractionLayer();
chartInteractionController.registerLayer(layer);
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
├── client/                      # Client-side code (Lit components)
│   ├── api/                    # Chart API, Firestore client, repositories
│   ├── components/             # Chart components
│   │   └── chart/              # Canvas-based chart components
│   │       ├── interaction/    # Controllers for chart features
│   │       │   ├── chart-interaction-controller.ts
│   │       │   ├── controller-factory.ts
│   │       │   ├── click-to-trade-controller.ts
│   │       │   ├── equity-curve-controller.ts
│   │       │   ├── risk-zones-controller.ts
│   │       │   ├── annotations-controller.ts
│   │       │   ├── trend-line-controller.ts
│   │       │   └── ...
│   │       ├── *-layer.ts      # Visual layer components
│   │       ├── chart-container.ts              # Main orchestrator
│   │       ├── trading-overlays-manager.ts     # Trading overlay manager
│   │       ├── layer-update-coordinator.ts     # Layer coordinator
│   │       ├── chart-event-handlers.ts         # Event handlers
│   │       ├── browser-integration.ts          # Browser utilities
│   │       └── ...
│   ├── state/                  # State management
│   ├── types/                  # TypeScript type definitions
│   ├── util/                   # Utilities (logger, price range, etc.)
│   ├── app.ts                  # Main application controller
│   ├── init.ts                 # Initialization and Firebase setup
│   ├── lib.ts                  # Library exports
│   └── index.ts                # Demo app entry point
├── server/                     # Server-side code (Bun)
│   ├── services/               # Price data services
│   │   └── price-data/         # Coinbase integration, models
│   └── index.ts                # HTTP server
├── doc/                        # Documentation
├── dist/                       # Build output
│   ├── lib/                    # Library distribution
│   ├── lib-bundled/            # Bundled library with dependencies
│   ├── client/                 # Demo app
│   └── server/                 # Server build
└── scripts/                    # Utility scripts
```

## Technical Debt & Known Issues

- State proxy comparisons require explicit string conversion
- Multiple chart instances need careful chartId management
- Live candle subscriptions should persist during page visibility changes (handled in `init.ts`)
