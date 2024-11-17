import { css } from "lit";
import { customElement, property } from "lit/decorators.js";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import {
  CandleDataByTimestamp,
  PriceHistory,
  SimplePriceHistory,
} from "../../../server/services/price-data/price-history-model";
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
  private _data: PriceHistory = new SimplePriceHistory("ONE_HOUR", new Map());

  override getId(): string {
    return "candlestick-chart";
  }

  @property({ type: Object })
  set data(newData: CandleDataByTimestamp) {
    console.log("CandlestickChart: Setting new data", {
      size: newData.size,
      timestamps: Array.from(newData.keys()),
    });
    this._data = new SimplePriceHistory("ONE_HOUR", new Map(newData.entries()));
  }

  get data(): CandleDataByTimestamp {
    return this._data.getCandles();
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
    if (!this.ctx || !this.canvas || this.data.size === 0) {
      console.warn("Cannot draw chart:", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        dataSize: this.data.size,
      });
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawingStrategy.draw(context);
  }
}
