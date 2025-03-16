import { customElement, property, state } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin, xinValue } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline, priceToY } from "../../../util/chart-util";
import { ScaleType } from "./indicator-types";
import "../value-axis";
import { html, css, PropertyValues } from "lit";
import { ValueRange } from "../value-axis";

// Add global type for state cache
declare global {
  interface Window {
    __INDICATOR_STATE_CACHE?: {
      [key: string]: {
        state: ChartState;
        valueRange: ValueRange;
        scale?: ScaleType;
        timestamp: number;
      };
    };
  }
}

@customElement("market-indicator")
export class MarketIndicator extends CanvasBase {
  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

  @property({ type: String })
  indicatorId?: string;

  @property({ type: String })
  scale?: ScaleType;

  @property({ type: Number })
  valueAxisWidth = 70;

  @property({ type: Number })
  valueAxisMobileWidth = 45;

  @property({ type: Boolean })
  showAxis = true;

  private _state: ChartState | null = null;

  @property({ type: Object })
  private localValueRange: ValueRange = {
    min: 0,
    max: 100,
    range: 100,
  };

  constructor(props?: {
    indicatorId?: string;
    scale?: ScaleType;
    valueAxisWidth?: number;
    valueAxisMobileWidth?: number;
    showAxis?: boolean;
  }) {
    super();
    if (props?.indicatorId) {
      this.indicatorId = props.indicatorId;
    }
    if (props?.scale) {
      this.scale = props.scale;
    }
    if (props?.valueAxisWidth) {
      this.valueAxisWidth = props?.valueAxisWidth;
    }
    if (props?.valueAxisMobileWidth) {
      this.valueAxisMobileWidth = props?.valueAxisMobileWidth;
    }
    if (props?.showAxis !== undefined) {
      this.showAxis = props.showAxis;
    }
    this.mobileMediaQuery.addEventListener("change", () => {
      this.isMobile = this.mobileMediaQuery.matches;
      this.draw();
    });
  }

  // Store snapshot of indicator state for restoration
  private storeStateSnapshot() {
    if (this._state) {
      try {
        // Store essential data needed for redrawing
        window.__INDICATOR_STATE_CACHE = window.__INDICATOR_STATE_CACHE || {};

        // Create a unique key based on indicator id
        const cacheKey = `indicator_${this.indicatorId || this.id}`;

        window.__INDICATOR_STATE_CACHE[cacheKey] = {
          state: this._state,
          valueRange: { ...this.localValueRange },
          scale: this.scale,
          timestamp: Date.now(),
        };

        console.log(`MarketIndicator: Stored state snapshot for ${cacheKey}`);
      } catch (err) {
        console.error("Failed to store state snapshot", err);
      }
    }
  }

  override getId(): string {
    return "market-indicator";
  }

  firstUpdated() {
    super.firstUpdated();
    console.log("MarketIndicator: First updated", {
      scale: this.scale,
      valueRange: this.localValueRange,
      dimensions: `${this.offsetWidth}x${this.offsetHeight}`,
    });

    // Initialize state observation
    observe("state", () => {
      this._state = xin["state"] as ChartState;

      // Store a snapshot whenever state is updated
      this.storeStateSnapshot();

      // Check scale and update value range if needed
      if (this.scale === ScaleType.Price) {
        this.localValueRange = {
          min: this._state.priceRange.min,
          max: this._state.priceRange.max,
          range: this._state.priceRange.max - this._state.priceRange.min,
        };
      }
      this.draw();
    });

    // Observe price range changes when using price scale
    observe("state.priceRange", () => {
      console.log("MarketIndicator: Price range changed", this.scale);
      const state = xin["state"] as ChartState;
      if (this.scale === ScaleType.Price && state) {
        this.localValueRange = {
          min: xinValue(state.priceRange.min),
          max: xinValue(state.priceRange.max),
          range:
            xinValue(state.priceRange.max) - xinValue(state.priceRange.min),
        };
        console.log("MarketIndicator: Local value range", this.localValueRange);

        // Update state snapshot with new value range
        this._state = state;
        this.storeStateSnapshot();

        this.draw();
      }
    });

    observe("state.timeRange", () => {
      // Update state snapshot before drawing
      this._state = xin["state"] as ChartState;
      this.storeStateSnapshot();
      this.draw();
    });

    this.addEventListener("value-range-change", ((
      e: CustomEvent<ValueRange>
    ) => {
      this.localValueRange = e.detail;
      // Update state snapshot with new value range
      this.storeStateSnapshot();
      this.draw();
    }) as EventListener);

    // Listen for force-redraw events from parent component
    this.addEventListener("force-redraw", ((
      e: CustomEvent<{ width: number; height: number }>
    ) => {
      console.log("MarketIndicator: Received force-redraw event", e.detail);

      // Apply the resize explicitly
      const { width, height } = e.detail;
      if (width && height) {
        this.resize(width, height);
      }

      // Force a redraw with a slight delay to ensure proper rendering
      setTimeout(() => {
        if (this.canvas && this.ctx) {
          console.log("MarketIndicator: Force redrawing after resize");

          // Clear the canvas completely
          this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

          // Redraw the content
          this.draw();
        }
      }, 50);
    }) as EventListener);

    // Listen for internal-state-update events (used for aggressive redraws)
    this.addEventListener("internal-state-update", ((e: CustomEvent) => {
      console.log("MarketIndicator: Received internal-state-update event");

      // Recreate canvas if needed
      if (!this.canvas) {
        // This will completely reinitialize the canvas
        (this as any).initializeCanvas();
      } else {
        // Get the current dimensions
        const width = this.offsetWidth;
        const height = this.offsetHeight;

        // Force resize and redraw
        setTimeout(() => {
          if (width > 0 && height > 0) {
            console.log(
              `MarketIndicator: Forcing resize to ${width}x${height}`
            );
            this.resize(width, height);

            // Additional draw call to ensure rendering
            setTimeout(() => {
              if (this.canvas && this.ctx) {
                console.log("MarketIndicator: Extra draw call");
                this.draw();
              }
            }, 100);
          }
        }, 10);
      }
    }) as EventListener);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("showAxis")) {
      this.style.setProperty(
        "--indicator-show-axis",
        this.showAxis ? "1" : "0"
      );
    }
    if (changedProperties.has("valueAxisWidth")) {
      this.style.setProperty("--value-axis-width", `${this.valueAxisWidth}px`);
    }
    if (changedProperties.has("valueAxisMobileWidth")) {
      this.style.setProperty(
        "--value-axis-mobile-width",
        `${this.valueAxisMobileWidth}px`
      );
    }
  }

  useResizeObserver(): boolean {
    return true;
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    style: {
      color?: string;
      lineWidth?: number;
      opacity?: number;
      dashArray?: number[];
    }
  ) {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = style.color || "#ffffff";
    ctx.lineWidth = style.lineWidth || 1;
    ctx.globalAlpha = style.opacity || 1;

    if (style.dashArray) {
      ctx.setLineDash(style.dashArray);
    }

    // Convert value to Y position using localValueRange
    const height = this.canvas!.height / (window.devicePixelRatio ?? 1);
    const getY = (value: number) => {
      return (
        height -
        ((value - this.localValueRange.min) / this.localValueRange.range) *
          height
      );
    };

    ctx.moveTo(points[0].x, getY(points[0].y));
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, getY(points[i].y));
    }

    ctx.stroke();
    ctx.setLineDash([]); // Reset dash array
    ctx.globalAlpha = 1; // Reset opacity
  }

  private drawBand(
    ctx: CanvasRenderingContext2D,
    upperPoints: { x: number; y: number }[],
    lowerPoints: { x: number; y: number }[],
    style: {
      color?: string;
      lineWidth?: number;
      opacity?: number;
      fillColor?: string;
      fillOpacity?: number;
    }
  ) {
    if (upperPoints.length < 2 || lowerPoints.length < 2) return;

    // Convert value to Y position using localValueRange
    const height = this.canvas!.height / (window.devicePixelRatio ?? 1);
    const getY = (value: number) => {
      return (
        height -
        ((value - this.localValueRange.min) / this.localValueRange.range) *
          height
      );
    };

    // Draw the filled area between bands
    ctx.beginPath();
    ctx.moveTo(upperPoints[0].x, getY(upperPoints[0].y));

    // Draw upper band
    for (let i = 1; i < upperPoints.length; i++) {
      ctx.lineTo(upperPoints[i].x, getY(upperPoints[i].y));
    }

    // Draw lower band in reverse
    for (let i = lowerPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(lowerPoints[i].x, getY(lowerPoints[i].y));
    }

    ctx.closePath();

    // Fill the area
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.globalAlpha = style.fillOpacity || 0.1;
      ctx.fill();
    }

    // Draw the band borders
    ctx.strokeStyle = style.color || "#ffffff";
    ctx.lineWidth = style.lineWidth || 1;
    ctx.globalAlpha = style.opacity || 1;
    ctx.stroke();

    ctx.globalAlpha = 1; // Reset opacity
  }

  private drawHistogram(
    ctx: CanvasRenderingContext2D,
    points: Array<{
      x: number;
      y: number;
      style: { color?: string; opacity?: number };
    }>
  ) {
    const dpr = window.devicePixelRatio ?? 1;
    const height = this.canvas!.height / dpr;
    const width = this.canvas!.width / dpr;

    // Calculate bar width based on the number of points and canvas width
    // Leave a small gap (10% of calculated width) between bars
    const barWidth = (width / points.length) * 0.9;

    // Convert value to Y position using localValueRange
    const getY = (value: number) => {
      return (
        height -
        ((value - this.localValueRange.min) / this.localValueRange.range) *
          height
      );
    };

    // Calculate zero line position using the same conversion
    const zeroY = getY(0);

    ctx.lineWidth = barWidth;

    points.forEach((point) => {
      // Use the color and opacity from the point's style
      ctx.strokeStyle = point.style.color || "#000";
      ctx.globalAlpha = point.style.opacity || 1;

      ctx.beginPath();
      ctx.moveTo(point.x, zeroY);
      ctx.lineTo(point.x, getY(point.y));
      ctx.stroke();
    });

    ctx.globalAlpha = 1; // Reset opacity
  }

  draw() {
    // Try to initialize state if not already done
    if (!this._state) {
      console.log(
        "MarketIndicator.draw: State not initialized, trying to get from global state"
      );
      try {
        this._state = xin["state"] as ChartState;
      } catch (err) {
        console.error(
          "MarketIndicator.draw: Failed to get state from xin",
          err
        );
      }
    }

    if (!this.canvas || !this.ctx || !this._state || !this.indicatorId) {
      console.log(
        "MarketIndicator: Not drawing, missing canvas, ctx, state, or indicatorId",
        {
          canvas: !!this.canvas,
          ctx: !!this.ctx,
          state: !!this._state,
          indicatorId: !!this.indicatorId,
        }
      );
      return;
    }

    try {
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio ?? 1;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Get visible candles
      const candles = this._state.priceHistory.getCandlesInRange(
        this._state.timeRange.start,
        this._state.timeRange.end
      );

      if (!candles || candles.length === 0) {
        console.log("MarketIndicator.draw: No candles to draw");
        return;
      }

      // Create a map to store points for each plot
      const plotPoints: {
        [key: string]: Array<{ x: number; y: number; style: any }>;
      } = {};
      const candleWidth = this.canvas.width / dpr / Math.max(1, candles.length);

      // Track min/max values for auto-scaling
      let minValue = Infinity;
      let maxValue = -Infinity;

      // Collect points and track min/max values
      iterateTimeline({
        callback: (x: number, timestamp: number) => {
          const candle = this._state!.priceHistory.getCandle(timestamp);
          if (!candle) return;

          const indicator = candle.evaluations.find(
            (e) => e.id === this.indicatorId
          );
          if (!indicator) return;

          indicator.values.forEach((value) => {
            if (!plotPoints[value.plot_ref]) {
              plotPoints[value.plot_ref] = [];
            }

            const candleX = x + candleWidth / 2;
            // Store raw value and update min/max
            const rawValue = value.value;
            minValue = Math.min(minValue, rawValue);
            maxValue = Math.max(maxValue, rawValue);

            // Store the point with its style
            plotPoints[value.plot_ref].push({
              x: candleX,
              y: rawValue,
              style: indicator.plot_styles[value.plot_ref]?.style || {},
            });
          });
        },
        granularity: this._state.priceHistory.getGranularity(),
        viewportStartTimestamp: this._state.timeRange.start,
        viewportEndTimestamp: this._state.timeRange.end,
        canvasWidth: this.canvas.width / dpr,
        interval: this._state.priceHistory.granularityMs,
        alignToLocalTime: false,
      });

      // Update localValueRange if not using price scale
      if (this.scale !== ScaleType.Price && minValue !== Infinity) {
        const range = maxValue - minValue;
        const padding = range * 0.1; // Add 10% padding
        this.localValueRange = {
          min: minValue - padding,
          max: maxValue + padding,
          range: range + padding * 2,
        };
      }

      // Draw each plot using its style
      const evaluation = candles[0]?.[1]?.evaluations?.find(
        (e) => e.id === this.indicatorId
      );
      if (!evaluation) {
        console.log(
          "MarketIndicator.draw: No evaluation found for indicator",
          this.indicatorId
        );
        return;
      }

      Object.entries(evaluation.plot_styles).forEach(([plotRef, plotStyle]) => {
        const points = plotPoints[plotRef];
        if (!points || points.length === 0) return;

        console.log("MI: Drawing plot:", {
          plotRef,
          type: plotStyle.type,
          points: points.length,
        });

        if (plotStyle.type === "line") {
          this.drawLine(ctx, points, plotStyle.style);
        } else if (plotStyle.type === "band") {
          const upperPoints = points.filter((_, i) => i % 2 === 0);
          const lowerPoints = points.filter((_, i) => i % 2 === 1);
          this.drawBand(ctx, upperPoints, lowerPoints, plotStyle.style);
        } else if (plotStyle.type === "histogram") {
          this.drawHistogram(ctx, points);
        }
      });
    } catch (err) {
      console.error("MarketIndicator.draw: Error drawing indicator", err);
    }
  }

  render() {
    return html`
      <div class="indicator-container">
        <div class="chart-area">
          <canvas></canvas>
        </div>
        ${this.showAxis
          ? html`<value-axis
              .valueRange=${this.localValueRange}
              .scale=${this.scale ?? "price"}
              .width=${this.isMobile
                ? this.valueAxisMobileWidth
                : this.valueAxisWidth}
              .showAxis=${this.showAxis}
              .isMobile=${this.isMobile}
            ></value-axis>`
          : ""}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      --show-axis: var(--indicator-show-axis, 1);
    }

    .indicator-container {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 150px;
      position: relative;
    }

    .chart-area {
      flex: 1;
      position: relative;
      height: 100%;
      width: calc(100% - (var(--show-axis) * var(--value-axis-width, 70px)));
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - (var(--show-axis) * var(--value-axis-width, 70px)));
      height: 100%;
    }

    value-axis {
      flex: none;
      width: var(--value-axis-width, 70px);
      height: 100%;
      z-index: 2;
    }
  `;
}
