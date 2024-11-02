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

  @state()
  private centerTimestamp: number = 0;

  private readonly BUFFER_MULTIPLIER = 2; // Keep 5x the visible candles loaded
  private debounceTimeout: number | null = null;

  @state()
  public viewportStartIndex = 0;

  @state()
  private isLoading = false;

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
    const sortedData = newData.sort((a, b) => a.timestamp - b.timestamp);
    // Calculate the initial viewport position to show latest candles
    if (this._data.length == 0) {
      const visibleCandles = this.calculateVisibleCandles();
      this.viewportStartIndex = Math.max(0, newData.length - visibleCandles);

      // Update centerTimestamp if not set
      if (this.centerTimestamp === 0) {
        this.centerTimestamp =
          sortedData[Math.floor(sortedData.length / 2)].timestamp;
      }
    }
    this._data = sortedData;

    if (this.canvas && this.ctx) {
      this.drawChart();
    }
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

    console.log("Drawing chart:", {
      totalCandles: this.data.length,
      visibleCandles: this.calculateVisibleCandles(),
      viewportStartIndex: this.viewportStartIndex,
      startIndex: this.viewportStartIndex,
      endIndex: Math.min(
        this.viewportStartIndex + this.calculateVisibleCandles(),
        this.data.length
      ),
    });

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const visibleCandles = this.calculateVisibleCandles();
    const startIndex = this.viewportStartIndex;
    const endIndex = Math.min(startIndex + visibleCandles, this.data.length);
    const visibleData = this.data.slice(startIndex, endIndex);

    console.log("Drawing chart:", {
      totalCandles: this.data.length,
      visibleCandles,
      viewportStartIndex: this.viewportStartIndex,
      startIndex,
      endIndex,
      actualVisible: visibleData.length,
      firstCandle: new Date(visibleData[0]?.timestamp),
      lastCandle: new Date(visibleData[visibleData.length - 1]?.timestamp),
    });

    // Draw the candles
    visibleData.forEach((candle, i) => {
      const x =
        this.padding.left +
        i * (this.options.candleWidth + this.options.candleGap);
      const y = this.canvas.height - this.padding.bottom;

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.moveTo(
        x,
        y -
          (candle.high - Math.min(...visibleData.map((d) => d.low))) *
            ((this.canvas.height - this.padding.top - this.padding.bottom) /
              (Math.max(...visibleData.map((d) => d.high)) -
                Math.min(...visibleData.map((d) => d.low))))
      );
      ctx.lineTo(
        x,
        y -
          (candle.low - Math.min(...visibleData.map((d) => d.low))) *
            ((this.canvas.height - this.padding.top - this.padding.bottom) /
              (Math.max(...visibleData.map((d) => d.high)) -
                Math.min(...visibleData.map((d) => d.low))))
      );
      ctx.stroke();

      // Draw body
      const bodyHeight =
        Math.abs(candle.close - candle.open) *
        ((this.canvas.height - this.padding.top - this.padding.bottom) /
          (Math.max(...visibleData.map((d) => d.high)) -
            Math.min(...visibleData.map((d) => d.low))));
      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(
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

    const labelInterval = Math.ceil(visibleData.length / 8);

    visibleData.forEach((candle, i) => {
      if (i % labelInterval === 0) {
        const x =
          this.padding.left +
          i * (this.options.candleWidth + this.options.candleGap);
        const date = new Date(candle.timestamp);
        const label = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        ctx.fillText(label, x, y + 20);
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

  private handlePanAction(deltaX: number, isTrackpad: boolean = false) {
    const candleWidth = this.options.candleWidth + this.options.candleGap;

    // Accumulate small movements
    this.accumulatedDelta = (this.accumulatedDelta || 0) + deltaX;

    // Adjust sensitivity based on input type
    const sensitivity = isTrackpad ? 1 : 1; // Removed the 0.3 multiplier
    const effectiveDelta = this.accumulatedDelta * sensitivity;

    // Only shift when we've accumulated enough movement
    const candlesShifted =
      Math.floor(Math.abs(effectiveDelta) / candleWidth) *
      Math.sign(effectiveDelta) *
      -1;

    console.log("Pan action:", {
      deltaX,
      effectiveDelta,
      accumulatedDelta: this.accumulatedDelta,
      candlesShifted,
      candleWidth,
      currentIndex: this.viewportStartIndex,
      dataLength: this.data.length,
      visibleCandles: this.calculateVisibleCandles(),
    });

    if (candlesShifted !== 0 && this.data.length > 0) {
      // Reset accumulated delta after applying shift
      this.accumulatedDelta = this.accumulatedDelta % candleWidth;

      const visibleCandles = this.calculateVisibleCandles();
      const newIndex = Math.max(
        0,
        Math.min(
          this.viewportStartIndex + candlesShifted,
          this.data.length - visibleCandles
        )
      );

      console.log("Index calculation:", {
        oldIndex: this.viewportStartIndex,
        newIndex,
        candlesShifted,
        changed: newIndex !== this.viewportStartIndex,
      });

      if (newIndex !== this.viewportStartIndex) {
        this.viewportStartIndex = newIndex;
        this.drawChart();

        const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once
        const LOW_DATA_THRESHOLD = 10; // Number of candles before edge to trigger fetch
        const isNearStart = newIndex < LOW_DATA_THRESHOLD;
        const isNearEnd =
          newIndex + visibleCandles > this.data.length - LOW_DATA_THRESHOLD;

        if (isNearStart || isNearEnd) {
          let timeRange: TimeRange;

          if (isNearStart) {
            // Fetch 200 candles backwards from the earliest candle
            timeRange = {
              start:
                this.data[0].timestamp -
                FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
              end: this.data[0].timestamp,
            };
          } else {
            // Fetch 200 candles forward from the latest candle
            timeRange = {
              start: this.data[this.data.length - 1].timestamp,
              end:
                this.data[this.data.length - 1].timestamp +
                FETCH_BATCH_SIZE * this.CANDLE_INTERVAL,
            };
          }

          console.log("dispatching chart-pan event:", {
            timeRange,
            visibleCandles,
            needMoreData: true,
            isNearStart,
            isNearEnd,
            direction: isNearStart ? "backward" : "forward",
          });

          this.dispatchEvent(
            new CustomEvent("chart-pan", {
              detail: {
                timeRange,
                visibleCandles,
                needMoreData: true,
                isNearEdge: true,
                direction: isNearStart ? "backward" : "forward",
              },
            })
          );
        }
      }
    }
  }

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastX;
    this.handlePanAction(deltaX);
    this.lastX = e.clientX;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
    this.accumulatedDelta = 0;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) < 50;
    this.handlePanAction(-e.deltaX, isTrackpad);
  };
}
