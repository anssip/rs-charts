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
    display: flex;
    flex-direction: column;
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

  .chart-area:has(candlestick-chart.active) {
    box-shadow: 0 4px 12px
      color-mix(in srgb, var(--color-accent-1) 30%, transparent);
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
    z-index: 8;
  }

  .chart {
    position: relative;
    flex: 1;
    min-height: 0;
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

  .volume-chart {
    position: absolute;
    bottom: ${timelineHeight}px;
    left: 0;
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
    height: 25%;
    pointer-events: none;
    z-index: 2;
    background: none;
  }

  volume-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    background: none;
  }

  .price-axis-container,
  .timeline-container {
    position: absolute;
    background: var(--color-primary-dark);
    z-index: 4;
  }

  .price-axis-container {
    right: 0;
    top: 0;
    width: var(--price-axis-width, ${priceAxisWidth}px);
    height: calc(100% - ${timelineHeight}px);
  }

  :host(:fullscreen) .price-axis-container,
  :host(.full-window) .price-axis-container {
    height: calc(100% - ${timelineHeight}px);
  }

  chart-timeline {
    display: block;
    width: 100%;
    height: 100%;
    pointer-events: auto;
  }

  .timeline-container {
    bottom: 0;
    left: 0px;
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
    height: ${timelineHeight}px;
    pointer-events: auto;
  }

  candlestick-chart {
    position: absolute;
    top: 0;
    left: 0;
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
    height: calc(100% - ${timelineHeight}px);
    pointer-events: auto;
    z-index: 2;
    cursor: default;
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
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
    height: calc(100% - ${timelineHeight}px);
    pointer-events: none;
    z-index: 6;
  }

  chart-crosshairs {
    position: absolute;
    top: 0;
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
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
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
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    pointer-events: none;
  }

  .bottom-indicators {
    position: absolute;
    left: 0;
    width: calc(100% - var(--price-axis-width, ${priceAxisWidth}px));
    height: 200px;
    pointer-events: none;
    bottom: 30px;
  }

  .chart-area:has(indicator-stack) .bottom-indicators {
    bottom: -150px;
  }

  indicator-stack {
    width: 100%;
    min-height: 150px;
    border-top: 1px solid var(--chart-grid-line-color, #363c4e);
    margin-top: 150px;
  }
`;
