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

class CandlestickChart extends HTMLElement {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  private data: CandleData[] = [];
  private padding = { top: 20, right: 20, bottom: 30, left: 60 };
  private options: ChartOptions = {
    candleWidth: 10,
    candleGap: 2,
    minCandleWidth: 4,
    maxCandleWidth: 20,
  };

  constructor() {
    super();
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }

  static get observedAttributes() {
    return ["width", "height"];
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === "width") this.canvas.width = parseInt(newValue) || 600;
      if (name === "height") this.canvas.height = parseInt(newValue) || 400;
      this.initializeChart();
    }
  }

  connectedCallback() {
    this.appendChild(this.canvas);
    this.canvas.width = parseInt(this.getAttribute("width") || "600");
    this.canvas.height = parseInt(this.getAttribute("height") || "400");
    this.initializeChart();
  }

  public setData(data: CandleData[]) {
    console.log("setData called with:", data);
    this.data = data;
    this.adjustCandleWidth();
    this.initializeChart();
  }

  private adjustCandleWidth() {
    const availableWidth =
      this.canvas.width - this.padding.left - this.padding.right;
    const idealCandleWidth =
      availableWidth / this.data.length - this.options.candleGap;

    this.options.candleWidth = Math.max(
      this.options.minCandleWidth,
      Math.min(this.options.maxCandleWidth, idealCandleWidth)
    );
  }

  private initializeChart() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.data.length === 0) return;

    // Calculate scales
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    const xScale = totalCandleWidth;
    const priceRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high)),
    };
    const yScale =
      (this.canvas.height - this.padding.top - this.padding.bottom) /
      (priceRange.max - priceRange.min);

    // Draw candlesticks
    this.data.forEach((candle, i) => {
      const x = this.padding.left + i * xScale;
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

    // Add time axis labels
    this.drawTimeAxis();
  }

  private drawTimeAxis() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const y = this.canvas.height - this.padding.bottom;

    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = "12px Arial";

    // Draw time labels every N candles
    const labelInterval = Math.ceil(this.data.length / 8); // Show ~8 labels

    this.data.forEach((candle, i) => {
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
}

customElements.define("candlestick-chart", CandlestickChart);
