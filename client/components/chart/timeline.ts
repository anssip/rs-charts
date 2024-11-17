import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { Drawable, DrawingContext } from "./drawing-strategy";
import { CanvasBase } from "./canvas-base";

@customElement("chart-timeline")
export class Timeline extends CanvasBase implements Drawable {
  private isDragging = false;
  private lastX = 0;

  override getId(): string {
    return "chart-timeline";
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(
      "draw-chart",
      this.handleDrawChart as EventListener
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(
      "draw-chart",
      this.handleDrawChart as EventListener
    );
  }

  private handleDrawChart = (event: CustomEvent<DrawingContext>) => {
    this.draw(event.detail);
  };

  draw(context: DrawingContext) {
    if (!this.canvas || !this.ctx) return;

    const {
      viewportStartTimestamp,
      viewportEndTimestamp,
      data,
      axisMappings: { timeToX },
    } = context;

    const dpr = window.devicePixelRatio ?? 1;
    const ctx = this.ctx;

    // Clear the canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Set text style
    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = "#666";
    ctx.textAlign = "center";

    // Calculate label interval based on granularity
    let labelInterval: number;
    let formatFn: (date: Date) => string;

    if (data.getGranularity() === "ONE_MINUTE") {
      // For 1-minute data, show labels every 10 minutes
      labelInterval = 10 * 60 * 1000;
      formatFn = (date: Date) =>
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (data.getGranularity() === "ONE_HOUR") {
      // For 1-hour data, show labels every 6 hours
      labelInterval = 6 * 60 * 60 * 1000;
      formatFn = (date: Date) =>
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (data.getGranularity() >= "ONE_DAY") {
      // For daily data, show date
      labelInterval = 24 * 60 * 60 * 1000;
      formatFn = (date: Date) =>
        date.toLocaleDateString([], { month: "short", day: "numeric" });
    } else {
      // For other intervals, show time
      labelInterval = 12 * 60 * 60 * 1000;
      formatFn = (date: Date) =>
        date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    // Find the first label timestamp before viewport start
    const firstLabelTimestamp =
      Math.floor(viewportStartTimestamp / labelInterval) * labelInterval;

    // Draw labels
    for (
      let timestamp = firstLabelTimestamp;
      timestamp <= viewportEndTimestamp + labelInterval;
      timestamp += labelInterval
    ) {
      const x = timeToX(timestamp) / dpr;

      // Only draw if the label is within the visible area
      if (x >= 0 && x <= this.canvas.width / dpr) {
        // Draw tick mark
        ctx.beginPath();
        ctx.strokeStyle = "#ccc";
        ctx.moveTo(x, 2 * dpr);
        ctx.lineTo(x, 7 * dpr);
        ctx.stroke();

        // Draw label
        const date = new Date(timestamp);
        const label = formatFn(date);
        ctx.fillText(label, x, 20 * dpr);
      }
    }
  }

  render() {
    return html` <canvas
      @mousedown=${this.handleDragStart}
      @mousemove=${this.handleDragMove}
      @mouseup=${this.handleDragEnd}
      @mouseleave=${this.handleDragEnd}
      @wheel=${this.handleWheel}
    ></canvas>`;
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
