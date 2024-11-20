import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { SimplePriceHistory } from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import { Timeline } from "./timeline";
import { CandlestickChart, ChartOptions } from "./chart";
import { TimeRange } from "../../candle-repository";
import { DrawingContext } from "./drawing-strategy";
import "./price-axis";
import { PriceAxis } from "./price-axis";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../live-candle-subscription";
import "./live-decorators";
import { ChartState } from "../..";
import { priceToY, timeToX } from "../../util/chart-util";

// We store data 5 times the visible range to allow for zooming and panning without fetching more data
const BUFFER_MULTIPLIER = 5;
export const CANDLE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in ms

@customElement("chart-container")
export class ChartContainer extends LitElement {
  @state()
  private _state: ChartState = {
    priceRange: new PriceRangeImpl(0, 0),
    priceHistory: new SimplePriceHistory("ONE_HOUR", new Map()),
    timeRange: { start: 0, end: 0 },
    liveCandle: null,
  };

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver!: ResizeObserver;
  private viewportStartTimestamp: number = 0;
  private viewportEndTimestamp: number = 0;

  private chart: CandlestickChart | null = null;
  private timeline: Timeline | null = null;
  private priceAxis: PriceAxis | null = null;

  private padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 10,
    candleGap: 2,
    minCandleWidth: 2,
    maxCandleWidth: 40,
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
    this.viewportStartTimestamp = startTimestamp;
  }

  set endTimestamp(endTimestamp: number) {
    this.viewportEndTimestamp = endTimestamp;
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

    this.chart = this.renderRoot.querySelector("candlestick-chart");
    this.timeline = this.renderRoot.querySelector("chart-timeline");
    this.priceAxis = this.renderRoot.querySelector("price-axis");
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

    if (this.timeline) {
      this.timeline.addEventListener(
        "timeline-zoom",
        this.handleTimelineZoom as EventListener
      );
    }

    this.priceAxis?.addEventListener(
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
      viewportStartTimestamp: this.viewportStartTimestamp,
      viewportEndTimestamp: this.viewportEndTimestamp,
      priceRange: this._state.priceRange,
      axisMappings: {
        timeToX: timeToX(this.chart.canvas!.width, {
          start: this.viewportStartTimestamp,
          end: this.viewportEndTimestamp,
        }),
        priceToY: priceToY(this.chart.canvas!.height, {
          start: this._state.priceRange.min,
          end: this._state.priceRange.max,
        }),
      },
    };
    console.log("ChartContainer: Drawing chart", context);
    this.chart.draw(context);
    this.timeline?.draw(context);
    this.priceAxis?.draw(context);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
    if (this.timeline) {
      this.timeline.removeEventListener(
        "timeline-zoom",
        this.handleTimelineZoom as EventListener
      );
    }
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
    console.log("ChartContainer: Rendering", this._state.liveCandle?.close);
    return html`
      <div class="container">
        <div class="toolbar-top"></div>
        <div class="toolbar-left"></div>
        <div class="toolbar-right">
          <price-axis></price-axis>
        </div>
        <div
          class="chart"
          @mousedown=${this.handleDragStart}
          @mousemove=${this.handleDragMove}
          @mouseup=${this.handleDragEnd}
          @mouseleave=${this.handleDragEnd}
          @wheel=${this.handleWheel}
        >
          <candlestick-chart></candlestick-chart>
          <live-decorators></live-decorators>
        </div>
        <div class="timeline">
          <chart-timeline
            .options=${this.options}
            .padding=${this.padding}
          ></chart-timeline>
        </div>
      </div>
    `;
  }

  private handleResize(width: number, height: number) {
    if (!this.chart) return;
    if (this._state.priceHistory.getCandles().size === 0) {
      // Just resize the canvas if we don't have data yet
      this.chart.resize(width, height);
      this.timeline?.resize(width, height);
      return;
    }
    // Don't proceed if we haven't set the time rang of th chart
    if (this.viewportEndTimestamp === 0) {
      return;
    }
    this.chart.resize(width, height);
    this.timeline?.resize(width, height);

    const visibleCandles = this.calculateVisibleCandles();
    const newStartTimestamp =
      this.viewportEndTimestamp - visibleCandles * CANDLE_INTERVAL;

    if (
      newStartTimestamp > 0 &&
      newStartTimestamp < this.viewportEndTimestamp
    ) {
      this.viewportStartTimestamp = newStartTimestamp;
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

    // Handle horizontal pan
    this.handlePan(deltaX);
    // Handle vertical pan
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

    const timeRange = this.viewportEndTimestamp - this.viewportStartTimestamp;
    const viewportWidth =
      this.chart.canvas!.width / (window.devicePixelRatio ?? 1);
    const timePerPixel = timeRange / viewportWidth;

    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    this.viewportStartTimestamp = this.viewportStartTimestamp - timeShift;
    this.viewportEndTimestamp = this.viewportStartTimestamp + timeRange;

    this.draw();

    // Check if we need more data
    const bufferTimeRange = timeRange * BUFFER_MULTIPLIER;
    const needMoreData =
      this.viewportStartTimestamp <
        this._state.priceHistory.startTimestamp + bufferTimeRange ||
      this.viewportEndTimestamp >
        this._state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
    }
  }

  private handleVerticalPan(deltaY: number, isTrackpad = false) {
    if (!this.chart || !this._state.priceRange) return;

    const availableHeight =
      this.chart.canvas!.height / (window.devicePixelRatio ?? 1);
    const pricePerPixel = this._state.priceRange.range / availableHeight;

    // Adjust delta based on input type and direction (negative deltaY moves price range up)
    const adjustedDelta = isTrackpad ? -deltaY : deltaY;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    this._state.priceRange.shift(priceShift);
    this.draw();
  }

  private dispatchRefetch(direction: "backward" | "forward") {
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              this._state.priceHistory.startTimestamp -
              FETCH_BATCH_SIZE * CANDLE_INTERVAL,
            end: this._state.priceHistory.startTimestamp,
          }
        : {
            start: this._state.priceHistory.endTimestamp,
            end:
              this._state.priceHistory.endTimestamp +
              FETCH_BATCH_SIZE * CANDLE_INTERVAL,
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
    const dpr = window.devicePixelRatio;
    const availableWidth =
      this.chart.canvas!.width - this.padding.left - this.padding.right;
    const candleWidth = this.options.candleWidth * dpr;
    const candleGap = this.options.candleGap * dpr;
    const totalCandleWidth = candleWidth + candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }

  private handleTimelineZoom = (event: CustomEvent) => {
    const { deltaX, clientX, rect, isTrackpad } = event.detail;

    const zoomMultiplier = isTrackpad ? 1 : 0.1; // Reduce sensitivity for mouse wheel
    const timeRange = this.viewportEndTimestamp - this.viewportStartTimestamp;
    const zoomCenter = (clientX - rect.left) / rect.width;
    const timeAdjustment =
      timeRange * this.ZOOM_FACTOR * deltaX * zoomMultiplier;
    const newTimeRange = Math.max(
      timeRange - timeAdjustment,
      CANDLE_INTERVAL * 10
    ); // Prevent zooming in too far
    const rangeDifference = timeRange - newTimeRange;

    this.viewportStartTimestamp += rangeDifference * zoomCenter;
    this.viewportEndTimestamp -= rangeDifference * (1 - zoomCenter);

    if (
      this.viewportEndTimestamp - this.viewportStartTimestamp <
      CANDLE_INTERVAL * 10
    ) {
      const center =
        (this.viewportStartTimestamp + this.viewportEndTimestamp) / 2;
      const minHalfRange = CANDLE_INTERVAL * 5;
      this.viewportStartTimestamp = center - minHalfRange;
      this.viewportEndTimestamp = center + minHalfRange;
    }
    this.draw();

    // Check if we need more data
    const bufferTimeRange = newTimeRange * BUFFER_MULTIPLIER;
    const needMoreData =
      this.viewportStartTimestamp <
        this._state.priceHistory.startTimestamp + bufferTimeRange ||
      this.viewportEndTimestamp >
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

    const timeRange = this.viewportEndTimestamp - this.viewportStartTimestamp;
    const numCandles = timeRange / CANDLE_INTERVAL;

    const availableWidth =
      this.chart.canvas.width / (window.devicePixelRatio ?? 1) -
      this.padding.left -
      this.padding.right;

    const idealCandleWidth = (availableWidth / numCandles) * 0.9; // 90% for candle, 10% for gap
    const idealGapWidth = (availableWidth / numCandles) * 0.1;

    // Clamp the values between min and max
    const candleWidth = Math.max(
      this.options.minCandleWidth,
      Math.min(this.options.maxCandleWidth, idealCandleWidth)
    );
    const candleGap = Math.max(1, idealGapWidth);

    return {
      ...this.options,
      candleWidth,
      candleGap,
    };
  }

  private handlePriceAxisZoom = (event: CustomEvent) => {
    const { deltaY, clientY, rect, isTrackpad } = event.detail;
    const zoomCenter = 1 - (clientY - rect.top) / rect.height;
    const zoomMultiplier = isTrackpad ? 1 : 0.1;
    (this._state.priceRange as PriceRangeImpl).adjust(
      deltaY * zoomMultiplier,
      zoomCenter
    );
    this.draw();
  };

  public updateLiveCandle(liveCandle: LiveCandle): void {
    this._state.priceHistory.setLiveCandle({
      timestamp: liveCandle.timestamp * 1000,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
      granularity: "ONE_HOUR", // TODO: Fixme once we have granularity selection
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
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      background: white;
    }
    .container {
      display: grid;
      width: 100%;
      height: 100%;
      grid-template-areas:
        "top-tb top-tb top-tb"
        "left-tb chart right-tb"
        "left-tb timeline right-tb";
      grid-template-columns: 50px 1fr 50px;
      grid-template-rows: 40px 1fr 80px;
      gap: 1px;
      background-color: #f5f5f5;
    }
    .toolbar-top {
      grid-area: top-tb;
      background: white;
    }
    .toolbar-left {
      grid-area: left-tb;
      background: white;
    }
    .toolbar-right {
      grid-area: right-tb;
      background: white;
    }
    .chart {
      grid-area: chart;
      background: white;
      overflow: hidden;
      position: relative;
      height: 100%;
    }
    live-decorators {
      display: block;
      width: 100%;
      height: 100%;
    }
    .timeline {
      grid-area: timeline;
      background: white;
      overflow: hidden;
      position: relative;
    }
    candlestick-chart {
      position: absolute;
      top: 0;
      left: 0;
    }
    chart-timeline {
      display: block;
      width: 100%;
      height: 100%;
    }
    price-axis {
      display: block;
      width: 100%;
      height: 100%;
    }
    live-decorators {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
  `;
}
