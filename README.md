# Rekt Sense Charts

A modern financial charting library built with Lit web components for real-time cryptocurrency price visualization.

## Features

- **Real-time candlestick charts** with live price updates via Firebase
- **Multiple timeframes** (1m, 5m, 15m, 30m, 1h, 2h, 6h, 1d)
- **Technical indicators** (RSI, MACD, Moving Averages, Bollinger Bands, Volume, and more)
- **Interactive controls** with pan, zoom, and touch/mobile support
- **Framework integration** ready for React, Vue, Angular, and vanilla JavaScript
- **TypeScript support** with full type definitions
- **Trading overlays** including trend lines, annotations, and paper trading visualization

## Screenshot

![Screenshot](screenshot.png)

## Installation

```bash
npm install @anssipiirainen/sc-charts
```

## Quick Start

```javascript
import { initChartWithApi, createChartContainer } from '@anssipiirainen/sc-charts';

// Create chart container
const chartContainer = createChartContainer();
document.body.appendChild(chartContainer);

// Firebase configuration (required for real-time data)
const firebaseConfig = {
  projectId: "your-project-id",
  apiKey: "your-api-key",
  authDomain: "your-domain.firebaseapp.com",
};

// Initialize the chart
const { app, api } = initChartWithApi(chartContainer, firebaseConfig, {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
});

// Control the chart programmatically
await api.setSymbol("ETH-USD");
api.showIndicator({ id: "rsi", name: "RSI", visible: true });
```

## React Integration

```tsx
import { useRef, useEffect } from 'react';
import { initChartWithApi, createChartContainer, ChartApi } from '@anssipiirainen/sc-charts';

function TradingChart({ firebaseConfig }) {
  const containerRef = useRef(null);
  const apiRef = useRef<ChartApi | null>(null);

  useEffect(() => {
    const chartContainer = createChartContainer();
    containerRef.current.appendChild(chartContainer);

    const { api } = initChartWithApi(chartContainer, firebaseConfig, {
      symbol: "BTC-USD",
      granularity: "ONE_HOUR"
    });
    apiRef.current = api;

    return () => api.dispose();
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '600px' }} />;
}
```

## Chart API

Control the chart programmatically with a comprehensive API:

```javascript
// Symbol and timeframe
await api.setSymbol("ETH-USD");
await api.setGranularity("FIVE_MINUTE");

// Indicators
api.showIndicator({ id: "rsi", name: "RSI", visible: true });
api.hideIndicator("macd");

// Fullscreen modes
await api.toggleFullscreen();
api.toggleFullWindow();

// Event listeners
api.on('symbolChange', (data) => {
  console.log(`Symbol changed to ${data.newSymbol}`);
});

api.on('indicatorChange', (data) => {
  console.log(`Indicator ${data.action}:`, data.indicator);
});
```

## Documentation

- **[Chart API Reference](doc/CHART_API_REFERENCE.md)** - Complete API documentation with all methods and events
- **[Paper Trading Plan](doc/paper-trading-plan.md)** - Trading features and paper trading visualization
- **[Firebase Usage](doc/FIREBASE_USAGE.md)** - Firebase integration guide for real-time data
- **[Implementation Summary](doc/IMPLEMENTATION_SUMMARY.md)** - Architecture and implementation details

## Available Timeframes

- `ONE_MINUTE` - 1 minute candles
- `FIVE_MINUTE` - 5 minute candles
- `FIFTEEN_MINUTE` - 15 minute candles
- `THIRTY_MINUTE` - 30 minute candles
- `ONE_HOUR` - 1 hour candles
- `TWO_HOUR` - 2 hour candles
- `SIX_HOUR` - 6 hour candles
- `ONE_DAY` - 1 day candles

## Technical Indicators

- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- EMA (Exponential Moving Average)
- SMA (Simple Moving Average)
- Bollinger Bands
- Volume
- And more...

## Development

```bash
# Install dependencies
bun install

# Development server with hot reload
bun run dev

# Run tests
bun test

# Build library for distribution
bun run build:lib

# Build complete application
bun run build
```

## TypeScript Support

Full TypeScript definitions are included:

```typescript
import { 
  initChartWithApi,
  ChartApi,
  ChartState,
  Granularity,
  IndicatorConfig
} from '@anssipiirainen/sc-charts';

const state: Partial<ChartState> = {
  symbol: "BTC-USD",
  granularity: "ONE_HOUR"
};

const { api } = initChartWithApi(container, firebaseConfig, state);
```

## Browser Compatibility

- Modern browsers with ES2020+ support
- WebComponents support required
- Firebase 9+ compatible

## Related Projects

This library is part of the Spot Canvas "ecosystem":

- [sc-app – Spot Canvas website and charts application with AI Assistend technical analysis](https://github.com/anssip/sc-app)
- [market-evaluators – Indicators backend for Spot Canvas and this library](https://github.com/anssip/market_evaluators)
- [spot-server – Price data ingestion](https://github.com/anssip/spot-server)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.
