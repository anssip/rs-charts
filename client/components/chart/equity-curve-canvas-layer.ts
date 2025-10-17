import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { EquityPoint, EquityCurveConfig, TRADING_OVERLAY_COLORS } from "../../types/trading-overlays";
import { ChartState } from "../..";
import { TimeRange, PriceRange } from "../../../server/services/price-data/price-history-model";
import { EquityCurveRenderer } from "./equity-curve-renderer";
import { getDpr } from "../../util/chart-util";
import { getLogger } from "../../util/logger";

const logger = getLogger("EquityCurveCanvasLayer");

/**
 * Canvas-based layer for rendering equity curve overlay
 * Sits on top of the chart canvas and handles independent drawing with separate Y-axis scaling
 */
@customElement("equity-curve-canvas-layer")
export class EquityCurveCanvasLayer extends LitElement {
  @property({ type: Array })
  data: EquityPoint[] = [];

  @property({ type: Object })
  config: EquityCurveConfig | null = null;

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Object })
  timeRange!: TimeRange;

  @property({ type: Object })
  priceRange!: PriceRange;

  @property({ type: Number })
  width: number = 0;

  @property({ type: Number })
  height: number = 0;

  @state()
  private canvas: HTMLCanvasElement | null = null;

  @state()
  private ctx: CanvasRenderingContext2D | null = null;

  private renderer: EquityCurveRenderer;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.renderer = new EquityCurveRenderer();
  }

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 15; /* Above zones (1,5) but below markers (25+) */
    }

    canvas {
      display: block;
      pointer-events: none;
    }
  `;

  firstUpdated() {
    this.canvas = this.shadowRoot?.querySelector("canvas") || null;
    if (this.canvas) {
      this.ctx = this.canvas.getContext("2d");
      this.updateCanvasSize();
      this.draw();
    }

    // Set up resize observer to handle canvas resizing
    if (this.canvas) {
      this.resizeObserver = new ResizeObserver(() => {
        this.updateCanvasSize();
        this.draw();
      });
      this.resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    this.renderer.clearCache();
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);

    if (
      changedProperties.has("data") ||
      changedProperties.has("config") ||
      changedProperties.has("state") ||
      changedProperties.has("timeRange") ||
      changedProperties.has("priceRange") ||
      changedProperties.has("width") ||
      changedProperties.has("height")
    ) {
      this.updateCanvasSize();
      this.draw();
    }
  }

  private updateCanvasSize() {
    if (!this.canvas || !this.state) return;

    const dpr = getDpr();
    const width = this.width || this.clientWidth;
    const height = this.height || this.clientHeight;

    // Set canvas physical size (accounting for DPR)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Set canvas display size
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  private draw() {
    if (!this.canvas || !this.ctx) return;
    if (!this.timeRange || !this.priceRange) return;
    if (!this.data || this.data.length === 0 || !this.config) {
      // Clear canvas if no data or config
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Create viewport transform
    const dpr = getDpr();
    const transform = {
      timeRange: this.timeRange,
      priceRange: this.priceRange,
      canvasWidth: this.canvas.width / dpr,
      canvasHeight: this.canvas.height / dpr,
      dpr: dpr,
    };

    // Draw equity curve
    this.renderer.drawEquityCurve(this.ctx, this.data, this.config, transform);

    logger.debug(`Drew equity curve with ${this.data.length} points`);
  }

  render() {
    return html`<canvas></canvas>`;
  }
}
