import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  granularityToMs,
  SimplePriceHistory,
} from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import "./price-axis";
import "./live-decorators";
import "./crosshairs";
import "./price-info";
import "./toolbar/top-toolbar";
import "./volume-chart";
import { CandlestickChart, ChartOptions } from "./chart";
import { TimeRange } from "../../candle-repository";
import { DrawingContext } from "./drawing-strategy";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getCandleInterval, priceToY, timeToX } from "../../util/chart-util";
import { touch } from "xinjs";
import { CoinbaseProduct } from "../../api/firestore-client";

// We store data 5 times the visible range to allow for zooming and panning without fetching more data
const BUFFER_MULTIPLIER = 1;
export const TIMELINE_HEIGHT = 40;

@customElement("chart-container")
export class ChartContainer extends LitElement {
  @state()
  private _state: ChartState = {
    priceRange: new PriceRangeImpl(0, 0),
    priceHistory: new SimplePriceHistory("ONE_HOUR", new Map()),
    timeRange: { start: 0, end: 0 },
    liveCandle: null,
    canvasWidth: 0,
    canvasHeight: 0,
    symbol: "BTC-USD",
    granularity: "ONE_HOUR",
  };

  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver!: ResizeObserver;

  private chart: CandlestickChart | null = null;

  private padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 15,
    candleGap: 2,
    minCandleWidth: 2,
    maxCandleWidth: 100,
  };

  // Add zoom factor to control how much the timeline affects the viewport
  private readonly ZOOM_FACTOR = 0.005;

  constructor() {
    super();
    console.log("ChartContainer: Constructor called");
  }

  connectedCallback() {
    super.connectedCallback();
    console.log("ChartContainer: Connected to DOM");
  }

  set startTimestamp(startTimestamp: number) {
    this._state.timeRange.start = startTimestamp;
  }

  set endTimestamp(endTimestamp: number) {
    this._state.timeRange.end = endTimestamp;
  }

  firstUpdated() {
    console.log("ChartContainer: First update completed");

    const chartContainer = this.renderRoot.querySelector(".chart");
    if (chartContainer) {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          this.handleResize(width, height);
        }
      });
      this.resizeObserver.observe(chartContainer);
    }

    const chartElement = this.renderRoot.querySelector("candlestick-chart");
    console.log("chartElement", chartElement);
    this.chart = chartElement as CandlestickChart;

    if (chartElement) {
      chartElement.addEventListener(
        "mousedown",
        this.handleDragStart as EventListener
      );
      chartElement.addEventListener(
        "mousemove",
        this.handleDragMove as EventListener
      );
      chartElement.addEventListener(
        "mouseup",
        this.handleDragEnd as EventListener
      );
      chartElement.addEventListener(
        "mouseleave",
        this.handleDragEnd as EventListener
      );
      chartElement.addEventListener("wheel", this.handleWheel as EventListener);
    }

    // Forward chart-ready and chart-pan events from the candlestick chart
    if (this.chart) {
      this.chart.addEventListener("chart-ready", (e: Event) => {
        console.log(
          "ChartContainer: Chart ready event received",
          (e as CustomEvent).detail
        );
        this.dispatchEvent(
          new CustomEvent("chart-ready", {
            detail: (e as CustomEvent).detail,
            bubbles: true,
            composed: true,
          })
        );
      });
    }

    window.addEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );

    window.addEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener
    );
  }

  updated() {
    console.log("ChartContainer: Updated");
    this.draw();
  }

  draw() {
    if (!this.chart || !this.chart.canvas) return;
    const context: DrawingContext = {
      ctx: this.chart.ctx!,
      chartCanvas: this.chart.canvas!,
      data: this._state.priceHistory,
      options: this.calculateCandleOptions(),
      viewportStartTimestamp: this._state.timeRange.start,
      viewportEndTimestamp: this._state.timeRange.end,
      priceRange: this._state.priceRange,
      axisMappings: {
        timeToX: timeToX(this.chart.canvas!.width, this._state.timeRange),
        priceToY: priceToY(this.chart.canvas!.height, {
          start: this._state.priceRange.min,
          end: this._state.priceRange.max,
        }),
      },
    };
    console.log("ChartContainer: Drawing chart", context);
    this.chart.drawWithContext(context);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    window.removeEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );
  }

  @property({ type: Object })
  set state(state: ChartState) {
    console.log("ChartContainer: Setting state", {
      min: state.priceRange.min,
      max: state.priceRange.max,
    });
    this._state = state;
  }

  render() {
    return html`
      <div class="container">
        <div class="toolbar-top">
          <top-toolbar
            .products=${this.products}
            .state=${this._state}
          ></top-toolbar>
        </div>
        <div class="chart-area">
          <div class="price-info">
            <price-info
              .product=${this._state.liveCandle?.productId}
            ></price-info>
          </div>
          <div class="chart">
            <candlestick-chart></candlestick-chart>
          </div>
          <div class="volume-chart">
            <volume-chart></volume-chart>
          </div>

          <live-decorators></live-decorators>
          <chart-crosshairs></chart-crosshairs>
          <div class="price-axis-container">
            <price-axis></price-axis>
          </div>
          <div class="timeline-container">
            <chart-timeline
              .options=${this.options}
              .padding=${this.padding}
            ></chart-timeline>
          </div>
        </div>
      </div>
    `;
  }

  private handleResize(width: number, height: number) {
    if (!this.chart) return;
    if (this._state.priceHistory.getCandles().size === 0) {
      this.chart.resize(width, height);
      return;
    }
    if (this._state.timeRange.end === 0) {
      return;
    }
    this.chart.resize(width, height);

    const visibleCandles = this.calculateVisibleCandles();
    const newStartTimestamp =
      this._state.timeRange.end -
      visibleCandles * getCandleInterval(this.state.granularity);

    if (
      newStartTimestamp > 0 &&
      newStartTimestamp < this._state.timeRange.end
    ) {
      this._state.timeRange = {
        start: newStartTimestamp,
        end: this._state.timeRange.end,
      };
      this.draw();
    }
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    this.handlePan(deltaX);
    this.handleVerticalPan(deltaY);

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;

    this.handlePan(e.deltaX, isTrackpad);
    this.handleVerticalPan(e.deltaY, isTrackpad);
  };

  private handlePan(deltaX: number, isTrackpad = false) {
    if (!this.chart) return;

    const timeRange = this._state.timeRange.end - this._state.timeRange.start;

    const viewportWidth =
      this.chart.canvas!.width / (window.devicePixelRatio ?? 1);
    const timePerPixel = timeRange / viewportWidth;

    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    const newStart = this._state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    this._state.timeRange = { start: newStart, end: newEnd };
    this.draw();

    // Check if we need more data
    // if (this._state.loading?.valueOf() ?? false) {
    //   console.log("ChartContainer: Loading, not fetching more data");
    //   return;
    // }
    const visibleTimeRange = timeRange;
    const bufferZone = visibleTimeRange * BUFFER_MULTIPLIER;

    const direction = timeShift > 0 ? "backward" : "forward";
    const needMoreData =
      (direction === "backward" &&
        newStart <
          Number(this._state.priceHistory.startTimestamp) + bufferZone) ||
      (direction === "forward" &&
        newEnd > Number(this._state.priceHistory.endTimestamp) - bufferZone);

    if (needMoreData) {
      console.log("ChartContainer: Need more data", {
        reason:
          newStart <
            Number(this._state.priceHistory.startTimestamp) + bufferZone &&
          direction === "backward"
            ? "Close to start"
            : "Close to end",
      });
      this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
    }
  }

  private handleVerticalPan(deltaY: number, isTrackpad = false) {
    if (!this.chart || !this._state.priceRange) return;

    const availableHeight =
      this.chart.canvas!.height / (window.devicePixelRatio ?? 1);
    const pricePerPixel = this._state.priceRange.range / availableHeight;

    const sensitivity = 1.5;
    const adjustedDelta = (isTrackpad ? -deltaY : deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    this._state.priceRange.shift(priceShift);
    touch("state.priceRange"); // trigger observers as shift() call does not cause it to happen

    this.draw();
  }

  private dispatchRefetch(direction: "backward" | "forward") {
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              Number(this._state.priceHistory.startTimestamp) -
              FETCH_BATCH_SIZE * granularityToMs(this._state.granularity),
            end: Number(this._state.priceHistory.startTimestamp),
          }
        : {
            start: Number(this._state.priceHistory.endTimestamp),
            end:
              Number(this._state.priceHistory.endTimestamp) +
              FETCH_BATCH_SIZE * granularityToMs(this._state.granularity),
          };
    console.log("Dispatching chart-pan event", {
      direction,
      timeRange,
      visibleCandles: this.calculateVisibleCandles(),
      needMoreData: true,
    });
    this.dispatchEvent(
      new CustomEvent("chart-pan", {
        detail: {
          direction,
          timeRange,
          visibleCandles: this.calculateVisibleCandles(),
          needMoreData: true,
          bubbles: true,
          composed: true,
        },
      })
    );
  }

  public calculateVisibleCandles(): number {
    if (!this.chart) return 0;
    const availableWidth =
      this.chart.canvas!.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(
      availableWidth / (totalCandleWidth * window.devicePixelRatio)
    );
  }

  private handleTimelineZoom = (event: CustomEvent) => {
    const { deltaX, clientX, rect, isTrackpad } = event.detail;

    const zoomMultiplier = isTrackpad ? 1 : 0.1;
    const timeRange = this._state.timeRange.end - this._state.timeRange.start;
    const zoomCenter = (clientX - rect.left) / rect.width;
    const timeAdjustment =
      timeRange * this.ZOOM_FACTOR * deltaX * zoomMultiplier;
    const newTimeRange = Math.max(
      timeRange - timeAdjustment,
      getCandleInterval(this._state.granularity) * 10
    );
    const rangeDifference = timeRange - newTimeRange;

    const newStart = this._state.timeRange.start + rangeDifference * zoomCenter;
    const newEnd =
      this._state.timeRange.end - rangeDifference * (1 - zoomCenter);

    if (newEnd - newStart < getCandleInterval(this._state.granularity) * 10) {
      const center = (newStart + newEnd) / 2;
      const minHalfRange = getCandleInterval(this._state.granularity) * 5;
      this._state.timeRange = {
        start: center - minHalfRange,
        end: center + minHalfRange,
      };
    } else {
      this._state.timeRange = { start: newStart, end: newEnd };
    }

    this.draw();

    // Check if we need more data
    const bufferTimeRange = newTimeRange * BUFFER_MULTIPLIER;
    const needMoreData =
      this._state.timeRange.start <
        this._state.priceHistory.startTimestamp + bufferTimeRange ||
      this._state.timeRange.end >
        this._state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.dispatchRefetch(deltaX > 0 ? "backward" : "forward");
    }
  };

  private calculateCandleOptions(): ChartOptions {
    if (!this.chart) return this.options;
    if (!this.chart.canvas) {
      console.warn(
        "ChartContainer: No canvas found, returning default options"
      );
      return this.options;
    }

    const timeRange = this._state.timeRange.end - this._state.timeRange.start;
    const numCandles = timeRange / getCandleInterval(this._state.granularity);

    const availableWidth =
      this.chart.canvas.width / (window.devicePixelRatio ?? 1) -
      this.padding.left -
      this.padding.right;

    const idealCandleWidth = (availableWidth / numCandles) * 0.9; // 90% for candle, 10% for gap
    const idealGapWidth = (availableWidth / numCandles) * 0.1;

    // Clamp the values between min and max
    const candleWidth =
      Math.max(
        this.options.minCandleWidth,
        Math.min(this.options.maxCandleWidth, idealCandleWidth)
      ) / (window.devicePixelRatio ?? 1);
    const candleGap = Math.max(1, idealGapWidth);

    return {
      ...this.options,
      candleWidth,
      candleGap,
    };
  }

  private handlePriceAxisZoom = (event: CustomEvent) => {
    const { deltaY, isTrackpad } = event.detail;
    const zoomCenter = 0.5; // Always zoom from the center
    const zoomMultiplier = isTrackpad ? 0.5 : 0.1;
    (this._state.priceRange as PriceRangeImpl).adjust(
      deltaY * zoomMultiplier,
      zoomCenter
    );
    touch("state.priceRange");
    this.draw();
  };

  public updateLiveCandle(liveCandle: LiveCandle): void {
    this._state.priceHistory.setLiveCandle({
      timestamp: liveCandle.timestamp * 1000,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
      granularity: this._state.granularity,
      volume: liveCandle.volume,
      live: true,
    });
    this.draw();
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .container {
      display: grid;
      width: 100%;
      height: 100%;
      grid-template-areas:
        "top-tb"
        "chart";
      grid-template-columns: 1fr;
      grid-template-rows: 40px 1fr;
      gap: 1px;
      background-color: var(--color-primary-dark);
      position: relative;
    }

    .toolbar-top {
      grid-area: top-tb;
      background: var(--color-primary-dark);
    }

    .chart-area {
      grid-area: chart;
      position: relative;
      background: var(--color-primary-dark);
      overflow: hidden;
      pointer-events: auto;
    }

    .chart {
      position: relative;
      width: calc(100% - 50px);
      height: calc(100% - ${TIMELINE_HEIGHT}px);
      pointer-events: auto;
    }

    .volume-chart {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT}px;
      left: 0;
      width: calc(100% - 50px);
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
      width: 50px;
      height: 100%;
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
      width: calc(100% - 50px);
      height: ${TIMELINE_HEIGHT}px;
      pointer-events: auto;
    }

    candlestick-chart {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - 50px);
      height: calc(100% - ${TIMELINE_HEIGHT}px);
      pointer-events: auto;
      z-index: 1;
      cursor: crosshair;
    }

    candlestick-chart:active {
      cursor: grabbing;
    }

    live-decorators {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - 50px);
      height: calc(100% - ${TIMELINE_HEIGHT}px);
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
    }

    chart-crosshairs > * {
      pointer-events: all;
    }

    price-axis {
      display: block;
      width: 100%;
      height: calc(100% - ${TIMELINE_HEIGHT}px);
    }

    .price-info {
      position: absolute;
      top: 0;
      left: 8px;
      z-index: 6;
      background: none;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
      pointer-events: none;
      color: var(--color-accent-2);
      background-color: rgba(var(--color-primary-rgb), 0.8);
    }
  `;
}
