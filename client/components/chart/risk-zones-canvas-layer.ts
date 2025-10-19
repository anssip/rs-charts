import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { RiskZone } from "../../types/trading-overlays";
import { ChartState } from "../..";
import { RiskZonesRenderer } from "./risk-zones-renderer";
import { getDpr } from "../../util/chart-util";
import { getLogger } from "../../util/logger";

const logger = getLogger("RiskZonesCanvasLayer");

/**
 * Canvas-based layer for rendering risk zones
 * Sits on top of the chart canvas and handles independent drawing
 */
@customElement("risk-zones-canvas-layer")
export class RiskZonesCanvasLayer extends LitElement {
  @property({ type: Array })
  zones: RiskZone[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Object })
  timeRange: any;

  @property({ type: Object })
  priceRange: any;

  @property({ type: Number })
  width: number = 0;

  @property({ type: Number })
  height: number = 0;

  @state()
  private canvas: HTMLCanvasElement | null = null;

  @state()
  private ctx: CanvasRenderingContext2D | null = null;

  private renderer: RiskZonesRenderer;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    super();
    this.renderer = new RiskZonesRenderer();
  }

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 1;
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
      changedProperties.has("zones") ||
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
    if (!this.zones || this.zones.length === 0) {
      // Clear canvas if no zones
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

    // Get visible zones
    const visibleZones = this.renderer.getVisibleZones(this.zones, transform);

    // Draw each visible zone
    for (const zone of visibleZones) {
      this.renderer.drawRiskZone(this.ctx, zone, transform);
    }

    logger.debug(`Drew ${visibleZones.length} risk zones on canvas layer`);
  }

  render() {
    return html`<canvas></canvas>`;
  }
}
