import { html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import { xin } from "xinjs";
import { ChartState } from "../..";
import { priceToY, timeToX } from "../../util/chart-util";
import "./price-axis";
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
  @property({ type: Number })
  priceAxisWidth = 70;

  @property({ type: Number })
  priceAxisMobileWidth = 45;

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

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

  constructor() {
    super();
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.resize(this.clientWidth, this.clientHeight);
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange
    );
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
    this._state = state;
  }

  override getId(): string {
    return "candlestick-chart";
  }

  override async firstUpdated() {
    await super.firstUpdated();
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

  useResizeObserver(): boolean {
    return true;
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

  render() {
    console.log("CandlestickChart render");
    return html`
      <div class="chart-container">
        <canvas></canvas>
      </div>
      <div class="price-axis-container">
        <price-axis></price-axis>
      </div>
    `;
  }

  updated() {
    this.style.setProperty("--price-axis-width", `${this.priceAxisWidth}px`);
    this.style.setProperty(
      "--price-axis-mobile-width",
      `${this.priceAxisMobileWidth}px`
    );
    console.log(
      "CandlestickChart updated with priceAxisWidth",
      this.priceAxisWidth
    );
  }

  static styles = css`
    :host {
      position: relative;
      display: grid;
      grid-template-columns: 1fr auto;
      width: 100%;
      height: 100%;
    }

    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      grid-column: 1;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: block;
    }

    .price-axis-container {
      position: relative;
      width: var(--price-axis-width);
      height: 100%;
      background: var(--color-primary-dark);
      grid-column: 2;
    }

    @media (max-width: 767px) {
      .price-axis-container {
        width: var(--price-axis-mobile-width);
      }
    }
  `;
}
