import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { Drawable, DrawingContext } from "./drawing-strategy";
import { CanvasBase } from "./canvas-base";
import { PriceHistory } from "../../../server/services/price-data/price-history-model";
import { formatTime, getGridInterval, timeToX } from "../../util/chart-util";

const TIMELINE_START_POS = 50; // pixels from the left

@customElement("chart-timeline")
export class Timeline extends CanvasBase implements Drawable {
  private isDragging = false;
  private lastX = 0;

  override getId(): string {
    return "chart-timeline";
  }


  override useResizeObserver(): boolean {
    return true;
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

    const labelInterval = getGridInterval(data);

    // Find the first label timestamp before viewport start
    const firstLabelTimestamp =
      Math.floor(viewportStartTimestamp / labelInterval) * labelInterval;

    // Draw labels
    for (
      let timestamp = firstLabelTimestamp;
      timestamp <= viewportEndTimestamp + labelInterval;
      timestamp += labelInterval
    ) {

      const x = timeToX(timestamp) / 2 + TIMELINE_START_POS;

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


