import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TimeRange } from "../candle-repository";

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

  private _data: CandleData[] = [];

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
  private readonly PAN_THRESHOLD = 5; // minimum pixels to trigger pan
  private readonly CANDLE_INTERVAL = 1 * 60 * 60 * 1000; // 1 hour in ms
  private accumulatedDelta: number = 0;

  private readonly BUFFER_MULTIPLIER = 3; // Keep 5x the visible candles loaded
  private debounceTimeout: number | null = null;

  @state()
  private viewportStartTimestamp: number = 0;

  @state()
  private isLoading = false;

  private lastPanTimestamp = 0;
  private readonly PAN_THROTTLE = 200; // ms between pan events

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
  set data(newData: CandleData[]) {
    this.isLoading = false;

    // TODO: component could use the data directly from the repository ??
    // TODO: at least sorting and deduplication should be done only in one place
    const allCandles = [...this._data, ...newData];
    const uniqueCandles = Array.from(
      new Map(allCandles.map((candle) => [candle.timestamp, candle])).values()
    ).sort((a, b) => a.timestamp - b.timestamp);

    if (this._data.length === 0) {
      // Initial load - set viewport to show most recent candles
      this.viewportStartTimestamp =
        uniqueCandles[
          Math.max(0, uniqueCandles.length - this.calculateVisibleCandles())
        ].timestamp;
    }

    this._data = uniqueCandles;
  }

  get data(): CandleData[] {
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
    if (this.data.length > 0) {
      this.drawChart();
    }
  };

  private handleResize(width: number, height: number) {
    if (width === 0 || height === 0) {
      console.warn("Invalid dimensions received:", width, height);
      return;
    }
    this.canvas.width = width;
    this.canvas.height = height;

    if (this.data.length > 0) {
      this.drawChart();
    }
  }

  public drawChart() {
    if (!this.ctx || !this.canvas || this.data.length === 0) return;

    // clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Find the starting index based on timestamp
    const startIndex = this.data.findIndex(
      (c) => c.timestamp === this.viewportStartTimestamp
    );
    if (startIndex === -1) {
      console.warn("Viewport timestamp not found in data");
      return;
    }

    const visibleCandles = this.calculateVisibleCandles();
    const endIndex = Math.min(startIndex + visibleCandles, this.data.length);
    const visibleData = this.data.slice(startIndex, endIndex);

    console.log("Drawing chart:", {
      totalCandles: this.data.length,
      visibleCandles,
      viewportStartTime: new Date(this.viewportStartTimestamp),
      startIndex,
      endIndex,
      actualVisible: visibleData.length,
    });

    // Draw the candles
    visibleData.forEach((candle, i) => {
      const x =
        this.padding.left +
        i * (this.options.candleWidth + this.options.candleGap);
      const y = this.canvas.height - this.padding.bottom;

      // Draw wick
      this.ctx!.beginPath();
      this.ctx!.strokeStyle = candle.close > candle.open ? "green" : "red";
      this.ctx!.moveTo(
        x,
        y -
          (candle.high - Math.min(...visibleData.map((d) => d.low))) *
            ((this.canvas.height - this.padding.top - this.padding.bottom) /
              (Math.max(...visibleData.map((d) => d.high)) -
                Math.min(...visibleData.map((d) => d.low))))
      );
      this.ctx!.lineTo(
        x,
        y -
          (candle.low - Math.min(...visibleData.map((d) => d.low))) *
            ((this.canvas.height - this.padding.top - this.padding.bottom) /
              (Math.max(...visibleData.map((d) => d.high)) -
                Math.min(...visibleData.map((d) => d.low))))
      );
      this.ctx!.stroke();

      // Draw body
      const bodyHeight =
        Math.abs(candle.close - candle.open) *
        ((this.canvas.height - this.padding.top - this.padding.bottom) /
          (Math.max(...visibleData.map((d) => d.high)) -
            Math.min(...visibleData.map((d) => d.low))));
      this.ctx!.fillStyle = candle.close > candle.open ? "green" : "red";
      this.ctx!.fillRect(
        x - this.options.candleWidth / 2,
        y -
          (Math.max(candle.open, candle.close) -
            Math.min(...visibleData.map((d) => d.low))) *
            ((this.canvas.height - this.padding.top - this.padding.bottom) /
              (Math.max(...visibleData.map((d) => d.high)) -
                Math.min(...visibleData.map((d) => d.low)))),
        this.options.candleWidth,
        bodyHeight
      );
    });

    this.drawTimeAxis(visibleData);
  }

  private drawTimeAxis(visibleData: CandleData[]) {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const y = this.canvas.height - this.padding.bottom;

    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = "12px Arial";

    let lastDate: string | null = null;
    const labelInterval = Math.ceil(visibleData.length / 8);

    visibleData.forEach((candle, i) => {
      if (i % labelInterval === 0) {
        const x =
          this.padding.left +
          i * (this.options.candleWidth + this.options.candleGap);
        const date = new Date(candle.timestamp);

        // Format time
        const timeLabel = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });

        // Format date
        const dateStr = date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });

        // Check if date has changed
        if (dateStr !== lastDate) {
          ctx.fillText(dateStr, x, y + 25);
          lastDate = dateStr;
        }

        // Draw time
        ctx.fillText(timeLabel, x, y + 10);
      }
    });
  }

  public calculateVisibleCandles(): number {
    if (!this.canvas) return 0;

    const availableWidth =
      this.canvas.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    const visibleCandles = Math.floor(availableWidth / totalCandleWidth);
    console.log("Calculating visible candles:", {
      availableWidth,
      totalCandleWidth,
      visibleCandles,
      canvasWidth: this.canvas.width,
      padding: this.padding,
    });
    return visibleCandles;
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
      const currentIndex = this.data.findIndex(
        (c) => c.timestamp === this.viewportStartTimestamp
      );
      if (currentIndex === -1) return;

      // Calculate new target index
      const targetIndex = Math.min(
        this.data.length - this.calculateVisibleCandles(),
        Math.max(0, currentIndex - candlesShifted)
      );

      // Update viewport timestamp
      this.viewportStartTimestamp = this.data[targetIndex].timestamp;
      const direction = candlesShifted > 0 ? "backward" : "forward";
      console.log("Pan movement:", {
        adjustedDelta,
        candlesShifted,
        oldTimestamp: new Date(this.viewportStartTimestamp),
        newTimestamp: new Date(this.data[targetIndex].timestamp),
        direction,
      });

      this.drawChart();

      // Check if we need more data
      const bufferSize =
        this.calculateVisibleCandles() * this.BUFFER_MULTIPLIER;

      const needMoreData =
        direction === "backward"
          ? currentIndex < bufferSize // Need more past data
          : this.data.length - (currentIndex + this.calculateVisibleCandles()) <
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
              this.data[0].timestamp - FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
            end: this.data[0].timestamp,
          }
        : {
            start: this.data[this.data.length - 1].timestamp,
            end:
              this.data[this.data.length - 1].timestamp +
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
    this.accumulatedDelta = 0;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    this.handlePan(e.deltaX, true);
  };
}
