import { customElement, property, state } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin, xinValue } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline, priceToY, timeToX } from "../../../util/chart-util";
import { ScaleType, GridStyle, OscillatorConfig } from "./indicator-types";
import "../value-axis";
import { html, css, PropertyValues } from "lit";
import { ValueRange } from "../value-axis";
import { drawLine, drawBand, drawHistogram } from "./drawing";
import { getLogger, LogLevel } from "../../../util/logger";
import { HairlineGrid } from "../grid";
import { DrawingContext } from "../drawing-strategy";
import { PriceRangeImpl } from "../../../util/price-range";
import { getLocalChartId, observeLocal } from "../../../util/state-context";

// Create a logger specific to this component
const logger = getLogger("MarketIndicator");
// Set debug level for this logger
logger.setLoggerLevel("MarketIndicator", LogLevel.DEBUG);

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

  @property({ type: String })
  gridStyle?: GridStyle;

  @property({ type: Object })
  oscillatorConfig?: OscillatorConfig;

  private _state: ChartState | null = null;
  private _chartId: string = "state";
  private grid = new HairlineGrid();
  // Track when the value range is manually set by user zooming
  private manualRangeSet = false;

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
    gridStyle?: GridStyle;
    oscillatorConfig?: OscillatorConfig;
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
    if (props?.gridStyle) {
      this.gridStyle = props.gridStyle;
    }
    if (props?.oscillatorConfig) {
      this.oscillatorConfig = props.oscillatorConfig;
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
    logger.debug("MarketIndicator firstUpdated called", this.indicatorId);

    // Initialize with safe defaults
    this._state = null;
    
    // Defer state initialization until component is properly connected
    requestAnimationFrame(() => {
      this.initializeState();
    });

    this.addEventListener("value-range-change", ((
      e: CustomEvent<ValueRange>
    ) => {
      if (e && e.detail) {
        this.localValueRange = e.detail;
        this.manualRangeSet = true;
        this.draw();
      } else {
        logger.warn("Received value-range-change event with null detail");
      }
    }) as EventListener);

    // Listen for force-redraw events from parent component
    this.addEventListener("force-redraw", ((
      e: CustomEvent<{ width: number; height: number }>
    ) => {
      if (e && e.detail) {
        const { width, height } = e.detail;
        if (width && height) {
          this.resize(width, height);
        }

        // Force a redraw with a slight delay to ensure proper rendering
        setTimeout(() => {
          if (this.canvas && this.ctx) {
            // Clear the canvas completely
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

            // Redraw the content
            this.draw();
          }
        }, 50);
      } else {
        logger.warn("Received force-redraw event with null detail");
      }
    }) as EventListener);
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    
    // Initialize state with actual data
    this._state = xin[this._chartId] as ChartState;
    
    // Set up observers for chart-specific state
    observeLocal(this, "state", () => {
      this._state = xin[this._chartId] as ChartState;
      logger.debug("State updated for indicator", this.indicatorId);

      // Check scale and update value range if needed
      if (this.scale === ScaleType.Price && this._state) {
        logger.debug("Updating from price range", this._state.priceRange);
        this.localValueRange = {
          min: this._state.priceRange.min,
          max: this._state.priceRange.max,
          range: this._state.priceRange.max - this._state.priceRange.min,
        };
      }
      this.draw();
    });

    // Observe price range changes when using price scale
    observeLocal(this, "state.priceRange", () => {
      const state = xin[this._chartId] as ChartState;
      if (this.scale === ScaleType.Price && state) {
        this.localValueRange = {
          min: xinValue(state.priceRange.min),
          max: xinValue(state.priceRange.max),
          range:
            xinValue(state.priceRange.max) - xinValue(state.priceRange.min),
        };

        // Update state snapshot with new value range
        this._state = state;

        this.draw();
      }
    });

    observeLocal(this, "state.timeRange", () => {
      // Update state snapshot before drawing
      this._state = xin[this._chartId] as ChartState;
      this.draw();
    });
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

    // Reset manual range flag when indicator or scale changes
    if (
      changedProperties.has("indicatorId") ||
      changedProperties.has("scale")
    ) {
      this.manualRangeSet = false;
      this.draw();
    }
  }

  useResizeObserver(): boolean {
    return true;
  }

  draw() {
    // Try to initialize state if not already done
    if (!this._state) {
      try {
        this._state = xin[this._chartId] as ChartState;
      } catch (err) {
        logger.error("MarketIndicator.draw: Failed to get state from xin", err);
      }
    }

    if (!this.canvas || !this.ctx || !this._state || !this.indicatorId) {
      logger.debug("MarketIndicator.draw: Missing required properties", {
        canvas: !!this.canvas,
        ctx: !!this.ctx,
        state: !!this._state,
        indicatorId: this.indicatorId,
      });
      return;
    }

    try {
      logger.debug(`Drawing indicator ${this.indicatorId}`);
      const ctx = this.ctx;
      const dpr = window.devicePixelRatio ?? 1;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Get visible candles
      const candles = this._state.priceHistory.getCandlesInRange(
        this._state.timeRange.start,
        this._state.timeRange.end
      );

      if (!candles || candles.length === 0) {
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

      logger.debug("Grid style", this.gridStyle);

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

      // Update localValueRange based on indicator type
      if (this.scale !== ScaleType.Price && !this.manualRangeSet) {
        if (this.gridStyle === GridStyle.PercentageOscillator) {
          // Force exact 0-100 range for percentage oscillators (RSI, Stochastic)
          this.localValueRange = {
            min: 0,
            max: 100,
            range: 100,
          };
        } else if (this.scale === ScaleType.Value) {
          // For custom value indicators, use auto-scaling with padding to utilize full vertical space
          const range = maxValue - minValue;
          const padding = range * 0.1; // Add 10% padding

          // Calculate a more appropriate min value to utilize the full chart height
          // Find the lowest visible value and add some padding below it
          let calculatedMin = Math.max(0, minValue - range * 0.3);

          this.localValueRange = {
            min: calculatedMin,
            max: maxValue + padding,
            range: maxValue + padding - calculatedMin,
          };
        } else if (minValue !== Infinity) {
          // For other indicators, use auto-scaling with padding
          const range = maxValue - minValue;
          const padding = range * 0.1; // Add 10% padding
          this.localValueRange = {
            min: minValue - padding,
            max: maxValue + padding,
            range: range + padding * 2,
          };
        }
      }

      // Now draw the grid with the finalized value range
      const drawingContext: DrawingContext = {
        ctx,
        chartCanvas: this.canvas,
        data: this._state.priceHistory,
        options: {
          candleWidth: 7,
          candleGap: 2,
          minCandleWidth: 2,
          maxCandleWidth: 100,
        },
        viewportStartTimestamp: this._state.timeRange.start,
        viewportEndTimestamp: this._state.timeRange.end,
        priceRange:
          this.scale === ScaleType.Price
            ? this._state.priceRange
            : new PriceRangeImpl(
                this.localValueRange.min,
                this.localValueRange.max
              ),
        axisMappings: {
          timeToX: timeToX(this.canvas.width / dpr, this._state.timeRange),
          priceToY: priceToY(this.canvas.height / dpr, {
            start: this.localValueRange.min,
            end: this.localValueRange.max,
          }),
        },
        gridStyle: this.gridStyle,
        oscillatorConfig: this.oscillatorConfig,
      };

      // Draw the grid first (behind the indicator data)
      this.grid.draw(drawingContext);

      // Draw each plot using its style
      const evaluation = candles[0]?.[1]?.evaluations?.find(
        (e) => e.id === this.indicatorId
      );
      if (!evaluation) {
        return;
      }

      // Reset line dash pattern before drawing indicator lines
      ctx.setLineDash([]);

      Object.entries(evaluation.plot_styles).forEach(([plotRef, plotStyle]) => {
        const points = plotPoints[plotRef];
        if (!points || points.length === 0) return;

        if (plotStyle.type === "line") {
          drawLine(ctx, points, plotStyle.style, this.localValueRange);
        } else if (plotStyle.type === "band") {
          const upperPoints = points.filter((_, i) => i % 2 === 0);
          const lowerPoints = points.filter((_, i) => i % 2 === 1);
          drawBand(
            ctx,
            upperPoints,
            lowerPoints,
            plotStyle.style,
            this.localValueRange
          );
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
              .gridStyle=${this.gridStyle}
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
      background: transparent;
    }

    .indicator-container {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 150px;
      position: relative;
      background: transparent;
    }

    .chart-area {
      flex: 1;
      position: relative;
      height: 100%;
      width: calc(100% - (var(--show-axis) * var(--value-axis-width, 70px)));
      background: transparent;
    }

    canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - (var(--show-axis) * var(--value-axis-width, 70px)));
      height: 100%;
      background: transparent;
      z-index: 1;
    }

    value-axis {
      flex: none;
      width: var(--value-axis-width, 70px);
      height: 100%;
      z-index: 2;
    }
  `;
}
