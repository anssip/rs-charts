import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TimeRange } from "../candle-repository";
import { CandleDataByTimestamp } from "../../server/services/price-data-cb";
import {
  ChartDrawingStrategy,
  CandlestickStrategy,
  DrawingContext,
} from "./chart/drawing-strategy";

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ChartOptions {
  candleWidth: number;
  candleGap: number;
  minCandleWidth: number;
  maxCandleWidth: number;
}

@customElement("candlestick-chart")
export class CandlestickChart extends LitElement {
  private canvas!: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null = null;

  private _data: CandleDataByTimestamp = new Map();
  private sortedTimestamps: number[] = [];

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 10,
    candleGap: 2,
    minCandleWidth: 10,
    maxCandleWidth: 10,
  };

  private padding = { top: 20, right: 20, bottom: 30, left: 60 };
  private resizeObserver!: ResizeObserver;
  private boundHandleResize: (event: Event) => void;

  private isDragging = false;
  private lastX = 0;
  private readonly CANDLE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in ms
  private readonly BUFFER_MULTIPLIER = 3; // Keep 5x the visible candles loaded

  @state()
  private viewportStartTimestamp: number = 0;

  @state()
  private isLoading = false;

  // Add new private properties for price range
  private maxPrice: number = 0;
  private minPrice: number = 0;
  private priceRange: number = 0;

  private drawingStrategy: ChartDrawingStrategy = new CandlestickStrategy();

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    .loading {
      position: absolute;
      bottom: 10px;
      left: 10px;
      color: #666;
      font-size: 12px;
      font-family: Arial, sans-serif;
    }
  `;
  constructor() {
    super();
    this.boundHandleResize = () => {
      const rect = this.getBoundingClientRect();
      this.handleResize(rect.width, rect.height);
    };
  }

  @property({ type: Array })
  set data(newData: CandleDataByTimestamp) {
    console.log("Setting new data:", {
      size: newData.size,
      firstKey: Array.from(newData.keys())[0],
      lastKey: Array.from(newData.keys())[newData.size - 1],
    });

    this.isLoading = false;
    this._data = newData;
    this.sortedTimestamps = Array.from(this._data.keys()).sort((a, b) => a - b);

    // Set initial viewport to show latest candles
    if (this.viewportStartTimestamp === 0 && this.sortedTimestamps.length > 0) {
      const visibleCandles = this.calculateVisibleCandles();
      const startIndex = Math.max(
        0,
        this.sortedTimestamps.length - visibleCandles
      );
      this.viewportStartTimestamp = this.sortedTimestamps[startIndex];

      // Calculate price range from visible candles only
      const visibleData = this.sortedTimestamps
        .slice(startIndex)
        .map((ts) => this._data.get(ts)!);

      this.maxPrice = Math.max(...visibleData.map((d) => d.high));
      this.minPrice = Math.min(...visibleData.map((d) => d.low));
      this.priceRange = this.maxPrice - this.minPrice;

      // Add some padding to the price range
      const padding = this.priceRange * 0.05;
      this.maxPrice += padding;
      this.minPrice -= padding;
      this.priceRange = this.maxPrice - this.minPrice;

      console.log("Initial setup:", {
        visibleCandles,
        startIndex,
        viewportStart: new Date(this.viewportStartTimestamp),
        priceRange: { min: this.minPrice, max: this.maxPrice },
      });
    }

    this.drawChart();
  }

  get data() {
    return this._data;
  }

  async firstUpdated() {
    this.canvas = this.renderRoot.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d");

    const rect = this.getBoundingClientRect();
    this.handleResize(rect.width, rect.height);

    // Dispatch ready event with visible candles count
    const visibleCandles = this.calculateVisibleCandles();
    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        detail: { visibleCandles },
      })
    );

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        this.handleResize(width, height);
      }
    });

    this.resizeObserver.observe(this.canvas);
    window.addEventListener("resize", this.boundHandleResize);
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

    console.log("Canvas dimensions:", { width, height });
    this.canvas.width = width;
    this.canvas.height = height;

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
    if (!this.ctx || !this.canvas || this.data.size === 0) {
      console.warn("Cannot draw chart:", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        dataSize: this.data.size,
      });
      return;
    }

    const context: DrawingContext = {
      ctx: this.ctx,
      canvas: this.canvas,
      data: this._data,
      sortedTimestamps: this.sortedTimestamps,
      options: this.options,
      padding: this.padding,
      priceToY: this.priceToY.bind(this),
    };

    this.drawingStrategy.drawChart(context, this.viewportStartTimestamp);
  }

  public calculateVisibleCandles(): number {
    if (!this.canvas) return 0;

    const availableWidth =
      this.canvas.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
  };

  private handlePan(deltaX: number, isTrackpad = false) {
    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const candlesPerPixel = 1 / this.options.candleWidth;
    const candlesShifted = Math.round(adjustedDelta * candlesPerPixel);

    if (candlesShifted !== 0) {
      // Find current timestamp index
      const currentIndex = this.binarySearch(
        this.sortedTimestamps,
        this.viewportStartTimestamp
      );
      if (currentIndex === -1) return;

      // Calculate new target index
      const targetIndex = Math.min(
        this.data.size - this.calculateVisibleCandles(),
        Math.max(0, currentIndex - candlesShifted)
      );

      // Update viewport timestamp
      this.viewportStartTimestamp = this.sortedTimestamps[targetIndex];
      const direction = candlesShifted > 0 ? "backward" : "forward";
      console.log("Pan movement:", {
        adjustedDelta,
        candlesShifted,
        oldTimestamp: new Date(this.viewportStartTimestamp),
        newTimestamp: new Date(this.sortedTimestamps[targetIndex]),
        direction,
      });

      this.drawChart();

      const bufferSize =
        this.calculateVisibleCandles() * this.BUFFER_MULTIPLIER;

      const needMoreData =
        direction === "backward"
          ? currentIndex < bufferSize // Need more past data
          : this.data.size - (currentIndex + this.calculateVisibleCandles()) <
            bufferSize; // Need more future data

      if (needMoreData) {
        this.dispatchRefetch(direction);
      }
    }
  }

  private dispatchRefetch(direction: "backward" | "forward") {
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              this.sortedTimestamps[0] -
              FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
            end: this.sortedTimestamps[0],
          }
        : {
            start: this.sortedTimestamps[this.sortedTimestamps.length - 1],
            end:
              this.sortedTimestamps[this.sortedTimestamps.length - 1] +
              FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
          };
    this.dispatchEvent(
      new CustomEvent("chart-pan", {
        detail: {
          direction,
          timeRange,
          visibleCandles: this.calculateVisibleCandles(),
          needMoreData: true,
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

  // Helper method to convert price to Y coordinate
  private priceToY(price: number): number {
    const availableHeight =
      this.canvas.height - this.padding.top - this.padding.bottom;
    const y =
      this.canvas.height -
      this.padding.bottom -
      ((price - this.minPrice) / this.priceRange) * availableHeight;
    return y;
  }
}
