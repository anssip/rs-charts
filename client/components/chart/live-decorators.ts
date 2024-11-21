import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { css } from "lit";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { priceToY } from "../../util/chart-util";

@customElement("live-decorators")
export class LiveDecorators extends CanvasBase {
  currentPrice: number = 0;
  priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private resizeObserver: ResizeObserver | null = null;

  firstUpdated() {
    super.firstUpdated();

    this.priceRange = xin["state.priceRange"] as PriceRange;
    console.log("LiveDecorators: priceRange", this.priceRange);
    // observe liveCandle.close from app state
    observe("state.liveCandle", (path) => {
      console.log(
        "LiveDecorators: liveCandle.close changed",
        (xin[path] as LiveCandle).close
      );
      this.currentPrice = (xin[path] as LiveCandle).close;
      this.requestUpdate();
    });
    observe("state.priceRange", (path) => {
      console.log("LiveDecorators: priceRange changed", xin[path]);
      this.priceRange = xin[path] as PriceRange;
      this.requestUpdate();
    });

    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === this) {
          this.resize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    this.resizeObserver.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(this);
      this.resizeObserver = null;
    }
  }

  override render() {
    this.draw();
    return super.render();
  }

  override getId(): string {
    return "live-decorators";
  }

  draw() {
    console.log("LiveDecorators: draw");

    if (!this.canvas || !this.ctx) return;
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    const priceY = priceToY(height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    // Draw the horizontal line
    this.ctx.strokeStyle = "darkgreen";
    // use dotted line
    this.ctx.setLineDash([2, 2]);
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, priceY(this.currentPrice));
    this.ctx.lineTo(width, priceY(this.currentPrice));
    this.ctx.stroke();

    console.log("LiveDecorators: draw", {
      width,
      height,
      currentPrice: this.currentPrice,
      closeY: priceY(this.currentPrice),
    });
  }

  override resize(width: number, height: number) {
    super.resize(width, height);
    this.draw();
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }
  `;
}
