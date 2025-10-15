import { css } from "lit";

const INDICATOR_HEIGHT = 150; // Height per stacked indicator

export const getStyles = (
  priceAxisWidth: number,
  timelineHeight: number,
) => css`
  :host {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 400px;
  }

  :host(.full-window) {
    background: var(--color-primary-dark);
    padding: 16px;
    box-sizing: border-box;
    height: 100vh;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1000;
  }

  :host(.full-window) .chart-wrapper {
    height: 100%;
    overflow: hidden;
  }

  .chart-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background-color: var(--color-primary-dark);
    min-height: 0; /* Allow flex children to shrink */
  }

  .container {
    display: grid;
    grid-template-areas:
      "indicators-top"
      "chart-area";
    grid-template-columns: minmax(0, 1fr);
    flex: 1 1 auto; /* Allow to grow and shrink */
    background-color: var(--color-primary-dark);
    gap: 0px;
    padding: 0;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }

  .chart-area {
    grid-area: chart-area;
    position: relative;
    min-height: 120px; /* Minimum height for chart area */
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    height: 100%;
    flex: 1;
    pointer-events: auto;
  }

  .chart {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    height: 100%;
    overflow: hidden;
    pointer-events: auto;
  }

  chart-timeline {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  .timeline-container {
    flex: 0 0 ${timelineHeight}px;
    height: ${timelineHeight}px;
    min-height: ${timelineHeight}px;
    position: relative;
    overflow: hidden;
    background-color: var(--color-primary-dark);
    width: 100%;
  }

  .candlestick-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
    cursor: crosshair;
  }

  .candlestick-chart:active {
    cursor: grabbing;
  }

  live-decorators {
    display: block;
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% - ${priceAxisWidth}px);
    height: 100%;
    pointer-events: none;
    z-index: 6;
  }

  chart-crosshairs {
    position: absolute;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 5;
    pointer-events: none;
    cursor: crosshair;
  }

  chart-crosshairs > * {
    pointer-events: all;
  }

  price-axis {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  chart-logo {
    position: absolute;
    bottom: 8px;
    z-index: 7;
  }

  indicator-container {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 25%;
    pointer-events: none;
    z-index: 2;
    background: none;
  }

  indicator-container[hidden] {
    display: none;
  }

  .overlay-indicators {
    position: absolute;
    height: 100%;
    top: 0;
    left: 0;
    width: 100%;
    pointer-events: none;
    z-index: 2;
  }

  .bottom-indicators {
    position: absolute;
    left: 0;
    width: 100%;
    height: 20%;
    pointer-events: none;
    bottom: 0;
    z-index: 5;
    background: none;
  }

  indicator-container.bottom-indicators {
    position: absolute;
    width: 100%;
    height: 20%;
  }

  indicator-stack {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  indicator-stack.main-chart {
    flex: 1;
    min-height: 0;
    overflow: hidden;
    height: 100%;
    pointer-events: none;
    cursor: crosshair;
  }

  indicator-stack.main-chart:active {
    cursor: grabbing;
  }

  /* Allow specific interactive elements to receive pointer events */
  indicator-stack.main-chart candlestick-chart,
  indicator-stack.main-chart price-axis {
    pointer-events: auto;
  }

  /* Style elements by their grid area attribute */
  [grid-area="indicators-top"] {
    border-bottom: 1px solid var(--chart-grid-line-color, #363c4e);
    height: 100%;
  }

  [grid-area="indicators-bottom"] {
    border-top: 1px solid var(--chart-grid-line-color, #363c4e);
  }

  [grid-area="chart-area"] {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex: 1;
    pointer-events: auto;
  }

  /* Add grid-crosshairs styling to extend crosshairs over the entire container */
  chart-crosshairs.grid-crosshairs {
    grid-area: 1 / 1 / -1 / -1;
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 9; /* higher than bottom indicators */
    pointer-events: none;
    cursor: crosshair;
  }

  /* Add styles for overlay indicator names */
  .indicator-names {
    position: absolute;
    top: 8px;
    left: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 5;
  }

  .indicator-name {
    font-size: 11px;
    color: var(--color-accent-2);
    font-family: var(--font-secondary);
    font-weight: 500;
    opacity: 0.7;
    white-space: nowrap;
  }

  /* Style for the candlestick chart inside the indicator stack */
  indicator-stack.main-chart ::slotted(candlestick-chart) {
    position: relative;
    width: 100%;
    height: 100%;
    flex: 1;
    cursor: crosshair;
  }

  indicator-stack.main-chart:active ::slotted(candlestick-chart) {
    cursor: grabbing;
  }

  /* Styles for the chart with overlays container */
  .chart-with-overlays {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Main chart sizing and positioning */
  .chart-with-overlays candlestick-chart {
    width: 100%;
    flex: 1;
    z-index: 2;
  }

  /* Volume chart container */
  .volume-chart {
    width: 100%;
    height: 25%;
    margin-top: auto; /* Push to bottom with flexbox */
    z-index: 3;
    background-color: transparent; /* Transparent background to see gridlines */
  }

  /* Make sure hidden volume chart doesn't take up space */
  .volume-chart[hidden] {
    display: none !important;
  }

  /* Volume chart component itself */
  volume-chart {
    width: 100%;
    height: 100%;
  }

  /* Fix pointer events for price-axis */
  candlestick-chart .price-axis-container {
    pointer-events: auto;
    z-index: 10;
  }

  /* Ensure overlay elements don't block the price-axis */
  .overlay-indicators,
  .indicator-names,
  live-decorators,
  .chart-with-overlays candlestick-chart {
    pointer-events: none;
  }

  /* Allow controls within the overlays to receive events */
  .overlay-indicators *,
  .indicator-names * {
    pointer-events: auto;
  }

  .volume-chart[hidden] {
    display: none !important;
  }

  .volume-chart {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 25%;
    pointer-events: none;
    z-index: 3;
  }

  volume-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  /* Make sure the chart area positions elements correctly */
  .chart-area {
    position: relative !important;
  }

  /* Make sure chart-with-overlays has proper positioning context */
  .chart-with-overlays {
    position: relative !important;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  /* Adjust main chart to accommodate volume chart at bottom */
  .chart-with-overlays candlestick-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
  }

  /* Overlay indicators positioning */
  .chart-with-overlays .overlay-indicators {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2;
    pointer-events: none;
  }

  /* Stack item styling */
  indicator-stack .stack-item {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  indicator-stack indicator-container {
    position: relative;
    height: 100%;
    width: 100%;
    flex: 1;
  }

  /* Flexbox container for top overlays (live-candle-display and position-overlay) */
  .top-overlays-container {
    position: absolute;
    top: 10px;
    left: 10px;
    display: flex;
    flex-direction: row;
    gap: 10px;
    align-items: flex-start;
    pointer-events: none;
    z-index: 100;
  }

  .top-overlays-container > * {
    pointer-events: auto;
  }
`;
