import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { formatTime, getGridInterval, timeToX } from "../../util/chart-util";
import { observe, xin } from "xinjs";
import { TimeRange } from "../../candle-repository";
import { PriceHistory } from "../../../server/services/price-data/price-history-model";

const TIMELINE_START_POS = 0; // pixels from the left

@customElement("chart-timeline")
export class Timeline extends CanvasBase {
  private isDragging = false;
  private lastX = 0;
  private timeRange: TimeRange = { start: 0, end: 0 };

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
    const viewportStartTimestamp = this.timeRange.start;
    const viewportEndTimestamp = this.timeRange.end;
    const canvasWidth = xin["state.canvasWidth"] as number;

    const data = xin["state.priceHistory"] as PriceHistory;
    console.log("Timeline: draw", { viewportStartTimestamp, viewportEndTimestamp, data });

    const dpr = window.devicePixelRatio ?? 1;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";

    const labelInterval = getGridInterval(data);

    const firstLabelTimestamp =
      Math.floor(viewportStartTimestamp / labelInterval) * labelInterval;

    for (
      let timestamp = firstLabelTimestamp;
      timestamp <= viewportEndTimestamp + labelInterval;
      timestamp += labelInterval
    ) {

      const x = timeToX(canvasWidth, { start: viewportStartTimestamp, end: viewportEndTimestamp })(timestamp) + TIMELINE_START_POS;

      // Only draw if the label is within the visible area
      if (x >= 0 && x <= this.canvas.width / dpr) {
        // Draw tick mark
        ctx.beginPath();
        ctx.strokeStyle = "#ccc";
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 5 * dpr);
        ctx.stroke();

        // Draw label near top
        const date = new Date(timestamp);
        const label = formatTime(date);
        ctx.fillText(label, x, 12 * dpr);
      }
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


