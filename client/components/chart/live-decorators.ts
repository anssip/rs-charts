import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { css } from "lit";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { priceToY } from "../../util/chart-util";

@customElement("live-decorators")
export class LiveDecorators extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private liveCandle: LiveCandle | null = null;

  firstUpdated() {
    super.firstUpdated();

    this.priceRange = xin["state.priceRange"] as PriceRange;
    // observe liveCandle from app state
    observe("state.liveCandle", (path) => {
      this.liveCandle = xin[path] as LiveCandle;
      this.currentPrice = this.liveCandle.close;
      this.draw();
    });
    observe("state.priceRange", (path) => {
      this.priceRange = xin[path] as PriceRange;
      this.draw();
    });
  }

  useResizeObserver(): boolean {
    return true;
  }

  override getId(): string {
    return "live-decorators";
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    const priceY = priceToY(height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    // Determine if the price movement is bearish or bullish
    const isBearish = this.liveCandle
      ? this.liveCandle.close < this.liveCandle.open
      : false;

    // Draw the horizontal line with color based on price movement
    this.ctx.strokeStyle = isBearish
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim();
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, priceY(this.currentPrice));
    this.ctx.lineTo(width, priceY(this.currentPrice));
    this.ctx.stroke();
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }
  `;
}
