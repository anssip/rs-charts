import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";

interface CandleData {
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
    // Only trigger initialization if canvas is ready
    if (this.canvas && this.ctx) {
      this.initializeChart();
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
    return html`<canvas @updated=${this.updateCanvas}></canvas>`;
  }

  private updateCanvas = () => {
    if (this.data.length > 0) {
      this.initializeChart();
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
      this.initializeChart();
    }
  }

  public initializeChart() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.data.length === 0) return;

    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    const visibleCandles = this.calculateVisibleCandles();
    const visibleData = this.data.slice(-visibleCandles);

    const priceRange = {
      min: Math.min(...visibleData.map((d) => d.low)),
      max: Math.max(...visibleData.map((d) => d.high)),
    };

    const yScale =
      (this.canvas.height - this.padding.top - this.padding.bottom) /
      (priceRange.max - priceRange.min);

    // Draw candlesticks
    visibleData.forEach((candle, i) => {
      const x = this.padding.left + i * totalCandleWidth;
      const y = this.canvas.height - this.padding.bottom;

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.moveTo(x, y - (candle.high - priceRange.min) * yScale);
      ctx.lineTo(x, y - (candle.low - priceRange.min) * yScale);
      ctx.stroke();

      // Draw body
      const bodyHeight = Math.abs(candle.close - candle.open) * yScale;
      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(
        x - this.options.candleWidth / 2,
        y - (Math.max(candle.open, candle.close) - priceRange.min) * yScale,
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

  private calculateVisibleCandles(): number {
    if (!this.canvas) return 0;

    const availableWidth =
      this.canvas.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }
}
