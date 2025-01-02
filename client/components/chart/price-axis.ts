import { customElement } from "lit/decorators.js";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import {
  Granularity,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import {
  PRICEAXIS_WIDTH,
  PRICEAXIS_MOBILE_WIDTH,
  TIMELINE_HEIGHT,
} from "./chart-container";
import { priceToY } from "../../util/chart-util";
import { granularityToMs } from "../../../server/services/price-data/price-history-model";
import { ChartState } from "../..";

@customElement("price-axis")
export class PriceAxis extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private isDragging = false;
  private lastY = 0;
  private lastTouchDistance = 0;
  private isZooming = false;
  private liveCandle: LiveCandle | null = null;
  private countdownInterval: number | null = null;
  private timeLeft: string = "";

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

  override getId(): string {
    return "price-axis";
  }

  firstUpdated() {
    super.firstUpdated();

    this.priceRange = xin["state.priceRange"] as PriceRange;

    observe("state.liveCandle", (path) => {
      this.liveCandle = xin[path] as LiveCandle;
      this.currentPrice = this.liveCandle.close;
      this.startCountdown();
      this.draw();
    });
    observe("state.priceRange", (path) => {
      this.priceRange = xin[path] as PriceRange;
      this.draw();
    });
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.draw();
  };

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
    this.drawLivePriceLabel(ctx, priceY);
  }

  drawLivePriceLabel(
    ctx: CanvasRenderingContext2D,
    priceY: (price: number) => number
  ) {
    if (!this.liveCandle) return;

    const isBearish = this.liveCandle.close < this.liveCandle.open;
    const priceColor = isBearish
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim();

    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent-2")
      .trim();

    const priceYPos = priceY(this.currentPrice);
    const labelWidth = this.isMobile ? PRICEAXIS_MOBILE_WIDTH : PRICEAXIS_WIDTH;
    const labelHeight = 30;

    // Draw background with rounded corners
    const cornerRadius = 4;
    ctx.beginPath();
    ctx.roundRect(
      0,
      priceYPos - labelHeight / 2,
      labelWidth,
      labelHeight,
      cornerRadius
    );
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary-dark")
      .trim();
    ctx.fill();

    // Draw border with rounded corners
    ctx.strokeStyle = priceColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw price text
    ctx.fillStyle = textColor;
    ctx.fillText(formatPrice(this.currentPrice), labelWidth / 2, priceYPos - 6);

    // Draw time text
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background-secondary")
      .trim();
    ctx.fillText(this.timeLeft, labelWidth / 2, priceYPos + 6);
  }

  override bindEventListeners(canvas: HTMLCanvasElement) {
    // Mouse events
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

    if (!this.ctx || !this.canvas) return;

    const priceY = priceToY(this.canvas.height, {
      start: this.priceRange.min,
      end: this.priceRange.max,
    });
    this.drawLivePriceLabel(this.ctx, priceY);
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

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
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
}
