# Rekt Sense Charts

A financial charting library built with Lit web components for modern web applications.

## Installation

```bash
npm install @anssipiirainen/sc-charts
```

## Quick Start

```javascript
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

// Create and append chart container to DOM
const chartContainer = createChartContainer();
document.body.appendChild(chartContainer);

// Firebase configuration for data backend
const firebaseConfig = {
  projectId: "your-project-id",
  apiKey: "your-api-key",
  authDomain: "your-domain.firebaseapp.com",
};

// Initialize the chart with API access
const { app, api } = initChartWithApi(chartContainer, firebaseConfig);
```

## Configuration Options

You can customize the initial chart state:

```javascript
const initialState = {
  symbol: "ETH-USD",
  granularity: "FIVE_MINUTE",
  loading: false,
  indicators: []
};

const { app, api } = initChartWithApi(chartContainer, firebaseConfig, initialState);
```

## Available Exports

- `initChart(container, firebaseConfig, initialState?)` - Legacy initialization function (returns App only)
- `initChartWithApi(container, firebaseConfig, initialState?)` - Enhanced initialization function (returns { app, api })
- `createChartContainer()` - Factory function to create chart container element
- `ChartContainer` - Chart container web component class
- `ChartApi` - Chart API class for external control
- `createChartApi(container, app)` - Factory function to create Chart API
- `ChartState` - TypeScript type for chart state
- `IndicatorConfig` - TypeScript type for indicator configuration
- `Granularity` - TypeScript type for time granularities
- `getAllGranularities()` - Get all available granularities
- `granularityLabel(granularity)` - Get human-readable granularity label
- `logger` - Logging utility
- `setProductionLogging()` - Switch to production logging mode

## Supported Features

- Real-time candlestick charts
- Multiple timeframes (1m, 5m, 15m, 30m, 1h, 2h, 6h, 1d)
- Technical indicators (RSI, MACD, Moving Averages, Bollinger Bands, etc.)
- Volume charts
- Interactive pan and zoom
- Touch/mobile support
- Customizable styling
- External API control for React/Vue/Angular integration
- Fullscreen and full-window modes
- Dynamic symbol and timeframe switching

## React Integration

### React Wrapper Component

Create a React wrapper component for the chart:

```tsx
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  initChartWithApi, 
  createChartContainer, 
  ChartState, 
  ChartContainer, 
  App, 
  ChartApi,
  Granularity 
} from '@anssipiirainen/sc-charts';

interface SCChartProps {
  firebaseConfig: any;
  initialState?: Partial<ChartState>;
  className?: string;
  style?: React.CSSProperties;
}

export interface SCChartRef {
  api: ChartApi | null;
  app: App | null;
  setSymbol: (symbol: string) => Promise<void>;
  setGranularity: (granularity: Granularity) => Promise<void>;
  toggleFullscreen: () => Promise<void>;
  toggleFullWindow: () => void;
  showIndicator: (id: string, name: string) => void;
  hideIndicator: (id: string) => void;
}

export const SCChart = forwardRef<SCChartRef, SCChartProps>(({
  firebaseConfig,
  initialState,
  className,
  style
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ChartContainer | null>(null);
  const appRef = useRef<App | null>(null);
  const apiRef = useRef<ChartApi | null>(null);

  // Expose API methods through ref
  useImperativeHandle(ref, () => ({
    api: apiRef.current,
    app: appRef.current,
    setSymbol: async (symbol: string) => {
      await apiRef.current?.setSymbol(symbol);
    },
    setGranularity: async (granularity: Granularity) => {
      await apiRef.current?.setGranularity(granularity);
    },
    toggleFullscreen: async () => {
      await apiRef.current?.toggleFullscreen();
    },
    toggleFullWindow: () => {
      apiRef.current?.toggleFullWindow();
    },
    showIndicator: (id: string, name: string) => {
      apiRef.current?.showIndicator({ id, name, visible: true });
    },
    hideIndicator: (id: string) => {
      apiRef.current?.hideIndicator(id);
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    // Create and append chart container
    const chartContainer = createChartContainer();
    chartRef.current = chartContainer;
    containerRef.current.appendChild(chartContainer);

    // Initialize the chart with API
    const { app, api } = initChartWithApi(chartContainer, firebaseConfig, initialState);
    appRef.current = app;
    apiRef.current = api;

    return () => {
      // Cleanup on unmount
      if (appRef.current) {
        appRef.current.cleanup();
      }
      if (apiRef.current) {
        apiRef.current.dispose();
      }
      if (chartRef.current && containerRef.current) {
        containerRef.current.removeChild(chartRef.current);
      }
    };
  }, [firebaseConfig, initialState]);

  return <div ref={containerRef} className={className} style={style} />;
});
```

### Usage in React/Remix

```tsx
import React, { useRef } from 'react';
import { SCChart, SCChartRef } from './components/SCChart';

const firebaseConfig = {
  projectId: "your-project-id",
  apiKey: "your-api-key",
  authDomain: "your-domain.firebaseapp.com",
};

function TradingPage() {
  const chartRef = useRef<SCChartRef>(null);
  
  const initialState = {
    symbol: "BTC-USD",
    granularity: "ONE_HOUR" as const,
  };

  const handleSymbolChange = async (symbol: string) => {
    await chartRef.current?.setSymbol(symbol);
  };

  const handleTimeframeChange = async (granularity: string) => {
    await chartRef.current?.setGranularity(granularity as any);
  };

  const toggleFullscreen = async () => {
    await chartRef.current?.toggleFullscreen();
  };

  const showRSI = () => {
    chartRef.current?.showIndicator('rsi', 'RSI');
  };

  return (
    <div className="trading-dashboard">
      <h1>Trading Dashboard</h1>
      
      {/* Chart Controls */}
      <div className="chart-controls">
        <button onClick={() => handleSymbolChange('BTC-USD')}>BTC-USD</button>
        <button onClick={() => handleSymbolChange('ETH-USD')}>ETH-USD</button>
        <button onClick={() => handleTimeframeChange('FIVE_MINUTE')}>5m</button>
        <button onClick={() => handleTimeframeChange('ONE_HOUR')}>1h</button>
        <button onClick={() => handleTimeframeChange('ONE_DAY')}>1d</button>
        <button onClick={toggleFullscreen}>Toggle Fullscreen</button>
        <button onClick={showRSI}>Show RSI</button>
      </div>

      <SCChart
        ref={chartRef}
        firebaseConfig={firebaseConfig}
        initialState={initialState}
        style={{ width: '100%', height: '600px' }}
        className="trading-chart"
      />
    </div>
  );
}
```

### Remix Route Example

```tsx
// app/routes/trading.tsx
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { SCChart, SCChartRef } from "~/components/SCChart";
import { useRef, useEffect } from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  // Load any server-side data if needed
  return {
    firebaseConfig: {
      projectId: process.env.FIREBASE_PROJECT_ID,
      apiKey: process.env.FIREBASE_API_KEY,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    }
  };
}

export default function TradingRoute() {
  const { firebaseConfig } = useLoaderData<typeof loader>();
  const chartRef = useRef<SCChartRef>(null);

  useEffect(() => {
    // Example: Listen for chart events
    const api = chartRef.current?.api;
    if (api) {
      api.on('symbolChange', (data) => {
        console.log('Symbol changed:', data);
      });
      
      api.on('granularityChange', (data) => {
        console.log('Granularity changed:', data);
      });
    }
  }, []);

  return (
    <div>
      <h1>Trading Charts</h1>
      <SCChart
        ref={chartRef}
        firebaseConfig={firebaseConfig}
        initialState={{ symbol: "ETH-USD", granularity: "ONE_HOUR" }}
        style={{ width: '100%', height: '500px' }}
      />
    </div>
  );
}
```

## TypeScript Support

This library is written in TypeScript and includes full type definitions.

```typescript
import { 
  initChartWithApi, 
  ChartState, 
  IndicatorConfig, 
  ChartApi,
  Granularity,
  getAllGranularities 
} from '@anssipiirainen/sc-charts';

const state: Partial<ChartState> = {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
};

// Example: Using the Chart API
const { app, api } = initChartWithApi(container, firebaseConfig, state);

// Change symbol
await api.setSymbol("ETH-USD");

// Change timeframe
await api.setGranularity("FIVE_MINUTE");

// Show indicators
api.showIndicator({
  id: "rsi",
  name: "RSI",
  visible: true
});

// Enter fullscreen
await api.enterFullscreen();

// Get available granularities
const granularities: Granularity[] = getAllGranularities();
```

## Chart API

The Chart API provides programmatic control over chart functionality, perfect for React, Vue, Angular, or vanilla JavaScript integration.

### API Methods

#### Symbol Control
- `getSymbol()` - Get current symbol
- `setSymbol(symbol)` - Change symbol (e.g., "BTC-USD", "ETH-USD")

#### Granularity Control  
- `getGranularity()` - Get current timeframe
- `setGranularity(granularity)` - Change timeframe
- `getAvailableGranularities()` - Get all available timeframes

#### Indicator Control
- `getVisibleIndicators()` - Get currently visible indicators
- `isIndicatorVisible(id)` - Check if indicator is visible
- `showIndicator(config)` - Show an indicator
- `hideIndicator(id)` - Hide an indicator
- `toggleIndicator(id, config?)` - Toggle indicator visibility
- `setIndicators(indicators)` - Set multiple indicators at once

#### Fullscreen Control
- `isFullscreen()` - Check if in fullscreen mode
- `enterFullscreen()` - Enter fullscreen mode
- `exitFullscreen()` - Exit fullscreen mode
- `toggleFullscreen()` - Toggle fullscreen mode

#### Full Window Control
- `isFullWindow()` - Check if in full window mode
- `enterFullWindow()` - Enter full window mode
- `exitFullWindow()` - Exit full window mode
- `toggleFullWindow()` - Toggle full window mode

#### State & Utility
- `getState()` - Get current chart state
- `isLoading()` - Check if chart is loading
- `redraw()` - Force chart redraw
- `getContainer()` - Get chart container element
- `getApp()` - Get app instance

#### Event System
- `on(event, callback)` - Add event listener
- `off(event, callback)` - Remove event listener

### Available Events

- `symbolChange` - Fired when symbol changes
- `granularityChange` - Fired when granularity changes  
- `indicatorChange` - Fired when indicators change
- `fullscreenChange` - Fired when fullscreen/fullwindow state changes

## Browser Compatibility

- Modern browsers with ES2020+ support
- WebComponents support required
- Firebase 9+ compatible

## License

MIT