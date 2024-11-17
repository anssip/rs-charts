# Rekt Sense Charts

Candlestick charting built with Web Components.

very much a work in progress.

## Install

```bash
bun install
```

## Run

You need a .env file with the Coinbase API keys.

```bash
bun run dev
```

## TODO

- add Zustand
- introduce CanvasComponent base class with `initializeCanvas`, `resize`
- introduce PriceHistoryComponent base class extending CanvasComponent, subscribing to price history state

- Fix timeline 
- Add zooming
- Live update for price (last candle)