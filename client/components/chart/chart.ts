import { LitElement, html, css } from "lit";
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
export class CandlestickChart extends LitElement implements Drawable {
  private drawingStrategy: Drawable = new CandlestickStrategy();
  public canvas!: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D | null = null;

  private _data: PriceHistory = new SimplePriceHistory("ONE_HOUR", new Map());

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
      background: white;
    }
  `;

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
    this.canvas = this.renderRoot.querySelector("canvas")!;
    this.ctx = this.canvas.getContext("2d");

    // Wait for next microtask to ensure canvas is ready
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Dispatch ready event after everything is set up
    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html` <canvas></canvas> `;
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

  public resize(width: number, height: number) {
    if (width === 0 || height === 0) {
      console.warn("Invalid dimensions received:", width, height);
      return;
    }
    const dpr = window.devicePixelRatio ?? 1;

    // Set the canvas buffer size (actual pixels)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Set the canvas display size (CSS pixels)
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Reset any previous transforms and apply DPR scaling once
    if (this.ctx) {
      this.ctx.resetTransform();
      this.ctx.scale(dpr, dpr);
    }
  }
}
