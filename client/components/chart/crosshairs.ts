import {  observe, xin } from "xinjs";
import {  CanvasBase } from "./canvas-base";
import {  granularityToMs } from "../../../server/services/price-data/price-history-model";
import {  customElement } from "lit/decorators.js";
import { drawTimeLabel, getLocalAlignedTimestamp, getDpr } from "../../util/chart-util";
import {  ChartState } from "../..";
import {  TIMELINE_HEIGHT } from "./chart-container";
import {  getLocalChartId, observeLocal } from "../../util/state-context";
import { ClickToTradeConfig } from "../../types/trading-overlays";

@customElement("chart-crosshairs")
export class Crosshairs extends CanvasBase {
  private mouseX: number = -1;
  private mouseY: number = -1;
  private cursorTime: number = 0;
  private snappedX: number = -1;
  private _chartId: string = "state";
  private shiftPressed: boolean = false;

  override getId(): string {
    return "chart-crosshairs";
  }

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);

    observeLocal(this, "state.timeRange", () => this.draw());
    observeLocal(this, "state.priceRange", () => this.draw());
    observeLocal(this, "state.clickToTrade", () => this.draw());
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();

    const state = xin[this._chartId] as ChartState;
    if (!state || !state.timeRange) return;
    
    const timeRange = state.timeRange;

    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    const timeSpan = timeRange.end - timeRange.start;
    const mouseTime = timeRange.start + (this.mouseX / rect.width) * timeSpan;

    const interval = granularityToMs(state.granularity);
    const firstTimestamp = Math.floor(timeRange.start / interval) * interval;

    const intervalsSinceMidnight = Math.round(
      (mouseTime - firstTimestamp) / interval
    );
    const snappedTime = firstTimestamp + intervalsSinceMidnight * interval;

    this.cursorTime =
      state.granularity === "SIX_HOUR"
        ? getLocalAlignedTimestamp(snappedTime, 6)
        : snappedTime;

    const timePosition = (this.cursorTime - timeRange.start) / timeSpan;
    this.snappedX = timePosition * rect.width;

    this.draw();
  };

  bindEventListeners(_: HTMLCanvasElement): void {
    document.addEventListener("mousemove", this.handleMouseMove);
    this.canvas?.addEventListener("mouseleave", this.handleMouseLeave);
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
  }

  private handleMouseLeave = () => {
    this.mouseX = -1;
    this.mouseY = -1;
    this.draw();
  };

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

  draw() {
    if (!this.canvas || !this.ctx || this.mouseX < 0 || this.mouseY < 0) {
      this.ctx?.clearRect(
        0,
        0,
        this.canvas?.width || 0,
        this.canvas?.height || 0
      );
      return;
    }

    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;
    const dpr = getDpr() || 1;
    const state = xin[this._chartId] as ChartState;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Check if click-to-trade mode is enabled
    const clickToTrade = state?.clickToTrade;
    const isClickToTradeEnabled = clickToTrade?.enabled === true;

    if (isClickToTradeEnabled) {
      // Click-to-trade mode styling
      this.drawClickToTradeCrosshairs(ctx, rect, state, dpr);
    } else {
      // Regular crosshairs styling
      this.drawRegularCrosshairs(ctx, rect, dpr);
    }
  }

  private drawRegularCrosshairs(ctx: CanvasRenderingContext2D, rect: DOMRect, dpr: number) {
    // Draw horizontal line (only above timeline)
    if (this.mouseY * dpr < this.canvas!.height - TIMELINE_HEIGHT * dpr) {
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
      ctx.lineWidth = 1;

      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(this.canvas!.width / dpr, this.mouseY);
      ctx.stroke();
    }

    // Draw vertical line
    if (this.snappedX >= 0 && this.snappedX <= rect.width) {
      ctx.beginPath();
      ctx.moveTo(this.snappedX, 0);
      ctx.lineTo(this.snappedX, this.canvas!.height / dpr);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw time label at bottom
    drawTimeLabel(
      ctx,
      this.cursorTime,
      this.snappedX,
      this.canvas!.height / dpr - 5,
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background-secondary")
        .trim(),
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary-dark")
        .trim(),
      true // Show full date and time
    );
  }

  private drawClickToTradeCrosshairs(ctx: CanvasRenderingContext2D, rect: DOMRect, state: ChartState, dpr: number) {
    if (!state?.priceRange) return;

    // Calculate price at mouse position
    const priceRange = state.priceRange.max - state.priceRange.min;
    const price = state.priceRange.max - (this.mouseY / rect.height) * priceRange;

    // Determine order side
    const clickToTrade = state.clickToTrade!;
    const defaultSide = clickToTrade.defaultSide || "buy";
    const allowSideToggle = clickToTrade.allowSideToggle !== false;
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

    // Draw order preview line (horizontal dashed line)
    if (clickToTrade.showOrderPreview !== false && this.mouseY < rect.height - TIMELINE_HEIGHT) {
      ctx.beginPath();
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(this.canvas!.width / dpr, this.mouseY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw enhanced crosshair
    if (clickToTrade.showCrosshair !== false && this.mouseY < rect.height - TIMELINE_HEIGHT) {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.5;

      // Vertical line
      ctx.beginPath();
      ctx.moveTo(this.snappedX, 0);
      ctx.lineTo(this.snappedX, this.canvas!.height / dpr);
      ctx.stroke();

      // Horizontal line
      ctx.beginPath();
      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(this.canvas!.width / dpr, this.mouseY);
      ctx.stroke();

      ctx.globalAlpha = 1;
    }

    // Draw price label on the right side
    if (clickToTrade.showPriceLabel !== false && this.mouseY < rect.height - TIMELINE_HEIGHT) {
      this.drawClickToTradePriceLabel(ctx, price, this.mouseY, lineColor, orderSide);
    }

    // Draw time label at bottom
    drawTimeLabel(
      ctx,
      this.cursorTime,
      this.snappedX,
      this.canvas!.height / dpr - 5,
      lineColor,
      "#ffffff",
      true // Show full date and time
    );

    ctx.restore();
  }

  private drawClickToTradePriceLabel(
    ctx: CanvasRenderingContext2D,
    price: number,
    yPosition: number,
    color: string,
    side: "buy" | "sell"
  ) {
    const fontSize = 12;
    const padding = 6;
    const arrowSize = 8;

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
    const labelX = this.canvas!.width / getDpr() - labelWidth;
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
    document.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas?.removeEventListener("mouseleave", this.handleMouseLeave);
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
  }
}
