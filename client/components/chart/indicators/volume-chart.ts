import { customElement } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline } from "../../../util/chart-util";

@customElement("volume-chart")
export class VolumeChart extends CanvasBase {
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
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.draw();
    });
    observe("state.liveCandle", () => {
      // make sure we have the latest state with the live candle
      this._state = xin["state"] as ChartState;
      this.draw();
    });
  }

  private isVisible(): boolean {
    // Check if element is hidden via attribute or style
    if (this.hidden || this.style.display === "none") return false;

    // Check if element has zero dimensions
    const rect = this.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;

    return true;
  }

  draw() {
    if (!this.canvas || !this.ctx || !this._state) return;

    // Skip drawing if the element is not visible
    if (!this.isVisible()) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Get all candles in the visible range
    const candles = this._state.priceHistory.getCandlesInRange(
      this._state.timeRange.start,
      this._state.timeRange.end
    );
    if (!candles || candles.length === 0) {
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

    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        const candle = this._state!.priceHistory.getCandle(timestamp);
        if (!candle || typeof candle.volume === "undefined") {
          return;
        }

        const volumeHeight = (candle.volume || 0) * volumeScale;
        if (volumeHeight <= 0) return; // Skip if no volume

        const y = this.canvas!.height / dpr - volumeHeight;

        // Color the volume bars based on price movement with CSS variables
        ctx.fillStyle =
          candle.close >= candle.open
            ? `${getComputedStyle(document.documentElement)
                .getPropertyValue("--color-accent-1")
                .trim()}80` // 50% opacity
            : `${getComputedStyle(document.documentElement)
                .getPropertyValue("--color-error")
                .trim()}80`; // 50% opacity

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
}
