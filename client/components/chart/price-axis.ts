import { customElement, state } from "lit/decorators.js";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import {
  Granularity,
  PriceRange,
  granularityToMs,
} from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { PRICEAXIS_WIDTH, PRICEAXIS_MOBILE_WIDTH } from "./chart-container";
import { priceToY, getDpr } from "../../util/chart-util";
import { ChartState } from "../..";
import { css, html } from "lit";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("PriceAxis");
logger.setLoggerLevel("PriceAxis", LogLevel.ERROR);

@customElement("price-axis")
export class PriceAxis extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private isDragging = false;
  private lastY = 0;
  private lastTouchDistance = 0;
  private isZooming = false;

  @state() private liveCandle: LiveCandle | null = null;

  @state() private mouseY: number = -1;
  @state() private mousePrice: number = 0;
  @state() private timeLeft: string = "";
  private _chartId: string = "state";
  private countdownInterval: number | null = null;

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;
  // Track if the device is touch-only (no mouse/trackpad)
  private isTouchOnly = window.matchMedia("(hover: none) and (pointer: coarse)")
    .matches;

  constructor() {
    super();
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.draw();
  };

  override getId(): string {
    return "price-axis";
  }

  firstUpdated() {
    super.firstUpdated();

    // Initialize with safe defaults
    this.priceRange = new PriceRangeImpl(0, 100);
    this.currentPrice = 0;
    this.liveCandle = null;

    // Listen for our own zoom events for immediate visual feedback
    this.addEventListener(
      "price-axis-zoom",
      this.handleOwnZoomEvent as EventListener,
    );

    // Listen for pan events from the chart area for immediate visual feedback
    document.addEventListener(
      "price-axis-pan",
      this.handleChartPanEvent as EventListener,
    );

    // Defer state initialization until component is properly connected
    requestAnimationFrame(() => {
      this.initializeState();
    });
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    logger.debug("Got chart ID:", this._chartId);
    logger.debug("Available xin keys:", Object.keys(xin));

    // Initialize state with actual data
    const stateData = xin[this._chartId] as ChartState;
    logger.debug("State data:", stateData);
    if (stateData && typeof stateData === "object") {
      this.priceRange = stateData.priceRange || new PriceRangeImpl(0, 100);
      this.liveCandle = stateData.liveCandle || null;
      logger.debug("Initialized priceRange:", this.priceRange);
      if (this.liveCandle) {
        this.currentPrice = this.liveCandle.close;
      }
    }

    // Set up observers
    logger.debug("Setting up observers for chart:", this._chartId);
    observeLocal(this, "state.liveCandle", () => {
      logger.debug("liveCandle observer triggered");
      this.liveCandle = xin[`${this._chartId}.liveCandle`] as LiveCandle;
      if (this.liveCandle) {
        this.currentPrice = this.liveCandle.close;
        this.startCountdown();
        this.draw();
      }
    });
    observeLocal(this, "state.priceRange", () => {
      logger.debug("priceRange observer triggered");
      const newPriceRange = xin[`${this._chartId}.priceRange`] as PriceRange;
      logger.debug("New price range:", newPriceRange);
      this.priceRange = newPriceRange;
      this.draw();
      this.requestUpdate(); // Update live price label position
    });
  }

  // Track mouse movements at the document level
  private handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.isConnected || !this.priceRange) return;

    // Get our component's position
    const rect = this.getBoundingClientRect();

    // Calculate relative Y position within our component
    this.mouseY = e.clientY - rect.top;

    // Convert Y position to price
    const percentage = 1 - this.mouseY / rect.height;
    this.mousePrice = this.priceRange.min + percentage * this.priceRange.range;

    this.requestUpdate();
  };

  private handleDocumentMouseOut = () => {
    this.mouseY = -1;
    this.requestUpdate();
  };

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange,
    );

    document.removeEventListener("mousemove", this.handleDocumentMouseMove);
    document.removeEventListener("mouseout", this.handleDocumentMouseOut);

    // Remove zoom and pan event listeners
    this.removeEventListener(
      "price-axis-zoom",
      this.handleOwnZoomEvent as EventListener,
    );
    document.removeEventListener(
      "price-axis-pan",
      this.handleChartPanEvent as EventListener,
    );

    // Clear countdown interval
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  useResizeObserver(): boolean {
    return true;
  }

  override draw(): void {
    if (!this.canvas || !this.ctx || !this.priceRange) return;

    const dpr = getDpr() ?? 1;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const priceY = priceToY(this.canvas.height / dpr, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    const priceStep = getPriceStep(this.priceRange.range);
    const firstPriceGridLine =
      Math.floor(this.priceRange.min / priceStep) * priceStep;

    // Set font once for all labels
    const fontFamily = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-primary")
      .trim();
    ctx.font = `${10}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    for (
      let price = firstPriceGridLine;
      price <= this.priceRange.max + priceStep;
      price += priceStep
    ) {
      const y = priceY(price);

      if (y >= 0 && y <= this.canvas.height / dpr) {
        const priceText = formatPrice(price);
        const labelWidth = this.isMobile
          ? PRICEAXIS_MOBILE_WIDTH
          : PRICEAXIS_WIDTH;
        const labelHeight = 20 / dpr;

        // Draw background
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();
        ctx.fillRect(0, y - labelHeight / 2, labelWidth, labelHeight);

        // Draw text
        ctx.fillStyle = "#666";
        ctx.fillText(priceText, labelWidth / 2, y);
      }
    }
  }

  override bindEventListeners(canvas: HTMLCanvasElement) {
    // Add a document-level mouse move listener to track mouse position
    // even when it's outside our component
    document.addEventListener("mousemove", this.handleDocumentMouseMove);
    document.addEventListener("mouseout", this.handleDocumentMouseOut);

    // Mouse events for drag/zoom functionality
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);

    // Touch events
    canvas.addEventListener("touchstart", this.handleTouchStart);
    canvas.addEventListener("touchmove", this.handleTouchMove);
    canvas.addEventListener("touchend", this.handleTouchEnd);
    canvas.addEventListener("touchcancel", this.handleTouchEnd);
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastY = e.clientY;
  };

  // Call this when dragging
  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaY = e.clientY - this.lastY;
    this.dispatchZoom(-deltaY, false);
    this.lastY = e.clientY;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad =
      Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < this.canvas!.width;
    this.dispatchZoom(e.deltaY, isTrackpad);
  };

  private dispatchZoom(deltaY: number, isTrackpad: boolean) {
    this.dispatchEvent(
      new CustomEvent("price-axis-zoom", {
        detail: {
          deltaY,
          isTrackpad,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault(); // Prevent scrolling while touching the axis
    this.isDragging = true;

    if (e.touches.length === 2) {
      // Initialize pinch-to-zoom
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    } else if (e.touches.length === 1) {
      // Single touch for dragging
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.isDragging) return;

    if (e.touches.length === 2 && this.isZooming) {
      // Handle pinch-to-zoom
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );

      const deltaDistance = currentDistance - this.lastTouchDistance;
      const zoomSensitivity = 0.5;

      // Apply zoom sensitivity to the delta and invert for natural pinch behavior
      const adjustedDelta = deltaDistance * zoomSensitivity;

      // Dispatch zoom event similar to mouse wheel zoom
      this.dispatchZoom(adjustedDelta, true);

      this.lastTouchDistance = currentDistance;
    } else if (e.touches.length === 1) {
      // Handle dragging
      const deltaY = e.touches[0].clientY - this.lastY;
      this.dispatchZoom(-deltaY, false);
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchEnd = () => {
    this.isDragging = false;
    this.isZooming = false;
  };

  private handleOwnZoomEvent = (event: CustomEvent) => {
    // Handle our own zoom event for immediate visual feedback
    const { deltaY, isTrackpad } = event.detail;

    // Apply zoom to our local price range for immediate visual feedback
    const zoomCenter = 0.5; // Center of the price axis
    const zoomMultiplier = isTrackpad ? 0.5 : 0.1;

    // Create a temporary price range for immediate feedback
    const tempRange = new PriceRangeImpl(
      this.priceRange.min,
      this.priceRange.max,
    );
    tempRange.adjust(deltaY * zoomMultiplier, zoomCenter);

    // Update our local price range for immediate rendering
    this.priceRange = tempRange;

    // Immediately redraw
    this.draw();
    this.requestUpdate(); // Update live price label position

    // The event will bubble up and the interaction controller will handle the state update
  };

  private handleChartPanEvent = (event: CustomEvent) => {
    // Handle pan events from chart area for immediate visual feedback
    const { newPriceRange } = event.detail;

    if (!newPriceRange) return;

    // Update our local price range for immediate rendering
    this.priceRange = new PriceRangeImpl(newPriceRange.min, newPriceRange.max);

    // Immediately redraw
    this.draw();
    this.requestUpdate(); // Update live price label position

    // The state update will happen via the interaction controller
  };

  // Countdown timer methods
  private formatTimeLeft(msLeft: number): string {
    const totalSeconds = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const granularityMs = granularityToMs(
      xin[`${this._chartId}.granularity`] as Granularity,
    );
    const showHours = granularityMs >= 24 * 60 * 60 * 1000;

    if (showHours) {
      return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    } else {
      return `${minutes.toString().padStart(2, "0")}:${seconds
        .toString()
        .padStart(2, "0")}`;
    }
  }

  private updateCountdown() {
    if (!this.liveCandle) return;

    const now = Date.now();
    const granularityMs = granularityToMs(
      xin[`${this._chartId}.granularity`] as Granularity,
    );

    // Calculate the start of the current candle period
    const currentPeriodStart = Math.floor(now / granularityMs) * granularityMs;
    // Calculate the end of the current candle period
    const currentPeriodEnd = currentPeriodStart + granularityMs;
    // Calculate remaining time
    const msLeft = currentPeriodEnd - now;

    this.timeLeft = this.formatTimeLeft(msLeft);
    this.requestUpdate();
  }

  private startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.updateCountdown();
    this.countdownInterval = window.setInterval(
      () => this.updateCountdown(),
      1000,
    );
  }

  // Computed properties for live price label positioning
  private get livePriceYPosition(): number {
    if (!this.liveCandle || !this.priceRange || !this.canvas) return -1;

    // Check if live candle is recent (within last 2 minutes)
    const now = Date.now();
    const candleAge = this.liveCandle.lastUpdate
      ? now - this.liveCandle.lastUpdate.getTime()
      : now - this.liveCandle.timestamp;

    if (candleAge > 120000) {
      // 2 minutes
      return -1;
    }

    // Check if the current price is within the visible range with some tolerance
    const tolerance = (this.priceRange.max - this.priceRange.min) * 0.01; // 1% tolerance
    if (
      this.currentPrice < this.priceRange.min - tolerance ||
      this.currentPrice > this.priceRange.max + tolerance
    ) {
      return -1;
    }

    const dpr = getDpr() ?? 1;
    const height = this.canvas.height / dpr;

    if (height === 0) {
      logger.warn(`Canvas has zero height, cannot calculate live price position`);
      return -1;
    }

    const priceY = priceToY(height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    return priceY(this.currentPrice);
  }

  private get isLivePriceBullish(): boolean {
    if (!this.liveCandle) return true;
    return this.liveCandle.close >= this.liveCandle.open;
  }

  render() {
    // No need for inline handlers anymore - we use document events
    const livePriceY = this.livePriceYPosition;
    const labelHeight = 30;
    const priceColor = this.isLivePriceBullish
      ? "var(--color-accent-1)"
      : "var(--color-error)";

    return html`
      <div class="container">
        <canvas></canvas>
        ${this.mouseY > 0 && !this.isTouchOnly
          ? html`
              <div
                class="mouse-price-label"
                style="top: ${this.mouseY - 10}px; left: 0;"
              >
                <div class="price">${formatPrice(this.mousePrice)}</div>
              </div>
            `
          : ""}
        ${livePriceY > 0 && this.liveCandle
          ? html`
              <div
                class="live-price-label"
                style="top: ${livePriceY - labelHeight / 2}px; left: 0; border-color: ${priceColor};"
              >
                <div class="price">${formatPrice(this.currentPrice)}</div>
                <div class="time">${this.timeLeft}</div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      pointer-events: auto;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: auto;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: auto;
    }

    .mouse-price-label {
      position: absolute;
      width: 94%;
      height: 20px;
      background-color: #222;
      border: 1px solid var(--color-primary);
      border-radius: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
      margin-right: 2px;
      z-index: 1000;
      color: white;
      pointer-events: none;
      box-shadow: 0 0 5px var(--color-primary);
    }

    .mouse-price-label .price {
      font-weight: bold;
    }

    .live-price-label {
      position: absolute;
      width: 97%;
      height: 30px;
      background-color: var(--color-primary-dark);
      border: 1px solid;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-size: 10px;
      line-height: 1.2;
      margin-right: 2px;
      z-index: 999;
      pointer-events: none;
    }

    .live-price-label .price {
      font-weight: bold;
      color: var(--color-accent-2);
    }

    .live-price-label .time {
      color: var(--color-background-secondary);
      font-size: 9px;
    }
  `;
}
