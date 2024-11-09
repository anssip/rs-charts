import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { Drawable, DrawingContext } from "./drawing-strategy";

interface TimelineOptions {
  candleWidth: number;
  candleGap: number;
}

@customElement("chart-timeline")
export class Timeline extends LitElement implements Drawable {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  @property({ type: Object })
  options: TimelineOptions = {
    candleWidth: 5,
    candleGap: 1,
  };

  @property({ type: Object })
  padding = { top: 5, right: 50, bottom: 30, left: 50 };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 50px;
      position: relative;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('draw-chart', this.handleDrawChart as EventListener);
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('draw-chart', this.handleDrawChart as EventListener);
    window.removeEventListener("resize", this.handleResize.bind(this));
  }

  private handleDrawChart = (event: CustomEvent<DrawingContext>) => {
    this.draw(event.detail);
  };

  draw(context: DrawingContext) {
    if (!this.canvas || !this.ctx) return;

    const { viewportStartTimestamp, viewportEndTimestamp, data } = context;

    const dpr = window.devicePixelRatio ?? 1;
    const ctx = this.ctx;

    // Clear the canvas
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Set text style
    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = '#666';
    ctx.textAlign = 'center';

    // Calculate label interval based on granularity
    let labelInterval: number;
    let formatFn: (date: Date) => string;

    if (data.getGranularity() === "ONE_MINUTE") {
      // For 1-minute data, show labels every 10 minutes
      labelInterval = 10 * 60 * 1000;
      formatFn = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (data.getGranularity() === "ONE_HOUR") {
      // For 1-hour data, show labels every 6 hours
      labelInterval = 6 * 60 * 60 * 1000;
      formatFn = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (data.getGranularity() >= "ONE_DAY") {
      // For daily data, show date
      labelInterval = 24 * 60 * 60 * 1000;
      formatFn = (date: Date) => date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
      // For other intervals, show time
      labelInterval = 12 * 60 * 60 * 1000;
      formatFn = (date: Date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Find the first label timestamp before viewport start
    const firstLabelTimestamp = Math.floor(viewportStartTimestamp / labelInterval) * labelInterval;

    // Draw labels
    for (
      let timestamp = firstLabelTimestamp;
      timestamp <= viewportEndTimestamp + labelInterval;
      timestamp += labelInterval
    ) {
      const x = this.calculateXForTime(timestamp, context) / dpr;

      // Only draw if the label is within the visible area
      if (x >= 0 && x <= this.canvas.width / dpr) {
        // Draw tick mark
        ctx.beginPath();
        ctx.strokeStyle = '#ccc';
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 5 * dpr);
        ctx.stroke();

        // Draw label
        const date = new Date(timestamp);
        const label = formatFn(date);
        ctx.fillText(label, x, 20 * dpr);
      }
    }
  }

  // this could be in the drawing context, so that it could be used also in the grid and chart strategies
  private calculateXForTime(timestamp: number, context: DrawingContext): number {
    const { viewportStartTimestamp, viewportEndTimestamp } = context;
    const { chartCanvas: canvas } = context;
    const availableWidth = canvas.width;
    const timeRange = Math.max(
      viewportEndTimestamp - viewportStartTimestamp,
      1
    );
    const timePosition = (timestamp - viewportStartTimestamp) / timeRange;
    const x = timePosition * availableWidth;
    return x;
  }

  render() {
    return html`<canvas></canvas>`;
  }

  firstUpdated() {
    requestAnimationFrame(() => {
      this.canvas = this.renderRoot.querySelector("canvas");
      this.ctx = this.canvas?.getContext("2d") || null;
      this.setupCanvas();
      window.addEventListener("resize", this.handleResize.bind(this));
    });
  }

  private setupCanvas() {
    if (!this.canvas) return;

    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      console.warn("Timeline: Invalid dimensions", rect);
      requestAnimationFrame(() => this.setupCanvas());
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    if (this.ctx) {
      this.ctx.scale(dpr, dpr);
    }
  }

  private handleResize() {
    this.setupCanvas();
    // TODO: handle zooming in the timeline
  }
}
