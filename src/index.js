// src/components/candlestick-chart.ts
class CandlestickChart extends HTMLElement {
  canvas;
  ctx;
  data = [];
  padding = { top: 20, right: 20, bottom: 30, left: 60 };
  constructor() {
    super();
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");
  }
  static get observedAttributes() {
    return ["width", "height"];
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue) {
      if (name === "width")
        this.canvas.width = parseInt(newValue) || 600;
      if (name === "height")
        this.canvas.height = parseInt(newValue) || 400;
      this.initializeChart();
    }
  }
  connectedCallback() {
    this.appendChild(this.canvas);
    this.canvas.width = parseInt(this.getAttribute("width") || "600");
    this.canvas.height = parseInt(this.getAttribute("height") || "400");
    this.initializeChart();
  }
  setData(data) {
    console.log("setData called with data:", data);
    this.data = data;
    console.log("this.data is now:", this.data);
    this.initializeChart();
  }
  initializeChart() {
    if (!this.ctx)
      return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.data.length === 0)
      return;
    const xScale = (this.canvas.width - this.padding.left - this.padding.right) / (this.data.length - 1);
    const priceRange = {
      min: Math.min(...this.data.map((d) => d.low)),
      max: Math.max(...this.data.map((d) => d.high))
    };
    const yScale = (this.canvas.height - this.padding.top - this.padding.bottom) / (priceRange.max - priceRange.min);
    this.data.forEach((candle, i) => {
      const x = this.padding.left + i * xScale;
      const y = this.canvas.height - this.padding.bottom;
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.moveTo(x, y - (candle.high - priceRange.min) * yScale);
      ctx.lineTo(x, y - (candle.low - priceRange.min) * yScale);
      ctx.stroke();
      const bodyHeight = Math.abs(candle.close - candle.open) * yScale;
      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(x - 5, y - (Math.max(candle.open, candle.close) - priceRange.min) * yScale, 10, bodyHeight);
    });
  }
}
customElements.define("candlestick-chart", CandlestickChart);
