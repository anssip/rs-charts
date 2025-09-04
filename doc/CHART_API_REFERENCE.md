# Rekt Sense Charts API Reference

## Overview

The Rekt Sense Charts API provides a comprehensive interface for controlling and interacting with cryptocurrency trading charts. This document covers all aspects of the Chart API including methods, events, configuration options, and framework integration examples.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Getting Started](#getting-started)
3. [Initialization](#initialization)
4. [API Methods](#api-methods)
   - [Symbol Control](#symbol-control)
   - [Granularity Control](#granularity-control)
   - [Indicator Control](#indicator-control)
   - [Display Control](#display-control)
   - [Trend Line Control](#trend-line-control)
   - [State Access](#state-access)
   - [Utility Methods](#utility-methods)
5. [Event System](#event-system)
6. [Type Definitions](#type-definitions)
7. [Framework Integration Examples](#framework-integration-examples)
8. [Usage Examples](#usage-examples)
9. [Error Handling](#error-handling)
10. [Performance Considerations](#performance-considerations)
11. [Best Practices](#best-practices)
12. [Migration from Legacy API](#migration-from-legacy-api)
13. [Library Exports](#library-exports)
14. [Build & Distribution](#build--distribution)

## Quick Start

```javascript
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

// Create chart container
const chartContainer = createChartContainer();
document.body.appendChild(chartContainer);

// Initialize chart with API
const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
});

// Use the API
await api.setSymbol("ETH-USD");
await api.setGranularity("FIVE_MINUTE");
api.showIndicator({ id: "rsi", name: "RSI", visible: true });
await api.enterFullscreen();
```

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

const chartContainer = createChartContainer();
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

const { app, api } = await initChartWithApi(chartContainer, firebaseConfig, initialState);
```

## Initialization

### Using initChartWithApi (Recommended)

```javascript
import { initChartWithApi } from '@anssipiirainen/sc-charts';

const { app, api } = await initChartWithApi(
  chartContainer, 
  firebaseConfig, 
  initialState?
);
```

**Returns:**
- `app`: App instance for low-level control
- `api`: ChartApi instance for high-level control

### Using createChartApi (Advanced)

```javascript
import { createChartApi, initChart } from '@anssipiirainen/sc-charts';

const app = initChart(chartContainer, firebaseConfig);
const api = createChartApi(chartContainer, app);
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

// Advanced usage with options
await api.setSymbol({
  symbol: "ETH-USD",
  refetch: true  // Whether to refetch data (default: true)
});
```

**Parameters:**
- `options`: `string | SymbolChangeOptions`
  - If string: symbol name
  - If object: `{ symbol: string, refetch?: boolean }`

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
// Returns: ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", "THIRTY_MINUTE", "ONE_HOUR", "TWO_HOUR", "SIX_HOUR", "ONE_DAY"]
```

#### `setGranularity(options: Granularity | GranularityChangeOptions): Promise<void>`

Set the chart timeframe.

```typescript
// Simple usage
await api.setGranularity("ONE_DAY");

// Advanced usage with options
await api.setGranularity({
  granularity: "ONE_DAY",
  refetch: true  // Whether to refetch data (default: true)
});
```

**Available Granularities:**
- `ONE_MINUTE` (1m)
- `FIVE_MINUTE` (5m)
- `FIFTEEN_MINUTE` (15m)
- `THIRTY_MINUTE` (30m)
- `ONE_HOUR` (1h)
- `TWO_HOUR` (2h)
- `SIX_HOUR` (6h)
- `ONE_DAY` (1d)

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
const isVolumeVisible = api.isIndicatorVisible("volume"); // Returns: true/false
```

#### `showIndicator(config: ApiIndicatorConfig): void`

Display an indicator on the chart.

```typescript
api.showIndicator({
  id: "rsi",
  name: "RSI",
  visible: true,
  display: DisplayType.Bottom,     // Optional: "overlay" | "bottom" | "stack-top" | "stack-bottom"
  scale: ScaleType.Value,          // Optional: "price" | "percentage" | "custom" | "value"
  params: { period: 14 },          // Optional: indicator-specific parameters
  skipFetch: false,                // Optional: skip data fetching
  gridStyle: GridStyle.Standard    // Optional: grid styling
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

// Toggle with configuration for when showing
api.toggleIndicator("macd", {
  name: "MACD",
  display: DisplayType.Bottom,
  params: { fast: 12, slow: 26, signal: 9 }
});
```

#### `setIndicators(indicators: ApiIndicatorConfig[]): void`

Set multiple indicators at once, replacing all current indicators.

```typescript
api.setIndicators([
  { id: "volume", name: "Volume", visible: true },
  { id: "rsi", name: "RSI", visible: true, params: { period: 14 } },
  { id: "macd", name: "MACD", visible: true }
]);
```

**Common Indicator IDs:**
- `volume` - Volume bars
- `rsi` - Relative Strength Index
- `macd` - MACD histogram and signal lines
- `bb` - Bollinger Bands
- `sma` - Simple Moving Average
- `ema` - Exponential Moving Average

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
try {
  await api.enterFullscreen();
  console.log("Entered fullscreen");
} catch (error) {
  console.log("Fullscreen failed:", error.message);
}
```

**Note:** Must be called in response to user interaction due to browser security restrictions.

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

Enter full window mode (maximizes chart within the page).

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

### Trend Line Control

#### `addTrendLine(trendLine: Omit<TrendLine, 'id'>): string`

Add a new trend line to the chart.

```typescript
// Add a trend line and keep it selected (default behavior)
const lineId = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 50000 },
  end: { timestamp: 1234567900000, price: 51000 },
  color: "#FF0000",
  lineWidth: 2,
  style: "solid", // "solid" | "dashed" | "dotted"
  extendLeft: false,
  extendRight: true
});

// Add a trend line and explicitly deselect it
const lineId2 = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 52000 },
  end: { timestamp: 1234567900000, price: 53000 },
  color: "#00FF00",
  selected: false  // Line will not be selected after creation
});

// Add a trend line and ensure it's selected
const lineId3 = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 54000 },
  end: { timestamp: 1234567900000, price: 55000 },
  selected: true  // Explicitly select the line after creation
});
```

**Parameters:**
- `trendLine`: Object containing trend line configuration
  - `start`: Start point with `timestamp` and `price`
  - `end`: End point with `timestamp` and `price`
  - `color`: Optional line color (default: chart default)
  - `lineWidth`: Optional line width (default: 2)
  - `style`: Optional line style - "solid" | "dashed" | "dotted" (default: "solid")
  - `extendLeft`: Optional extend line to the left (default: false)
  - `extendRight`: Optional extend line to the right (default: false)
  - `selected`: Optional whether to select the line after creation (default: true)

**Returns:** The ID of the created trend line

#### `getTrendLine(id: string): TrendLine | null`

Get a specific trend line by its ID.

```typescript
const trendLine = api.getTrendLine('trend-line-1704153600000');
if (trendLine) {
  console.log("Trend line:", trendLine);
}
```

#### `getTrendLines(): TrendLine[]`

Get all trend lines currently on the chart.

```typescript
const allTrendLines = api.getTrendLines();
console.log(`Chart has ${allTrendLines.length} trend lines`);
```

#### `updateTrendLine(id: string, updates: Partial<TrendLine>): void`

Update an existing trend line.

```typescript
api.updateTrendLine("trend-line-1234567890", {
  color: "#00FF00",
  lineWidth: 3,
  extendRight: false
});
```

#### `updateTrendLineSettings(id: string, settings: TrendLineSettings): void`

Update visual settings of an existing trend line (convenience method).

```typescript
api.updateTrendLineSettings('trend-line-1704153600000', {
  color: '#0000FF',
  lineWidth: 1,
  style: 'dashed',
  extendLeft: true,
  extendRight: true
});
```

#### `removeTrendLine(id: string): void`

Remove a specific trend line from the chart. This will emit a `trend-line-deleted` event.

```typescript
api.removeTrendLine("trend-line-1234567890");
```

#### `clearTrendLines(): void`

Remove all trend lines from the chart.

```typescript
api.clearTrendLines();
```

#### `selectTrendLine(id: string): void`

Select a trend line by ID.

```typescript
api.selectTrendLine("trend-line-1234567890");
```

#### `deselectAllTrendLines(): void`

Deselect all trend lines.

```typescript
api.deselectAllTrendLines();
```

#### `getSelectedTrendLineId(): string | null`

Get the currently selected trend line ID.

```typescript
const selectedId = api.getSelectedTrendLineId();
if (selectedId) {
  console.log("Selected trend line:", selectedId);
}
```

#### `activateTrendLineTool(defaults?: TrendLineDefaults): void`

Activate the trend line drawing tool with optional default settings for new trend lines.

```typescript
// Simple activation
api.activateTrendLineTool();

// Activation with default settings for new trend lines
api.activateTrendLineTool({
  color: '#FF0000',
  lineWidth: 3,
  style: 'dashed',
  extendLeft: false,
  extendRight: true
});
// User can now click and drag to draw trend lines with these defaults
```

**Parameters:**
- `defaults`: Optional `TrendLineDefaults` object with default settings for new trend lines
  - `color`: Default line color
  - `lineWidth`: Default line width
  - `style`: Default line style ('solid' | 'dashed' | 'dotted')
  - `extendLeft`: Default for extending line to the left
  - `extendRight`: Default for extending line to the right

#### `setTrendLineDefaults(defaults: TrendLineDefaults): void`

Set default settings for new trend lines without activating the drawing tool. These defaults will be used for all subsequently created trend lines.

```typescript
// Set defaults for new trend lines
api.setTrendLineDefaults({
  color: '#2962ff',
  lineWidth: 2,
  style: 'solid',
  extendLeft: false,
  extendRight: false
});

// Later, when the tool is activated, it will use these defaults
api.activateTrendLineTool();
```

**Parameters:**
- `defaults`: `TrendLineDefaults` object with default settings for new trend lines
  - `color`: Default line color
  - `lineWidth`: Default line width
  - `style`: Default line style ('solid' | 'dashed' | 'dotted')
  - `extendLeft`: Default for extending line to the left
  - `extendRight`: Default for extending line to the right

#### `deactivateTrendLineTool(): void`

Deactivate the trend line drawing tool.

```typescript
api.deactivateTrendLineTool();
```

#### `isToolActive(tool: string): boolean`

Check if a drawing tool is active.

```typescript
const isActive = api.isToolActive('trendLine');
console.log("Trend line tool active:", isActive);
```

### State Access

#### `getState(): ChartState`

Get the complete current chart state.

```typescript
const state = api.getState();
console.log(state.symbol, state.granularity, state.indicators);
```

#### `isLoading(): boolean`

Check if chart is currently loading data.

```typescript
const loading = api.isLoading(); // Returns: true/false
```

#### `getTimeRange(): TimeRange`

Get the currently visible time range of the chart.

```typescript
const timeRange = api.getTimeRange();
console.log("Start:", new Date(timeRange.start));
console.log("End:", new Date(timeRange.end));
// Returns: { start: 1609459200000, end: 1609545600000 }
```

**Returns:**
- `TimeRange`: Object with `start` and `end` properties (timestamps in milliseconds)

#### `setTimeRange(timeRange: TimeRange | { start?: number; end?: number }): void`

Set a new time range for the chart. The chart will automatically fetch additional data if needed when panning outside the buffered area.

```typescript
// Set a specific time range
api.setTimeRange({
  start: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  end: Date.now()
});

// Zoom in by 50% (keeping center point)
const current = api.getTimeRange();
const duration = current.end - current.start;
const center = (current.start + current.end) / 2;
const newDuration = duration * 0.5;
api.setTimeRange({
  start: center - newDuration / 2,
  end: center + newDuration / 2
});

// Pan left by 20%
const current = api.getTimeRange();
const duration = current.end - current.start;
const shift = duration * 0.2;
api.setTimeRange({
  start: current.start - shift,
  end: current.end - shift
});
```

**Parameters:**
- `timeRange`: Object with optional `start` and/or `end` properties
  - `start`: Start timestamp in milliseconds
  - `end`: End timestamp in milliseconds
  - If only one is provided, the other will remain unchanged

**Throws:**
- Error if `start >= end`

#### `getPriceRange(): PriceRange`

Get the currently visible price range of the chart.

```typescript
const priceRange = api.getPriceRange();
console.log("Min:", priceRange.min);
console.log("Max:", priceRange.max);
console.log("Range:", priceRange.range);
// Returns: { min: 45000, max: 50000, range: 5000 }
```

**Returns:**
- `PriceRange`: Object with `min`, `max`, and `range` properties
  - `min`: Minimum visible price
  - `max`: Maximum visible price
  - `range`: Price range (max - min)

#### `setPriceRange(priceRange: { min: number; max: number }): void`

Set a new price range for the chart.

```typescript
// Set a specific price range
api.setPriceRange({
  min: 45000,
  max: 55000
});

// Expand range by 10%
const current = api.getPriceRange();
const adjustment = current.range * 0.1;
api.setPriceRange({
  min: current.min - adjustment,
  max: current.max + adjustment
});

// Auto-fit to visible data
const state = api.getState();
const timeRange = api.getTimeRange();
const visibleCandles = state.priceHistory.getCandlesInRange(
  timeRange.start,
  timeRange.end
);

if (visibleCandles.length > 0) {
  let minPrice = Infinity;
  let maxPrice = -Infinity;
  
  visibleCandles.forEach(([_, candle]) => {
    minPrice = Math.min(minPrice, candle.low);
    maxPrice = Math.max(maxPrice, candle.high);
  });
  
  // Add 5% padding
  const padding = (maxPrice - minPrice) * 0.05;
  api.setPriceRange({
    min: minPrice - padding,
    max: maxPrice + padding
  });
}
```

**Parameters:**
- `priceRange`: Object with required `min` and `max` properties
  - `min`: Minimum price to display
  - `max`: Maximum price to display

**Throws:**
- Error if `min >= max`

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

api.on('granularityChange', (data) => {
  console.log('Granularity changed to', data.newGranularity);
});

api.on('indicatorChange', (data) => {
  console.log('Indicator', data.action, data.indicator?.id || data.indicatorId);
});

api.on('fullscreenChange', (data) => {
  console.log('Fullscreen changed:', data.isFullscreen, data.type);
});

// Trend line events
api.on('trend-line-added', (data) => {
  console.log('Trend line added:', data.trendLine);
});

api.on('trend-line-updated', (data) => {
  console.log('Trend line updated:', data.trendLine);
});

api.on('trend-line-removed', (data) => {
  console.log('Trend line removed:', data.trendLine);
});

api.on('trend-line-selected', (data) => {
  console.log('Trend line selected:', data.trendLineId);
});

api.on('trend-line-deselected', (data) => {
  console.log('Trend line deselected');
});

api.on('trend-line-deleted', (data) => {
  console.log('Trend line deleted:', data.trendLineId);
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

**Available Events:**
- `ready` - Fired when chart is fully initialized
- `symbolChange` - Fired when symbol changes
- `granularityChange` - Fired when granularity changes
- `indicatorChange` - Fired when indicators change
- `fullscreenChange` - Fired when fullscreen/fullwindow state changes
- `trend-line-added` - Fired when a trend line is added
- `trend-line-updated` - Fired when a trend line is updated
- `trend-line-removed` - Fired when a trend line is removed
- `trend-line-selected` - Fired when a trend line is selected
- `trend-line-deselected` - Fired when trend lines are deselected
- `trend-line-deleted` - Fired when a trend line is deleted

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
  } else {
    // No line selected - update defaults for new lines
    api.setTrendLineDefaults({ color: newColor });
  }
}

function onLineWidthChange(newWidth: number) {
  if (selectedLineId) {
    api.updateTrendLineSettings(selectedLineId, { lineWidth: newWidth });
  } else {
    // No line selected - update defaults for new lines
    api.setTrendLineDefaults({ lineWidth: newWidth });
  }
}

function onStyleChange(newStyle: 'solid' | 'dashed' | 'dotted') {
  if (selectedLineId) {
    api.updateTrendLineSettings(selectedLineId, { style: newStyle });
  } else {
    // No line selected - update defaults for new lines
    api.setTrendLineDefaults({ style: newStyle });
  }
}
```

### Trend Line Defaults Example

```typescript
// Set up default settings for trend lines based on user preferences
const userPreferences = {
  trendLineColor: '#FF5722',
  trendLineWidth: 3,
  trendLineStyle: 'dashed' as const,
  extendLines: true
};

// Apply user preferences as defaults
api.setTrendLineDefaults({
  color: userPreferences.trendLineColor,
  lineWidth: userPreferences.trendLineWidth,
  style: userPreferences.trendLineStyle,
  extendLeft: false,
  extendRight: userPreferences.extendLines
});

// Activate the tool - all new lines will use these defaults
api.activateTrendLineTool();

// Or activate with different defaults for a specific session
api.activateTrendLineTool({
  color: '#00FF00',
  lineWidth: 1,
  style: 'dotted',
  extendLeft: true,
  extendRight: true
});

// Save user's default preferences
function saveDefaultPreferences(defaults: TrendLineDefaults) {
  localStorage.setItem('trendLineDefaults', JSON.stringify(defaults));
}

// Load and apply saved preferences
function loadDefaultPreferences() {
  const saved = localStorage.getItem('trendLineDefaults');
  if (saved) {
    const defaults = JSON.parse(saved);
    api.setTrendLineDefaults(defaults);
  }
}
```

## Type Definitions

### Core Types

```typescript
// Available granularities (timeframes)
type Granularity =
  | "ONE_MINUTE"
  | "FIVE_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "TWO_HOUR"
  | "SIX_HOUR"
  | "ONE_DAY";

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

interface TrendLineSettings {
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  extendLeft?: boolean;
  extendRight?: boolean;
}

interface TrendLineDefaults {
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  extendLeft?: boolean;
  extendRight?: boolean;
}

interface TrendLinePoint {
  timestamp: number;
  price: number;
}

interface TrendLine {
  id: string;
  start: TrendLinePoint;
  end: TrendLinePoint;
  color: string;
  lineWidth: number;
  style: 'solid' | 'dashed' | 'dotted';
  extendLeft: boolean;
  extendRight: boolean;
  selected?: boolean;
}

// Initial state configuration that can be passed when creating a chart
interface ChartState {
  symbol?: string; // Trading pair symbol (e.g., "BTC-USD")
  granularity?: Granularity; // Chart timeframe
  indicators?: IndicatorConfig[]; // Initial indicators to display
  trendLines?: TrendLine[]; // Initial trend lines to display
  loading?: boolean; // Loading state
  // ... other optional state properties
}

interface InitChartResult {
  app: App;
  api: ChartApi;
}
```

## Framework Integration Examples

### React Hook

```typescript
import { useRef, useEffect, useState } from 'react';
import { ChartApi, initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

function useChart(firebaseConfig: any, initialState?: any) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [api, setApi] = useState<ChartApi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const initChart = async () => {
      const chartContainer = createChartContainer();
      containerRef.current!.appendChild(chartContainer);
      
      const { api } = await initChartWithApi(chartContainer, firebaseConfig, initialState);
      setApi(api);
      setLoading(false);
    };

    initChart();
    
    return () => {
      api?.dispose();
    };
  }, [firebaseConfig]);

  return { containerRef, api, loading };
}
```

### Vue Composition API

```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { ChartApi, initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

export function useChart(firebaseConfig: any, initialState?: any) {
  const containerRef = ref<HTMLElement>();
  const api = ref<ChartApi | null>(null);
  const loading = ref(true);

  onMounted(async () => {
    if (!containerRef.value) return;

    const chartContainer = createChartContainer();
    containerRef.value.appendChild(chartContainer);
    
    const result = await initChartWithApi(chartContainer, firebaseConfig, initialState);
    api.value = result.api;
    loading.value = false;
  });

  onUnmounted(() => {
    api.value?.dispose();
  });

  return { containerRef, api, loading };
}
```

### Angular Service

```typescript
import { Injectable } from '@angular/core';
import { ChartApi, initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

@Injectable({
  providedIn: 'root'
})
export class ChartService {
  private api: ChartApi | null = null;

  async initializeChart(container: HTMLElement, firebaseConfig: any, initialState?: any): Promise<ChartApi> {
    const chartContainer = createChartContainer();
    container.appendChild(chartContainer);
    
    const { api } = await initChartWithApi(chartContainer, firebaseConfig, initialState);
    this.api = api;
    return api;
  }

  getApi(): ChartApi | null {
    return this.api;
  }

  dispose(): void {
    this.api?.dispose();
    this.api = null;
  }
}
```

## Usage Examples

### Complete React Integration

```typescript
import { useEffect, useState, useRef } from 'react';
import { ChartApi, SymbolChangeEvent, GranularityChangeEvent, ReadyEvent } from '@anssipiirainen/sc-charts';

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

### TypeScript Support

The Chart API is fully typed for TypeScript users:

```typescript
import { 
  ChartApi, 
  Granularity, 
  ApiIndicatorConfig,
  InitChartResult,
  TrendLine 
} from '@anssipiirainen/sc-charts';

// Strongly typed API usage
const { app, api }: InitChartResult = await initChartWithApi(
  container, 
  firebaseConfig
);

const granularity: Granularity = "ONE_HOUR";
await api.setGranularity(granularity);

const indicatorConfig: ApiIndicatorConfig = {
  id: "rsi",
  name: "RSI",
  visible: true
};
api.showIndicator(indicatorConfig);

// Trend line usage
const lineId = api.addTrendLine({
  start: { timestamp: Date.now() - 3600000, price: 50000 },
  end: { timestamp: Date.now(), price: 52000 },
  color: "#FF0000",
  lineWidth: 2,
  selected: false  // Don't select the line after creation
});

const trendLines: TrendLine[] = api.getTrendLines();
api.selectTrendLine(lineId);  // Manually select it later if needed
```

## Error Handling

```typescript
try {
  await api.setSymbol("INVALID-SYMBOL");
} catch (error) {
  console.error("Failed to change symbol:", error);
}

// Event-based error handling
api.on('error', (error) => {
  console.error("Chart error:", error);
});

// Async operations error handling
try {
  await api.enterFullscreen();
} catch (error) {
  console.error("Failed to enter fullscreen:", error);
  // Show user-friendly error message
}
```

## Performance Considerations

- **Batching**: When making multiple changes, consider using `setIndicators()` instead of multiple `showIndicator()` calls
- **Debouncing**: Debounce rapid API calls, especially symbol/granularity changes
- **Memory**: Always call `dispose()` when cleaning up to prevent memory leaks
- **Async Operations**: Symbol and granularity changes are async and trigger data fetches

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

## Migration from Legacy API

If you're upgrading from the legacy `initChart()` function:

```javascript
// Old way
const app = initChart(container, firebaseConfig);

// New way (backward compatible)
const app = initChart(container, firebaseConfig); // Still works

// New way (with API access)
const { app, api } = initChartWithApi(container, firebaseConfig);
```

The legacy `initChart()` function is still supported but deprecated in favor of `initChartWithApi()`.

## 📦 Library Exports

All types and functions are exported through the main package:

```typescript
export {
  // Main API
  ChartApi,
  createChartApi,
  initChartWithApi,
  createChartContainer,

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
  ChartState,
  InitChartResult,

  // Trend Line Types
  TrendLine,
  TrendLinePoint,
  TrendLineEvent,
  TrendLineDefaults,

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