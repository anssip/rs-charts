import { observe, xin } from "xinjs";
import { CanvasBase } from "./canvas-base";
import { TimeRange } from "../../candle-repository";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { customElement } from "lit/decorators.js";

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

    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Get mouse coordinates relative to canvas, but don't multiply by DPR here
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    // Calculate price and time at cursor position
    const timeRange = xin["state.timeRange"] as TimeRange;
    const priceRange = xin["state.priceRange"] as PriceRange;

    // Use logical (non-DPR) width/height for calculations
    const logicalWidth = this.canvas.width / dpr;
    const logicalHeight = this.canvas.height / dpr;

    // Convert mouse position to price and time
    const timeSpan = timeRange.end - timeRange.start;
    this.cursorTime = timeRange.start + (this.mouseX / logicalWidth) * timeSpan;

    const priceSpan = priceRange.max - priceRange.min;
    this.cursorPrice = priceRange.max - (this.mouseY / logicalHeight) * priceSpan;

    this.draw();
  };

  bindEventListeners(_: HTMLCanvasElement): void {
    if (this.canvas) {
      this.canvas.addEventListener('mousemove', this.handleMouseMove);
      this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
    }
  }

  private handleMouseLeave = () => {
    this.mouseX = -1;
    this.mouseY = -1;
    this.draw();
  };

  draw() {
    if (!this.canvas || !this.ctx || this.mouseX < 0 || this.mouseY < 0) {
      this.ctx?.clearRect(0, 0, this.canvas?.width || 0, this.canvas?.height || 0);
      return;
    }

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const width = this.canvas.width;
    const height = this.canvas.height;

    // Clear previous drawing
    ctx.clearRect(0, 0, width, height);

    // Set line style
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;

    // Draw horizontal line
    ctx.beginPath();
    ctx.moveTo(0, this.mouseY);
    ctx.lineTo(width, this.mouseY);
    ctx.stroke();

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(this.mouseX, 0);
    ctx.lineTo(this.mouseX, height);
    ctx.stroke();

    // Reset line dash
    ctx.setLineDash([]);

    // Draw price label
    ctx.fillStyle = 'black';
    ctx.font = '12px monospace';
    const priceText = this.cursorPrice.toFixed(2);
    ctx.fillText(priceText, width / dpr - ctx.measureText(priceText).width - 5, this.mouseY);

    // Draw time label
    const timeText = new Date(this.cursorTime).toLocaleTimeString();
    ctx.fillText(timeText, this.mouseX - ctx.measureText(timeText).width, height / dpr - 5);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.canvas?.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas?.removeEventListener('mouseleave', this.handleMouseLeave);
  }
}
