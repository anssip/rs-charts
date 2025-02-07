import { css } from "lit";

export const getStyles = (
  priceAxisWidth: number,
  timelineHeight: number
) => css`
  :host {
    display: block;
    width: 100%;
    height: var(--spotcanvas-chart-height, 600px);
    min-height: 400px;
  }

  :host(:fullscreen),
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

  :host(:fullscreen) .container,
  :host(.full-window) .container {
    height: 100%;
    overflow: hidden;
  }

  .container {
    display: grid;
    grid-template-areas:
      "price-info"
      "indicators-top"
      "chart"
      "indicators-bottom"
      "timeline";
    grid-template-rows: auto auto 1fr auto auto;
    width: 100%;
    height: 100%;
    background-color: var(--color-primary-dark);
    gap: 8px;
    padding: 0 16px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    z-index: 1;
    isolation: isolate;
  }

  .chart-area {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  :host(:fullscreen) .chart-area,
  :host(.full-window) .chart-area {
    height: calc(100vh - 200px);
  }

  .container.fullscreen,
  .container.full-window {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    padding: 16px;
  }

  .container.fullscreen .chart-area,
  .container.full-window .chart-area {
    height: calc(100vh - 120px);
  }

  .price-info {
    flex: 0 0 auto;
    background: var(--color-primary-dark);
    border-radius: 12px;
    margin: 8px 0;
    padding: 12px 16px;
    border: 1px solid rgba(143, 143, 143, 0.2);
    position: relative;
    z-index: 10;
  }

  .chart {
    position: relative;
    flex: 1;
    min-height: 0;
    width: 100%;
  }

  .activate-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    backdrop-filter: blur(8px);
    background: transparent;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 1.5em;
    font-weight: 600;
    color: var(--color-accent-2);
    z-index: 10;
    cursor: pointer;
    opacity: 0.8;
    transition: opacity 0.2s ease-in-out;
    pointer-events: auto;
  }

  .activate-label:hover {
    opacity: 1;
  }

  .activate-label.hidden {
    display: none;
  }

  chart-timeline {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  .timeline-container {
    height: ${timelineHeight}px;
    position: relative;
  }

  candlestick-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  candlestick-chart.active {
    cursor: crosshair;
  }

  candlestick-chart.active:active {
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
  }

  chart-logo {
    position: absolute;
    bottom: ${timelineHeight + 8}px;
    z-index: 7;
  }

  indicator-container {
    position: absolute;
    bottom: ${timelineHeight}px;
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

  /* Stack positioning - outside chart-area */
  indicator-stack {
    position: relative;
    width: 100%;
    height: 80px;
    border-top: 1px solid var(--chart-grid-line-color, #363c4e);
    display: flex;
    flex-direction: column;
  }

  indicator-stack indicator-container {
    position: relative;
    flex: 1;
    width: 100%;
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
`;
