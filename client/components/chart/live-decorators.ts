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
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger('LiveDecorators');
logger.setLoggerLevel('LiveDecorators', LogLevel.ERROR);

@customElement("live-decorators")
export class LiveDecorators extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private liveCandle: LiveCandle | null = null;
  private _chartId: string = "state";
  private drawRequestId: number | null = null;
  private isInitialized: boolean = false;
  private lastDrawnTimestamp: number = 0;
  private visibilityChangeHandler: (() => void) | null = null;

  firstUpdated() {
    super.firstUpdated();

    // Initialize with safe defaults
    this.priceRange = new PriceRangeImpl(0, 100);
    this.currentPrice = 0;

    // Defer state initialization until component is properly connected
    requestAnimationFrame(() => {
      if (!this.isInitialized) {
        this.initializeState();
      }
    });
  }

  private initializeState() {
    if (this.isInitialized) return;

    try {
      // Get the local chart ID for this chart instance
      this._chartId = getLocalChartId(this);

      // Initialize state with actual data
      const stateData = xin[this._chartId] as ChartState;
      if (stateData && typeof stateData === "object") {
        this.priceRange = stateData.priceRange || new PriceRangeImpl(0, 100);
        this.liveCandle = stateData.liveCandle || null;
        if (this.liveCandle) {
          this.currentPrice = this.liveCandle.close;
          this.lastDrawnTimestamp = this.liveCandle.timestamp;
        }
      }

      // Set up observers with proper cleanup tracking
      observeLocal(this, "state.liveCandle", () => {
        const newLiveCandle = xin[`${this._chartId}.liveCandle`] as LiveCandle;

        // Only update if we have a meaningful change
        if (
          newLiveCandle &&
          (!this.liveCandle ||
            newLiveCandle.timestamp !== this.liveCandle.timestamp ||
            newLiveCandle.close !== this.liveCandle.close ||
            Math.abs(newLiveCandle.timestamp - this.lastDrawnTimestamp) > 1000)
        ) {
          this.liveCandle = newLiveCandle;
          this.currentPrice = newLiveCandle.close;
          this.lastDrawnTimestamp = newLiveCandle.timestamp;
          this.requestDraw();
        }
      });

      observeLocal(this, "state.priceRange", () => {
        const latestState = xin[this._chartId] as ChartState;
        const newPriceRange = latestState?.priceRange;
        if (
          newPriceRange &&
          typeof newPriceRange.min !== "undefined" &&
          typeof newPriceRange.max !== "undefined"
        ) {
          // Always update the price range, even if values seem the same
          // This ensures we stay in sync with pan/zoom operations
          this.priceRange = new PriceRangeImpl(
            newPriceRange.min,
            newPriceRange.max,
          );
          this.requestDraw();
        }
      });

      // Listen for price-axis-zoom events for real-time updates during zoom/pan
      this.addEventListener("price-axis-zoom", this.handlePriceAxisZoom);
      // Also listen at document level to catch events that bubble up
      document.addEventListener("price-axis-zoom", this.handlePriceAxisZoom);

      // Listen for additional price axis events that might affect positioning
      this.addEventListener("price-axis-pan", this.handlePriceAxisZoom);
      document.addEventListener("price-axis-pan", this.handlePriceAxisZoom);
      this.addEventListener("price-range-change", this.handlePriceAxisZoom);
      document.addEventListener("price-range-change", this.handlePriceAxisZoom);

      // Listen for visibility changes to immediately update when chart becomes visible
      this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
      document.addEventListener(
        "visibilitychange",
        this.visibilityChangeHandler,
      );

      // Listen for any state changes that might affect the chart
      observeLocal(this, "state", () => {
        // Force update of price range from the latest state
        const latestState = xin[this._chartId] as ChartState;
        if (
          latestState &&
          latestState.priceRange &&
          typeof latestState.priceRange.min !== "undefined" &&
          typeof latestState.priceRange.max !== "undefined"
        ) {
          // Always update to ensure we stay in sync with all state changes
          this.priceRange = new PriceRangeImpl(
            latestState.priceRange.min,
            latestState.priceRange.max,
          );
          this.requestDraw();
        }
      });

      this.isInitialized = true;
    } catch (error) {
      logger.error(
        `Error initializing state:`,
        error,
      );
    }
  }

  useResizeObserver(): boolean {
    return true;
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    // Clean up event listeners
    this.removeEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    document.removeEventListener("price-axis-zoom", this.handlePriceAxisZoom);
    this.removeEventListener("price-axis-pan", this.handlePriceAxisZoom);
    document.removeEventListener("price-axis-pan", this.handlePriceAxisZoom);
    this.removeEventListener("price-range-change", this.handlePriceAxisZoom);
    document.removeEventListener(
      "price-range-change",
      this.handlePriceAxisZoom,
    );

    // Clean up visibility change listener
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler,
      );
      this.visibilityChangeHandler = null;
    }

    // Cancel any pending draw requests
    if (this.drawRequestId) {
      cancelAnimationFrame(this.drawRequestId);
      this.drawRequestId = null;
    }

    // Reset state
    this.isInitialized = false;
    this.liveCandle = null;
    this.lastDrawnTimestamp = 0;
  }

  private handlePriceAxisZoom = (event?: Event) => {
    // Force immediate update of price range from state on pan/zoom
    const latestState = xin[this._chartId] as ChartState;
    const latestPriceRange = latestState?.priceRange;
    if (
      latestPriceRange &&
      typeof latestPriceRange.min !== "undefined" &&
      typeof latestPriceRange.max !== "undefined"
    ) {
      // Always update, even if values appear the same (floating point precision)
      const oldMin = this.priceRange.min;
      const oldMax = this.priceRange.max;
      this.priceRange = new PriceRangeImpl(
        latestPriceRange.min,
        latestPriceRange.max,
      );
    }
    // Immediately request a redraw when zoom/pan occurs
    this.requestDraw();
  };

  private handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && this.isInitialized) {
      // Force immediate update of live candle data when page becomes visible
      const latestState = xin[this._chartId] as ChartState;
      if (latestState?.liveCandle) {
        const newLiveCandle = latestState.liveCandle;

        // Update live candle data even if it seems the same (might have been updated while hidden)
        this.liveCandle = newLiveCandle;
        this.currentPrice = newLiveCandle.close;
        this.lastDrawnTimestamp = newLiveCandle.timestamp;
      }

      // Force immediate update of price range
      if (
        latestState?.priceRange &&
        typeof latestState.priceRange.min !== "undefined" &&
        typeof latestState.priceRange.max !== "undefined"
      ) {
        this.priceRange = new PriceRangeImpl(
          latestState.priceRange.min,
          latestState.priceRange.max,
        );
      }

      // Request immediate redraw to show latest data
      this.requestDraw();
    }
  };

  private requestDraw() {
    // Throttle draw requests using requestAnimationFrame
    if (this.drawRequestId) {
      return; // Already have a pending draw request
    }

    this.drawRequestId = requestAnimationFrame(() => {
      this.drawRequestId = null;

      // Always sync price range before drawing
      const latestState = xin[this._chartId] as ChartState;
      const latestPriceRange = latestState?.priceRange;
      if (
        latestPriceRange &&
        typeof latestPriceRange.min !== "undefined" &&
        typeof latestPriceRange.max !== "undefined"
      ) {
        this.priceRange = new PriceRangeImpl(
          latestPriceRange.min,
          latestPriceRange.max,
        );
      }

      try {
        this.draw();
      } catch (error) {
        logger.error(
          `Error during draw:`,
          error,
        );
      }
    });
  }

  override getId(): string {
    return "live-decorators";
  }

  draw() {
    if (!this.canvas) {
      logger.warn(`Canvas not initialized`);
      return;
    }
    if (!this.ctx) {
      logger.warn(`Context not initialized`);
      return;
    }
    if (!this.liveCandle) {
      logger.warn(
        `Live candle not initialized`,
      );
      return;
    }
    const width = this.canvas.width;
    const height = this.canvas.height;

    this.ctx.clearRect(0, 0, width, height);

    // Check if live candle is recent (within last 2 minutes)
    const now = Date.now();
    const candleAge = this.liveCandle.lastUpdate
      ? now - this.liveCandle.lastUpdate.getTime()
      : now - this.liveCandle.timestamp;

    if (candleAge > 120000) {
      // 2 minutes
      return;
    }

    // Always get the latest price range from state to ensure real-time updates
    const latestState = xin[this._chartId] as ChartState;
    const latestPriceRange = latestState?.priceRange;
    if (
      !latestPriceRange ||
      typeof latestPriceRange.min === "undefined" ||
      typeof latestPriceRange.max === "undefined"
    ) {
      logger.warn(
        `No valid price range available in state`,
        latestPriceRange,
      );
      return;
    }

    // Update our local reference - this is critical for pan/zoom responsiveness
    // Force update even if values appear the same due to potential floating point differences
    this.priceRange = new PriceRangeImpl(
      latestPriceRange.min,
      latestPriceRange.max,
    );
    // Check if the current price is within the visible range with some tolerance
    const tolerance = (this.priceRange.max - this.priceRange.min) * 0.01; // 1% tolerance
    if (
      this.currentPrice < this.priceRange.min - tolerance ||
      this.currentPrice > this.priceRange.max + tolerance
    ) {
      return;
    }

    const priceY = priceToY(height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    const yPosition = priceY(this.currentPrice);
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
    this.ctx.moveTo(0, yPosition);
    this.ctx.lineTo(width, yPosition);
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
