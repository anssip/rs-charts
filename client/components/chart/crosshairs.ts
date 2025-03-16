import { observe, xin } from "xinjs";
import { CanvasBase } from "./canvas-base";
import { granularityToMs } from "../../../server/services/price-data/price-history-model";
import { customElement } from "lit/decorators.js";
import { drawTimeLabel, getLocalAlignedTimestamp } from "../../util/chart-util";
import { ChartState } from "../..";
import { TIMELINE_HEIGHT } from "./chart-container";

@customElement("chart-crosshairs")
export class Crosshairs extends CanvasBase {
  private mouseX: number = -1;
  private mouseY: number = -1;
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

  private handleMouseMove = (event: MouseEvent) => {
    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();

    const state = xin["state"] as ChartState;
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
    const rect = this.canvas.getBoundingClientRect();
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.mouseY * dpr < this.canvas.height - TIMELINE_HEIGHT * dpr) {
      ctx.beginPath();
      ctx.setLineDash([2, 2]);
      ctx.strokeStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-primary")
        .trim();
      ctx.lineWidth = 1;

      ctx.moveTo(0, this.mouseY);
      ctx.lineTo(this.canvas.width, this.mouseY);
      ctx.stroke();
    }

    if (this.snappedX >= 0 && this.snappedX <= rect.width) {
      ctx.beginPath();
      ctx.moveTo(this.snappedX, 0);
      ctx.lineTo(this.snappedX, this.canvas.height);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    drawTimeLabel(
      ctx,
      this.cursorTime,
      this.snappedX,
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
