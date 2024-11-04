import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

interface TimelineOptions {
  candleWidth: number;
  candleGap: number;
}

@customElement("chart-timeline")
export class Timeline extends LitElement {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  @property({ type: Array })
  timestamps: number[] = [];

  @property({ type: Object })
  options: TimelineOptions = {
    candleWidth: 5,
    candleGap: 1,
  };

  @property({ type: Object })
  padding = { top: 5, right: 50, bottom: 30, left: 50 };

  private _viewportStartTimestamp: number = 0;
  private _viewportEndTimestamp: number = 0;

  @property({ type: Number })
  get viewportStartTimestamp(): number {
    return this._viewportStartTimestamp;
  }

  set viewportStartTimestamp(value: number) {
    const oldValue = this._viewportStartTimestamp;
    if (value !== oldValue) {
      console.log("Timeline: Setting viewport start", {
        old: new Date(oldValue),
        new: new Date(value),
      });
      this._viewportStartTimestamp = value;
      this.requestUpdate("viewportStartTimestamp", oldValue);
    }
  }

  @property({ type: Number })
  get viewportEndTimestamp(): number {
    return this._viewportEndTimestamp;
  }

  set viewportEndTimestamp(value: number) {
    const oldValue = this._viewportEndTimestamp;
    if (value !== oldValue) {
      console.log("Timeline: Setting viewport end", {
        old: new Date(oldValue),
        new: new Date(value),
      });
      this._viewportEndTimestamp = value;
      this.requestUpdate("viewportEndTimestamp", oldValue);
    }
  }

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

  render() {
    return html`<canvas></canvas>`;
  }

  firstUpdated() {
    requestAnimationFrame(() => {
      this.canvas = this.renderRoot.querySelector("canvas");
      this.ctx = this.canvas?.getContext("2d") || null;
      this.setupCanvas();
      window.addEventListener("resize", this.handleResize.bind(this));
      this.draw();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("resize", this.handleResize.bind(this));
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
      this.draw();
    }
  }

  private handleResize() {
    this.setupCanvas();
  }

  public draw() {
    if (!this.ctx || !this.canvas || this.timestamps.length === 0) {
      console.warn("Timeline: Cannot draw, missing context or data", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        timestampsLength: this.timestamps.length,
      });
      return;
    }

    const { ctx, canvas } = this;
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = canvas.width / dpr;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // If no viewport is set, show all timestamps
    const startIdx =
      this.viewportStartTimestamp > 0
        ? this.timestamps.findIndex((ts) => ts >= this.viewportStartTimestamp)
        : 0;
    const endIdx =
      this.viewportEndTimestamp > 0
        ? this.timestamps.findIndex((ts) => ts > this.viewportEndTimestamp)
        : this.timestamps.length;

    console.log("Timeline: Drawing", {
      startIdx,
      endIdx,
      viewportStart: new Date(this.viewportStartTimestamp),
      viewportEnd: new Date(this.viewportEndTimestamp),
      totalTimestamps: this.timestamps.length,
    });

    const visibleCount =
      (endIdx === -1 ? this.timestamps.length : endIdx) - startIdx;

    // Ensure we have at least one visible timestamp
    if (visibleCount <= 0) {
      console.warn("Timeline: No visible timestamps");
      return;
    }

    const labelInterval = Math.max(1, Math.ceil(visibleCount / 8));
    const availableWidth =
      displayWidth - (this.padding.left + this.padding.right);
    const spacing = availableWidth / Math.ceil(visibleCount / labelInterval);

    let lastDate: string | null = null;
    const y = 0;
    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = "12px Arial";

    // Only iterate over visible timestamps
    for (
      let i = startIdx;
      i < (endIdx === -1 ? this.timestamps.length : endIdx);
      i++
    ) {
      if ((i - startIdx) % labelInterval === 0) {
        const x =
          this.padding.left + ((i - startIdx) / labelInterval) * spacing;
        const date = new Date(this.timestamps[i]);

        const timeLabel = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dateStr = date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });

        if (dateStr !== lastDate) {
          ctx.fillText(dateStr, x, y + 25);
          lastDate = dateStr;
        }
        ctx.fillText(timeLabel, x, y + 10);
      }
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    if (
      changedProperties.has("timestamps") ||
      changedProperties.has("options") ||
      changedProperties.has("viewportStartTimestamp") ||
      changedProperties.has("viewportEndTimestamp")
    ) {
      console.log("Timeline: Properties updated", {
        timestamps: this.timestamps.length,
        viewportStart: new Date(this.viewportStartTimestamp),
        viewportEnd: new Date(this.viewportEndTimestamp),
      });
      this.draw();
    }
  }
}
