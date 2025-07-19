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
import { getLocalChartId, observeLocal } from "../../util/state-context";
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

  private _state: ChartState | null = null;
  private _chartId: string = "state";
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

  private drawingStrategy: CandlestickStrategy = new CandlestickStrategy();

  constructor() {
    super();
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
    
    // Set up redraw callback for live candle updates
    this.drawingStrategy.setRedrawCallback(() => {
      this.draw();
    });
  }

  bindEventListeners(_: HTMLCanvasElement): void {
    this.addEventListener(
      "force-redraw",
      this.handleForceRedraw as EventListener
    );
  }

  handleForceRedraw(e: CustomEvent<{ width: number; height: number }>) {
    this.resize(e.detail.width, e.detail.height);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.resize(this.clientWidth, this.clientHeight);
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange
    );
    
    // Clean up drawing strategy
    if (this.drawingStrategy && typeof this.drawingStrategy.destroy === 'function') {
      this.drawingStrategy.destroy();
    }
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
    this.draw();
  }

  override getId(): string {
    return "candlestick-chart";
  }

  override async firstUpdated() {
    await super.firstUpdated();

    // Initialize state management
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.initializeState();
    
    // Ensure canvas has chart ID for drawing strategy
    if (this.canvas && this._chartId) {
      (this.canvas as any).chartId = this._chartId;
      this.canvas.setAttribute('data-chart-id', this._chartId);
    }
    
    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        bubbles: true,
        composed: true,
      })
    );
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    
    // Pass chart ID to the canvas element for drawing strategy identification
    if (this.canvas) {
      (this.canvas as any).chartId = this._chartId;
      this.canvas.setAttribute('data-chart-id', this._chartId);
    }
    
    // Initialize state with actual data
    this._state = xin[this._chartId] as ChartState;
    
    // Set up observers for state changes
    observeLocal(this, "state", () => {
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
    observeLocal(this, "state.priceHistory", () => {
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
    observeLocal(this, "state.timeRange", () => {
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
    observeLocal(this, "state.priceRange", () => {
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
    observeLocal(this, "state.liveCandle", () => {
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
  }

  public drawWithContext(context: DrawingContext) {
    if (!this.ctx || !this.canvas) {
      return;
    }

    // Ensure canvas has chart ID before drawing
    if (this._chartId) {
      (this.canvas as any).chartId = this._chartId;
      this.canvas.setAttribute('data-chart-id', this._chartId);
    }

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawingStrategy.draw(context);
  }

  override draw() {
    if (!this._state) {
      this._state = xin[this._chartId] as ChartState;
    }
    if (!this.ctx || !this.canvas || !this._state) {
      return;
    }
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
    return html`
      <div class="chart-container">
        <canvas></canvas>
        <div class="price-axis-container">
          <price-axis></price-axis>
        </div>
      </div>
    `;
  }

  updated() {
    this.style.setProperty("--price-axis-width", `${this.priceAxisWidth}px`);
    this.style.setProperty(
      "--price-axis-mobile-width",
      `${this.priceAxisMobileWidth}px`
    );
  }

  static styles = css`
    :host {
      position: relative;
      display: block;
      width: 100%;
      height: 100%;
    }

    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
      display: flex;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - var(--price-axis-width));
      height: 100%;
      display: block;
    }

    .price-axis-container {
      position: absolute;
      right: 0;
      top: 0;
      width: var(--price-axis-width);
      height: 100%;
      background: var(--color-primary-dark);
      pointer-events: auto;
      z-index: 10;
    }

    @media (max-width: 767px) {
      .price-axis-container {
        width: var(--price-axis-mobile-width);
      }

      canvas {
        width: calc(100% - var(--price-axis-mobile-width));
      }
    }
  `;
}
