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

- [x] Add textual live price info
- [ ] Add product selector
- [ ] Add 15 min granularity
- [ ] Live candle to a separate canvas?
- [x] Add crosshairs
- [x] Remove viewportStartTimestamp and viewportEndTimestamp variables and use state.timeRange instead

# User Documentation

## Keyboard Shortcuts

### Symbol Selection

You can search for a symbol by typing the first letter or two of the symbol. This will open the symbol selector modal. Once open, you can use the arrow keys to navigate through the list. Pressing enter will select the symbol and close the modal.

### Time interval selection

Press any digit to open the time interval selector. Use the arrow keys to navigate through the list. Press enter to select the time interval.
