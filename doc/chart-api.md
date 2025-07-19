# Chart API Documentation

The Chart API provides comprehensive programmatic control over the charting library, enabling external frameworks like React, Vue, Angular, or vanilla JavaScript to dynamically control chart behavior.

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

## API Reference

### Symbol Control

#### `getSymbol(): string`
Get the current trading symbol.

```javascript
const currentSymbol = api.getSymbol(); // "BTC-USD"
```

#### `setSymbol(options): Promise<void>`
Change the trading symbol.

```javascript
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
Get the current time granularity.

```javascript
const granularity = api.getGranularity(); // "ONE_HOUR"
```

#### `getAvailableGranularities(): Granularity[]`
Get all available time granularities.

```javascript
const granularities = api.getAvailableGranularities();
// ["ONE_MINUTE", "FIVE_MINUTE", "FIFTEEN_MINUTE", ...]
```

#### `setGranularity(options): Promise<void>`
Change the time granularity.

```javascript
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

```javascript
const indicators = api.getVisibleIndicators();
// [{ id: "rsi", name: "RSI", visible: true, ... }]
```

#### `isIndicatorVisible(id): boolean`
Check if a specific indicator is visible.

```javascript
const isRsiVisible = api.isIndicatorVisible("rsi"); // true/false
const isVolumeVisible = api.isIndicatorVisible("volume"); // true/false
```

#### `showIndicator(config): void`
Show an indicator with configuration.

```javascript
api.showIndicator({
  id: "rsi",
  name: "RSI",
  visible: true,
  display: "bottom",     // Optional: "overlay" | "bottom" | "stack-top" | "stack-bottom"
  scale: "value",        // Optional: "price" | "percentage" | "custom" | "value"
  params: { period: 14 }, // Optional: indicator-specific parameters
  skipFetch: false,      // Optional: skip data fetching
  gridStyle: "standard"  // Optional: grid styling
});
```

#### `hideIndicator(id): void`
Hide a specific indicator.

```javascript
api.hideIndicator("rsi");
```

#### `toggleIndicator(id, config?): void`
Toggle an indicator's visibility.

```javascript
// Simple toggle
api.toggleIndicator("volume");

// Toggle with configuration for when showing
api.toggleIndicator("macd", {
  name: "MACD",
  display: "bottom"
});
```

#### `setIndicators(indicators): void`
Set multiple indicators at once, replacing all current indicators.

```javascript
api.setIndicators([
  { id: "volume", name: "Volume", visible: true },
  { id: "rsi", name: "RSI", visible: true },
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

### Fullscreen Control

#### `isFullscreen(): boolean`
Check if chart is in fullscreen mode.

```javascript
const inFullscreen = api.isFullscreen(); // true/false
```

#### `enterFullscreen(): Promise<void>`
Enter fullscreen mode.

```javascript
try {
  await api.enterFullscreen();
  console.log("Entered fullscreen");
} catch (error) {
  console.log("Fullscreen failed:", error.message);
}
```

**Note:** Must be called in response to user interaction due to browser security restrictions.

#### `exitFullscreen(): Promise<void>`
Exit fullscreen mode.

```javascript
await api.exitFullscreen();
```

#### `toggleFullscreen(): Promise<void>`
Toggle fullscreen mode.

```javascript
await api.toggleFullscreen();
```

### Full Window Control

#### `isFullWindow(): boolean`
Check if chart is in full window mode.

```javascript
const inFullWindow = api.isFullWindow(); // true/false
```

#### `enterFullWindow(): void`
Enter full window mode (maximizes chart within the page).

```javascript
api.enterFullWindow();
```

#### `exitFullWindow(): void`
Exit full window mode.

```javascript
api.exitFullWindow();
```

#### `toggleFullWindow(): void`
Toggle full window mode.

```javascript
api.toggleFullWindow();
```

### State & Utility

#### `getState(): ChartState`
Get the current chart state.

```javascript
const state = api.getState();
console.log(state.symbol, state.granularity, state.indicators);
```

#### `isLoading(): boolean`
Check if chart is currently loading data.

```javascript
const loading = api.isLoading(); // true/false
```

#### `redraw(): void`
Force a chart redraw.

```javascript
api.redraw();
```

#### `getContainer(): ChartContainer`
Get the chart container element.

```javascript
const container = api.getContainer();
```

#### `getApp(): App`
Get the underlying App instance.

```javascript
const app = api.getApp();
```

### Event System

#### `on(event, callback): void`
Add an event listener.

```javascript
api.on('symbolChange', (data) => {
  console.log('Symbol changed from', data.oldSymbol, 'to', data.newSymbol);
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
```

#### `off(event, callback): void`
Remove an event listener.

```javascript
const handler = (data) => console.log(data);
api.on('symbolChange', handler);
api.off('symbolChange', handler);
```

**Available Events:**
- `symbolChange` - Fired when symbol changes
- `granularityChange` - Fired when granularity changes
- `indicatorChange` - Fired when indicators change
- `fullscreenChange` - Fired when fullscreen/fullwindow state changes

### Cleanup

#### `dispose(): void`
Clean up the API instance.

```javascript
api.dispose();
```

## TypeScript Support

The Chart API is fully typed for TypeScript users:

```typescript
import { 
  ChartApi, 
  Granularity, 
  ApiIndicatorConfig,
  InitChartResult 
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

## Error Handling

```javascript
try {
  await api.setSymbol("INVALID-SYMBOL");
} catch (error) {
  console.error("Failed to change symbol:", error);
}

// Event-based error handling
api.on('error', (error) => {
  console.error("Chart error:", error);
});
```

## Performance Considerations

- **Batching**: When making multiple changes, consider using `setIndicators()` instead of multiple `showIndicator()` calls
- **Debouncing**: Debounce rapid API calls, especially symbol/granularity changes
- **Memory**: Always call `dispose()` when cleaning up to prevent memory leaks
- **Async Operations**: Symbol and granularity changes are async and trigger data fetches

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