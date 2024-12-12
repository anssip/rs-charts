import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { formatDate, formatTime, iterateTimeline } from "../../util/chart-util";
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
      ctx.fillStyle = "#666";
      ctx.textAlign = "center";
      ctx.textBaseline = "top"; // Consistent text baseline

      iterateTimeline({
        callback: (x: number, timestamp: number) => {
          const date = new Date(timestamp);
          const { shouldDrawLabel, shouldDrawDateLabel } = resolveShouldDraw(
            date,
            state.granularity
          );

          if (shouldDrawLabel) {
            // Draw tick mark
            ctx.beginPath();
            ctx.strokeStyle = "#ccc";
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 5 * dpr);
            ctx.stroke();

            // Draw time label
            const timeLabel = formatTime(date);
            ctx.fillText(timeLabel, x, 1 * dpr);
          }
          if (shouldDrawDateLabel) {
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

type ShouldDrawResult = {
  shouldDrawLabel: boolean;
  shouldDrawDateLabel: boolean;
};

function resolveShouldDraw(date: Date, granularity: string): ShouldDrawResult {
  let shouldDrawLabel = false;
  let shouldDrawDateLabel = false;

  // For all granularities, check if we should draw a date label at midnight
  if (
    granularity !== "ONE_DAY" &&
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0
  ) {
    shouldDrawDateLabel = true;
  }

  switch (granularity) {
    case "ONE_MINUTE":
      shouldDrawLabel = date.getUTCMinutes() % 15 === 0; // Every 15 minutes
      break;
    case "FIVE_MINUTE":
      shouldDrawLabel = date.getUTCMinutes() % 30 === 0; // Every 30 minutes
      break;
    case "FIFTEEN_MINUTE":
      shouldDrawLabel = date.getUTCMinutes() === 0; // Every hour
      break;
    case "THIRTY_MINUTE":
      shouldDrawLabel =
        date.getUTCHours() % 4 === 0 && date.getUTCMinutes() === 0; // Every 4th hour
      break;
    case "ONE_HOUR":
      shouldDrawLabel = date.getUTCHours() % 12 === 0; // Every 12 hours
      break;
    case "TWO_HOUR":
      shouldDrawLabel = date.getUTCHours() % 12 === 0; // Every 12 hours
      break;
    case "SIX_HOUR":
      shouldDrawLabel = date.getUTCHours() % 24 === 0; // Every 24 hours
      break;
    case "ONE_DAY":
      // don't draw time labels at all
      shouldDrawLabel = false;
      shouldDrawDateLabel = date.getUTCDate() % 4 === 0;
      break;
    default:
      shouldDrawLabel = date.getUTCHours() % 12 === 0; // Default to 12 hours
  }

  return { shouldDrawLabel, shouldDrawDateLabel };
}
