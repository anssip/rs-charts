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

- [x] Volume chart
- [ ] Use fonts and colors from the brand guide
- [ ] Deploy to GCP or AWS with some CDN.
- [ ] Add a loading indicator on top of the chart area (with SpotCanvas logo)
- [x] Fix timeline to not drow labels too close to each other
- [x] Refactor grid drawing to use new timeline iterator
- [x] Fix candle alignment to center on granularities (30 minute candles are centered on exact hour or 30 minute mark)
- [ ] Add iteratePriceRange to draw price labels and grid lines
- [ ] Refactor to use the ChartManager
- [x] Add textual live price info
- [x] Add product selector
- [ ] Add granularity selector
- [ ] Live candle to a separate canvas?
- [x] Add crosshairs
- [x] Remove viewportStartTimestamp and viewportEndTimestamp variables and use state.timeRange instead

### After MVP

- [ ] Binance integration
- [ ] Scripting
- [ ] Indicators
- [ ] API
- [ ] Trading

# User Documentation

## Keyboard Shortcuts

### Symbol Selection

You can search for a symbol by typing the first letter or two of the symbol. This will open the symbol selector modal. Once open, you can use the arrow keys to navigate through the list. Pressing enter will select the symbol and close the modal.

### Time interval selection

Press any digit to open the time interval selector. Use the arrow keys to navigate through the list. Press enter to select the time interval.
