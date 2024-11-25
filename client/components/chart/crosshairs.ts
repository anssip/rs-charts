import { observe, xin } from "xinjs";
import { CanvasBase } from "./canvas-base";
import { TimeRange } from "../../candle-repository";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { customElement } from "lit/decorators.js";
import { canvasYToPrice } from "../../util/chart-util";
import { CandlestickChart } from "./chart";
import { drawPriceLabel } from "../../util/chart-util";
import { drawTimeLabel } from "../../util/chart-util";

@customElement("chart-crosshairs")
export class Crosshairs extends CanvasBase {
  private mouseX: number = -1;
  private mouseY: number = -1;
  private cursorPrice: number = 0;
  private cursorTime: number = 0;

  override getId(): string {
    return "chart-crosshairs";
  }

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    observe("state.timeRange", () => this.draw());
    observe("state.priceRange", () => this.draw());
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.canvas) return;

    const chartArea = this.parentElement;
    const chart = chartArea?.querySelector(
      "candlestick-chart"
    ) as CandlestickChart;
    const rect = chart?.getBoundingClientRect();
    if (!rect) {
      console.error("Crosshairs: chart not found");
      return;
    }

    const chartWidth = xin["state.canvasWidth"] as number;
    const chartHeight = xin["state.canvasHeight"] as number;
    console.log("Crosshairs: mouseMove", { chartWidth, chartHeight });

    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    const timeRange = xin["state.timeRange"] as TimeRange;
    const priceRange = xin["state.priceRange"] as PriceRange;

    const timeSpan = timeRange.end - timeRange.start;
    this.cursorTime = timeRange.start + (this.mouseX / chartWidth) * timeSpan;

    this.cursorPrice = canvasYToPrice(this.mouseY, chart.canvas!, priceRange);

    this.draw();
  };

  bindEventListeners(_: HTMLCanvasElement): void {
    document.addEventListener("mousemove", this.handleMouseMove);
    this.canvas?.addEventListener("mouseleave", this.handleMouseLeave);
  }

  private handleMouseLeave = () => {
    this.mouseX = -1;
    this.mouseY = -1;
    this.draw();
  };

  draw() {
    if (!this.canvas || !this.ctx || this.mouseX < 0 || this.mouseY < 0) {
      this.ctx?.clearRect(
        0,
        0,
        this.canvas?.width || 0,
        this.canvas?.height || 0
      );
      return;
    }

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const chartWidth = xin["state.canvasWidth"] as number;
    const chartHeight = xin["state.canvasHeight"] as number;
    console.log("Crosshairs: draw", { chartWidth, chartHeight });

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const deviceMouseX = this.mouseX;
    const deviceMouseY = this.mouseY;

    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, deviceMouseY);
    ctx.lineTo(this.canvas.width, deviceMouseY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(deviceMouseX, 0);
    ctx.lineTo(deviceMouseX, this.canvas.height);
    ctx.stroke();

    ctx.setLineDash([]);

    drawPriceLabel(
      ctx,
      this.cursorPrice,
      this.canvas.width / dpr - 50, // x position from left edge
      deviceMouseY, // y position
      "gray", // background color
      "white", // text color
      50 // width
    );

    drawTimeLabel(
      ctx,
      this.cursorTime,
      deviceMouseX,
      this.canvas.height / dpr - 10 * dpr,
      "#eee", // light gray background
      "#000" // black text
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas?.removeEventListener("mouseleave", this.handleMouseLeave);
  }
}
