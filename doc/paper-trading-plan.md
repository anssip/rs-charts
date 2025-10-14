# rs-charts API Enhancements for Paper Trading & Backtesting Support

This document outlines the API additions needed in the rs-charts library to support both paper trading and backtesting visualization features.

**Note:** The same visualization APIs are used for both paper trading (real-time) and backtesting (historical replay). The only difference is the timing of data updates - paper trading uses live data while backtesting can fast-forward through historical data.

## Architecture & Separation of Concerns

**Important:** This API design follows a clear separation between visualization (rs-charts) and business logic (sc-app):

### rs-charts Responsibilities (Visualization Layer)
- ✅ Display trade markers, price lines, and overlays
- ✅ Handle chart interactions (clicks, hovers, drags)
- ✅ Emit events with price/timestamp data
- ✅ Provide visual feedback (crosshairs, previews)

### sc-app Responsibilities (Business Logic Layer)
- ✅ Show order entry forms and confirmation dialogs
- ✅ Manage order types, quantities, and validation
- ✅ Execute trades and update positions
- ✅ Handle account balances and P&L calculations
- ✅ Persist trading data to Firestore

**Key Principle:** rs-charts provides the **interaction layer**, sc-app provides the **order entry UI and execution logic**.

## Priority Overview

**Must Have (P0):**
1. Trade markers (buy/sell flags)
2. Price level lines
3. Position overlay
4. Basic events (price-clicked, marker-clicked)

**Should Have (P1):**
5. Trade zones
6. Annotations
7. Click-to-trade
8. Enhanced crosshair events

**Nice to Have (P2):**
9. Equity curve overlay
10. Risk zones
11. Time markers
12. Order depth visualization

---

## 1. Trade Markers / Execution Flags

### Purpose
Display buy/sell execution points directly on the chart with visual markers (arrows, flags, etc.)

### API Methods

```typescript
// Add a trade marker to the chart
addTradeMarker(config: TradeMarkerConfig): string

// Remove a specific trade marker
removeTradeMarker(markerId: string): void

// Update an existing trade marker
updateTradeMarker(markerId: string, updates: Partial<TradeMarkerConfig>): void

// Get all trade markers
getTradeMarkers(): TradeMarker[]

// Remove all trade markers
clearTradeMarkers(): void
```

### TypeScript Interfaces

```typescript
interface TradeMarkerConfig {
  id?: string;                    // Auto-generated if not provided
  timestamp: number;              // Unix timestamp (X-axis position)
  price: number;                  // Price level (Y-axis position)
  side: 'buy' | 'sell';          // Trade direction
  shape?: 'arrow' | 'flag' | 'triangle' | 'circle';  // Marker shape
  color?: string;                 // Default: green for buy, red for sell
  size?: 'small' | 'medium' | 'large';  // Marker size
  text?: string;                  // Optional label text (e.g., "Entry")
  tooltip?: {                     // Hover information
    title: string;                // e.g., "Buy BTC-USD"
    details: string[];            // e.g., ["Qty: 0.5", "Price: $45,000"]
  };
  interactive?: boolean;          // Enable click/hover events
  zIndex?: number;                // Layer ordering
}

interface TradeMarker extends TradeMarkerConfig {
  id: string;                     // Always present after creation
}
```

### Events

```typescript
// Emitted when a trade marker is clicked
chart.on('trade-marker-clicked', (event: {
  markerId: string;
  marker: TradeMarker;
}) => void);

// Emitted when mouse hovers over a trade marker
chart.on('trade-marker-hovered', (event: {
  markerId: string;
  marker: TradeMarker;
}) => void);
```

### Visual Examples
- **Buy markers**: Green upward arrow below the candle
- **Sell markers**: Red downward arrow above the candle
- **Tooltip**: Shows trade details on hover

---

## 2. Price Level Lines

### Purpose
Display horizontal lines at specific price levels for pending orders, stop losses, take profits, and position entry prices.

### API Methods

```typescript
// Add a horizontal price line
addPriceLine(config: PriceLineConfig): string

// Remove a specific price line
removePriceLine(lineId: string): void

// Update an existing price line
updatePriceLine(lineId: string, updates: Partial<PriceLineConfig>): void

// Get all price lines
getPriceLines(): PriceLine[]

// Remove all price lines
clearPriceLines(): void
```

### TypeScript Interfaces

```typescript
interface PriceLineConfig {
  id?: string;                    // Auto-generated if not provided
  price: number;                  // Y-axis price level
  color?: string;                 // Line color (default: gray)
  lineStyle?: 'solid' | 'dashed' | 'dotted';  // Line style
  lineWidth?: number;             // Line thickness (default: 1)
  label?: {                       // Optional label
    text: string;                 // e.g., "Limit Order @ $45,000"
    position: 'left' | 'right';   // Label position
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
  };
  draggable?: boolean;            // Allow user to drag the line up/down
  extendLeft?: boolean;           // Extend line to left edge
  extendRight?: boolean;          // Extend line to right edge (default: true)
  interactive?: boolean;          // Enable click/hover events
  showPriceLabel?: boolean;       // Show price on Y-axis
  metadata?: any;                 // Store custom data (e.g., order ID)
  zIndex?: number;                // Layer ordering
}

interface PriceLine extends PriceLineConfig {
  id: string;
  price: number;
}
```

### Events

```typescript
// Emitted when a draggable price line is moved
chart.on('price-line-dragged', (event: {
  lineId: string;
  oldPrice: number;
  newPrice: number;
  line: PriceLine;
}) => void);

// Emitted when a price line is clicked
chart.on('price-line-clicked', (event: {
  lineId: string;
  line: PriceLine;
}) => void);

// Emitted when mouse hovers over a price line
chart.on('price-line-hovered', (event: {
  lineId: string;
  line: PriceLine;
}) => void);
```

### Use Cases
- **Pending limit orders**: Dashed blue line
- **Stop loss**: Red solid line
- **Take profit**: Green solid line
- **Position entry**: Yellow dotted line

---

## 3. Position Overlay

### Purpose
Display current position information directly on the chart (quantity, entry price, P&L).

### API Methods

```typescript
// Show position overlay on chart
showPositionOverlay(config: PositionOverlayConfig): void

// Hide position overlay
hidePositionOverlay(): void

// Update position overlay data
updatePositionOverlay(updates: Partial<PositionOverlayConfig>): void

// Get current position overlay state
getPositionOverlay(): PositionOverlayConfig | null
```

### TypeScript Interfaces

```typescript
interface PositionOverlayConfig {
  symbol: string;                 // e.g., "BTC-USD"
  quantity: number;               // Position size
  side: 'long' | 'short';        // Position direction
  entryPrice: number;             // Average entry price
  currentPrice: number;           // Current market price
  unrealizedPnL: number;          // P&L in dollars
  unrealizedPnLPercent: number;   // P&L as percentage
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';  // Overlay position
  showEntryLine?: boolean;        // Show line at entry price
  entryLineColor?: string;
  backgroundColor?: string;       // Overlay background color
  textColor?: string;             // Text color
  opacity?: number;               // Overlay opacity (0-1)
  compact?: boolean;              // Show compact view
}
```

### Visual Example
```
┌─────────────────────────┐
│ LONG BTC-USD            │
│ Qty: 0.5 @ $45,000      │
│ P&L: +$2,500 (+5.56%)   │
└─────────────────────────┘
```

---

## 4. Trade Zone Visualization

### Purpose
Highlight the duration and price range of a completed trade with a semi-transparent overlay.

### API Methods

```typescript
// Add a trade zone to highlight trade duration
addTradeZone(config: TradeZoneConfig): string

// Remove a specific trade zone
removeTradeZone(zoneId: string): void

// Update an existing trade zone
updateTradeZone(zoneId: string, updates: Partial<TradeZoneConfig>): void

// Get all trade zones
getTradeZones(): TradeZone[]

// Remove all trade zones
clearTradeZones(): void
```

### TypeScript Interfaces

```typescript
interface TradeZoneConfig {
  id?: string;
  startTimestamp: number;         // Trade entry time
  endTimestamp: number;           // Trade exit time
  entryPrice: number;             // Entry price level
  exitPrice: number;              // Exit price level
  fillColor?: string;             // Semi-transparent background (default: green/red based on P&L)
  fillOpacity?: number;           // Opacity 0-1 (default: 0.2)
  borderColor?: string;           // Border color
  borderWidth?: number;           // Border thickness
  showPnL?: boolean;              // Display P&L text in zone (default: true)
  metadata?: {
    quantity: number;
    pnl: number;
    pnlPercent: number;
    side: 'long' | 'short';
    fees?: number;
  };
}

interface TradeZone extends TradeZoneConfig {
  id: string;
}
```

### Visual Example
A semi-transparent green rectangle from entry time/price to exit time/price with "P&L: +$500" displayed inside.

---

## 5. Click-to-Trade Interface

### Purpose
Enable users to interact with price levels by clicking directly on the chart. **Note:** This feature only handles chart interaction and emits events. All order entry UI (forms, confirmations) is handled by sc-app.

### What rs-charts DOES:
- ✅ Detect clicks on chart at specific price levels
- ✅ Show visual feedback (crosshair, price preview)
- ✅ Emit events with price/timestamp data
- ✅ Handle keyboard modifiers (Shift for buy/sell toggle)

### What rs-charts does NOT do:
- ❌ Show order entry forms
- ❌ Show confirmation dialogs
- ❌ Manage quantities or order types
- ❌ Execute trades

### API Methods

```typescript
// Enable click-to-trade functionality
enableClickToTrade(config: ClickToTradeConfig): void

// Disable click-to-trade functionality
disableClickToTrade(): void

// Check if click-to-trade is enabled
isClickToTradeEnabled(): boolean
```

### TypeScript Interfaces

```typescript
interface ClickToTradeConfig {
  enabled: boolean;                     // Enable/disable feature
  showCrosshair?: boolean;              // Show enhanced crosshair cursor
  showPriceLabel?: boolean;             // Show price label on Y-axis when hovering
  showOrderPreview?: boolean;           // Show preview line at hover position
  clickBehavior?: 'single' | 'double' | 'hold';  // Single-click, double-click, or click-and-hold
  defaultSide?: 'buy' | 'sell';        // Default order side (can be toggled with Shift)
  allowSideToggle?: boolean;            // Allow Shift key to toggle buy/sell
  onOrderRequest: (orderData: {
    price: number;                      // Price level clicked
    timestamp: number;                  // Time coordinate clicked
    side: 'buy' | 'sell';              // Buy or sell (based on defaultSide + Shift)
    modifiers: {                        // Keyboard modifiers pressed during click
      shift: boolean;
      ctrl: boolean;
      alt: boolean;
    };
  }) => void;
}
```

### Events

```typescript
// Emitted when user clicks to request an order placement
// sc-app should listen to this and show order entry UI
chart.on('order-request', (event: {
  price: number;
  timestamp: number;
  side: 'buy' | 'sell';
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}) => void);

// Emitted when hovering over price level in click-to-trade mode
chart.on('price-hover', (event: {
  price: number;
  timestamp: number;
}) => void);
```

### Usage Flow

1. **rs-charts**: User clicks on chart at price $45,000
2. **rs-charts**: Emits `order-request` event with price/timestamp
3. **sc-app**: Receives event, shows order entry modal/panel
4. **sc-app**: User fills form (quantity, order type, etc.)
5. **sc-app**: User confirms, executes trade via paper trading engine
6. **sc-app**: Adds trade marker to chart via `addTradeMarker()`

---

## 6. Annotations

### Purpose
Add custom text notes, alerts, or milestones to the chart.

### API Methods

```typescript
// Add an annotation to the chart
addAnnotation(config: AnnotationConfig): string

// Remove a specific annotation
removeAnnotation(annotationId: string): void

// Update an existing annotation
updateAnnotation(annotationId: string, updates: Partial<AnnotationConfig>): void

// Get all annotations
getAnnotations(): Annotation[]

// Remove all annotations
clearAnnotations(): void
```

### TypeScript Interfaces

```typescript
interface AnnotationConfig {
  id?: string;
  timestamp: number;              // Time position
  price?: number;                 // Price position (if undefined, anchor to top/bottom)
  text: string;                   // Annotation text
  type?: 'note' | 'alert' | 'milestone' | 'custom';  // Annotation type
  position?: 'above' | 'below' | 'left' | 'right';   // Relative to point
  color?: string;                 // Text color
  backgroundColor?: string;       // Background color
  borderColor?: string;
  fontSize?: number;
  icon?: string;                  // SVG icon or emoji
  draggable?: boolean;            // Allow repositioning
  showLine?: boolean;             // Show line connecting to price level
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  zIndex?: number;
}

interface Annotation extends AnnotationConfig {
  id: string;
}
```

---

## 7. Enhanced Chart Events

### New Events for Trading

```typescript
// Emitted when user clicks on a specific price level
chart.on('price-clicked', (event: {
  price: number;
  timestamp: number;
  mouseX: number;
  mouseY: number;
}) => void);

// Emitted when user clicks on a specific time
chart.on('time-clicked', (event: {
  timestamp: number;
  price: number;
  mouseX: number;
  mouseY: number;
}) => void);

// Emitted when crosshair position changes
chart.on('crosshair-moved', (event: {
  price: number | null;
  timestamp: number | null;
  mouseX: number;
  mouseY: number;
}) => void);

// Emitted when user right-clicks on chart
chart.on('context-menu', (event: {
  price: number;
  timestamp: number;
  mouseX: number;
  mouseY: number;
}) => void);
```

---

## 8. Time Markers

### Purpose
Add vertical lines at specific timestamps to mark important events.

### API Methods

```typescript
// Add a vertical time marker
addTimeMarker(config: TimeMarkerConfig): string

// Remove a specific time marker
removeTimeMarker(markerId: string): void

// Update an existing time marker
updateTimeMarker(markerId: string, updates: Partial<TimeMarkerConfig>): void

// Get all time markers
getTimeMarkers(): TimeMarker[]

// Remove all time markers
clearTimeMarkers(): void
```

### TypeScript Interfaces

```typescript
interface TimeMarkerConfig {
  id?: string;
  timestamp: number;              // Unix timestamp
  label?: string;                 // Optional label text
  color?: string;                 // Line color
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  showLabel?: boolean;            // Show label at top/bottom
  labelPosition?: 'top' | 'bottom';
  zIndex?: number;
}

interface TimeMarker extends TimeMarkerConfig {
  id: string;
}
```

---

## 9. Risk Zones

### Purpose
Highlight price ranges that represent risk areas (e.g., stop loss zones, liquidation zones).

### API Methods

```typescript
// Add a risk zone to the chart
addRiskZone(config: RiskZoneConfig): string

// Remove a specific risk zone
removeRiskZone(zoneId: string): void

// Update an existing risk zone
updateRiskZone(zoneId: string, updates: Partial<RiskZoneConfig>): void

// Get all risk zones
getRiskZones(): RiskZone[]

// Remove all risk zones
clearRiskZones(): void
```

### TypeScript Interfaces

```typescript
interface RiskZoneConfig {
  id?: string;
  startPrice: number;             // Lower price boundary
  endPrice: number;               // Upper price boundary
  label?: string;                 // e.g., "Stop Loss Zone"
  color?: string;                 // Zone color (default: red with transparency)
  opacity?: number;               // Fill opacity (0-1)
  pattern?: 'solid' | 'striped' | 'dotted';  // Fill pattern
  borderColor?: string;
  borderWidth?: number;
  extendLeft?: boolean;           // Extend to left edge
  extendRight?: boolean;          // Extend to right edge (default: true)
}

interface RiskZone extends RiskZoneConfig {
  id: string;
}
```

---

## 10. Equity Curve Overlay

### Purpose
Overlay portfolio equity curve on top of price chart for performance visualization.

### API Methods

```typescript
// Show equity curve overlay
showEquityCurve(data: EquityPoint[]): void

// Hide equity curve overlay
hideEquityCurve(): void

// Update equity curve data
updateEquityCurve(data: EquityPoint[]): void

// Check if equity curve is visible
isEquityCurveVisible(): boolean
```

### TypeScript Interfaces

```typescript
interface EquityPoint {
  timestamp: number;              // Unix timestamp
  equity: number;                 // Portfolio value at this time
}

interface EquityCurveConfig {
  data: EquityPoint[];
  color?: string;                 // Line color (default: blue)
  lineWidth?: number;             // Line thickness
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  showArea?: boolean;             // Fill area under curve
  areaColor?: string;             // Area fill color
  opacity?: number;               // Line/area opacity
  yAxisPosition?: 'left' | 'right' | 'separate';  // Y-axis placement
}
```

---

## 11. Drawdown Visualization

### Purpose
Highlight drawdown periods on the chart.

### API Methods

```typescript
// Show drawdown overlay
showDrawdown(data: DrawdownPoint[]): void

// Hide drawdown overlay
hideDrawdown(): void

// Update drawdown data
updateDrawdown(data: DrawdownPoint[]): void
```

### TypeScript Interfaces

```typescript
interface DrawdownPoint {
  timestamp: number;
  drawdownPercent: number;        // Negative percentage
}
```

---

## 12. Chart State Management for Trading

### Purpose
Save and restore all trading overlays for persistence.

### API Methods

```typescript
// Get complete trading state
getTradingState(): TradingChartState

// Restore trading state
setTradingState(state: TradingChartState): void

// Clear all trading overlays
clearTradingOverlays(): void
```

### TypeScript Interfaces

```typescript
interface TradingChartState {
  tradeMarkers: TradeMarker[];
  priceLines: PriceLine[];
  tradeZones: TradeZone[];
  annotations: Annotation[];
  timeMarkers: TimeMarker[];
  riskZones: RiskZone[];
  positionOverlay: PositionOverlayConfig | null;
  clickToTrade: ClickToTradeConfig | null;
}
```

---

## Implementation Priority

### Phase 1 (Must Have - P0)
1. **Trade Markers** - Essential for showing buy/sell executions
2. **Price Lines** - Critical for order visualization
3. **Position Overlay** - Important for position awareness
4. **Basic Events** - Required for interactivity

### Phase 2 (Should Have - P1)
5. **Trade Zones** - Nice visualization for completed trades
6. **Annotations** - Useful for trade notes
7. **Click-to-Trade** - Enhanced user experience
8. **Enhanced Events** - Better interaction handling

### Phase 3 (Nice to Have - P2)
9. **Equity Curve** - Advanced analytics
10. **Risk Zones** - Risk management visualization
11. **Time Markers** - Event marking
12. **Drawdown** - Performance analysis

---

## Example Usage

```typescript
// Example: Adding a buy trade marker
const markerId = chart.addTradeMarker({
  timestamp: 1699564800000,
  price: 45000,
  side: 'buy',
  shape: 'arrow',
  text: 'Entry',
  tooltip: {
    title: 'Buy BTC-USD',
    details: ['Qty: 0.5', 'Price: $45,000', 'Total: $22,500']
  }
});

// Example: Adding a stop loss price line
const lineId = chart.addPriceLine({
  price: 43000,
  color: '#ff0000',
  lineStyle: 'solid',
  label: {
    text: 'Stop Loss',
    position: 'right',
    backgroundColor: '#ff0000',
    textColor: '#ffffff'
  },
  draggable: true
});

// Listen for price line drag
chart.on('price-line-dragged', (event) => {
  console.log('Stop loss moved to:', event.newPrice);
  updateStopLoss(event.newPrice);
});

// Example: Show position overlay
chart.showPositionOverlay({
  symbol: 'BTC-USD',
  quantity: 0.5,
  side: 'long',
  entryPrice: 45000,
  currentPrice: 47000,
  unrealizedPnL: 1000,
  unrealizedPnLPercent: 4.44,
  position: 'top-left',
  showEntryLine: true
});

// Example: Enable click-to-trade (rs-charts only handles interaction)
chart.enableClickToTrade({
  enabled: true,
  showCrosshair: true,
  showPriceLabel: true,
  showOrderPreview: true,
  defaultSide: 'buy',
  allowSideToggle: true,  // Shift key toggles to sell
  onOrderRequest: (orderData) => {
    // rs-charts emits this event when user clicks
    // sc-app handles the order entry UI
    console.log(`Order requested at $${orderData.price} (${orderData.side})`);
  }
});

// Example: sc-app listens to order-request event
chart.on('order-request', (event) => {
  // sc-app shows order entry UI (modal, sidebar, etc.)
  showOrderEntryModal({
    initialPrice: event.price,
    initialSide: event.side,
    onConfirm: (order) => {
      // Execute trade through paper trading engine
      paperTradingEngine.placeOrder({
        symbol: 'BTC-USD',
        side: order.side,
        type: order.type,      // Market/Limit/Stop - set by user in modal
        quantity: order.quantity,  // Set by user in modal
        price: order.price,
      });

      // After execution, add visual marker to chart
      chart.addTradeMarker({
        timestamp: Date.now(),
        price: order.price,
        side: order.side,
        shape: 'arrow',
        tooltip: {
          title: `${order.side.toUpperCase()} BTC-USD`,
          details: [
            `Qty: ${order.quantity}`,
            `Price: $${order.price}`,
            `Type: ${order.type}`
          ]
        }
      });
    }
  });
});
```

---

## Notes

### General Guidelines
- All price values should be in the same units as the chart's price data
- All timestamps should be Unix timestamps in milliseconds
- Colors should support hex, rgb, rgba, and named colors
- All overlay elements should be properly layered (zIndex) to avoid conflicts
- All IDs should be unique and auto-generated if not provided
- Methods should handle invalid data gracefully with clear error messages

### Separation of Concerns
**Critical:** rs-charts should remain a pure visualization library:
- ❌ **No business logic**: No order execution, position management, or P&L calculations
- ❌ **No forms/dialogs**: No order entry forms, confirmation dialogs, or input validation
- ❌ **No data persistence**: No Firestore writes or account balance management
- ✅ **Pure visualization**: Only handle rendering, interaction, and events
- ✅ **Event emission**: Emit events with data, let sc-app handle the business logic
- ✅ **Visual feedback**: Show markers, lines, overlays based on data provided by sc-app

This separation ensures:
1. rs-charts remains reusable across different applications
2. Business logic stays in sc-app where it belongs
3. Testing is simpler (visual tests vs. business logic tests)
4. Changes to trading rules don't require rs-charts updates

# sc-app Paper Trading & Backtesting Implementation Plan

**Architecture:** Client-side unified trading engine supporting both paper trading and backtesting modes.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Data Models](#data-models)
4. [Implementation Phases](#implementation-phases)
5. [File Structure](#file-structure)
6. [Detailed Implementation](#detailed-implementation)
7. [Usage Examples](#usage-examples)

---

## Architecture Overview

### Unified Trading Engine Approach

```
┌──────────────────────────────────────────────────────┐
│          Core Trading Engine (Client-Side)           │
│  ┌────────────────────────────────────────────────┐  │
│  │  Abstract Trading Engine Base Class            │  │
│  │  • Order execution logic                       │  │
│  │  • Position management                         │  │
│  │  │  Account & balance tracking                 │  │
│  │  • Trade recording                             │  │
│  │  • P&L calculations                            │  │
│  │  • Performance analytics                       │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
              ↓                           ↓
    ┌────────────────────┐      ┌────────────────────┐
    │  Paper Trading     │      │   Backtesting      │
    │  Mode              │      │   Mode             │
    ├────────────────────┤      ├────────────────────┤
    │ • Live prices      │      │ • Historical data  │
    │ • Real-time sub.   │      │ • Fast-forward     │
    │ • Manual orders    │      │ • Strategy auto.   │
    │ • Interactive UI   │      │ • Bulk results     │
    └────────────────────┘      └────────────────────┘
```

### Why Client-Side?

✅ **Instant feedback** - No network latency
✅ **No cold starts** - Firebase Functions have delays
✅ **Free execution** - No function invocation costs
✅ **Better UX** - Immediate order execution
✅ **Easier debugging** - All in browser dev tools
✅ **Real-time updates** - Direct Firestore subscriptions

### Shared Logic (80% code reuse)

Both modes share:
- Order execution engine
- Position tracking
- Account/balance management
- P&L calculations
- Trade recording
- Performance metrics
- Chart visualization

### Key Differences

| Aspect | Paper Trading | Backtesting |
|--------|---------------|-------------|
| **Time** | Real-time, live | Historical, fast-forward |
| **Orders** | Manual UI | Strategy-automated |
| **Speed** | Market speed | Simulated (fast) |
| **Data** | Live subscriptions | Historical queries |
| **Interaction** | Interactive | Report-based |

---

## Core Components

### 1. Trading Engine (Abstract Base)

**Location:** `app/services/tradingEngine/TradingEngine.ts`

```typescript
abstract class TradingEngine {
  protected account: TradingAccount;
  protected positions: Map<string, Position>;
  protected orders: Map<string, Order>;
  protected trades: Trade[];

  // Abstract methods (implement in subclasses)
  abstract getPriceAt(symbol: string, timestamp: number): Promise<number>;
  abstract onPriceUpdate(symbol: string, price: number): void;

  // Shared methods (used by both modes)
  executeOrder(order: Order): Promise<Trade | null> { }
  updatePosition(trade: Trade): void { }
  closePosition(symbol: string, price: number): Trade | null { }
  calculatePnL(position: Position, currentPrice: number): number { }
  recordTrade(trade: Trade): void { }
  getPerformanceMetrics(): PerformanceMetrics { }
}
```

### 2. Paper Trading Engine

**Location:** `app/services/tradingEngine/PaperTradingEngine.ts`

```typescript
class PaperTradingEngine extends TradingEngine {
  private priceSubscriptions: Map<string, Unsubscribe>;

  async getPriceAt(symbol: string, timestamp: number): Promise<number> {
    // Get current live price from Firestore subscription
    return this.currentPrices.get(symbol) || 0;
  }

  subscribeToPrices(symbols: string[]): void {
    // Subscribe to live candle updates
    symbols.forEach(symbol => {
      const unsubscribe = repository.subscribeToCandle(
        'coinbase',
        symbol,
        'ONE_MINUTE',
        (candle) => this.onPriceUpdate(symbol, candle.close)
      );
      this.priceSubscriptions.set(symbol, unsubscribe);
    });
  }

  onPriceUpdate(symbol: string, price: number): void {
    // Update current price
    this.currentPrices.set(symbol, price);

    // Check pending limit/stop orders
    this.checkPendingOrders(symbol, price);

    // Update position P&L
    this.updatePositionPnL(symbol, price);
  }
}
```

### 3. Backtesting Engine

**Location:** `app/services/tradingEngine/BacktestingEngine.ts`

```typescript
class BacktestingEngine extends TradingEngine {
  private historicalData: Map<string, Candle[]>;
  private currentIndex: number = 0;

  async loadHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    granularity: Granularity
  ): Promise<void> {
    // Query historical candles from Firestore
    const candles = await this.queryCandles(symbol, startDate, endDate, granularity);
    this.historicalData.set(symbol, candles);
  }

  async getPriceAt(symbol: string, timestamp: number): Promise<number> {
    // Find price at specific timestamp in historical data
    const candles = this.historicalData.get(symbol) || [];
    const candle = candles.find(c => c.timestamp === timestamp);
    return candle?.close || 0;
  }

  async runBacktest(strategy: TradingStrategy): Promise<BacktestResult> {
    const candles = this.historicalData.get(strategy.symbol) || [];

    for (const candle of candles) {
      this.currentIndex++;
      this.currentTimestamp = candle.timestamp;

      // Let strategy analyze candle and generate signals
      const signal = strategy.onCandle(candle);

      if (signal) {
        // Execute order at current price
        const order = this.createOrderFromSignal(signal, candle);
        const trade = await this.executeOrder(order);

        if (trade) {
          strategy.onTrade?.(trade);
        }
      }

      // Update positions with current price
      this.updateAllPositionsPnL(candle.close);

      // Optional: Emit progress event for UI
      this.emit('progress', {
        current: this.currentIndex,
        total: candles.length,
        timestamp: candle.timestamp
      });
    }

    return this.generateBacktestResult();
  }
}
```

### 4. Order Executor

**Location:** `app/services/tradingEngine/OrderExecutor.ts`

```typescript
class OrderExecutor {
  executeMarketOrder(order: Order, currentPrice: number): Trade {
    // Immediate execution at current price
    return {
      id: generateId(),
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      quantity: order.quantity,
      price: currentPrice,
      timestamp: Date.now(),
      type: 'market'
    };
  }

  checkLimitOrder(order: Order, currentPrice: number): Trade | null {
    // Check if limit order should execute
    if (order.side === 'buy' && currentPrice <= order.price!) {
      return this.executeLimitOrder(order, order.price!);
    }
    if (order.side === 'sell' && currentPrice >= order.price!) {
      return this.executeLimitOrder(order, order.price!);
    }
    return null;
  }

  checkStopOrder(order: Order, currentPrice: number): Trade | null {
    // Check if stop order should trigger
    if (order.side === 'buy' && currentPrice >= order.price!) {
      return this.executeStopOrder(order, currentPrice);
    }
    if (order.side === 'sell' && currentPrice <= order.price!) {
      return this.executeStopOrder(order, currentPrice);
    }
    return null;
  }
}
```

### 5. Position Manager

**Location:** `app/services/tradingEngine/PositionManager.ts`

```typescript
class PositionManager {
  private positions: Map<string, Position> = new Map();

  updatePosition(trade: Trade): Position {
    const existing = this.positions.get(trade.symbol);

    if (!existing) {
      // New position
      return this.createPosition(trade);
    }

    // Update existing position
    if (this.isSameSide(existing, trade)) {
      // Adding to position
      return this.addToPosition(existing, trade);
    } else {
      // Reducing or closing position
      return this.reducePosition(existing, trade);
    }
  }

  calculatePnL(position: Position, currentPrice: number): PnLResult {
    const positionValue = position.quantity * currentPrice;
    const costBasis = position.quantity * position.avgEntryPrice;
    const unrealizedPnL = position.side === 'long'
      ? positionValue - costBasis
      : costBasis - positionValue;
    const unrealizedPnLPercent = (unrealizedPnL / costBasis) * 100;

    return {
      unrealizedPnL,
      unrealizedPnLPercent,
      positionValue,
      costBasis
    };
  }

  closePosition(symbol: string, exitPrice: number): Trade | null {
    const position = this.positions.get(symbol);
    if (!position) return null;

    // Create closing trade
    const closingTrade: Trade = {
      id: generateId(),
      symbol,
      side: position.side === 'long' ? 'sell' : 'buy',
      quantity: position.quantity,
      entryPrice: position.avgEntryPrice,
      exitPrice,
      pnl: this.calculatePnL(position, exitPrice).unrealizedPnL,
      entryTime: position.entryTime,
      exitTime: Date.now()
    };

    this.positions.delete(symbol);
    return closingTrade;
  }
}
```

### 6. Account Manager

**Location:** `app/services/tradingEngine/AccountManager.ts`

```typescript
class AccountManager {
  private account: TradingAccount;

  constructor(startingBalance: number) {
    this.account = {
      balance: startingBalance,
      startingBalance,
      equity: startingBalance,
      buyingPower: startingBalance,
      totalPnL: 0,
      totalPnLPercent: 0
    };
  }

  deductOrderCost(order: Order, executionPrice: number): boolean {
    const cost = order.quantity * executionPrice;

    if (cost > this.account.buyingPower) {
      return false; // Insufficient funds
    }

    this.account.balance -= cost;
    this.account.buyingPower -= cost;
    return true;
  }

  creditOrderProceeds(trade: Trade): void {
    const proceeds = trade.quantity * trade.price;
    this.account.balance += proceeds;
    this.account.buyingPower += proceeds;
  }

  updateEquity(positions: Position[], currentPrices: Map<string, number>): void {
    let totalPositionValue = 0;

    positions.forEach(position => {
      const currentPrice = currentPrices.get(position.symbol) || position.avgEntryPrice;
      totalPositionValue += position.quantity * currentPrice;
    });

    this.account.equity = this.account.balance + totalPositionValue;
    this.account.totalPnL = this.account.equity - this.account.startingBalance;
    this.account.totalPnLPercent =
      (this.account.totalPnL / this.account.startingBalance) * 100;
  }

  reset(startingBalance?: number): void {
    const balance = startingBalance || this.account.startingBalance;
    this.account = {
      balance,
      startingBalance: balance,
      equity: balance,
      buyingPower: balance,
      totalPnL: 0,
      totalPnLPercent: 0
    };
  }
}
```

### 7. Performance Analytics

**Location:** `app/services/tradingEngine/PerformanceAnalytics.ts`

```typescript
class PerformanceAnalytics {
  calculateMetrics(trades: Trade[], account: TradingAccount): PerformanceMetrics {
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);

    const winRate = (winningTrades.length / trades.length) * 100;
    const avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length || 0;
    const avgLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length || 0);
    const profitFactor = avgWin / avgLoss || 0;

    return {
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalPnL: account.totalPnL,
      totalPnLPercent: account.totalPnLPercent,
      largestWin: Math.max(...trades.map(t => t.pnl)),
      largestLoss: Math.min(...trades.map(t => t.pnl)),
      avgTradeDuration: this.calculateAvgDuration(trades),
      sharpeRatio: this.calculateSharpeRatio(trades),
      maxDrawdown: this.calculateMaxDrawdown(trades, account.startingBalance)
    };
  }

  private calculateMaxDrawdown(trades: Trade[], startingBalance: number): number {
    let peak = startingBalance;
    let maxDrawdown = 0;
    let runningBalance = startingBalance;

    trades.forEach(trade => {
      runningBalance += trade.pnl;

      if (runningBalance > peak) {
        peak = runningBalance;
      }

      const drawdown = ((peak - runningBalance) / peak) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    });

    return maxDrawdown;
  }
}
```

---

## Data Models

### Core Types

**Location:** `app/types/trading.ts`

```typescript
// Account
export interface TradingAccount {
  balance: number;              // Available cash
  startingBalance: number;      // Initial capital
  equity: number;               // Balance + position values
  buyingPower: number;          // Available for new trades
  totalPnL: number;            // Total profit/loss ($)
  totalPnLPercent: number;     // Total profit/loss (%)
}

// Order
export interface Order {
  id: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  price?: number;               // For limit/stop orders
  stopPrice?: number;           // For stop_limit orders
  status: 'pending' | 'filled' | 'cancelled' | 'rejected' | 'partial';
  createdAt: number;           // Timestamp
  filledAt?: number;           // Timestamp when filled
  metadata?: any;              // Custom data
}

// Position
export interface Position {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  entryTime: number;
  costBasis: number;
}

// Trade (completed transaction)
export interface Trade {
  id: string;
  orderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;                 // Realized P&L
  pnlPercent: number;          // Realized P&L %
  entryTime: number;
  exitTime: number;
  duration: number;            // milliseconds
  fees?: number;               // Optional commission
  notes?: string;              // Trade journal notes
}

// Performance Metrics
export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;            // Percentage
  avgWin: number;
  avgLoss: number;
  profitFactor: number;       // avgWin / avgLoss
  totalPnL: number;
  totalPnLPercent: number;
  largestWin: number;
  largestLoss: number;
  avgTradeDuration: number;   // milliseconds
  sharpeRatio: number;
  maxDrawdown: number;        // Percentage
  expectancy: number;         // Average $ per trade
}

// Trading Strategy (for backtesting)
export interface TradingStrategy {
  name: string;
  symbol: string;
  description?: string;

  // Called for each candle
  onCandle(candle: Candle): OrderSignal | null;

  // Called when trade executes
  onTrade?(trade: Trade): void;

  // Optional initialization
  onStart?(account: TradingAccount): void;

  // Optional cleanup
  onEnd?(metrics: PerformanceMetrics): void;
}

// Order Signal (from strategy)
export interface OrderSignal {
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  stopLoss?: number;
  takeProfit?: number;
}

// Backtest Result
export interface BacktestResult {
  strategy: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  metrics: PerformanceMetrics;
  trades: Trade[];
  equityCurve: EquityPoint[];
  drawdownCurve: DrawdownPoint[];
  account: TradingAccount;
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface DrawdownPoint {
  timestamp: number;
  drawdownPercent: number;
}
```

---

## Implementation Phases

### Phase 1: Core Engine (Week 1)

**Goal:** Build shared trading engine with order execution and position management

**Tasks:**
1. Create base `TradingEngine` abstract class
2. Implement `OrderExecutor` (market, limit, stop orders)
3. Implement `PositionManager` (open, update, close positions)
4. Implement `AccountManager` (balance, equity, buying power)
5. Add unit tests for core logic

**Deliverable:** Working core engine that can execute trades programmatically

### Phase 2: Backtesting Mode (Week 1-2)

**Goal:** Implement backtesting with strategy support

**Tasks:**
1. Create `BacktestingEngine` class
2. Implement historical data loader (query Firestore)
3. Create `TradingStrategy` interface
4. Implement strategy executor (process candles)
5. Create simple example strategies (SMA crossover, RSI)
6. Build `PerformanceAnalytics` calculator
7. Create backtest result generator

**Deliverable:** Can run automated backtests with strategies

### Phase 3: Backtesting UI (Week 2)

**Goal:** Build user interface for backtesting

**Tasks:**
1. Create `BacktestPanel` component (strategy selector, date range, settings)
2. Create `BacktestResults` component (metrics display)
3. Create `EquityCurveChart` component
4. Create `TradesList` component
5. Integrate with chart visualization (trade markers, zones)
6. Add export functionality (CSV, JSON)

**Deliverable:** Full backtesting UI with results visualization

### Phase 4: Paper Trading Mode (Week 2-3)

**Goal:** Implement paper trading with live data

**Tasks:**
1. Create `PaperTradingEngine` class
2. Implement live price subscriptions
3. Create pending order checker (real-time)
4. Implement position P&L updates (real-time)
5. Add Firestore persistence for paper trading data

**Deliverable:** Working paper trading engine with live execution

### Phase 5: Paper Trading UI (Week 3)

**Goal:** Build interactive UI for manual trading

**Tasks:**
1. Create `TradingPanel` component (order entry)
2. Create `PositionsPanel` component (open positions)
3. Create `OrdersPanel` component (active/history)
4. Create `AccountSummary` widget
5. Integrate click-to-trade (rs-charts events)
6. Add keyboard shortcuts (B/S for buy/sell)

**Deliverable:** Complete paper trading UI

### Phase 6: Advanced Features (Week 3-4)

**Goal:** Add analytics, risk management, trade journal

**Tasks:**
1. Create `PerformanceAnalytics` component
2. Create `TradeJournal` component (notes, screenshots)
3. Add risk management tools (position sizing calculator)
4. Add notifications (trade fills, position updates)
5. Add settings (starting balance, commissions, slippage)
6. Add account reset functionality

**Deliverable:** Full-featured trading platform

---

## File Structure

```
app/
├── services/
│   ├── tradingEngine/
│   │   ├── TradingEngine.ts           # Abstract base class
│   │   ├── PaperTradingEngine.ts      # Live trading implementation
│   │   ├── BacktestingEngine.ts       # Historical backtesting
│   │   ├── OrderExecutor.ts           # Order matching logic
│   │   ├── PositionManager.ts         # Position tracking
│   │   ├── AccountManager.ts          # Balance management
│   │   ├── PerformanceAnalytics.ts    # Metrics calculation
│   │   └── index.ts                   # Exports
│   └── strategies/
│       ├── Strategy.ts                # Base strategy class
│       ├── SMAStrategy.ts             # Example: SMA crossover
│       ├── RSIStrategy.ts             # Example: RSI strategy
│       └── index.ts
│
├── components/
│   ├── trading/
│   │   ├── TradingPanel.tsx           # Order entry form
│   │   ├── PositionsPanel.tsx         # Open positions list
│   │   ├── OrdersPanel.tsx            # Orders list
│   │   ├── AccountSummary.tsx         # Balance/equity widget
│   │   ├── TradeHistory.tsx           # Completed trades
│   │   └── OrderEntryModal.tsx        # Quick order modal
│   │
│   ├── backtesting/
│   │   ├── BacktestPanel.tsx          # Backtest configuration
│   │   ├── BacktestResults.tsx        # Results dashboard
│   │   ├── StrategySelector.tsx       # Strategy picker
│   │   ├── EquityCurveChart.tsx       # Equity visualization
│   │   └── MetricsGrid.tsx            # Performance metrics
│   │
│   └── analytics/
│       ├── PerformanceAnalytics.tsx   # Analytics dashboard
│       ├── TradeJournal.tsx           # Trade notes/review
│       └── RiskCalculator.tsx         # Position sizing
│
├── types/
│   └── trading.ts                     # All trading types
│
└── hooks/
    ├── usePaperTrading.ts             # Paper trading hook
    ├── useBacktesting.ts              # Backtesting hook
    └── useTradeHistory.ts             # Trade data hook
```

---

## Detailed Implementation

### Creating the Core Engine

**Step 1: Base Trading Engine**

```typescript
// app/services/tradingEngine/TradingEngine.ts
import { db } from '~/lib/firebase';
import { Order, Trade, Position, TradingAccount } from '~/types/trading';
import { OrderExecutor } from './OrderExecutor';
import { PositionManager } from './PositionManager';
import { AccountManager } from './AccountManager';

export abstract class TradingEngine extends EventEmitter {
  protected orderExecutor: OrderExecutor;
  protected positionManager: PositionManager;
  protected accountManager: AccountManager;
  protected trades: Trade[] = [];

  constructor(startingBalance: number) {
    super();
    this.orderExecutor = new OrderExecutor();
    this.positionManager = new PositionManager();
    this.accountManager = new AccountManager(startingBalance);
  }

  // Abstract methods (implement in subclasses)
  abstract getPriceAt(symbol: string, timestamp: number): Promise<number>;

  // Shared order execution
  async executeOrder(order: Order): Promise<Trade | null> {
    const currentPrice = await this.getPriceAt(order.symbol, Date.now());

    // Check if we have enough buying power
    if (order.side === 'buy') {
      const cost = order.quantity * currentPrice;
      if (!this.accountManager.deductOrderCost(order, currentPrice)) {
        this.emit('order-rejected', { order, reason: 'Insufficient funds' });
        return null;
      }
    }

    // Execute based on order type
    let trade: Trade | null = null;

    if (order.type === 'market') {
      trade = this.orderExecutor.executeMarketOrder(order, currentPrice);
    } else if (order.type === 'limit') {
      trade = this.orderExecutor.checkLimitOrder(order, currentPrice);
    } else if (order.type === 'stop') {
      trade = this.orderExecutor.checkStopOrder(order, currentPrice);
    }

    if (trade) {
      // Update position
      const position = this.positionManager.updatePosition(trade);

      // Credit proceeds if selling
      if (order.side === 'sell') {
        this.accountManager.creditOrderProceeds(trade);
      }

      // Record trade
      this.trades.push(trade);

      // Emit events
      this.emit('trade-executed', { trade, position });
      this.emit('account-updated', this.accountManager.getAccount());
    }

    return trade;
  }

  getAccount(): TradingAccount {
    return this.accountManager.getAccount();
  }

  getPositions(): Position[] {
    return Array.from(this.positionManager.getPositions().values());
  }

  getTrades(): Trade[] {
    return this.trades;
  }

  closePosition(symbol: string): Trade | null {
    const currentPrice = await this.getPriceAt(symbol, Date.now());
    return this.positionManager.closePosition(symbol, currentPrice);
  }

  reset(startingBalance?: number): void {
    this.accountManager.reset(startingBalance);
    this.positionManager.clear();
    this.trades = [];
    this.emit('reset');
  }
}
```

### Implementing Paper Trading

```typescript
// app/services/tradingEngine/PaperTradingEngine.ts
import { TradingEngine } from './TradingEngine';
import { getRepository } from '~/services/repository';

export class PaperTradingEngine extends TradingEngine {
  private repository: Repository;
  private userId: string;
  private priceSubscriptions = new Map<string, Unsubscribe>();
  private currentPrices = new Map<string, number>();
  private pendingOrders = new Map<string, Order>();

  constructor(userId: string, startingBalance: number) {
    super(startingBalance);
    this.userId = userId;
    this.repository = getRepository(userId);
  }

  async initialize(): Promise<void> {
    await this.repository.initialize();
    // Load saved paper trading state from Firestore
    await this.loadState();
  }

  async getPriceAt(symbol: string, timestamp: number): Promise<number> {
    // For paper trading, we use current live price
    return this.currentPrices.get(symbol) || 0;
  }

  subscribeToPrices(symbols: string[]): void {
    symbols.forEach(symbol => {
      // Skip if already subscribed
      if (this.priceSubscriptions.has(symbol)) return;

      const unsubscribe = this.repository.subscribeToCandle(
        'coinbase',
        symbol,
        'ONE_MINUTE',
        (candle) => {
          this.currentPrices.set(symbol, candle.close);
          this.onPriceUpdate(symbol, candle.close);
        }
      );

      this.priceSubscriptions.set(symbol, unsubscribe);
    });
  }

  private onPriceUpdate(symbol: string, price: number): void {
    // Check pending limit/stop orders
    this.checkPendingOrders(symbol, price);

    // Update position P&L
    const position = this.positionManager.getPosition(symbol);
    if (position) {
      const pnl = this.positionManager.calculatePnL(position, price);
      this.emit('position-updated', { symbol, position, pnl });
    }

    // Update account equity
    this.accountManager.updateEquity(
      this.getPositions(),
      this.currentPrices
    );
    this.emit('account-updated', this.getAccount());
  }

  private checkPendingOrders(symbol: string, price: number): void {
    this.pendingOrders.forEach(async (order) => {
      if (order.symbol !== symbol) return;

      let shouldExecute = false;

      if (order.type === 'limit') {
        if (order.side === 'buy' && price <= order.price!) {
          shouldExecute = true;
        } else if (order.side === 'sell' && price >= order.price!) {
          shouldExecute = true;
        }
      } else if (order.type === 'stop') {
        if (order.side === 'buy' && price >= order.price!) {
          shouldExecute = true;
        } else if (order.side === 'sell' && price <= order.price!) {
          shouldExecute = true;
        }
      }

      if (shouldExecute) {
        this.pendingOrders.delete(order.id);
        await this.executeOrder(order);
      }
    });
  }

  async placeOrder(order: Order): Promise<void> {
    if (order.type === 'market') {
      // Execute immediately
      await this.executeOrder(order);
    } else {
      // Add to pending orders
      this.pendingOrders.set(order.id, order);
      this.emit('order-placed', order);

      // Make sure we're subscribed to this symbol
      this.subscribeToPrices([order.symbol]);
    }

    // Persist to Firestore
    await this.saveState();
  }

  async cancelOrder(orderId: string): Promise<void> {
    const order = this.pendingOrders.get(orderId);
    if (order) {
      this.pendingOrders.delete(orderId);
      this.emit('order-cancelled', order);
      await this.saveState();
    }
  }

  private async loadState(): Promise<void> {
    // Load from Firestore: settings/{userId}/paperTrading/
    // Implementation depends on Firestore structure
  }

  private async saveState(): Promise<void> {
    // Save to Firestore: settings/{userId}/paperTrading/
    // Implementation depends on Firestore structure
  }

  destroy(): void {
    // Unsubscribe from all price feeds
    this.priceSubscriptions.forEach(unsubscribe => unsubscribe());
    this.priceSubscriptions.clear();
  }
}
```

### Implementing Backtesting

```typescript
// app/services/tradingEngine/BacktestingEngine.ts
import { TradingEngine } from './TradingEngine';
import { TradingStrategy, BacktestResult } from '~/types/trading';
import { getRepository } from '~/services/repository';

export class BacktestingEngine extends TradingEngine {
  private repository: Repository;
  private historicalData = new Map<string, Candle[]>();
  private currentTimestamp: number = 0;
  private currentIndex: number = 0;

  constructor(userId: string, startingBalance: number) {
    super(startingBalance);
    this.repository = getRepository(userId);
  }

  async loadHistoricalData(
    symbol: string,
    startDate: Date,
    endDate: Date,
    granularity: Granularity
  ): Promise<void> {
    await this.repository.initialize();

    // Query historical candles from Firestore
    const candles = await this.queryCandles(symbol, startDate, endDate, granularity);
    this.historicalData.set(symbol, candles);

    this.emit('data-loaded', {
      symbol,
      candleCount: candles.length,
      startDate,
      endDate
    });
  }

  private async queryCandles(
    symbol: string,
    startDate: Date,
    endDate: Date,
    granularity: Granularity
  ): Promise<Candle[]> {
    // Query Firestore for historical candles
    const candlesRef = collection(
      db,
      'exchanges',
      'coinbase',
      'products',
      symbol,
      'candles',
      granularity
    );

    const q = query(
      candlesRef,
      where('timestamp', '>=', startDate.getTime()),
      where('timestamp', '<=', endDate.getTime()),
      orderBy('timestamp', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Candle);
  }

  async getPriceAt(symbol: string, timestamp: number): Promise<number> {
    const candles = this.historicalData.get(symbol) || [];
    const candle = candles.find(c => c.timestamp === timestamp);
    return candle?.close || 0;
  }

  async runBacktest(strategy: TradingStrategy): Promise<BacktestResult> {
    const candles = this.historicalData.get(strategy.symbol) || [];

    if (candles.length === 0) {
      throw new Error('No historical data loaded');
    }

    // Initialize strategy
    strategy.onStart?.(this.getAccount());

    // Process each candle
    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      this.currentIndex = i;
      this.currentTimestamp = candle.timestamp;

      // Let strategy analyze candle
      const signal = strategy.onCandle(candle);

      if (signal) {
        // Create order from signal
        const order: Order = {
          id: this.generateOrderId(),
          symbol: strategy.symbol,
          side: signal.side,
          type: signal.type,
          quantity: signal.quantity,
          price: signal.price,
          status: 'pending',
          createdAt: candle.timestamp
        };

        // Execute order
        const trade = await this.executeOrder(order);

        if (trade) {
          strategy.onTrade?.(trade);
        }
      }

      // Update all positions with current price
      this.getPositions().forEach(position => {
        const pnl = this.positionManager.calculatePnL(position, candle.close);
        this.emit('position-updated', { position, pnl, timestamp: candle.timestamp });
      });

      // Update account equity
      this.accountManager.updateEquity(
        this.getPositions(),
        new Map([[strategy.symbol, candle.close]])
      );

      // Emit progress
      this.emit('progress', {
        current: i + 1,
        total: candles.length,
        percent: ((i + 1) / candles.length) * 100,
        timestamp: candle.timestamp
      });
    }

    // Close any open positions at final price
    const finalCandle = candles[candles.length - 1];
    this.getPositions().forEach(position => {
      this.closePosition(position.symbol);
    });

    // Generate result
    const result = this.generateResult(strategy, candles);

    // Cleanup
    strategy.onEnd?.(result.metrics);

    return result;
  }

  private generateResult(
    strategy: TradingStrategy,
    candles: Candle[]
  ): BacktestResult {
    const analytics = new PerformanceAnalytics();
    const metrics = analytics.calculateMetrics(this.getTrades(), this.getAccount());

    // Generate equity curve
    const equityCurve = this.generateEquityCurve(candles);
    const drawdownCurve = analytics.calculateDrawdownCurve(equityCurve);

    return {
      strategy: strategy.name,
      symbol: strategy.symbol,
      startDate: new Date(candles[0].timestamp),
      endDate: new Date(candles[candles.length - 1].timestamp),
      metrics,
      trades: this.getTrades(),
      equityCurve,
      drawdownCurve,
      account: this.getAccount()
    };
  }

  private generateEquityCurve(candles: Candle[]): EquityPoint[] {
    // Reconstruct equity at each point in time
    const curve: EquityPoint[] = [];
    let equity = this.getAccount().startingBalance;

    // This is simplified - in reality, track equity changes with each trade
    this.getTrades().forEach(trade => {
      equity += trade.pnl;
      curve.push({
        timestamp: trade.exitTime,
        equity
      });
    });

    return curve;
  }

  private generateOrderId(): string {
    return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

---

## Usage Examples

### Paper Trading

```typescript
// In a React component
import { PaperTradingEngine } from '~/services/tradingEngine';

function usePaperTrading() {
  const { user } = useAuth();
  const [engine, setEngine] = useState<PaperTradingEngine | null>(null);
  const [account, setAccount] = useState<TradingAccount | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    if (!user) return;

    const paperEngine = new PaperTradingEngine(user.uid, 100000);

    paperEngine.on('trade-executed', ({ trade, position }) => {
      console.log('Trade executed:', trade);
      // Add trade marker to chart
      if (chartRef.current?.api) {
        chartRef.current.api.addTradeMarker({
          timestamp: trade.entryTime,
          price: trade.entryPrice,
          side: trade.side,
          shape: 'arrow',
          tooltip: {
            title: `${trade.side.toUpperCase()} ${trade.symbol}`,
            details: [
              `Qty: ${trade.quantity}`,
              `Price: $${trade.entryPrice.toFixed(2)}`
            ]
          }
        });
      }
    });

    paperEngine.on('account-updated', (acc) => {
      setAccount(acc);
    });

    paperEngine.on('position-updated', () => {
      setPositions(paperEngine.getPositions());
    });

    paperEngine.initialize().then(() => {
      paperEngine.subscribeToPrices(['BTC-USD', 'ETH-USD']);
      setEngine(paperEngine);
      setAccount(paperEngine.getAccount());
    });

    return () => {
      paperEngine.destroy();
    };
  }, [user]);

  const placeMarketOrder = useCallback(async (
    symbol: string,
    side: 'buy' | 'sell',
    quantity: number
  ) => {
    if (!engine) return;

    const order: Order = {
      id: `order-${Date.now()}`,
      symbol,
      side,
      type: 'market',
      quantity,
      status: 'pending',
      createdAt: Date.now()
    };

    await engine.placeOrder(order);
  }, [engine]);

  return {
    account,
    positions,
    placeMarketOrder,
    engine
  };
}
```

### Backtesting

```typescript
// In a React component
import { BacktestingEngine } from '~/services/tradingEngine';
import { SMAStrategy } from '~/services/strategies';

function useBacktesting() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<BacktestResult | null>(null);

  const runBacktest = useCallback(async (
    symbol: string,
    startDate: Date,
    endDate: Date,
    strategyName: string,
    startingBalance: number
  ) => {
    if (!user) return;

    setIsRunning(true);
    setProgress(0);

    const engine = new BacktestingEngine(user.uid, startingBalance);

    engine.on('progress', ({ percent }) => {
      setProgress(percent);
    });

    // Load historical data
    await engine.loadHistoricalData(symbol, startDate, endDate, 'ONE_HOUR');

    // Create strategy
    const strategy = new SMAStrategy(symbol, {
      fastPeriod: 10,
      slowPeriod: 30
    });

    // Run backtest
    const backtestResult = await engine.runBacktest(strategy);

    setResult(backtestResult);
    setIsRunning(false);

    // Visualize trades on chart
    backtestResult.trades.forEach(trade => {
      if (chartRef.current?.api) {
        chartRef.current.api.addTradeMarker({
          timestamp: trade.entryTime,
          price: trade.entryPrice,
          side: trade.side,
          shape: 'arrow'
        });

        // Add trade zone
        chartRef.current.api.addTradeZone({
          startTimestamp: trade.entryTime,
          endTimestamp: trade.exitTime,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          fillColor: trade.pnl > 0 ? '#00ff00' : '#ff0000',
          fillOpacity: 0.2,
          showPnL: true,
          metadata: trade
        });
      }
    });
  }, [user]);

  return {
    runBacktest,
    isRunning,
    progress,
    result
  };
}
```

---

## Next Steps

1. **Implement Phase 1** (Core Engine) - Start with base classes and order execution
2. **Test thoroughly** - Unit tests for all core logic
3. **Implement Phase 2** (Backtesting) - Strategy support and historical replay
4. **Build Phase 3** (Backtesting UI) - Results visualization
5. **Implement Phase 4** (Paper Trading) - Live execution engine
6. **Build Phase 5** (Paper Trading UI) - Interactive trading interface
7. **Add Phase 6** (Advanced Features) - Analytics and risk tools

**Estimated Total Time:** 3-4 weeks for complete implementation

**Key Benefits:**
- ✅ Shared core logic (80% code reuse)
- ✅ Client-side execution (instant feedback)
- ✅ Strategy validation workflow (backtest → paper trade → live)
- ✅ Full control over execution logic
- ✅ No backend costs
