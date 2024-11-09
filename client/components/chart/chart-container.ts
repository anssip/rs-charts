import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  CandleDataByTimestamp,
  PriceHistory,
  PriceRange,
  SimplePriceHistory,
} from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import { Timeline } from "./timeline";
import { CandlestickChart, ChartOptions } from "./chart";
import { TimeRange } from "../../candle-repository";
import { DrawingContext } from "./drawing-strategy";

// We store data 5 times the visible range to allow for zooming and panning without fetching more data
const BUFFER_MULTIPLIER = 5;

@customElement("chart-container")
export class ChartContainer extends LitElement {
  @state()
  private _data: PriceHistory = new SimplePriceHistory("ONE_HOUR", new Map());

  private isDragging = false;
  private lastX = 0;
  private resizeObserver!: ResizeObserver;

  @state()
  private viewportStartTimestamp: number = 0;

  @state()
  private viewportEndTimestamp: number = 0;

  private readonly CANDLE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in ms
  private chart: CandlestickChart | null = null;
  private timeline: Timeline | null = null;

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
    minCandleWidth: 10,
    maxCandleWidth: 10,
  };

  private initialPriceRange: PriceRange = {
    min: 0,
    max: 0,
    range: 0,
  };

  constructor() {
    super();
    console.log("ChartContainer: Constructor called");
  }

  connectedCallback() {
    super.connectedCallback();
    console.log("ChartContainer: Connected to DOM");
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
  }

  updated() {
    console.log("ChartContainer: Updated");
    this.draw();
  }

  draw() {
    if (!this.chart) return;
    const context: DrawingContext = {
      ctx: this.chart.ctx!,
      chartCanvas: this.chart.canvas,
      data: this.data,
      options: this.options,
      viewportStartTimestamp: this.viewportStartTimestamp,
      viewportEndTimestamp: this.viewportEndTimestamp,
      priceRange: this.initialPriceRange,
    };
    console.log("ChartContainer: Drawing chart", context);
    this.chart.draw(context);
    this.timeline?.draw(context);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
  }

  @property({ type: Object })
  get data(): PriceHistory {
    return this._data;
  }

  set data(newData: CandleDataByTimestamp) {
    this._data = new SimplePriceHistory("ONE_HOUR", new Map(newData.entries()));
    this.chart!.data = newData;
    this.requestUpdate("data", newData);

    // Initialize viewport when setting initial data
    if (this.viewportStartTimestamp === 0 && newData.size > 0 && this.chart) {
      const visibleCandles = this.calculateVisibleCandles();
      const timestamps = Array.from(newData.keys()).sort((a, b) => a - b);
      this.viewportEndTimestamp = timestamps[timestamps.length - 1];
      this.viewportStartTimestamp =
        this.viewportEndTimestamp - visibleCandles * this.CANDLE_INTERVAL;

      // This will be eventually stored in local storage and updated when zooming vertically
      this.initialPriceRange = this.data.getPriceRange(
        this.viewportStartTimestamp,
        this.viewportEndTimestamp
      );

      console.log("ChartContainer: Setting initial viewport", {
        start: new Date(this.viewportStartTimestamp),
        end: new Date(this.viewportEndTimestamp),
        visibleCandles,
      });
    }
  }

  render() {
    return html`
      <div class="container">
        <div class="toolbar-top"></div>
        <div class="toolbar-left"></div>
        <div class="toolbar-right"></div>
        <div
          class="chart"
          @mousedown=${this.handleDragStart}
          @mousemove=${this.handleDragMove}
          @mouseup=${this.handleDragEnd}
          @mouseleave=${this.handleDragEnd}
          @wheel=${this.handleWheel}
        >
          <candlestick-chart></candlestick-chart>
        </div>
        <div class="timeline">
          <chart-timeline></chart-timeline>
        </div>
      </div>
    `;
  }

  private handleResize(width: number, height: number) {
    if (!this.chart) return;
    if (!this.data || this.data.getCandles().size === 0) {
      // Just resize the canvas if we don't have data yet
      this.chart.resize(width, height);
      this.timeline?.resize(width, height * 0.2);
      return;
    }
    // Don't proceed if we haven't set the time rang of th chart
    if (this.viewportEndTimestamp === 0) {
      return;
    }
    this.chart.resize(width, height);
    this.timeline?.resize(width, height * 0.2);

    const visibleCandles = this.calculateVisibleCandles();
    const newStartTimestamp =
      this.viewportEndTimestamp - visibleCandles * this.CANDLE_INTERVAL;

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
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastX;
    this.handlePan(deltaX, false);
    this.lastX = e.clientX;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.handlePan(e.deltaX, true);
  };

  private handlePan(deltaX: number, isTrackpad = false) {
    if (!this.chart) return;

    const timeRange = this.viewportEndTimestamp - this.viewportStartTimestamp;
    const viewportWidth =
      this.chart.canvas.width / (window.devicePixelRatio ?? 1);
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
        this.data.startTimestamp + bufferTimeRange ||
      this.viewportEndTimestamp > this.data.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
    }
  }

  private dispatchRefetch(direction: "backward" | "forward") {
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              this._data.startTimestamp -
              FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
            end: this._data.startTimestamp,
          }
        : {
            start: this._data.endTimestamp,
            end:
              this._data.endTimestamp + FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
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
      this.chart.canvas.width - this.padding.left - this.padding.right;
    const candleWidth = this.options.candleWidth * dpr;
    const candleGap = this.options.candleGap * dpr;
    const totalCandleWidth = candleWidth + candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
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
    .timeline {
      grid-area: timeline;
      background: white;
      overflow: hidden;
      position: relative;
    }
    candlestick-chart {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    chart-timeline {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;
}
