import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

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

  @property({ type: Array })
  set data(newData: CandleData[]) {
    const sortedData = newData.sort((a, b) => a.timestamp - b.timestamp);
    this._data = sortedData;
    if (this.centerTimestamp === 0 && sortedData.length > 0) {
      this.centerTimestamp =
        sortedData[Math.floor(sortedData.length / 2)].timestamp;
    }
    if (this.canvas && this.ctx) {
      this.drawChart();
    }
  }
  get data(): CandleData[] {
    return this._data;
  }
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

  @state()
  private centerTimestamp: number = 0;

  private readonly BUFFER_MULTIPLIER = 2; // Keep 2x the visible candles loaded
  private debounceTimeout: number | null = null;

  @state()
  private viewportStartIndex = 0;

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
    }
  `;

  constructor() {
    super();
    this.boundHandleResize = () => {
      const rect = this.getBoundingClientRect();
      this.handleResize(rect.width, rect.height);
    };
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
    return html`<canvas
      @mousedown=${this.handleDragStart}
      @mousemove=${this.handleDragMove}
      @mouseup=${this.handleDragEnd}
      @mouseleave=${this.handleDragEnd}
      @updated=${this.updateCanvas}
    ></canvas>`;
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
    if (!this.ctx || !this.data.length) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const visibleCandles = this.calculateVisibleCandles();
    // Use viewportStartIndex to determine which candles to display
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

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const candleWidth = this.options.candleWidth + this.options.candleGap;
    const candlesShifted = Math.round(deltaX / candleWidth) * -1;
    const visibleCandles = this.calculateVisibleCandles();

    if (
      Math.abs(deltaX) >= this.PAN_THRESHOLD &&
      candlesShifted !== 0 &&
      this.data.length > 0
    ) {
      const newIndex = Math.max(
        0,
        Math.min(
          this.viewportStartIndex + candlesShifted,
          this.data.length - visibleCandles
        )
      );

      if (newIndex !== this.viewportStartIndex) {
        this.viewportStartIndex = newIndex;
        this.drawChart();

        // Check if we need more data (when we're using more than half of our buffer)
        const bufferThreshold = (visibleCandles * this.BUFFER_MULTIPLIER) / 2;
        const needsMoreData =
          newIndex < bufferThreshold || // Need older data
          this.data.length - (newIndex + visibleCandles) < bufferThreshold; // Need newer data

        if (needsMoreData) {
          // Debounce the data request
          if (this.debounceTimeout) {
            clearTimeout(this.debounceTimeout);
          }

          this.debounceTimeout = setTimeout(() => {
            const direction = newIndex < bufferThreshold ? "older" : "newer";
            const edgeTimestamp =
              direction === "older"
                ? this.data[0].timestamp
                : this.data[this.data.length - 1].timestamp;

            console.log("Requesting more data:", {
              direction,
              edgeTimestamp: new Date(edgeTimestamp),
              visibleCandles,
              totalBuffered: this.data.length,
            });

            this.dispatchEvent(
              new CustomEvent("chart-pan", {
                detail: {
                  centerTimestamp: edgeTimestamp,
                  visibleCandles: visibleCandles * this.BUFFER_MULTIPLIER,
                  needMoreData: true,
                  direction,
                },
              })
            );
          }, 250) as unknown as number; // 250ms debounce
        }
      }
    }

    this.lastX = e.clientX;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
  };
}
