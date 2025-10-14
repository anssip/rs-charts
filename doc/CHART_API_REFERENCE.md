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
   - [Pattern Highlighting](#pattern-highlighting)
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
      extendRight: true,
      animation: {
        type: "pulse",
        duration: 2000,
        intensity: 0.3
      }
      name: "Support Line",
      description: "Key support level from previous trading session"
    },
    {
      id: "trend-2",
      startPoint: { timestamp: 1704067200000, price: 48000 },
      endPoint: { timestamp: 1704153600000, price: 48000 },
      color: "#00FF00",
      lineWidth: 3,
      style: "solid",
      opacity: 0.9,
      levelType: "swing",
      zIndex: 100,
      markers: {
        enabled: true,
        symbol: "diamond",
        size: 4,
        spacing: 100,
        color: "#00FF00"
      },
      extendLeft: true,
      extendRight: true,
      name: "◆ Swing Support",
      description: "Major swing support level with high confidence"
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

Add a new trend line to the chart with advanced support/resistance visualization capabilities.

```typescript
// Add a basic trend line
const lineId = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 50000 },
  end: { timestamp: 1234567900000, price: 51000 },
  color: "#FF0000",
  lineWidth: 2,
  style: "solid", // "solid" | "dashed" | "dotted"
  extendLeft: false,
  extendRight: true,
  name: "Resistance",
  description: "Major resistance level from daily chart"
});

// Add a swing support level with markers
const swingSupport = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 48000 },
  end: { timestamp: 1234567900000, price: 48000 },
  color: "#00FF00",
  lineWidth: 3,
  style: "solid",
  opacity: 0.9,
  levelType: "swing",
  zIndex: 100,
  markers: {
    enabled: true,
    symbol: "diamond",
    size: 4,
    spacing: 100,
    color: "#00FF00"
  },
  extendLeft: true,
  extendRight: true,
  name: "◆ Swing Support",
  description: "Strong swing support level at 48000"
});

// Add a horizontal resistance level
const horizontalResistance = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 52000 },
  end: { timestamp: 1234567900000, price: 52000 },
  color: "#FF6666",
  lineWidth: 1.5,
  style: "dashed",
  opacity: 0.7,
  levelType: "horizontal",
  zIndex: 90,
  extendLeft: true,
  extendRight: true,
  name: "— Horizontal Resistance",
  description: "Consolidation zone resistance"
});

// Add a trend line with pulse animation for critical levels
const animatedSupportLine = api.addTrendLine({
  start: { timestamp: 1234567890000, price: 45000 },
  end: { timestamp: 1234567900000, price: 45500 },
  color: "#00FF00",
  lineWidth: 4,
  style: "solid",
  opacity: 0.8,
  animation: {
    type: "pulse",
    duration: 2000,    // 2 second pulse cycle
    intensity: 0.3,    // 30% opacity variation (will pulse between 0.65 and 0.95)
    enabled: true
  },
  extendLeft: false,
  extendRight: true,
  name: "⚡ Critical Support",
  description: "Major support level with high importance"
});
```

**Parameters:**
- `trendLine`: Object containing trend line configuration
  - `start`: Start point with `timestamp` and `price`
  - `end`: End point with `timestamp` and `price`
  - `name?`: Optional display name shown above the line
  - `description?`: Optional description shown as tooltip on hover
  - `color?`: Optional line color (default: chart default)
  - `lineWidth?`: Optional line width (default: 2)
  - `style?`: Optional line style - "solid" | "dashed" | "dotted" (default: "solid")
  - `extendLeft?`: Optional extend line to the left (default: false)
  - `extendRight?`: Optional extend line to the right (default: false)
  - `selected?`: Optional whether to select the line after creation (default: true)
  - **`levelType?`**: Optional level classification - "swing" | "horizontal" for support/resistance types
  - **`opacity?`**: Optional opacity value from 0.0 to 1.0 (default: 1.0)
  - **`zIndex?`**: Optional z-index for layering (higher values on top, default: 0)
  - **`markers?`**: Optional marker configuration object:
    - `enabled`: Whether to show markers along the line
    - `symbol`: Marker shape - "diamond" | "circle" | "square" | "triangle"
    - `size`: Marker size in pixels
    - `spacing`: Distance between markers in pixels
    - `color?`: Marker color (defaults to line color)
  - **`animation?`**: Optional pulse animation configuration:
    - `type`: Animation type - currently only "pulse" is supported
    - `duration?`: Duration of one pulse cycle in milliseconds (default: 2000)
    - `intensity?`: Intensity of opacity variation from 0.0 to 1.0 (default: 0.3)
    - `enabled?`: Whether animation is enabled (default: true if animation object exists)

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
  extendRight: false,
  name: "Updated Resistance",
  description: "Adjusted resistance level after breakout"
});
```

#### `updateTrendLineSettings(id: string, settings: TrendLineSettings): void`

Update visual settings of an existing trend line (convenience method).

```typescript
// Basic settings update
api.updateTrendLineSettings('trend-line-1704153600000', {
  color: '#0000FF',
  lineWidth: 1,
  style: 'dashed',
  extendLeft: true,
  extendRight: true,
  name: "Dynamic Support",
  description: "Support level that adjusts with market conditions"
});

// Update with advanced properties
api.updateTrendLineSettings('trend-line-1704153600000', {
  color: '#00FF00',
  lineWidth: 3,
  style: 'solid',
  opacity: 0.9,
  levelType: 'swing',
  zIndex: 100,
  markers: {
    enabled: true,
    symbol: 'diamond',
    size: 4,
    spacing: 100,
    color: '#00FF00'
  }
});

// Add pulse animation to a trend line
api.updateTrendLineSettings('trend-line-1704153600000', {
  animation: {
    type: 'pulse',
    duration: 2000,     // 2 second pulse cycle
    intensity: 0.3,     // 30% opacity variation
    enabled: true
  }
});

// Remove animation
api.updateTrendLineSettings('trend-line-1704153600000', {
  animation: undefined
});

// Remove markers
api.updateTrendLineSettings('trend-line-1704153600000', {
  markers: undefined
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

### Pattern Highlighting

#### `highlightPatterns(patterns: PatternHighlight[]): void`

Highlight candlestick patterns on the chart. Each pattern can highlight multiple candles and display a name label and description.

```typescript
const patterns: PatternHighlight[] = [
  {
    id: 'pattern_1',
    type: 'pattern',
    patternType: 'bullish_engulfing',
    name: 'Bullish Engulfing',
    description: 'Bullish Engulfing pattern at support $115,633.58',
    candleTimestamps: [1758344400000, 1758348000000],
    significance: 'very high',
    color: '#4ade80',  // Green for bullish
    style: 'both',     // 'outline' | 'fill' | 'both'
    nearLevel: {
      type: 'support',
      price: 115633.58,
      distance: 0.3    // Percentage distance from level
    }
  },
  {
    id: 'pattern_2',
    type: 'pattern',
    patternType: 'doji',
    name: 'Doji',
    description: 'Doji pattern (body 4.5% of range)',
    candleTimestamps: [1758369600000],
    significance: 'medium',
    color: '#fbbf24',  // Yellow for indecision
    style: 'outline'
  }
];

api.highlightPatterns(patterns);
```

**PatternHighlight Interface:**
```typescript
interface PatternHighlight {
  id: string;                    // Unique ID for the pattern instance
  type: 'pattern';                // Marker type (always 'pattern' for pattern highlights)
  patternType: string;            // Pattern type (e.g., "doji", "hammer", "bullish_engulfing")
  name: string;                   // Display name (e.g., "Doji", "Hammer", "Bullish Engulfing")
  description: string;            // Detailed description shown on click
  candleTimestamps: number[];     // Array of timestamps for candles in the pattern
  significance: 'low' | 'medium' | 'high' | 'very high' | 'effect';  // Pattern significance ('effect' for visual effects like pulseWave)
  color?: string;                 // Optional highlight color (defaults based on pattern type)
  style?: 'outline' | 'fill' | 'both';  // How to highlight (default: 'outline')
  nearLevel?: {                  // Optional key level information
    type: 'support' | 'resistance';
    price: number;
    distance: number;            // Percentage distance from the level
  };
}
```

**Default Pattern Colors:**
- Bullish patterns (bullish_engulfing, hammer, morning_star, etc.): `#4ade80` (green)
- Bearish patterns (bearish_engulfing, shooting_star, evening_star, etc.): `#ef4444` (red)
- Neutral/Indecision patterns (doji, spinning_top, inside_bar): `#fbbf24` (yellow)
- Default for unknown patterns: `#60a5fa` (blue)

#### `clearPatternHighlights(): void`

Remove all pattern highlights from the chart.

```typescript
api.clearPatternHighlights();
```

#### `getHighlightedPatterns(): PatternHighlight[]`

Get the currently highlighted patterns.

```typescript
const currentPatterns = api.getHighlightedPatterns();
console.log(`${currentPatterns.length} patterns currently highlighted`);

// Check if a specific pattern is highlighted
const hasDoji = currentPatterns.some(p => p.patternType === 'doji');
```

#### `pulseWave(options?: { speed?: number; color?: string; numCandles?: number }): void`

Create an animated pulsating wave effect that moves through the chart candles. This creates a visual wave of highlighted candles that travels from left to right across the chart.

```typescript
// Start a wave with default settings
api.pulseWave();

// Start a fast pink wave with 20 candles
api.pulseWave({
  speed: 25,           // Move 25 positions per update (5x faster than default)
  color: '#ec4899',    // Pink color
  numCandles: 20       // Wave spans 20 candles
});

// Start a slow blue wave with 30 candles
api.pulseWave({
  speed: 2,            // Slow movement
  color: '#3b82f6',    // Blue color
  numCandles: 30       // Wider wave
});

// Start a medium-speed green wave
api.pulseWave({
  speed: 10,
  color: '#10b981',    // Green color
  numCandles: 15
});
```

**Parameters:**
- `options` (optional): Configuration object for the wave effect
  - `speed`: Speed of wave movement in positions per update (default: 5, range: 1-50)
  - `color`: Hex color code for the wave (default: "#ec4899" - pink)
  - `numCandles`: Number of candles in the wave width (default: 20, minimum: 5)

**Features:**
- **Animated Movement**: The wave continuously moves from left to right through all visible candles
- **Gradient Effect**: Wave has an opacity gradient - stronger in the middle, fading at edges
- **Auto-stop**: Wave automatically stops after 30 seconds to prevent infinite animation
- **Smooth Animation**: Updates at 40ms intervals for smooth visual effect
- **Style Variation**: Uses different highlight styles (outline, fill, both) based on position in wave

#### `stopPulseWave(): void`

Stop the currently running pulse wave animation.

```typescript
// Start a wave
api.pulseWave({ speed: 10 });

// Stop it manually after 5 seconds
setTimeout(() => {
  api.stopPulseWave();
}, 5000);
```

**Note:** The wave will also stop automatically when:
- `clearPatternHighlights()` is called
- Another `pulseWave()` is started (replaces the current wave)
- 30 seconds have elapsed (automatic timeout)

**Pattern Highlighting Features:**
- **Visual Styles**: Patterns can be highlighted with outline, fill, or both
- **Name Labels**: Pattern names appear above the first candle in the pattern
- **Interactive Descriptions**: Click on a pattern name to see its full description
- **Significance Indicators**: High and very high significance patterns show additional visual indicators
- **Multi-Candle Support**: Patterns can span multiple candles (e.g., engulfing patterns)
- **Level Context**: Patterns can include information about nearby support/resistance levels
- **Custom Colors**: Each pattern can have a custom color or use defaults based on pattern type

**Usage Example - Highlighting Multiple Pattern Types:**
```typescript
// Example: Highlight various patterns found in technical analysis
const detectedPatterns: PatternHighlight[] = [
  // Reversal pattern at support
  {
    id: 'rev_1',
    type: 'pattern',
    patternType: 'bullish_engulfing',
    name: 'Bullish Engulfing',
    description: 'Strong bullish reversal signal. Previous downtrend may be ending.',
    candleTimestamps: [timestamp1, timestamp2],
    significance: 'very high',
    color: '#10b981',
    style: 'both',
    nearLevel: {
      type: 'support',
      price: 50000,
      distance: 0.5
    }
  },
  // Continuation pattern
  {
    id: 'cont_1',
    type: 'pattern',
    patternType: 'inside_bar',
    name: 'Inside Bar',
    description: 'Consolidation pattern. Waiting for breakout direction.',
    candleTimestamps: [timestamp3, timestamp4],
    significance: 'medium',
    style: 'outline'
  },
  // Warning pattern at resistance
  {
    id: 'warn_1',
    type: 'pattern',
    patternType: 'shooting_star',
    name: 'Shooting Star',
    description: 'Potential reversal at resistance. Watch for confirmation.',
    candleTimestamps: [timestamp5],
    significance: 'high',
    color: '#dc2626',
    style: 'both',
    nearLevel: {
      type: 'resistance',
      price: 52000,
      distance: 0.2
    }
  }
];

// Highlight all detected patterns
api.highlightPatterns(detectedPatterns);

// Listen for pattern click events
api.on('pattern-click', (event) => {
  console.log('Pattern clicked:', event.pattern.name);
  // Could show additional analysis or trigger actions
});

// Clear highlights when analysis is complete
setTimeout(() => {
  api.clearPatternHighlights();
}, 30000); // Clear after 30 seconds
```

### Trading Overlays (Paper Trading & Backtesting)

The Chart API provides comprehensive support for visualizing trading activity including trade markers, price lines, and position information. These features are designed for both paper trading (real-time simulated trading) and backtesting (historical strategy analysis) scenarios.

**Important:** rs-charts handles visualization and events only. All business logic (order execution, position management, P&L calculations, data persistence) must be handled by the consuming application.

#### Trade Markers

Trade markers visualize buy and sell execution points on the chart with customizable shapes, colors, and tooltips.

##### `addTradeMarker(config: TradeMarkerConfig): string`

Add a trade marker to the chart to mark a buy or sell execution point.

```typescript
// Add a buy marker
const buyMarkerId = api.addTradeMarker({
  timestamp: 1704067200000,
  price: 45000,
  side: 'buy',
  shape: 'arrow',              // 'arrow' | 'flag' | 'triangle' | 'circle'
  color: '#10b981',            // Green for buy
  size: 'medium',              // 'small' | 'medium' | 'large'
  text: 'Entry',               // Optional label
  tooltip: {
    title: 'Buy BTC-USD',
    details: [
      'Qty: 0.5 BTC',
      'Price: $45,000',
      'Total: $22,500'
    ]
  },
  interactive: true,           // Enable click/hover events
  zIndex: 100                  // Layer ordering
});

// Add a sell marker
const sellMarkerId = api.addTradeMarker({
  timestamp: 1704153600000,
  price: 48000,
  side: 'sell',
  shape: 'flag',
  color: '#ef4444',            // Red for sell
  size: 'large',
  text: 'Exit',
  tooltip: {
    title: 'Sell BTC-USD',
    details: [
      'Qty: 0.5 BTC',
      'Price: $48,000',
      'P&L: +$1,500 (+6.67%)'
    ]
  }
});

// Add a simple marker with defaults
const markerId = api.addTradeMarker({
  timestamp: Date.now(),
  price: 46500,
  side: 'buy'
  // Uses default colors, shape (arrow), size (medium)
});
```

**Parameters:**
- `config`: `TradeMarkerConfig` object
  - `timestamp`: Unix timestamp in milliseconds (X-axis position)
  - `price`: Price level in dollars (Y-axis position)
  - `side`: `'buy'` or `'sell'` (determines default color)
  - `id?`: Optional unique ID (auto-generated if not provided)
  - `shape?`: Marker shape (default: 'arrow')
  - `color?`: Custom color (default: green for buy, red for sell)
  - `size?`: Marker size (default: 'medium')
  - `text?`: Optional label text displayed near marker
  - `tooltip?`: Optional hover information
  - `interactive?`: Enable click/hover events (default: true)
  - `zIndex?`: Layer ordering (default: 100)

**Returns:** The ID of the created trade marker

**Default Colors:**
- Buy markers: `#10b981` (green)
- Sell markers: `#ef4444` (red)

##### `removeTradeMarker(markerId: string): void`

Remove a specific trade marker from the chart.

```typescript
api.removeTradeMarker(buyMarkerId);
```

##### `updateTradeMarker(markerId: string, updates: Partial<TradeMarkerConfig>): void`

Update an existing trade marker's properties.

```typescript
// Update marker color and text
api.updateTradeMarker(markerId, {
  color: '#fbbf24',  // Change to yellow
  text: 'Stop Loss',
  tooltip: {
    title: 'Stop Loss Triggered',
    details: ['Price: $44,500', 'Loss: -$250']
  }
});

// Update marker size
api.updateTradeMarker(markerId, {
  size: 'large',
  shape: 'flag'
});
```

##### `getTradeMarkers(): TradeMarker[]`

Get all trade markers currently on the chart.

```typescript
const markers = api.getTradeMarkers();
console.log(`Chart has ${markers.length} trade markers`);

// Find all buy markers
const buyMarkers = markers.filter(m => m.side === 'buy');

// Calculate total P&L from marker metadata
const totalPnL = markers.reduce((sum, marker) => {
  return sum + (marker.metadata?.pnl || 0);
}, 0);
```

##### `clearTradeMarkers(): void`

Remove all trade markers from the chart.

```typescript
api.clearTradeMarkers();
```

#### Price Lines

Price lines display horizontal lines at specific price levels for orders, stop losses, take profits, and other price-based alerts.

##### `addPriceLine(config: PriceLineConfig): string`

Add a horizontal price line to the chart.

```typescript
// Add a limit order line
const limitOrderId = api.addPriceLine({
  price: 47000,
  color: '#3b82f6',            // Blue
  lineStyle: 'dashed',          // 'solid' | 'dashed' | 'dotted'
  lineWidth: 2,
  label: {
    text: 'Limit Buy @ $47,000',
    position: 'right',          // 'left' | 'right'
    backgroundColor: '#3b82f6',
    textColor: '#ffffff',
    fontSize: 11
  },
  draggable: true,              // Allow user to drag line up/down
  extendLeft: true,             // Extend to left edge
  extendRight: true,            // Extend to right edge
  interactive: true,            // Enable click/hover events
  showPriceLabel: true,         // Show price on Y-axis
  metadata: {                   // Store custom data
    orderId: 'order-123',
    orderType: 'limit',
    quantity: 0.5
  },
  zIndex: 50
});

// Add a stop loss line
const stopLossId = api.addPriceLine({
  price: 43000,
  color: '#ef4444',
  lineStyle: 'solid',
  lineWidth: 2,
  label: {
    text: 'Stop Loss',
    position: 'left',
    backgroundColor: '#ef4444'
  },
  draggable: true,
  metadata: {
    stopType: 'stop-loss',
    triggerPrice: 43000
  }
});

// Add a take profit line
const takeProfitId = api.addPriceLine({
  price: 50000,
  color: '#10b981',
  lineStyle: 'dashed',
  lineWidth: 2,
  label: {
    text: 'Take Profit',
    position: 'right'
  },
  draggable: true
});
```

**Parameters:**
- `config`: `PriceLineConfig` object
  - `price`: Price level in dollars (Y-axis position)
  - `id?`: Optional unique ID (auto-generated if not provided)
  - `color?`: Line color (default: '#6b7280' gray)
  - `lineStyle?`: Line style (default: 'solid')
  - `lineWidth?`: Line thickness in pixels (default: 1)
  - `label?`: Optional label configuration
  - `draggable?`: Allow user to drag line (default: false)
  - `extendLeft?`: Extend line to left edge (default: true)
  - `extendRight?`: Extend line to right edge (default: true)
  - `interactive?`: Enable click/hover events (default: true)
  - `showPriceLabel?`: Show price on Y-axis (default: true)
  - `metadata?`: Store custom data (e.g., order ID)
  - `zIndex?`: Layer ordering (default: 50)

**Returns:** The ID of the created price line

##### `removePriceLine(lineId: string): void`

Remove a specific price line from the chart.

```typescript
api.removePriceLine(limitOrderId);
```

##### `updatePriceLine(lineId: string, updates: Partial<PriceLineConfig>): void`

Update an existing price line's properties.

```typescript
// Update line price and label
api.updatePriceLine(stopLossId, {
  price: 44000,
  label: {
    text: 'Stop Loss @ $44,000',
    position: 'left'
  }
});

// Change line style
api.updatePriceLine(limitOrderId, {
  color: '#fbbf24',
  lineStyle: 'dotted'
});
```

##### `getPriceLines(): PriceLine[]`

Get all price lines currently on the chart.

```typescript
const lines = api.getPriceLines();
console.log(`Chart has ${lines.length} price lines`);

// Find all limit order lines
const limitOrders = lines.filter(l => l.metadata?.orderType === 'limit');
```

##### `getPriceLine(lineId: string): PriceLine | null`

Get a specific price line by its ID.

```typescript
const line = api.getPriceLine(limitOrderId);
if (line) {
  console.log(`Limit order at $${line.price}`);
}
```

##### `clearPriceLines(): void`

Remove all price lines from the chart.

```typescript
api.clearPriceLines();
```

#### Position Overlay

The position overlay displays current position information including entry price, current price, P&L, and quantity.

##### `setPositionOverlay(config: PositionOverlayConfig | null): void`

Show or update the position overlay. Pass `null` to hide it.

```typescript
// Show long position
api.setPositionOverlay({
  symbol: 'BTC-USD',
  quantity: 0.5,
  side: 'long',
  entryPrice: 45000,
  currentPrice: 48000,
  unrealizedPnL: 1500,
  unrealizedPnLPercent: 6.67,
  position: 'top-right',        // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  showEntryLine: true,          // Show horizontal line at entry price
  entryLineColor: '#6b7280',
  backgroundColor: 'rgba(0, 0, 0, 0.9)',
  textColor: '#ffffff',
  opacity: 0.9,
  compact: false                // Use compact view
});

// Show short position with compact view
api.setPositionOverlay({
  symbol: 'ETH-USD',
  quantity: 2.0,
  side: 'short',
  entryPrice: 3000,
  currentPrice: 2850,
  unrealizedPnL: 300,
  unrealizedPnLPercent: 5.0,
  position: 'bottom-right',
  showEntryLine: true,
  compact: true
});

// Hide position overlay
api.setPositionOverlay(null);
```

**Parameters:**
- `config`: `PositionOverlayConfig` object or `null` to hide
  - `symbol`: Trading pair symbol (e.g., 'BTC-USD')
  - `quantity`: Position size
  - `side`: `'long'` or `'short'`
  - `entryPrice`: Average entry price
  - `currentPrice`: Current market price
  - `unrealizedPnL`: Profit/loss in dollars
  - `unrealizedPnLPercent`: Profit/loss as percentage
  - `position?`: Overlay position (default: 'top-right')
  - `showEntryLine?`: Show line at entry price (default: true)
  - `entryLineColor?`: Entry line color (default: '#6b7280')
  - `backgroundColor?`: Overlay background (default: 'rgba(0, 0, 0, 0.9)')
  - `textColor?`: Text color (default: '#ffffff')
  - `opacity?`: Overlay opacity 0-1 (default: 0.9)
  - `compact?`: Use compact view (default: false)

##### `getPositionOverlay(): PositionOverlayConfig | null`

Get the current position overlay configuration.

```typescript
const position = api.getPositionOverlay();
if (position) {
  console.log(`Position: ${position.side} ${position.quantity} ${position.symbol}`);
  console.log(`P&L: $${position.unrealizedPnL} (${position.unrealizedPnLPercent}%)`);
}
```

##### `updatePositionOverlay(updates: Partial<PositionOverlayConfig>): void`

Update the current position overlay with new values (e.g., live P&L updates).

```typescript
// Update P&L as price changes
api.updatePositionOverlay({
  currentPrice: 48500,
  unrealizedPnL: 1750,
  unrealizedPnLPercent: 7.78
});

// Switch to compact view
api.updatePositionOverlay({
  compact: true
});
```

#### Trading Overlay Events

Trading overlays emit events for user interactions that your application can listen to.

##### Trade Marker Events

```typescript
// Marker clicked
api.on('trade-marker-clicked', (event) => {
  console.log('Marker clicked:', event.markerId);
  console.log('Trade details:', event.marker);
  // Could show trade details modal, edit order, etc.
});

// Marker hovered
api.on('trade-marker-hovered', (event) => {
  console.log('Hovering over marker:', event.markerId);
  // Tooltip is shown automatically
});
```

##### Price Line Events

```typescript
// Line dragged (for adjusting order prices)
api.on('price-line-dragged', (event) => {
  console.log(`Line ${event.lineId} dragged from $${event.oldPrice} to $${event.newPrice}`);

  // Update order in your system
  if (event.line.metadata?.orderId) {
    updateOrderPrice(event.line.metadata.orderId, event.newPrice);
  }
});

// Line clicked
api.on('price-line-clicked', (event) => {
  console.log('Price line clicked:', event.lineId);
  // Could show order details, modify, or cancel
});

// Line hovered
api.on('price-line-hovered', (event) => {
  console.log('Hovering over line:', event.lineId);
});
```

##### Chart Interaction Events

```typescript
// Price clicked (for click-to-trade features)
api.on('price-clicked', (event) => {
  console.log(`Clicked price: $${event.price} at time ${event.timestamp}`);
  // Could show order entry form at clicked price
});

// Time clicked
api.on('time-clicked', (event) => {
  console.log(`Clicked time: ${new Date(event.timestamp)}`);
});

// Crosshair moved
api.on('crosshair-moved', (event) => {
  if (event.price && event.timestamp) {
    console.log(`Crosshair at $${event.price} @ ${new Date(event.timestamp)}`);
  }
});

// Chart context menu
api.on('chart-context-menu', (event) => {
  console.log(`Right-clicked at $${event.price}, ${new Date(event.timestamp)}`);
  // Could show custom context menu with trading options
});
```

#### Paper Trading Example

Complete example showing paper trading implementation with the Chart API:

```typescript
import { ChartApi } from '@anssipiirainen/sc-charts';

class PaperTradingManager {
  private api: ChartApi;
  private position: Position | null = null;
  private orders: Map<string, Order> = new Map();

  constructor(api: ChartApi) {
    this.api = api;
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Handle price line drags (order price adjustments)
    this.api.on('price-line-dragged', (event) => {
      const order = this.orders.get(event.line.metadata?.orderId);
      if (order) {
        order.price = event.newPrice;
        this.api.updatePriceLine(event.lineId, {
          price: event.newPrice,
          label: {
            text: `${order.type} @ $${event.newPrice.toFixed(2)}`,
            position: 'right'
          }
        });
      }
    });

    // Handle marker clicks (view trade details)
    this.api.on('trade-marker-clicked', (event) => {
      this.showTradeDetails(event.marker.metadata?.tradeId);
    });

    // Handle price clicks (quick order entry)
    this.api.on('price-clicked', (event) => {
      this.showOrderEntry(event.price);
    });
  }

  // Place a limit order
  placeLimitOrder(side: 'buy' | 'sell', price: number, quantity: number) {
    const orderId = `order-${Date.now()}`;
    const order: Order = {
      id: orderId,
      side,
      price,
      quantity,
      type: 'limit',
      status: 'open'
    };

    this.orders.set(orderId, order);

    // Add price line for the order
    const lineId = this.api.addPriceLine({
      price,
      color: side === 'buy' ? '#3b82f6' : '#f59e0b',
      lineStyle: 'dashed',
      draggable: true,
      label: {
        text: `${side.toUpperCase()} ${quantity} @ $${price}`,
        position: 'right'
      },
      metadata: { orderId }
    });

    order.lineId = lineId;
    return orderId;
  }

  // Execute a trade (fill an order)
  executeTrade(orderId: string, price: number) {
    const order = this.orders.get(orderId);
    if (!order) return;

    // Remove order price line
    if (order.lineId) {
      this.api.removePriceLine(order.lineId);
    }

    // Add trade marker
    const markerId = this.api.addTradeMarker({
      timestamp: Date.now(),
      price,
      side: order.side,
      shape: 'arrow',
      text: order.side === 'buy' ? 'Entry' : 'Exit',
      tooltip: {
        title: `${order.side.toUpperCase()} ${this.api.getSymbol()}`,
        details: [
          `Qty: ${order.quantity}`,
          `Price: $${price.toFixed(2)}`,
          `Total: $${(order.quantity * price).toFixed(2)}`
        ]
      },
      metadata: { orderId, tradeId: `trade-${Date.now()}` }
    });

    // Update position
    if (order.side === 'buy') {
      this.openPosition(order.quantity, price);
    } else {
      this.closePosition(price);
    }

    order.status = 'filled';
    order.markerId = markerId;
  }

  // Open a new position
  private openPosition(quantity: number, entryPrice: number) {
    this.position = {
      symbol: this.api.getSymbol(),
      quantity,
      side: 'long',
      entryPrice,
      currentPrice: entryPrice,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0
    };

    this.api.setPositionOverlay(this.position);

    // Start live P&L updates
    this.startPnLUpdates();
  }

  // Close the current position
  private closePosition(exitPrice: number) {
    if (!this.position) return;

    const pnl = (exitPrice - this.position.entryPrice) * this.position.quantity;
    const pnlPercent = ((exitPrice - this.position.entryPrice) / this.position.entryPrice) * 100;

    console.log(`Position closed: P&L = $${pnl.toFixed(2)} (${pnlPercent.toFixed(2)}%)`);

    this.api.setPositionOverlay(null);
    this.position = null;
    this.stopPnLUpdates();
  }

  // Update P&L as price changes
  private startPnLUpdates() {
    this.pnlUpdateInterval = setInterval(() => {
      if (!this.position) return;

      const currentPrice = this.getCurrentPrice();
      const pnl = (currentPrice - this.position.entryPrice) * this.position.quantity;
      const pnlPercent = ((currentPrice - this.position.entryPrice) / this.position.entryPrice) * 100;

      this.api.updatePositionOverlay({
        currentPrice,
        unrealizedPnL: pnl,
        unrealizedPnLPercent: pnlPercent
      });
    }, 1000);
  }

  private stopPnLUpdates() {
    if (this.pnlUpdateInterval) {
      clearInterval(this.pnlUpdateInterval);
    }
  }

  private getCurrentPrice(): number {
    // Get current price from chart state or live candle
    const state = this.api.getState();
    return state.liveCandle?.close || state.priceHistory.getLatestCandle()?.close || 0;
  }
}
```

#### Backtesting Example

Example showing backtesting visualization with the Chart API:

```typescript
class BacktestVisualizer {
  private api: ChartApi;

  constructor(api: ChartApi) {
    this.api = api;
  }

  // Visualize backtest results
  async visualizeBacktest(results: BacktestResults) {
    // Clear previous overlays
    this.api.clearTradeMarkers();
    this.api.clearPriceLines();
    this.api.setPositionOverlay(null);

    // Add markers for all trades
    results.trades.forEach(trade => {
      // Entry marker
      this.api.addTradeMarker({
        timestamp: trade.entryTime,
        price: trade.entryPrice,
        side: trade.side,
        shape: 'arrow',
        text: 'Entry',
        tooltip: {
          title: `${trade.side.toUpperCase()} Entry`,
          details: [
            `Qty: ${trade.quantity}`,
            `Entry: $${trade.entryPrice.toFixed(2)}`,
            `Strategy: ${trade.strategy}`
          ]
        }
      });

      // Exit marker
      this.api.addTradeMarker({
        timestamp: trade.exitTime,
        price: trade.exitPrice,
        side: trade.side === 'buy' ? 'sell' : 'buy',
        shape: 'flag',
        text: trade.pnl > 0 ? 'Win' : 'Loss',
        color: trade.pnl > 0 ? '#10b981' : '#ef4444',
        tooltip: {
          title: `${trade.side.toUpperCase()} Exit`,
          details: [
            `Exit: $${trade.exitPrice.toFixed(2)}`,
            `P&L: $${trade.pnl.toFixed(2)}`,
            `Return: ${trade.pnlPercent.toFixed(2)}%`,
            `Duration: ${this.formatDuration(trade.exitTime - trade.entryTime)}`
          ]
        }
      });

      // Add stop loss line if applicable
      if (trade.stopLoss) {
        this.api.addPriceLine({
          price: trade.stopLoss,
          color: '#ef4444',
          lineStyle: 'dashed',
          label: {
            text: 'Stop Loss',
            position: 'left'
          }
        });
      }

      // Add take profit line if applicable
      if (trade.takeProfit) {
        this.api.addPriceLine({
          price: trade.takeProfit,
          color: '#10b981',
          lineStyle: 'dashed',
          label: {
            text: 'Take Profit',
            position: 'right'
          }
        });
      }
    });

    // Show summary statistics
    console.log('Backtest Results:');
    console.log(`Total Trades: ${results.trades.length}`);
    console.log(`Win Rate: ${results.winRate.toFixed(2)}%`);
    console.log(`Total P&L: $${results.totalPnL.toFixed(2)}`);
    console.log(`Max Drawdown: ${results.maxDrawdown.toFixed(2)}%`);
  }

  // Play back trades in sequence
  async playbackTrades(trades: Trade[], speed: number = 1000) {
    for (const trade of trades) {
      // Navigate to trade time
      const timeRange = this.api.getTimeRange();
      const duration = timeRange.end - timeRange.start;

      this.api.setTimeRange({
        start: trade.entryTime - duration / 2,
        end: trade.entryTime + duration / 2
      });

      // Show entry
      const entryMarkerId = this.api.addTradeMarker({
        timestamp: trade.entryTime,
        price: trade.entryPrice,
        side: trade.side,
        shape: 'arrow',
        size: 'large'
      });

      // Show position overlay during trade
      this.api.setPositionOverlay({
        symbol: this.api.getSymbol(),
        quantity: trade.quantity,
        side: trade.side === 'buy' ? 'long' : 'short',
        entryPrice: trade.entryPrice,
        currentPrice: trade.entryPrice,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      });

      await this.sleep(speed);

      // Show exit
      this.api.addTradeMarker({
        timestamp: trade.exitTime,
        price: trade.exitPrice,
        side: trade.side === 'buy' ? 'sell' : 'buy',
        shape: 'flag',
        size: 'large',
        color: trade.pnl > 0 ? '#10b981' : '#ef4444'
      });

      this.api.setPositionOverlay(null);

      await this.sleep(speed);
    }
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Pan and Zoom Control

#### `pan(deltaX: number, deltaY: number, options?: PanOptions): void`

Pan the chart by the specified pixel amounts. The embedding app handles gesture interpretation - this method applies the deltas directly.

```typescript
// Pan right by 50 pixels, down by 20 pixels
api.pan(50, 20);

// Pan with custom sensitivity
api.pan(50, 20, { sensitivity: 2.0 });

// Animated pan over 500ms
api.pan(100, 0, { animate: true, duration: 500 });
```

**Parameters:**
- `deltaX`: Horizontal pan amount in pixels (positive = pan right, negative = pan left)
- `deltaY`: Vertical pan amount in pixels (positive = pan down, negative = pan up)
- `options`: Optional configuration
  - `sensitivity`: Multiplier for pan sensitivity (default: 1.0)
  - `animate`: Whether to animate the pan (default: false)
  - `duration`: Animation duration in ms (default: 1000)

#### `panHorizontal(deltaX: number, options?: PanOptions): void`

Pan the chart horizontally (time axis only).

```typescript
// Pan right by 100 pixels
api.panHorizontal(100);

// Pan left with animation
api.panHorizontal(-100, { animate: true });
```

#### `panVertical(deltaY: number, options?: PanOptions): void`

Pan the chart vertically (price axis only).

```typescript
// Pan down by 50 pixels
api.panVertical(50);

// Pan up with high sensitivity
api.panVertical(-50, { sensitivity: 1.5 });
```

#### `zoom(delta: number, options?: ZoomOptions): void`

Zoom the time axis (horizontal zoom).

```typescript
// Zoom in
api.zoom(10);

// Zoom out
api.zoom(-10);

// Zoom with custom center point (x in pixels from left)
api.zoom(10, { center: { x: 400, y: 0 } });

// Zoom with custom sensitivity
api.zoom(5, { sensitivity: 2.0 });
```

**Parameters:**
- `delta`: Zoom amount (positive = zoom in, negative = zoom out)
- `options`: Optional configuration
  - `center`: Zoom center point in pixels relative to chart
  - `sensitivity`: Zoom sensitivity multiplier (default: 1.0)

#### `zoomPrice(delta: number, options?: ZoomOptions): void`

Zoom the price axis (vertical zoom).

```typescript
// Zoom in on price axis
api.zoomPrice(10);

// Zoom out with custom center
api.zoomPrice(-10, { center: { x: 0, y: 200 } });
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

#### `getCandles(): [number, Candle][]`

Get the candles currently visible in the chart viewport.

```typescript
const visibleCandles = api.getCandles();
console.log(`Showing ${visibleCandles.length} candles`);

// Process visible candles
visibleCandles.forEach(([timestamp, candle]) => {
  console.log(`${new Date(timestamp).toISOString()}: O:${candle.open} H:${candle.high} L:${candle.low} C:${candle.close} V:${candle.volume}`);
});

// Calculate statistics for visible candles
const prices = visibleCandles.map(([_, candle]) => candle.close);
const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
const minLow = Math.min(...visibleCandles.map(([_, c]) => c.low));
const maxHigh = Math.max(...visibleCandles.map(([_, c]) => c.high));

// Find highest volume candle in view
const highestVolume = visibleCandles.reduce((max, [timestamp, candle]) => {
  return candle.volume > max.volume ? { timestamp, ...candle } : max;
}, { volume: 0 });

console.log(`Highest volume at ${new Date(highestVolume.timestamp).toISOString()}: ${highestVolume.volume}`);
```

**Returns:**
- Array of `[timestamp, Candle]` tuples for candles visible in the current time range
  - `timestamp`: Unix timestamp in milliseconds
  - `Candle`: Object containing:
    - `granularity`: Timeframe of the candle
    - `timestamp`: Unix timestamp in milliseconds
    - `open`: Opening price
    - `high`: Highest price
    - `low`: Lowest price
    - `close`: Closing price
    - `volume`: Trading volume
    - `live`: Whether this is a live updating candle
    - `evaluations`: Additional evaluation data

**Note:** This method returns candles from the existing chart state without triggering any server requests. The candles returned are limited to those within the current visible time range set by `getTimeRange()`.

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

### Screenshot Methods

#### `takeScreenshot(options?: ScreenshotOptions): Promise<string>`

Take a screenshot of the entire chart view and return it as a data URL. Captures everything including the main chart, indicators, timeline, price axis, trend lines, and pattern highlights.

```typescript
// Simple PNG screenshot
const dataUrl = await api.takeScreenshot();

// High-quality JPEG for social media
const dataUrl = await api.takeScreenshot({
  format: 'jpeg',
  quality: 0.95,
  backgroundColor: '#FFFFFF'
});

// High-resolution screenshot (2x scale)
const dataUrl = await api.takeScreenshot({
  format: 'png',
  scale: 2,
  backgroundColor: '#000000'
});

// WebP format with custom size
const dataUrl = await api.takeScreenshot({
  format: 'webp',
  quality: 0.9,
  width: 1920,
  height: 1080
});
```

**Parameters:**
- `options`: Optional `ScreenshotOptions` object
  - `format`: Image format - 'png' (default), 'jpeg', or 'webp'
  - `quality`: Quality for JPEG/WebP (0.0 to 1.0, default: 0.95)
  - `scale`: Scaling factor (default: device pixel ratio)
  - `backgroundColor`: Background color (default: transparent for PNG, white for JPEG)
  - `excludeCrosshairs`: Exclude crosshairs from screenshot (default: true)
  - `excludeContextMenu`: Exclude context menu from screenshot (default: true)
  - `width`: Optional fixed width in pixels
  - `height`: Optional fixed height in pixels

**Returns:** Promise that resolves to a data URL string

**Note:** The data URL can be used directly in an `<img>` tag, downloaded, or uploaded to a server.

#### `takeScreenshotBlob(options?: ScreenshotOptions): Promise<Blob>`

Take a screenshot and return it as a Blob, which is useful for uploading to servers or sharing via APIs.

```typescript
// Get blob for upload to server
const blob = await api.takeScreenshotBlob({ format: 'jpeg' });
const formData = new FormData();
formData.append('image', blob, 'chart.jpg');
await fetch('/api/upload', { method: 'POST', body: formData });

// Share using Web Share API
const blob = await api.takeScreenshotBlob({ format: 'png' });
const file = new File([blob], 'chart.png', { type: 'image/png' });
if (navigator.share) {
  await navigator.share({
    files: [file],
    title: 'Chart Analysis',
    text: 'Check out this chart!'
  });
}
```

**Parameters:**
- `options`: Optional `ScreenshotOptions` object (same as `takeScreenshot`)

**Returns:** Promise that resolves to a Blob

#### `downloadScreenshot(filename?: string, options?: ScreenshotOptions): Promise<void>`

Take a screenshot and immediately download it as a file.

```typescript
// Download as PNG with custom filename
await api.downloadScreenshot('my-analysis.png');

// Download as high-quality JPEG
await api.downloadScreenshot('chart.jpg', {
  format: 'jpeg',
  quality: 0.95,
  backgroundColor: '#FFFFFF'
});

// Download high-res for printing
await api.downloadScreenshot('chart-hires.png', {
  scale: 2,
  format: 'png'
});

// Auto-generated filename
await api.downloadScreenshot(); // Downloads as chart-{timestamp}.png
```

**Parameters:**
- `filename`: Optional filename (default: `chart-{timestamp}.{format}`)
- `options`: Optional `ScreenshotOptions` object (same as `takeScreenshot`)

**Returns:** Promise that resolves when download is initiated

### Screenshot Usage Examples

#### Social Media Sharing

```typescript
// Prepare optimized image for Twitter/X
async function shareToTwitter() {
  const blob = await api.takeScreenshotBlob({
    format: 'jpeg',
    quality: 0.92,
    backgroundColor: '#FFFFFF',
    scale: 2 // Higher resolution for better quality
  });

  const file = new File([blob], 'chart.jpg', { type: 'image/jpeg' });

  if (navigator.share) {
    await navigator.share({
      files: [file],
      title: 'BTC Analysis',
      text: 'Bitcoin breakout imminent! 🚀'
    });
  }
}

// Upload to your server
async function uploadToServer() {
  const blob = await api.takeScreenshotBlob({
    format: 'png',
    excludeCrosshairs: true
  });

  const formData = new FormData();
  formData.append('chart', blob, 'analysis.png');
  formData.append('symbol', api.getSymbol());
  formData.append('timestamp', Date.now().toString());

  const response = await fetch('/api/charts/upload', {
    method: 'POST',
    body: formData
  });

  return response.json();
}
```

#### Copy to Clipboard

```typescript
// Copy screenshot to clipboard for easy pasting
async function copyToClipboard() {
  const blob = await api.takeScreenshotBlob({ format: 'png' });

  await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob })
  ]);

  console.log('Chart copied to clipboard!');
}
```

#### Display Preview Modal

```typescript
// Show preview before downloading
async function showPreview() {
  const dataUrl = await api.takeScreenshot({
    format: 'png',
    scale: 1.5
  });

  // Create and show modal with preview
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.maxWidth = '100%';

  const modal = document.createElement('div');
  modal.className = 'screenshot-preview-modal';
  modal.appendChild(img);
  document.body.appendChild(modal);

  // Add download button
  const downloadBtn = document.createElement('button');
  downloadBtn.textContent = 'Download';
  downloadBtn.onclick = () => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `chart-${Date.now()}.png`;
    link.click();
  };
  modal.appendChild(downloadBtn);
}
```

#### Batch Export Multiple Charts

```typescript
// Export multiple timeframes
async function exportMultipleTimeframes() {
  const granularities = ['FIVE_MINUTE', 'ONE_HOUR', 'ONE_DAY'];
  const screenshots = [];

  for (const granularity of granularities) {
    await api.setGranularity(granularity);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for update

    const blob = await api.takeScreenshotBlob({
      format: 'png',
      scale: 2
    });

    screenshots.push({
      granularity,
      blob,
      filename: `${api.getSymbol()}-${granularity}.png`
    });
  }

  return screenshots;
}
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
  name?: string;
  description?: string;
  levelType?: 'swing' | 'horizontal';
  opacity?: number;
  zIndex?: number;
  markers?: {
    enabled: boolean;
    symbol: 'diamond' | 'circle' | 'square' | 'triangle';
    size: number;
    spacing: number;
    color?: string;
  };
  animation?: {
    type: 'pulse';
    duration?: number;
    intensity?: number;
    enabled?: boolean;
  };
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
  name?: string;         // Display name shown above the line
  description?: string;   // Tooltip text shown on hover
  selected?: boolean;
  levelType?: 'swing' | 'horizontal';  // Type of support/resistance level
  opacity?: number;                     // Opacity value (0.0 to 1.0)
  zIndex?: number;                      // Z-index for layering (higher = on top)
  markers?: {                          // Optional markers along the line
    enabled: boolean;
    symbol: 'diamond' | 'circle' | 'square' | 'triangle';
    size: number;                      // Size in pixels
    spacing: number;                   // Spacing between markers in pixels
    color?: string;                    // Marker color (defaults to line color)
  };
  animation?: {                         // Optional pulse animation
    type: 'pulse';                      // Animation type (currently only pulse supported)
    duration?: number;                  // Duration in milliseconds (default: 2000)
    intensity?: number;                 // Intensity of the animation (0.0 to 1.0, default: 0.3)
    enabled?: boolean;                  // Whether animation is enabled (default: true if animation object exists)
  };
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
  name: "Breakout Level",
  description: "Important breakout level to watch for entry",
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