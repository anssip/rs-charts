import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { css, PropertyValueMap } from "lit";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";

@customElement("live-decorators")
export class LiveDecorators extends CanvasBase {
  currentPrice: number = 0;
  priceRange: PriceRange = new PriceRangeImpl(0, 0);

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

    // Draw the horizontal line
    this.ctx.strokeStyle = "darkgreen";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.priceToY(this.currentPrice));
    this.ctx.lineTo(width, this.priceToY(this.currentPrice));
    this.ctx.stroke();

    console.log("LiveDecorators: draw", {
      width,
      height,
      currentPrice: this.currentPrice,
      closeY: this.priceToY(this.currentPrice),
    });
  }

  private priceToY(price: number): number {
    const dpr = window.devicePixelRatio ?? 1;
    const availableHeight = this.canvas!.height / dpr;
    const percentage = (price - this.priceRange.min) / this.priceRange.range;
    const y = (1 - percentage) * availableHeight;
    return y * dpr;
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }
  `;
}
