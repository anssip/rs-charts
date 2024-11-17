import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { LiveCandle } from "../../live-candle-subscription";
import { Drawable, DrawingContext } from "./drawing-strategy";

@customElement("live-decorators")
export class LiveDecorators extends LitElement implements Drawable {
  @property({ type: Number })
  currentPrice: number = 0;

  setLiveCandle(liveCandle: LiveCandle): void {
    console.log("LiveDecorators: setLiveCandle", liveCandle);
    this.currentPrice = liveCandle.close;
  }

  render() {
    return html`<canvas id="live-decorator-canvas"></canvas>`;
  }

  draw(context: DrawingContext) {
    const {
      axisMappings: { priceToY },
    } = context;
    console.log("LiveDecorators: draw");
    const canvas = this.shadowRoot?.getElementById(
      "live-decorator-canvas"
    ) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Draw the horizontal line
    ctx.strokeStyle = "darkgreen";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, priceToY(this.currentPrice));
    ctx.lineTo(width, priceToY(this.currentPrice));
    ctx.stroke();

    console.log("LiveDecorators: draw", {
      width,
      height,
      currentPrice: this.currentPrice,
      y: priceToY(this.currentPrice),
    });
  }

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
}
