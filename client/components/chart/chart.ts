import { customElement, property } from "lit/decorators.js";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import { CanvasBase } from "./canvas-base";
import { xin } from "xinjs";
import { ChartState } from "../..";
import { priceToY, timeToX } from "../../util/chart-util";
// We store data 5 times the visible range to allow for zooming and panning without fetching more data
export const BUFFER_MULTIPLIER = 5;

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
  private _state: ChartState | null = null;
  private _padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } = { top: 0, right: 0, bottom: 0, left: 0 };

  @property({ type: Object })
  _options: ChartOptions = {
    candleWidth: 7,
    candleGap: 2,
    minCandleWidth: 2,
    maxCandleWidth: 100,
  };

  private drawingStrategy: Drawable = new CandlestickStrategy();
  override getId(): string {
    return "candlestick-chart";
  }

  @property({ type: Object })
  public set options(options: ChartOptions) {
    this._options = options;
  }

  @property({ type: Object })
  public set padding(padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }) {
    this._padding = padding;
  }

  @property({ type: Object })
  public set state(state: ChartState) {
    console.log("CandlestickChart: Setting state", state);
    this._state = state;
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

  public drawWithContext(context: DrawingContext) {
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

  override draw() {
    if (!this._state) return;
    const context: DrawingContext = {
      ctx: this.ctx!,
      chartCanvas: this.canvas!,
      data: this._state!.priceHistory,
      options: this._options,
      viewportStartTimestamp: this._state!.timeRange.start,
      viewportEndTimestamp: this._state!.timeRange.end,
      priceRange: this._state!.priceRange,
      axisMappings: {
        timeToX: timeToX(this.canvas!.width, this._state!.timeRange),
        priceToY: priceToY(this.canvas!.height, {
          start: this._state!.priceRange.min,
          end: this._state.priceRange.max,
        }),
      },
    };
    this.drawWithContext(context);
  }

  override resize(width: number, height: number) {
    super.resize(width, height);

    xin["state.canvasWidth"] = width;
    xin["state.canvasHeight"] = height;
  }

  public calculateVisibleCandles(): number {
    if (!this.canvas) return 0;
    const availableWidth =
      this.canvas!.width - this._padding.left - this._padding.right;

    const totalCandleWidth =
      this._options.candleWidth + this._options.candleGap;
    return Math.floor(
      availableWidth / (totalCandleWidth * window.devicePixelRatio)
    );
  }
}
