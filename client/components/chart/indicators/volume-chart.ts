import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline } from "../../../util/chart-util";
import { PropertyValues } from "lit";
import { css } from "lit";
import { logger } from "../../../util/logger";

@customElement("volume-chart")
export class VolumeChart extends CanvasBase {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;

  @property({ type: Object })
  params?: Record<string, any>;

  @property({ type: Boolean })
  visible = true;

  private readonly FIXED_GAP_WIDTH = 2; // pixels
  private readonly MIN_BAR_WIDTH = 1; // pixels
  private readonly MAX_BAR_WIDTH = 500; // pixels
  private _state: ChartState | null = null;

  override getId(): string {
    return "volume-chart";
  }

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    // Get initial state
    this._state = xin["state"] as ChartState;

    // Wait for canvas and state to be ready
    if (this.canvas && this._state) {
      requestAnimationFrame(() => {
        this.draw();
      });
    }

    // Only observe state changes when the component is actually in the DOM
    if (this.isConnected) {
      observe("state", () => {
        this._state = xin["state"] as ChartState;
        this.draw();
      });
      observe("state.liveCandle", () => {
        this._state = xin["state"] as ChartState;
        this.draw();
      });
    }

    // Listen for force-redraw events
    this.addEventListener("force-redraw", () => {
      logger.debug("VolumeChart: Received force-redraw event");
      this.draw();
    });
  }

  // Add connectedCallback to ensure we draw when added to DOM
  connectedCallback() {
    super.connectedCallback();
    if (this._state) {
      requestAnimationFrame(() => {
        this.draw();
      });
    }
  }

  draw() {
    // Skip drawing if component is not connected to DOM
    if (!this.isConnected) return;
    if (!this.canvas || !this.ctx || !this._state) return;

    // Check if we're in a hidden container
    const container = this.closest(".volume-chart");
    if (container && container.hasAttribute("hidden")) {
      logger.debug("VolumeChart: Container is hidden, skipping draw");
      return;
    }

    logger.debug("VolumeChart: Drawing volume chart");
    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Get all candles in the visible range
    const candles = this._state.priceHistory.getCandlesInRange(
      this._state.timeRange.start,
      this._state.timeRange.end
    );
    if (!candles || candles.length === 0) {
      logger.warn("VolumeChart: No candles available in visible range");
      return;
    }

    // Calculate max volume including a minimum to prevent division by zero
    const maxVolume = Math.max(
      1, // Minimum value to prevent division by zero
      ...candles.map(([_, candle]) => candle?.volume || 0)
    );

    const volumeScale = this.canvas.height / dpr / maxVolume;

    const timeSpan = this._state.timeRange.end - this._state.timeRange.start;
    const candleCount = Math.ceil(
      timeSpan / this._state.priceHistory.granularityMs
    );
    const availableWidth = this.canvas.width / dpr;

    const totalGapWidth = ((candleCount - 1) * this.FIXED_GAP_WIDTH) / dpr;
    const spaceForBars = availableWidth - totalGapWidth;
    const barWidth = Math.max(
      this.MIN_BAR_WIDTH,
      Math.min(this.MAX_BAR_WIDTH, spaceForBars / candleCount)
    );

    logger.debug(
      `VolumeChart: Drawing ${candleCount} volume bars with width ${barWidth}px`
    );

    // Display "Volume" label at top left of the volume chart area
    ctx.font = "bold 11px var(--font-secondary, sans-serif)";
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)"; // Increased opacity for better visibility
    ctx.fillText("Volume", 8, 15);

    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        const candle = this._state!.priceHistory.getCandle(timestamp);
        if (!candle || typeof candle.volume === "undefined") {
          return;
        }

        const volumeHeight = (candle.volume || 0) * volumeScale;
        // if (volumeHeight <= 0) return; // Skip if no volume

        const y = this.canvas!.height / dpr - volumeHeight;

        // Color the volume bars based on price movement with CSS variables
        ctx.fillStyle =
          candle.close >= candle.open
            ? `${getComputedStyle(document.documentElement)
                .getPropertyValue("--color-accent-1")
                .trim()}A0` // 60% opacity
            : `${getComputedStyle(document.documentElement)
                .getPropertyValue("--color-error")
                .trim()}A0`; // 60% opacity

        ctx.fillRect(x - barWidth / 2, y, barWidth, volumeHeight);
      },
      granularity: this._state.priceHistory.getGranularity(),
      viewportStartTimestamp: this._state.timeRange.start,
      viewportEndTimestamp: this._state.timeRange.end,
      canvasWidth: this.canvas.width / dpr,
      interval: this._state.priceHistory.granularityMs,
      alignToLocalTime: false,
    });
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("visible") || changedProperties.has("params")) {
      logger.debug(`VolumeChart: Property changed, visible=${this.visible}`);
      this.draw();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up state observations when removed from DOM
    // TODO: Add proper cleanup for xinjs observers
  }
}
