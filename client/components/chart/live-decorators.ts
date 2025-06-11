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
  private drawRequestId: number | null = null;

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
      this.requestDraw();
    });
    observeLocal(this, "state.priceRange", () => {
      this.priceRange = xin[`${this._chartId}.priceRange`] as PriceRange;
      this.requestDraw();
    });

    // Listen for price-axis-zoom events for real-time updates during zoom/pan
    this.addEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    // Also listen at document level to catch events that bubble up
    document.addEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    
    // Listen for any state changes that might affect the chart
    observeLocal(this, "state", () => {
      // Force update of price range from the latest state
      const latestState = xin[this._chartId] as ChartState;
      if (latestState && latestState.priceRange) {
        this.priceRange = latestState.priceRange;
        this.requestDraw();
      }
    });
  }

  useResizeObserver(): boolean {
    return true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up event listeners
    this.removeEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    document.removeEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    
    // Cancel any pending draw requests
    if (this.drawRequestId) {
      cancelAnimationFrame(this.drawRequestId);
      this.drawRequestId = null;
    }
  }

  private handlePriceAxisZoom = () => {
    // Immediately request a redraw when zoom/pan occurs
    this.requestDraw();
  };

  private requestDraw() {
    // Throttle draw requests using requestAnimationFrame
    if (this.drawRequestId) {
      return; // Already have a pending draw request
    }
    
    this.drawRequestId = requestAnimationFrame(() => {
      this.drawRequestId = null;
      this.draw();
    });
  }

  override getId(): string {
    return "live-decorators";
  }

  draw() {
    if (!this.canvas || !this.ctx) return;
    
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    // Don't draw if we don't have valid price data
    if (!this.liveCandle || this.currentPrice === 0) return;

    // Always get the latest price range from state to ensure real-time updates
    const latestPriceRange = xin[`${this._chartId}.priceRange`] as PriceRange;
    if (!latestPriceRange) return;
    
    // Update our local reference
    this.priceRange = latestPriceRange;

    // Check if the current price is within the visible range
    if (this.currentPrice < this.priceRange.min || this.currentPrice > this.priceRange.max) {
      // Don't draw if price is outside the visible range
      return;
    }

    const priceY = priceToY(height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    // Determine if the price movement is bearish or bullish
    const isBearish = this.liveCandle.close < this.liveCandle.open;

    // Draw the horizontal line with color based on price movement
    this.ctx.strokeStyle = isBearish
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim();
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]); // Dashed line for better visibility
    this.ctx.beginPath();
    this.ctx.moveTo(0, priceY(this.currentPrice));
    this.ctx.lineTo(width, priceY(this.currentPrice));
    this.ctx.stroke();
    this.ctx.setLineDash([]); // Reset line dash
  }

  static styles = css`
    :host {
      width: 100%;
      height: 100%;
    }
  `;
}
