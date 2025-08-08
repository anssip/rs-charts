# Rekt Sense Charts API Reference

## Overview

The Rekt Sense Charts API provides a comprehensive interface for controlling and interacting with cryptocurrency trading charts. This document covers all aspects of the Chart API including methods, events, and configuration options.

## Table of Contents

1. [Getting Started](#getting-started)
2. [API Methods](#api-methods)
   - [Symbol Control](#symbol-control)
   - [Granularity Control](#granularity-control)
   - [Indicator Control](#indicator-control)
   - [Display Control](#display-control)
   - [State Access](#state-access)
   - [Utility Methods](#utility-methods)
3. [Event System](#event-system)
4. [Type Definitions](#type-definitions)
5. [Usage Examples](#usage-examples)
6. [Best Practices](#best-practices)

## Getting Started

### Installation

```bash
npm install @anssipiirainen/sc-charts
# or
bun add @anssipiirainen/sc-charts
```

### Basic Setup

```typescript
import { ChartApi, createChartApi } from "@anssipiirainen/sc-charts";

// Get references to container and app (implementation specific)
const container = document.querySelector("chart-container");
const app = container.getApp();

// Create API instance
const api = createChartApi(container, app);
```

### Initial Configuration

You can pass trend lines and other configuration options when initializing the chart:

```typescript
import { initChartWithApi } from "@anssipiirainen/sc-charts";

const chartContainer = document.createElement("chart-container");
const initialState = {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR",
  indicators: [
    { id: "volume", name: "Volume", visible: true },
    { id: "rsi", name: "RSI", visible: true, params: { period: 14 } }
  ],
  trendLines: [
    {
      id: "trend-1",
      startPoint: { timestamp: 1704067200000, price: 45000 },
      endPoint: { timestamp: 1704153600000, price: 46500 },
      color: "#2962ff",
      lineWidth: 2,
      style: "solid",
      extendLeft: false,
      extendRight: true
    }
  ]
};

const { app, api } = initChartWithApi(chartContainer, firebaseConfig, initialState);
```

## API Methods

### Symbol Control

#### `getSymbol(): string`

Get the current trading pair symbol.

```typescript
const currentSymbol = api.getSymbol(); // Returns: "BTC-USD"
```

#### `setSymbol(options: string | SymbolChangeOptions): Promise<void>`

Set the chart symbol (e.g., "BTC-USD", "ETH-USD").

```typescript
// Simple usage
await api.setSymbol("ETH-USD");

// With options
await api.setSymbol({
  symbol: "ETH-USD",
  refetch: true, // Whether to refetch data immediately (default: true)
});
```

### Granularity Control

#### `getGranularity(): Granularity`

Get the current chart timeframe.

```typescript
const timeframe = api.getGranularity(); // Returns: "ONE_HOUR"
```

#### `getAvailableGranularities(): Granularity[]`

Get all available timeframes.

```typescript
const granularities = api.getAvailableGranularities();
// Returns: ["FIVE_MINUTE", "FIFTEEN_MINUTE", "ONE_HOUR", "FOUR_HOUR", "ONE_DAY", ...]
```

#### `setGranularity(options: Granularity | GranularityChangeOptions): Promise<void>`

Set the chart timeframe.

```typescript
// Simple usage
await api.setGranularity("ONE_DAY");

// With options
await api.setGranularity({
  granularity: "ONE_DAY",
  refetch: true, // Whether to refetch data immediately (default: true)
});
```

### Indicator Control

#### `getVisibleIndicators(): IndicatorConfig[]`

Get all currently visible indicators.

```typescript
const indicators = api.getVisibleIndicators();
// Returns array of active indicator configurations
```

#### `isIndicatorVisible(indicatorId: string): boolean`

Check if a specific indicator is visible.

```typescript
const isRSIVisible = api.isIndicatorVisible("rsi"); // Returns: true/false
```

#### `showIndicator(config: ApiIndicatorConfig): void`

Display an indicator on the chart.

```typescript
api.showIndicator({
  id: "rsi",
  name: "RSI",
  visible: true,
  display: DisplayType.Bottom,
  scale: ScaleType.Value,
  params: { period: 14 },
  gridStyle: GridStyle.Standard,
});
```

#### `hideIndicator(indicatorId: string): void`

Hide a specific indicator.

```typescript
api.hideIndicator("rsi");
```

#### `toggleIndicator(indicatorId: string, config?: Partial<ApiIndicatorConfig>): void`

Toggle an indicator's visibility.

```typescript
// Simple toggle
api.toggleIndicator("volume");

// Toggle with configuration (used when showing)
api.toggleIndicator("macd", {
  display: DisplayType.Bottom,
  params: { fast: 12, slow: 26, signal: 9 },
});
```

#### `setIndicators(indicators: ApiIndicatorConfig[]): void`

Set multiple indicators at once, replacing all current indicators.

```typescript
api.setIndicators([
  { id: "volume", name: "Volume", visible: true },
  { id: "rsi", name: "RSI", visible: true, params: { period: 14 } },
  { id: "macd", name: "MACD", visible: false },
]);
```

### Display Control

#### Fullscreen Mode

##### `isFullscreen(): boolean`

Check if chart is in browser fullscreen mode.

```typescript
const inFullscreen = api.isFullscreen(); // Returns: true/false
```

##### `enterFullscreen(): Promise<void>`

Enter browser fullscreen mode.

```typescript
await api.enterFullscreen();
```

##### `exitFullscreen(): Promise<void>`

Exit browser fullscreen mode.

```typescript
await api.exitFullscreen();
```

##### `toggleFullscreen(): Promise<void>`

Toggle browser fullscreen mode.

```typescript
await api.toggleFullscreen();
```

#### Full Window Mode

##### `isFullWindow(): boolean`

Check if chart is in full window mode (maximized within page).

```typescript
const inFullWindow = api.isFullWindow(); // Returns: true/false
```

##### `enterFullWindow(): void`

Enter full window mode.

```typescript
api.enterFullWindow();
```

##### `exitFullWindow(): void`

Exit full window mode.

```typescript
api.exitFullWindow();
```

##### `toggleFullWindow(): void`

Toggle full window mode.

```typescript
api.toggleFullWindow();
```

### State Access

#### `getState(): ChartState`

Get the complete current chart state.

```typescript
const state = api.getState();
// Returns: { symbol, granularity, indicators, loading, ... }
```

#### `isLoading(): boolean`

Check if chart is currently loading data.

```typescript
const loading = api.isLoading(); // Returns: true/false
```

### Utility Methods

#### `redraw(): void`

Force a complete redraw of the chart.

```typescript
api.redraw(); // Useful after external state changes
```

#### `getContainer(): ChartContainer`

Get the chart container element reference.

```typescript
const container = api.getContainer();
```

#### `getApp(): App`

Get the application instance reference.

```typescript
const app = api.getApp();
```

#### `dispose(): void`

Clean up the API instance and remove all event listeners.

```typescript
api.dispose(); // Call when unmounting/destroying chart
```

### Trend Line Control

#### `addTrendLine(trendLine: Omit<TrendLine, 'id'>): string`

Add a new trend line to the chart.

```typescript
const trendLineId = api.addTrendLine({
  startPoint: { timestamp: 1704067200000, price: 45000 },
  endPoint: { timestamp: 1704153600000, price: 46500 },
  color: '#2962ff',
  lineWidth: 2,
  style: 'solid',
  extendLeft: false,
  extendRight: true
});
// Returns: "trend-line-1704153600000"
```

#### `getTrendLine(id: string): TrendLine | null`

Get a specific trend line by its ID.

```typescript
const trendLine = api.getTrendLine('trend-line-1704153600000');
// Returns: TrendLine object or null if not found
```

#### `getTrendLines(): TrendLine[]`

Get all trend lines currently on the chart.

```typescript
const allTrendLines = api.getTrendLines();
// Returns: Array of TrendLine objects
```

#### `updateTrendLineSettings(id: string, settings: TrendLineSettings): void`

Update visual settings of an existing trend line.

```typescript
api.updateTrendLineSettings('trend-line-1704153600000', {
  color: '#ff0000',
  lineWidth: 3,
  style: 'dashed',
  extendLeft: true,
  extendRight: false
});
```

#### `removeTrendLine(id: string): void`

Remove a specific trend line from the chart. This will emit a `trend-line-deleted` event.

```typescript
// Remove a trend line by ID
api.removeTrendLine('trend-line-1704153600000');

// Listen for deletion events
api.on('trend-line-deleted', (data) => {
  console.log('Trend line deleted:', data.trendLineId);
});

// Note: Users can also delete selected lines with Backspace key
```

#### `clearTrendLines(): void`

Remove all trend lines from the chart.

```typescript
api.clearTrendLines();
```

#### `activateTrendLineTool(): void`

Activate the trend line drawing tool.

```typescript
api.activateTrendLineTool();
// User can now click twice on the chart to draw a trend line
```

#### `deactivateTrendLineTool(): void`

Deactivate the trend line drawing tool.

```typescript
api.deactivateTrendLineTool();
```

## Event System

### Event Types

#### 1. `ReadyEvent`

Emitted when the chart has been completely initialized and the API is ready to be called.

```typescript
interface ReadyEvent {
  timestamp: number; // When the chart became ready (Date.now())
  symbol: string; // Current trading pair symbol
  granularity: Granularity; // Current timeframe
}
```

#### 2. `SymbolChangeEvent`

Emitted when the trading pair symbol changes.

```typescript
interface SymbolChangeEvent {
  oldSymbol: string; // Previous trading pair symbol
  newSymbol: string; // New trading pair symbol
  refetch: boolean; // Whether price data will be refetched
}
```

#### 3. `GranularityChangeEvent`

Emitted when the chart timeframe changes.

```typescript
interface GranularityChangeEvent {
  oldGranularity: Granularity; // Previous timeframe
  newGranularity: Granularity; // New timeframe
  refetch: boolean; // Whether price data will be refetched
}
```

#### 4. `IndicatorChangeEvent`

Emitted when indicators are shown or hidden.

```typescript
interface IndicatorChangeEvent {
  action: "show" | "hide"; // Action performed on indicator
  indicator?: ApiIndicatorConfig; // Full indicator config (when showing)
  indicatorId?: string; // Indicator ID (when hiding)
}
```

#### 5. `FullscreenChangeEvent`

Emitted when display mode changes.

```typescript
interface FullscreenChangeEvent {
  isFullscreen?: boolean; // True if in browser fullscreen mode
  isFullWindow?: boolean; // True if in full window mode
  type: "fullscreen" | "fullwindow"; // Which display mode changed
}
```

#### 6. `TrendLineSelectedEvent`

Emitted when a trend line is selected by the user.

```typescript
interface TrendLineSelectedEvent {
  trendLineId: string; // ID of the selected trend line
  trendLine: TrendLine; // Complete trend line object with all settings
}
```

#### 7. `TrendLineDeselectedEvent`

Emitted when all trend lines are deselected.

```typescript
interface TrendLineDeselectedEvent {
  trendLineId: string | null; // ID of the previously selected trend line
}
```

#### 8. `TrendLineDeletedEvent`

Emitted when a trend line is deleted (via API call or Backspace key).

```typescript
interface TrendLineDeletedEvent {
  trendLineId: string; // ID of the deleted trend line
}
```

### Event Methods

#### `on<T extends ChartApiEventName>(event: T, callback: ChartApiEventCallback<T>): void`

Add an event listener with type-safe callback.

```typescript
// Listen for when chart is ready
api.on("ready", (data) => {
  console.log(`Chart ready at ${data.timestamp} for ${data.symbol}`);
  // Now safe to call other API methods like showIndicator()
});

// Listen for symbol changes  
api.on("symbolChange", (data) => {
  console.log(`Symbol changed: ${data.oldSymbol} → ${data.newSymbol}`);
});
```

#### `off<T extends ChartApiEventName>(event: T, callback: ChartApiEventCallback<T>): void`

Remove an event listener.

```typescript
const handler = (data: SymbolChangeEvent) => console.log(data);
api.on("symbolChange", handler);
// Later...
api.off("symbolChange", handler);
```

### Trend Line Event Examples

```typescript
// Listen for trend line selection
api.on("trend-line-selected", (data) => {
  console.log(`Trend line ${data.trendLineId} selected`);
  console.log("Current settings:", {
    color: data.trendLine.color,
    lineWidth: data.trendLine.lineWidth,
    style: data.trendLine.style,
    extendLeft: data.trendLine.extendLeft,
    extendRight: data.trendLine.extendRight
  });
  
  // Update UI controls to show current settings
  updateColorPicker(data.trendLine.color);
  updateLineWidthSlider(data.trendLine.lineWidth);
  updateStyleSelector(data.trendLine.style);
});

// Listen for trend line deselection
api.on("trend-line-deselected", (data) => {
  console.log("Trend lines deselected");
  // Hide settings UI controls
  hideSettingsPanel();
});

// Example: Update selected trend line settings
let selectedLineId: string | null = null;

api.on("trend-line-selected", (data) => {
  selectedLineId = data.trendLineId;
  showSettingsPanel(data.trendLine);
});

api.on("trend-line-deselected", () => {
  selectedLineId = null;
  hideSettingsPanel();
});

// Update settings when user changes them
function onColorChange(newColor: string) {
  if (selectedLineId) {
    api.updateTrendLineSettings(selectedLineId, { color: newColor });
  }
}

function onLineWidthChange(newWidth: number) {
  if (selectedLineId) {
    api.updateTrendLineSettings(selectedLineId, { lineWidth: newWidth });
  }
}

function onStyleChange(newStyle: 'solid' | 'dashed' | 'dotted') {
  if (selectedLineId) {
    api.updateTrendLineSettings(selectedLineId, { style: newStyle });
  }
}
```

## Type Definitions

### Core Types

```typescript
// Available granularities (timeframes)
type Granularity =
  | "FIVE_MINUTE"
  | "FIFTEEN_MINUTE"
  | "ONE_HOUR"
  | "FOUR_HOUR"
  | "ONE_DAY"
  | "ONE_WEEK";

// Indicator display options
enum DisplayType {
  None = "none",
  Main = "main", // Overlay on price chart
  Bottom = "bottom", // Separate panel below
  Top = "top", // Separate panel above
}

// Indicator scale options
enum ScaleType {
  Value = "value",
  Percent = "percent",
  Log = "log",
}

// Grid style options
enum GridStyle {
  None = "none",
  Standard = "standard",
  Fine = "fine",
}
```

### Configuration Interfaces

```typescript
interface ApiIndicatorConfig {
  id: string; // Unique indicator identifier
  name: string; // Display name
  visible: boolean; // Visibility state
  display?: DisplayType; // Where to display
  scale?: ScaleType; // Scale type
  params?: any; // Indicator-specific parameters
  skipFetch?: boolean; // Skip data fetching
  gridStyle?: GridStyle; // Grid display style
}

interface SymbolChangeOptions {
  symbol: string; // New symbol
  refetch?: boolean; // Refetch data (default: true)
}

interface GranularityChangeOptions {
  granularity: Granularity; // New granularity
  refetch?: boolean; // Refetch data (default: true)
}

// Initial state configuration that can be passed when creating a chart
interface ChartState {
  symbol?: string; // Trading pair symbol (e.g., "BTC-USD")
  granularity?: Granularity; // Chart timeframe
  indicators?: IndicatorConfig[]; // Initial indicators to display
  trendLines?: TrendLine[]; // Initial trend lines to display
  // ... other optional state properties
}
```

## Usage Examples

### Complete React Integration

```typescript
import { useEffect, useState, useRef } from 'react';
import { ChartApi, SymbolChangeEvent, GranularityChangeEvent } from '@anssipiirainen/sc-charts';

function TradingChart({ initialSymbol = "BTC-USD" }) {
  const [api, setApi] = useState<ChartApi | null>(null);
  const [symbol, setSymbol] = useState(initialSymbol);
  const [granularity, setGranularity] = useState<Granularity>("ONE_HOUR");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api) return;

    // Ready handler - chart is initialized and API is safe to use
    const handleReady = (data: ReadyEvent) => {
      setLoading(false);
      console.log(`Chart ready for ${data.symbol} at ${data.granularity}`);
      // Safe to call API methods like showIndicator() here
    };

    // Symbol change handler
    const handleSymbolChange = (data: SymbolChangeEvent) => {
      setSymbol(data.newSymbol);
      setLoading(data.refetch);
    };

    // Granularity change handler
    const handleGranularityChange = (data: GranularityChangeEvent) => {
      setGranularity(data.newGranularity);
      setLoading(data.refetch);
    };

    // Subscribe to events
    api.on('ready', handleReady);
    api.on('symbolChange', handleSymbolChange);
    api.on('granularityChange', handleGranularityChange);

    // Cleanup
    return () => {
      api.off('ready', handleReady);
      api.off('symbolChange', handleSymbolChange);
      api.off('granularityChange', handleGranularityChange);
    };
  }, [api]);

  // Control methods
  const changeSymbol = async (newSymbol: string) => {
    await api?.setSymbol(newSymbol);
  };

  const toggleIndicator = (indicatorId: string) => {
    api?.toggleIndicator(indicatorId);
  };

  const enterFullscreen = async () => {
    await api?.enterFullscreen();
  };

  return (
    <div>
      <div className="controls">
        <select onChange={(e) => changeSymbol(e.target.value)} value={symbol}>
          <option value="BTC-USD">Bitcoin</option>
          <option value="ETH-USD">Ethereum</option>
        </select>

        <button onClick={() => toggleIndicator('volume')}>
          Toggle Volume
        </button>

        <button onClick={enterFullscreen}>
          Fullscreen
        </button>
      </div>

      <chart-container ref={/* ... */} />

      {loading && <div className="loading">Loading...</div>}
    </div>
  );
}
```

### Vanilla JavaScript Integration

```javascript
// Initialize chart API
const container = document.querySelector("chart-container");
const app = container.getApp();
const api = createChartApi(container, app);

// Set up event listeners
api.on("ready", (data) => {
  console.log(`Chart initialized for ${data.symbol}`);
  hideLoadingSpinner();
  // Now safe to show indicators or perform other API operations
});

api.on("symbolChange", (data) => {
  document.getElementById("symbol-display").textContent = data.newSymbol;
  if (data.refetch) {
    showLoadingSpinner();
  }
});

api.on("indicatorChange", (data) => {
  if (data.action === "show") {
    console.log(`Indicator ${data.indicator.name} is now visible`);
  } else {
    console.log(`Indicator ${data.indicatorId} was hidden`);
  }
});

// Control chart
document.getElementById("btc-button").addEventListener("click", () => {
  api.setSymbol("BTC-USD");
});

document.getElementById("rsi-toggle").addEventListener("click", () => {
  api.toggleIndicator("rsi", { params: { period: 14 } });
});

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  api.dispose();
});
```

### Advanced Indicator Management

```typescript
// Define custom indicator presets
const indicatorPresets = {
  dayTrading: [
    { id: "volume", name: "Volume", visible: true },
    { id: "rsi", name: "RSI", visible: true, params: { period: 14 } },
    { id: "macd", name: "MACD", visible: true },
  ],
  longTerm: [
    {
      id: "moving-averages",
      name: "Moving Averages",
      visible: true,
      params: { ma1: 50, ma2: 200 },
    },
    { id: "volume", name: "Volume", visible: true },
  ],
};

// Apply preset
function applyIndicatorPreset(preset: "dayTrading" | "longTerm") {
  api.setIndicators(indicatorPresets[preset]);
}

// Save current indicator state
function saveIndicatorState() {
  const indicators = api.getVisibleIndicators();
  localStorage.setItem("chartIndicators", JSON.stringify(indicators));
}

// Restore indicator state
function restoreIndicatorState() {
  const saved = localStorage.getItem("chartIndicators");
  if (saved) {
    const indicators = JSON.parse(saved);
    api.setIndicators(indicators);
  }
}
```

## Best Practices

### 1. Event Listener Management

Always remove event listeners when components unmount to prevent memory leaks:

```typescript
useEffect(() => {
  const handler = (data: SymbolChangeEvent) => {
    // Handle event
  };

  api.on("symbolChange", handler);

  return () => {
    api.off("symbolChange", handler);
  };
}, [api]);
```

### 2. Error Handling

Wrap async operations in try-catch blocks:

```typescript
try {
  await api.enterFullscreen();
} catch (error) {
  console.error("Failed to enter fullscreen:", error);
  // Show user-friendly error message
}
```

### 3. State Synchronization

Keep your application state synchronized with chart state:

```typescript
// Initial sync
const state = api.getState();
setAppState({
  symbol: state.symbol,
  granularity: state.granularity,
  indicators: state.indicators,
});

// Ongoing sync via events
api.on("symbolChange", (data) => {
  setAppState((prev) => ({ ...prev, symbol: data.newSymbol }));
});
```

### 4. Performance Optimization

Debounce rapid API calls when needed:

```typescript
import { debounce } from "lodash";

const debouncedRedraw = debounce(() => {
  api.redraw();
}, 300);

// Use debounced version for frequent updates
window.addEventListener("resize", debouncedRedraw);
```

### 5. Type Safety

Always use TypeScript types for better development experience:

```typescript
import type {
  ChartApi,
  ReadyEvent,
  SymbolChangeEvent,
  ApiIndicatorConfig,
  Granularity,
} from "@anssipiirainen/sc-charts";

// Type-safe configuration
const indicatorConfig: ApiIndicatorConfig = {
  id: "bollinger-bands",
  name: "Bollinger Bands",
  visible: true,
  display: DisplayType.Main,
  params: { period: 20, stdDev: 2 },
};
```

## 📦 Library Exports

All types and functions are exported through the main package:

```typescript
export {
  // Main API
  ChartApi,
  createChartApi,

  // Event Types
  ReadyEvent,
  SymbolChangeEvent,
  GranularityChangeEvent,
  IndicatorChangeEvent,
  FullscreenChangeEvent,
  TrendLineSelectedEvent,
  TrendLineDeselectedEvent,
  TrendLineDeletedEvent,
  ChartApiEventMap,
  ChartApiEventName,
  ChartApiEventCallback,

  // Configuration Types
  ApiIndicatorConfig,
  SymbolChangeOptions,
  GranularityChangeOptions,
  TrendLineSettings,

  // Trend Line Types
  TrendLine,
  TrendLinePoint,
  TrendLineEvent,

  // Enums
  DisplayType,
  ScaleType,
  GridStyle,
  Granularity,
} from "@anssipiirainen/sc-charts";
```

## 🔧 Build & Distribution

### Build Process

```bash
bun run build:lib  # Build library for distribution
bun test          # Run all tests
```

### NPM Package

- ✅ Full TypeScript support with type definitions
- ✅ Tree-shakeable ES modules
- ✅ CommonJS compatibility
- ✅ Source maps included
- ✅ Comprehensive documentation
- ✅ Semantic versioning
