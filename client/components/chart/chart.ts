import { customElement, property } from "lit/decorators.js";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import { CanvasBase } from "./canvas-base";

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartOptions {
  candleWidth: number;
  candleGap: number;
  minCandleWidth: number;
  maxCandleWidth: number;
}

@customElement("candlestick-chart")
export class CandlestickChart extends CanvasBase implements Drawable {
  private drawingStrategy: Drawable = new CandlestickStrategy();
  override getId(): string {
    return "candlestick-chart";
  }

  async firstUpdated() {
    super.firstUpdated();

    await new Promise((resolve) => setTimeout(resolve, 0));

    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        bubbles: true,
        composed: true,
      })
    );
  }

  public draw(context: DrawingContext) {
    if (!this.ctx || !this.canvas) {
      console.warn("Cannot draw chart:", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        dataSize: context.data.length,
      });
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawingStrategy.draw(context);
  }
}
