import { customElement, property, state } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin, xinValue } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline, priceToY } from "../../../util/chart-util";
import { ScaleType } from "./indicator-types";
import "../value-axis";
import { html, css, PropertyValues } from "lit";
import { ValueRange } from "../value-axis";
import { drawLine, drawBand, drawHistogram } from "./drawing";

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

        this.draw();
      }
    });

    observe("state.timeRange", () => {
      // Update state snapshot before drawing
      this._state = xin["state"] as ChartState;
      this.draw();
    });

    this.addEventListener("value-range-change", ((
      e: CustomEvent<ValueRange>
    ) => {
      this.localValueRange = e.detail;
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
          drawLine(ctx, points, plotStyle.style, this.localValueRange);
        } else if (plotStyle.type === "band") {
          const upperPoints = points.filter((_, i) => i % 2 === 0);
          const lowerPoints = points.filter((_, i) => i % 2 === 1);
          drawBand(ctx, upperPoints, lowerPoints, plotStyle.style, this.localValueRange);
        } else if (plotStyle.type === "histogram") {
          drawHistogram(ctx, points, this.localValueRange);
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
