import { customElement } from "lit/decorators.js";
import { MarketIndicator } from "./market-indicator";
import { ScaleType, GridStyle } from "./indicator-types";
import { DrawdownParams, DrawdownPoint } from "../../../types/trading-indicators";
import { getDpr, timeToX, priceToY } from "../../../util/chart-util";
import { getLogger } from "../../../util/logger";

const logger = getLogger("DrawdownIndicator");

/**
 * Drawdown Indicator
 *
 * Visualizes portfolio drawdown (percentage decline from peak) over time.
 * This is a data renderer - drawdown calculations are done in sc-app's business logic layer.
 *
 * Architecture:
 * - Extends MarketIndicator to reuse panel management and rendering infrastructure
 * - Uses ScaleType.Percentage with fixed 0-100 range (or inverted)
 * - Renders pre-calculated drawdown data (not from candle evaluations)
 * - Supports inverted Y-axis (drawdowns appear downward)
 * - Shows zero line and highlights severe drawdowns
 */
@customElement("drawdown-indicator")
export class DrawdownIndicator extends MarketIndicator {
  private _params: DrawdownParams = {
    data: [],
    fillColor: "#ff0000",
    fillOpacity: 0.3,
    showZeroLine: true,
    invertYAxis: true,
    warnColor: "#ff0000",
  };

  constructor(params?: DrawdownParams) {
    super({
      indicatorId: "drawdown",
      scale: ScaleType.Percentage,
      gridStyle: GridStyle.PercentageOscillator,
      showAxis: true,
    });

    if (params) {
      this._params = {
        data: params.data || [],
        fillColor: params.fillColor || "#ff0000",
        fillOpacity: params.fillOpacity ?? 0.3,
        showZeroLine: params.showZeroLine ?? true,
        invertYAxis: params.invertYAxis ?? true,
        warnThreshold: params.warnThreshold,
        warnColor: params.warnColor || "#ff0000",
      };
    }
  }

  // Property getter/setter to allow Lit to set params after construction
  get params(): DrawdownParams {
    return this._params;
  }

  set params(value: DrawdownParams) {
    this._params = {
      data: value.data || [],
      fillColor: value.fillColor || "#ff0000",
      fillOpacity: value.fillOpacity ?? 0.3,
      showZeroLine: value.showZeroLine ?? true,
      invertYAxis: value.invertYAxis ?? true,
      warnThreshold: value.warnThreshold,
      warnColor: value.warnColor || "#ff0000",
    };
    this.draw();
  }

  override getId(): string {
    return "drawdown-indicator";
  }

  /**
   * Override draw method to render drawdown from pre-calculated data
   */
  override draw(): void {
    if (!this.canvas || !this.ctx || !this._state || !this._params.data || this._params.data.length === 0) {
      return;
    }

    try {
      const ctx = this.ctx;
      const dpr = getDpr();
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      const canvasWidth = this.canvas.width / dpr;
      const canvasHeight = this.canvas.height / dpr;

      // Filter data to visible time range
      const visibleData = this._params.data.filter(
        (point: DrawdownPoint) =>
          point.timestamp >= this._state!.timeRange.start &&
          point.timestamp <= this._state!.timeRange.end
      );

      if (visibleData.length === 0) {
        return;
      }

      // Calculate drawdown range from visible data
      const drawdownValues = visibleData.map((p: DrawdownPoint) => p.drawdownPercent);
      const minDrawdown = Math.min(...drawdownValues, 0); // Include 0
      const maxDrawdown = Math.max(...drawdownValues, 0); // Include 0

      // Determine value range based on invertYAxis setting
      let valueRange: { start: number; end: number };
      if (this._params.invertYAxis) {
        // Inverted: 0 at top, negative values go down
        valueRange = {
          start: minDrawdown * 1.1, // Add 10% padding at bottom
          end: maxDrawdown,
        };
      } else {
        // Normal: 0 at bottom, negative values go up
        valueRange = {
          start: maxDrawdown,
          end: minDrawdown * 1.1, // Add 10% padding at bottom
        };
      }

      // Update local value range for the value axis
      this.localValueRange = {
        min: Math.min(valueRange.start, valueRange.end),
        max: Math.max(valueRange.start, valueRange.end),
        range: Math.abs(valueRange.end - valueRange.start),
      };

      // Create coordinate mapping functions
      const xMapper = timeToX(canvasWidth, this._state!.timeRange);
      const yMapper = priceToY(canvasHeight, valueRange);

      // Draw zero line if enabled
      if (this._params.showZeroLine) {
        this.drawZeroLine(ctx, dpr, canvasWidth, yMapper);
      }

      // Split data into normal and severe drawdown segments
      if (this._params.warnThreshold !== undefined) {
        this.drawSegmentedArea(ctx, dpr, visibleData, xMapper, yMapper, canvasHeight);
      } else {
        // Draw single area fill
        this.drawAreaFill(
          ctx,
          dpr,
          visibleData,
          xMapper,
          yMapper,
          canvasHeight,
          this._params.fillColor!,
          this._params.fillOpacity!
        );
      }
    } catch (err) {
      logger.error("Error drawing drawdown indicator", err);
    }
  }

  /**
   * Draw zero line (horizontal line at 0%)
   */
  private drawZeroLine(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    canvasWidth: number,
    yMapper: (price: number) => number
  ): void {
    const zeroY = yMapper(0) * dpr;

    ctx.save();
    ctx.strokeStyle = "#666";
    ctx.lineWidth = 1 * dpr;
    ctx.setLineDash([5 * dpr, 5 * dpr]);

    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(canvasWidth * dpr, zeroY);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw area fill for drawdown
   */
  private drawAreaFill(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: DrawdownPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    canvasHeight: number,
    color: string,
    opacity: number
  ): void {
    if (data.length === 0) return;

    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;

    ctx.beginPath();

    // Start from zero line at first timestamp
    const firstX = xMapper(data[0].timestamp) * dpr;
    const zeroY = yMapper(0) * dpr;
    ctx.moveTo(firstX, zeroY);

    // Draw through all points
    for (let i = 0; i < data.length; i++) {
      const x = xMapper(data[i].timestamp) * dpr;
      const y = yMapper(data[i].drawdownPercent) * dpr;
      ctx.lineTo(x, y);
    }

    // Close path back to zero line
    const lastX = xMapper(data[data.length - 1].timestamp) * dpr;
    ctx.lineTo(lastX, zeroY);
    ctx.closePath();

    ctx.fill();
    ctx.restore();
  }

  /**
   * Draw segmented area with different colors for normal and severe drawdowns
   */
  private drawSegmentedArea(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: DrawdownPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    canvasHeight: number
  ): void {
    if (data.length === 0) return;

    // Separate points into normal and severe segments
    const normalSegments: DrawdownPoint[][] = [];
    const severeSegments: DrawdownPoint[][] = [];
    let currentNormalSegment: DrawdownPoint[] = [];
    let currentSevereSegment: DrawdownPoint[] = [];
    let lastWasSevere = data[0].drawdownPercent <= this._params.warnThreshold!;

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const isSevere = point.drawdownPercent <= this._params.warnThreshold!;

      if (isSevere) {
        // Severe drawdown
        if (!lastWasSevere && currentNormalSegment.length > 0) {
          // Transition from normal to severe
          normalSegments.push([...currentNormalSegment]);
          currentNormalSegment = [];
          currentSevereSegment = [point];
        } else {
          currentSevereSegment.push(point);
        }
      } else {
        // Normal drawdown
        if (lastWasSevere && currentSevereSegment.length > 0) {
          // Transition from severe to normal
          severeSegments.push([...currentSevereSegment]);
          currentSevereSegment = [];
          currentNormalSegment = [point];
        } else {
          currentNormalSegment.push(point);
        }
      }

      lastWasSevere = isSevere;
    }

    // Add remaining segments
    if (currentNormalSegment.length > 0) {
      normalSegments.push(currentNormalSegment);
    }
    if (currentSevereSegment.length > 0) {
      severeSegments.push(currentSevereSegment);
    }

    // Draw normal segments
    normalSegments.forEach((segment) => {
      this.drawAreaFill(
        ctx,
        dpr,
        segment,
        xMapper,
        yMapper,
        canvasHeight,
        this._params.fillColor!,
        this._params.fillOpacity!
      );
    });

    // Draw severe segments with warning color
    severeSegments.forEach((segment) => {
      this.drawAreaFill(
        ctx,
        dpr,
        segment,
        xMapper,
        yMapper,
        canvasHeight,
        this._params.warnColor!,
        Math.min(this._params.fillOpacity! + 0.2, 1.0) // Slightly more opaque
      );
    });
  }

  /**
   * Update indicator with new data
   */
  public updateData(data: DrawdownPoint[]): void {
    this._params.data = data;
    this.draw();
  }

  /**
   * Update indicator configuration
   */
  public updateConfig(updates: Partial<DrawdownParams>): void {
    this._params = { ...this._params, ...updates };
    this.draw();
  }
}
