import { customElement } from "lit/decorators.js";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../api/live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { PRICEAXIS_WIDTH } from "./chart-container";
import { priceToY } from "../../util/chart-util";

@customElement("price-axis")
export class PriceAxis extends CanvasBase {
  private currentPrice: number = 0;
  private priceRange: PriceRange = new PriceRangeImpl(0, 0);
  private isDragging = false;
  private lastY = 0;
  private liveCandle: LiveCandle | null = null;

  override getId(): string {
    return "price-axis";
  }

  firstUpdated() {
    super.firstUpdated();

    this.priceRange = xin["state.priceRange"] as PriceRange;
    console.log("PriceAxis: priceRange", this.priceRange);

    observe("state.liveCandle", (path) => {
      console.log("PriceAxis: liveCandle changed", xin[path] as LiveCandle);
      this.liveCandle = xin[path] as LiveCandle;
      this.currentPrice = this.liveCandle.close;
      this.draw();
    });
    observe("state.priceRange", (path) => {
      console.log("PriceAxis: priceRange changed", xin[path]);
      this.priceRange = xin[path] as PriceRange;
      this.draw();
    });
  }

  useResizeObserver(): boolean {
    return true;
  }

  override draw(): void {
    if (!this.canvas || !this.ctx) return;
    console.log("PriceAxis: priceRange", {
      width: this.canvas.width,
      height: this.canvas.height,
      priceRange: { min: this.priceRange.min, max: this.priceRange.max },
    });

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
        const labelWidth = PRICEAXIS_WIDTH;
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

    // Determine if the price movement is bearish or bullish
    const isBearish = this.liveCandle
      ? this.liveCandle.close < this.liveCandle.open
      : false;

    // Get the appropriate color based on price movement
    const priceColor = isBearish
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim();

    const textColor = isBearish
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-2")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();

    // Draw live price label
    const priceYPos = priceY(this.currentPrice);
    const labelWidth = PRICEAXIS_WIDTH;
    const labelHeight = 20;

    // Draw background
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary-dark")
      .trim();
    ctx.fillRect(0, priceYPos - labelHeight / 2, labelWidth, labelHeight);

    // Draw border
    ctx.strokeStyle = priceColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, priceYPos - labelHeight / 2, labelWidth, labelHeight);

    // Draw text
    ctx.fillStyle = textColor;
    ctx.fillText(formatPrice(this.currentPrice), labelWidth / 2, priceYPos);
  }

  override bindEventListeners(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);
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
}
