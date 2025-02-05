import { observe, xin } from "xinjs";
import { CanvasBase } from "./canvas-base";
import { granularityToMs } from "../../../server/services/price-data/price-history-model";
import { customElement } from "lit/decorators.js";
import {
  canvasYToPrice,
  drawTimeLabel,
  getLocalAlignedTimestamp,
  yToPrice,
} from "../../util/chart-util";
import { CandlestickChart } from "./chart";
import { ChartState } from "../..";
import { PRICEAXIS_WIDTH, TIMELINE_HEIGHT } from "./chart-container";
import { formatPrice } from "../../util/price-util";

@customElement("chart-crosshairs")
export class Crosshairs extends CanvasBase {
  private mouseX: number = -1;
  private mouseY: number = -1;
  private cursorPrice: number = 0;
  private cursorTime: number = 0;
  private snappedX: number = -1;

  override getId(): string {
    return "chart-crosshairs";
  }

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    observe("state.timeRange", () => this.draw());
    observe("state.priceRange", () => this.draw());
  }

  private getChartRect(): DOMRect {
    const chartArea = this.parentElement;
    const chart = chartArea?.querySelector(
      "candlestick-chart"
    ) as HTMLCanvasElement;
    return chart?.getBoundingClientRect() as DOMRect;
  }

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.canvas) return;

    const rect = this.getChartRect();
    if (!rect) {
      return;
    }

    const state = xin["state"] as ChartState;
    const timeRange = state.timeRange;
    const priceRange = state.priceRange;

    // Scale mouse coordinates for DPI
    this.mouseX = event.clientX - rect.left;
    this.mouseY = event.clientY - rect.top;

    // Calculate time at mouse position
    const timeSpan = timeRange.end - timeRange.start;
    const mouseTime = timeRange.start + (this.mouseX / rect.width) * timeSpan;

    // Get the interval and snap to it
    const interval = granularityToMs(state.granularity);
    const firstTimestamp = Math.floor(timeRange.start / interval) * interval;

    // Find the nearest interval timestamp
    const intervalsSinceMidnight = Math.round(
      (mouseTime - firstTimestamp) / interval
    );
    const snappedTime = firstTimestamp + intervalsSinceMidnight * interval;

    // For SIX_HOUR, align to local time boundaries
    this.cursorTime =
      state.granularity === "SIX_HOUR"
        ? getLocalAlignedTimestamp(snappedTime, 6)
        : snappedTime;

    // Calculate X position from snapped time
    const timePosition = (this.cursorTime - timeRange.start) / timeSpan;
    this.snappedX = timePosition * rect.width;

    this.cursorPrice = yToPrice(this.mouseY, rect.height, priceRange);

    this.draw();
  };

  bindEventListeners(_: HTMLCanvasElement): void {
    document.addEventListener("mousemove", this.handleMouseMove);
    this.canvas?.addEventListener("mouseleave", this.handleMouseLeave);
  }

  private handleMouseLeave = () => {
    this.mouseX = -1;
    this.mouseY = -1;
    this.draw();
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
    const rect = this.getChartRect();
    if (!rect) {
      return;
    }

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw horizontal line at mouse Y
    if (
      (rect.top + this.mouseY) * dpr <
      this.canvas.height - TIMELINE_HEIGHT * dpr
    ) {
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
      ctx.lineWidth = 1;
      ctx.moveTo(0, this.mouseY + rect.top);
      ctx.lineTo(this.canvas.width, this.mouseY + rect.top);
      ctx.stroke();
    }

    // Draw vertical line at snapped X
    if (this.snappedX >= 0 && this.snappedX <= rect.width) {
      ctx.beginPath();
      ctx.moveTo(this.snappedX + rect.left, 0);
      ctx.lineTo(this.snappedX + rect.left, this.canvas.height);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw price label
    const textColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-accent-2")
      .trim();
    const backgroundColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary-dark")
      .trim();
    const borderColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-primary")
      .trim();

    // Set font
    const fontFamily = getComputedStyle(document.documentElement)
      .getPropertyValue("--font-primary")
      .trim();
    ctx.font = `${10}px ${fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Draw price label
    const labelWidth = PRICEAXIS_WIDTH;
    const labelHeight = 20;
    const labelX = this.canvas.width / dpr - labelWidth;
    const labelY = this.mouseY;

    // Draw background
    const cornerRadius = 4;
    ctx.beginPath();
    ctx.roundRect(
      labelX,
      labelY - labelHeight / 2,
      labelWidth,
      labelHeight,
      cornerRadius
    );
    ctx.fillStyle = backgroundColor;
    ctx.fill();

    // Draw border
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw text
    ctx.fillStyle = textColor;
    ctx.fillText(
      formatPrice(this.cursorPrice),
      labelX + labelWidth / 2,
      labelY
    );

    // Draw time label
    drawTimeLabel(
      ctx,
      this.cursorTime,
      this.snappedX + rect.left,
      this.canvas.height / dpr - 5 * dpr,
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background-secondary")
        .trim(),
      getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary-dark")
        .trim()
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas?.removeEventListener("mouseleave", this.handleMouseLeave);
  }
}
