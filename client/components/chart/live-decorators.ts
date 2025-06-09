import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { priceToY } from "../../util/chart-util";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import { ChartState } from "../..";
import { css } from "lit";

@customElement("live-decorators")
export class LiveDecorators extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private liveCandle: LiveCandle | null = null;
  private _chartId: string = "state";

  firstUpdated() {
    super.firstUpdated();

    // Initialize with safe defaults
    this.priceRange = new PriceRangeImpl(0, 100);
    this.currentPrice = 0;
    
    // Defer state initialization until component is properly connected
    requestAnimationFrame(() => {
      this.initializeState();
    });
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    
    // Initialize state with actual data
    const stateData = xin[this._chartId] as ChartState;
    if (stateData && typeof stateData === 'object') {
      this.priceRange = stateData.priceRange || new PriceRangeImpl(0, 100);
      this.liveCandle = stateData.liveCandle || null;
      if (this.liveCandle) {
        this.currentPrice = this.liveCandle.close;
      }
    }

    // Set up observers
    observeLocal(this, "state.liveCandle", () => {
      this.liveCandle = xin[`${this._chartId}.liveCandle`] as LiveCandle;
      if (this.liveCandle) {
        this.currentPrice = this.liveCandle.close;
      }
      this.draw();
    });
    observeLocal(this, "state.priceRange", () => {
      this.priceRange = xin[`${this._chartId}.priceRange`] as PriceRange;
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
    if (!this.canvas || !this.ctx || !this.priceRange) return;
    
    // Don't draw if we don't have valid price data
    if (!this.liveCandle || this.currentPrice === 0) return;
    
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
    this.ctx.lineWidth = 0.5;
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
