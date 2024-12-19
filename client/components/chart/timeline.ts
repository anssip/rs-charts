import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import {
  formatDate,
  formatTime,
  iterateTimeline,
  getTimelineMarks,
} from "../../util/chart-util";
import { observe, xin } from "xinjs";
import { TimeRange } from "../../candle-repository";
import { ChartState } from "../..";

const dpr = window.devicePixelRatio ?? 1;

@customElement("chart-timeline")
export class Timeline extends CanvasBase {
  private isDragging = false;
  private lastX = 0;
  private timeRange: TimeRange = { start: 0, end: 0 };
  private animationFrameId: number | null = null;

  override getId(): string {
    return "chart-timeline";
  }

  override useResizeObserver(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();

    observe("state.timeRange", (path) => {
      this.timeRange = xin[path] as TimeRange;
      this.draw();
    });
  }

  draw() {
    if (!this.canvas || !this.ctx) {
      console.warn("Timeline: canvas or ctx not found");
      return;
    }

    // Cancel any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Schedule the actual drawing
    this.animationFrameId = requestAnimationFrame(() => {
      const viewportStartTimestamp = this.timeRange.start;
      const viewportEndTimestamp = this.timeRange.end;
      const canvasWidth = this.canvas!.width / dpr;

      const state = xin["state"] as ChartState;

      const ctx = this.ctx!;
      ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

      // Set text properties once
      ctx.font = `${6 * dpr}px Arial`;
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background-secondary")
        .trim();
      ctx.textAlign = "center";
      ctx.textBaseline = "top"; // Consistent text baseline

      iterateTimeline({
        callback: (x: number, timestamp: number) => {
          const date = new Date(timestamp);
          const { tickMark, dateChange } = getTimelineMarks(
            date,
            state.granularity
          );

          if (tickMark) {
            // Draw tick mark
            ctx.beginPath();
            ctx.strokeStyle = getComputedStyle(document.documentElement)
              .getPropertyValue("--color-background-secondary")
              .trim();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 5 * dpr);
            ctx.stroke();

            // Draw time label
            const timeLabel = formatTime(date);
            ctx.fillText(timeLabel, x, 1 * dpr);
          }
          if (dateChange) {
            const dateLabel = formatDate(date);
            ctx.fillText(dateLabel, x, 10 * dpr);
          }
        },
        granularity: state.granularity,
        viewportStartTimestamp,
        viewportEndTimestamp,
        canvasWidth,
      });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  bindEventListeners(canvas: HTMLCanvasElement) {
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastX;
    this.dispatchZoom(deltaX, e.clientX, false);
    this.lastX = e.clientX;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault(); // Prevent page scrolling
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    this.dispatchZoom(delta, e.clientX, isTrackpad);
  };

  private dispatchZoom(deltaX: number, clientX: number, isTrackpad: boolean) {
    this.dispatchEvent(
      new CustomEvent("timeline-zoom", {
        detail: {
          deltaX,
          clientX,
          rect: this.getBoundingClientRect(),
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
