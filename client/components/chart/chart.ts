import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TimeRange } from "../../candle-repository";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import { Timeline } from "./timeline";
import {
  CandleDataByTimestamp,
  PriceHistory,
  PriceRange,
  SimplePriceHistory,
} from "../../../server/services/price-data/price-history-model";

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartOptions {
  candleWidth: number;
  candleGap: number;
  minCandleWidth: number;
  maxCandleWidth: number;
}

@customElement("candlestick-chart")
export class CandlestickChart extends LitElement {
  private drawingStrategy: Drawable = new CandlestickStrategy();
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private _data: PriceHistory = new SimplePriceHistory("ONE_HOUR", new Map());

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 10,
    candleGap: 2,
    minCandleWidth: 10,
    maxCandleWidth: 10,
  };

  @property({ type: Object })
  timeline: Timeline | null = null;

  private padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  private resizeObserver!: ResizeObserver;
  private boundHandleResize: (event: Event) => void;

  private isDragging = false;
  private lastX = 0;
  private readonly CANDLE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in ms
  private readonly BUFFER_MULTIPLIER = 3; // Keep 5x the visible candles loaded
  private initialPriceRange: PriceRange | null = null;

  @state()
  private viewportStartTimestamp: number = 0;

  @state()
  private viewportEndTimestamp: number = 0;

  @state()
  private isLoading = false;

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      background: white;
    }
  `;
  constructor() {
    super();
    this.boundHandleResize = () => {
      const rect = this.getBoundingClientRect();
      this.handleResize(rect.width, rect.height);
    };
  }

  @property({ type: Object })
  set data(newData: CandleDataByTimestamp) {
    console.log("CandlestickChart: Setting new data", {
      size: newData.size,
      timestamps: Array.from(newData.keys()),
    });

    this._data = new SimplePriceHistory("ONE_HOUR", new Map(newData.entries()));


    // Then set the viewport start if needed
    if (this.viewportStartTimestamp === 0 && this._data.numCandles > 0) {
      const visibleCandles = this.calculateVisibleCandles();
      this.viewportEndTimestamp = this._data.endTimestamp;
      this.viewportStartTimestamp =
        this._data.endTimestamp - visibleCandles * this.CANDLE_INTERVAL;

      // the price range will be eventually stored in local storage, when zooming in and out
      this.initialPriceRange = this._data.getPriceRange(
        this.viewportStartTimestamp,
        this.viewportEndTimestamp
      );
      console.log("CandlestickChart: Setting initial viewport", {
        start: new Date(this.viewportStartTimestamp),
        end: new Date(this.viewportEndTimestamp),
        visibleCandles,
      });
    }

    this.requestUpdate("data", newData);
    this.drawChart();
  }

  get data(): CandleDataByTimestamp {
    return this._data.getCandles();
  }

  async firstUpdated() {
    this.canvas = this.renderRoot.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d");

    const rect = this.getBoundingClientRect();
    this.handleResize(rect.width, rect.height);

    // Wait for next microtask to ensure canvas is ready
    await new Promise((resolve) => setTimeout(resolve, 0));

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });

    this.resizeObserver.observe(this.canvas);
    window.addEventListener("resize", this.boundHandleResize);

    // Dispatch ready event after everything is set up
    const visibleCandles = this.calculateVisibleCandles();
    console.log(
      "CandlestickChart: Dispatching chart-ready event with visible candles:",
      visibleCandles
    );
    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        detail: { visibleCandles },
        bubbles: true,
        composed: true,
      })
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver.disconnect();
    window.removeEventListener("resize", this.boundHandleResize);
  }

  render() {
    return html`
      <canvas
        @mousedown=${this.handleDragStart}
        @mousemove=${this.handleDragMove}
        @mouseup=${this.handleDragEnd}
        @mouseleave=${this.handleDragEnd}
        @wheel=${this.handleWheel}
        @updated=${this.updateCanvas}
      ></canvas>
      ${this.isLoading ? html`<div class="loading">Loading...</div>` : ""}
    `;
  }

  private updateCanvas = () => {
    this.drawChart();
  };

  private handleResize(width: number, height: number) {
    if (width === 0 || height === 0) {
      console.warn("Invalid dimensions received:", width, height);
      return;
    }

    const dpr = window.devicePixelRatio ?? 1;

    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx?.scale(dpr, dpr);

    if (this.data.size > 0) {
      this.drawChart();
    }
  }

  private binarySearch(arr: number[], target: number): number {
    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    return -1; // not found
  }

  public drawChart() {
    if (!this.ctx || !this.canvas || this.data.size === 0 || !this.initialPriceRange) {
      console.warn("Cannot draw chart:", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        dataSize: this.data.size,
        hasInitialPriceRange: !!this.initialPriceRange,
      });
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const context: DrawingContext = {
      ctx: this.ctx,
      chartCanvas: this.canvas,
      data: this._data,
      options: {
        ...this.options,
        candleWidth: this.options.candleWidth,
        candleGap: this.options.candleGap,
      },
      viewportStartTimestamp: this.viewportStartTimestamp,
      viewportEndTimestamp: this.viewportEndTimestamp,
      priceRange: this.initialPriceRange,
    };
    this.dispatchEvent(new CustomEvent("draw-chart", {
      detail: context,
      bubbles: true,
      composed: true,
    }));
    this.drawingStrategy.draw(context);
    if (this.timeline) {
      this.timeline.draw(context);
    }
  }

  public calculateVisibleCandles(): number {
    const dpr = window.devicePixelRatio;
    const availableWidth =
      this.canvas.width - this.padding.left - this.padding.right;
    const candleWidth = this.options.candleWidth * dpr;
    const candleGap = this.options.candleGap * dpr;
    const totalCandleWidth = candleWidth + candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
  };

  private handlePan(deltaX: number, isTrackpad = false) {

    const timeRange = this.viewportEndTimestamp - this.viewportStartTimestamp;
    const viewportWidth = this.canvas.width / (window.devicePixelRatio ?? 1);
    const timePerPixel = timeRange / viewportWidth;

    // Calculate time shift caused by panning
    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift !== 0) {
      this.viewportStartTimestamp -= timeShift;
      this.viewportEndTimestamp = this.viewportStartTimestamp + timeRange;

      this.drawChart();

      // Check if we need more data
      const bufferTimeRange = timeRange * this.BUFFER_MULTIPLIER;
      const needMoreData =
        this.viewportStartTimestamp <
        this._data.startTimestamp + bufferTimeRange ||
        this.viewportEndTimestamp > this._data.endTimestamp - bufferTimeRange;

      if (needMoreData) {
        this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
      }
    }
    this.dispatchViewportChange();
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


  private dispatchViewportChange() {
    const visibleTimestamps = this.getVisibleTimestamps();

    console.log("CandlestickChart: Dispatching viewport change", {
      visibleTimestamps: visibleTimestamps.length,
      start: new Date(this.viewportStartTimestamp),
      end: new Date(this.viewportEndTimestamp),
      startTimestamp: this.viewportStartTimestamp,
      endTimestamp: this.viewportEndTimestamp,
    });

    this.dispatchEvent(
      new CustomEvent("viewport-change", {
        detail: {
          visibleTimestamps,
          viewportStartTimestamp: this.viewportStartTimestamp,
          viewportEndTimestamp: this.viewportEndTimestamp,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private getVisibleTimestamps(): number[] {
    const startIdx = this.binarySearch(
      this._data.getTimestampsSorted(),
      this.viewportStartTimestamp
    );

    if (startIdx === -1) {
      console.warn("Invalid start index in getVisibleTimestamps");
      return [];
    }

    const visibleCandles = this.calculateVisibleCandles();
    // Ensure we don't exceed array bounds
    const endIdx = Math.min(startIdx + visibleCandles, this._data.numCandles);

    console.log("Getting visible timestamps:", {
      startIdx,
      endIdx,
      visibleCandles,
      actualVisible: endIdx - startIdx,
    });

    return this._data.getTimestampsSorted().slice(startIdx, endIdx);
  }

}
