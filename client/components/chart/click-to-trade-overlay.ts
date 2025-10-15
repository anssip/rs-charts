import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { getDpr } from "../../util/chart-util";
import { ChartState } from "../..";
import { xin } from "xinjs";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import {
  ClickToTradeConfig,
  PriceHoverEvent,
} from "../../types/trading-overlays";

/**
 * Visual feedback overlay for click-to-trade mode
 * Shows enhanced crosshair, price label, and order preview line
 */
@customElement("click-to-trade-overlay")
export class ClickToTradeOverlay extends CanvasBase {
  @property({ type: Object })
  config: ClickToTradeConfig | null = null;

  @property({ type: Object })
  hoverData: PriceHoverEvent | null = null;

  @property({ type: Boolean })
  shiftPressed = false;

  private _chartId: string = "state";

  override getId(): string {
    return "click-to-trade-overlay";
  }

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);

    // Observe state changes that affect drawing
    observeLocal(this, "state.timeRange", () => this.draw());
    observeLocal(this, "state.priceRange", () => this.draw());
  }

  bindEventListeners(_: HTMLCanvasElement): void {
    // Track shift key state for buy/sell toggle
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Shift" && !this.shiftPressed) {
      this.shiftPressed = true;
      this.draw();
    }
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === "Shift" && this.shiftPressed) {
      this.shiftPressed = false;
      this.draw();
    }
  };

  /**
   * Update hover data and redraw
   */
  updateHover(data: PriceHoverEvent | null) {
    this.hoverData = data;
    this.draw();
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const dpr = getDpr() || 1;

    // Clear canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // If no config or not enabled, don't draw anything
    if (!this.config || !this.config.enabled) return;

    // If no hover data, don't draw anything
    if (!this.hoverData) return;

    const state = xin[this._chartId] as ChartState;
    if (!state || !state.priceRange || !state.timeRange) return;

    const { price, timestamp } = this.hoverData;
    const rect = this.canvas.getBoundingClientRect();

    // Convert price to Y coordinate
    const priceRange = state.priceRange.max - state.priceRange.min;
    const yPosition =
      ((state.priceRange.max - price) / priceRange) * rect.height;

    // Convert timestamp to X coordinate
    const timeSpan = state.timeRange.end - state.timeRange.start;
    const xPosition =
      ((timestamp - state.timeRange.start) / timeSpan) * rect.width;

    // Determine order side based on config and shift key
    const defaultSide = this.config.defaultSide || "buy";
    const allowSideToggle = this.config.allowSideToggle !== false;
    const orderSide =
      allowSideToggle && this.shiftPressed
        ? defaultSide === "buy"
          ? "sell"
          : "buy"
        : defaultSide;

    // Colors
    const buyColor = "#10b981"; // Green
    const sellColor = "#ef4444"; // Red
    const lineColor = orderSide === "buy" ? buyColor : sellColor;

    ctx.save();

    // Draw order preview line (horizontal line at price level)
    if (this.config.showOrderPreview !== false) {
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(0, yPosition * dpr);
      ctx.lineTo(this.canvas.width, yPosition * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw enhanced crosshair
    if (this.config.showCrosshair !== false) {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(xPosition * dpr, 0);
      ctx.lineTo(xPosition * dpr, this.canvas.height);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, yPosition * dpr);
      ctx.lineTo(this.canvas.width, yPosition * dpr);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // Draw price label on the right side
    if (this.config.showPriceLabel !== false) {
      this.drawPriceLabel(ctx, price, yPosition * dpr, lineColor, orderSide);
    }

    ctx.restore();
  }

  /**
   * Draw price label with buy/sell indicator on the right side
   */
  private drawPriceLabel(
    ctx: CanvasRenderingContext2D,
    price: number,
    yPosition: number,
    color: string,
    side: "buy" | "sell",
  ) {
    const dpr = getDpr() || 1;
    const fontSize = 12 * dpr;
    const padding = 6 * dpr;
    const arrowSize = 8 * dpr;

    ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";

    // Format price
    const priceText = `${side.toUpperCase()} @ ${price.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    const textWidth = ctx.measureText(priceText).width;
    const labelWidth = textWidth + padding * 2 + arrowSize + padding;
    const labelHeight = fontSize + padding * 2;

    // Position label on the right edge
    const labelX = this.canvas!.width - labelWidth;
    const labelY = yPosition - labelHeight / 2;

    // Draw background
    ctx.fillStyle = color;
    ctx.fillRect(labelX, labelY, labelWidth, labelHeight);

    // Draw arrow pointing to the price line
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(labelX, yPosition);
    ctx.lineTo(labelX - arrowSize, yPosition - arrowSize / 2);
    ctx.lineTo(labelX - arrowSize, yPosition + arrowSize / 2);
    ctx.closePath();
    ctx.fill();

    // Draw text
    ctx.fillStyle = "#ffffff";
    ctx.fillText(priceText, labelX + padding, yPosition);

    // Draw side indicator arrow
    const arrowX = labelX + textWidth + padding * 2;
    const arrowY = yPosition;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();

    if (side === "buy") {
      // Up arrow for buy
      ctx.moveTo(arrowX + arrowSize / 2, arrowY - arrowSize / 2);
      ctx.lineTo(arrowX + arrowSize, arrowY + arrowSize / 2);
      ctx.lineTo(arrowX, arrowY + arrowSize / 2);
    } else {
      // Down arrow for sell
      ctx.moveTo(arrowX, arrowY - arrowSize / 2);
      ctx.lineTo(arrowX + arrowSize, arrowY - arrowSize / 2);
      ctx.lineTo(arrowX + arrowSize / 2, arrowY + arrowSize / 2);
    }

    ctx.closePath();
    ctx.fill();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
