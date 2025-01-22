import { customElement } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";

@customElement("market-indicator")
export class MarketIndicator extends CanvasBase {
  private _state: ChartState | null = null;

  override getId(): string {
    return "market-indicator";
  }

  firstUpdated() {
    super.firstUpdated();
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.draw();
    });
  }

  useResizeObserver(): boolean {
    return true;
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    // Clear the canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Set text properties
    ctx.font = `${48 / dpr}px var(--font-primary)`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw the text in the center of the canvas
    const x = this.canvas.width / (2 * dpr);
    const y = this.canvas.height / (2 * dpr);
    ctx.fillText("MARKET INDICATOR 1", x, y);
  }
}
