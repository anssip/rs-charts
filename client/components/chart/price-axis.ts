import { customElement, property, state } from "lit/decorators.js";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import {
  Granularity,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { PRICEAXIS_WIDTH, PRICEAXIS_MOBILE_WIDTH } from "./chart-container";
import { priceToY } from "../../util/chart-util";
import { granularityToMs } from "../../../server/services/price-data/price-history-model";
import { ChartState } from "../..";
import { css, html } from "lit";

@customElement("price-axis")
export class PriceAxis extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private isDragging = false;
  private lastY = 0;
  private lastTouchDistance = 0;
  private isZooming = false;

  @state() private liveCandle: LiveCandle | null = null;
  @state() private livePriceYPosition: number = 0;
  @state() private isBearish: boolean = false;

  @state() private mouseY: number = -1;
  @state() private mousePrice: number = 0;

  private countdownInterval: number | null = null;
  @state() private timeLeft: string = "";

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

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

    this.priceRange = xin["state.priceRange"] as PriceRange;

    observe("state.liveCandle", (path) => {
      this.liveCandle = xin[path] as LiveCandle;
      this.currentPrice = this.liveCandle.close;
      this.isBearish = this.liveCandle.close < this.liveCandle.open;
      this.startCountdown();
      this.draw();
    });
    observe("state.priceRange", (path) => {
      this.priceRange = xin[path] as PriceRange;
      this.draw();
    });
  }

  // Track mouse movements at the document level
  private handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.isConnected) return;

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
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange
    );

    document.removeEventListener("mousemove", this.handleDocumentMouseMove);
    document.removeEventListener("mouseout", this.handleDocumentMouseOut);
  }

  useResizeObserver(): boolean {
    return true;
  }

  override draw(): void {
    if (!this.canvas || !this.ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const priceY = priceToY(this.canvas.height, {
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

    // Update live price position for HTML label
    if (this.liveCandle) {
      this.livePriceYPosition = priceY(this.currentPrice);
      this.isBearish = this.liveCandle.close < this.liveCandle.open;
      this.requestUpdate();
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
      })
    );
  }

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private formatTimeLeft(msLeft: number): string {
    const totalSeconds = Math.floor(msLeft / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const granularityMs = granularityToMs(
      xin["state.granularity"] as Granularity
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
      xin["state.granularity"] as Granularity
    );

    // Calculate the start of the current candle period
    const currentPeriodStart = Math.floor(now / granularityMs) * granularityMs;
    // Calculate the end of the current candle period
    const currentPeriodEnd = currentPeriodStart + granularityMs;
    // Calculate remaining time
    const msLeft = currentPeriodEnd - now;

    this.timeLeft = this.formatTimeLeft(msLeft);

    if (msLeft <= 1000) {
      const state = xin["state"] as ChartState;
      // dispatch event to fetch new candle
      this.dispatchEvent(
        new CustomEvent("fetch-next-candle", {
          detail: {
            granularity: state.granularity,
            timeRange: {
              start: state.timeRange.end + 1000,
              end: state.timeRange.end + granularityMs * 2,
            },
          },
          bubbles: true,
          composed: true,
        })
      );
    }

    if (!this.canvas) return;

    const priceY = priceToY(this.canvas.height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });

    // Update position for HTML label
    this.livePriceYPosition = priceY(this.currentPrice);
    this.requestUpdate();
  }

  private startCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.updateCountdown();
    this.countdownInterval = window.setInterval(
      () => this.updateCountdown(),
      1000
    );
  }

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault(); // Prevent scrolling while touching the axis
    this.isDragging = true;

    if (e.touches.length === 2) {
      // Initialize pinch-to-zoom
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
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
        e.touches[0].clientY - e.touches[1].clientY
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

  render() {
    // No need for inline handlers anymore - we use document events
    return html`
      <div class="container">
        <canvas></canvas>
        ${this.liveCandle ? this.renderLivePriceLabel() : ""}
        ${this.mouseY > 0
          ? html`
              <div
                class="mouse-price-label"
                style="top: ${this.mouseY - 10}px; left: 0;"
              >
                <div class="price">${formatPrice(this.mousePrice)}</div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  renderLivePriceLabel() {
    const priceColor = this.isBearish
      ? "var(--color-error)"
      : "var(--color-accent-1)";

    const textColor = "var(--color-accent-2)";
    const timeColor = "var(--color-background-secondary)";

    const labelHeight = 30;
    const top = `${this.livePriceYPosition - labelHeight / 2}px`;

    return html`
      <div
        class="live-price-label"
        style="
          top: ${top}; 
          border-color: ${priceColor};
        "
      >
        <div class="price" style="color: ${textColor}">
          ${formatPrice(this.currentPrice)}
        </div>
        <div class="time" style="color: ${timeColor}">${this.timeLeft}</div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
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
      z-index: 2;
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

    .price {
      font-weight: bold;
    }
  `;
}
