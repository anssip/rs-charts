import { customElement } from "lit/decorators.js";
import { MarketIndicator } from "./market-indicator";
import { ScaleType, GridStyle } from "./indicator-types";
import { EquityCurveParams, EquityPoint } from "../../../types/trading-indicators";
import { getDpr, timeToX, priceToY } from "../../../util/chart-util";
import { getLogger } from "../../../util/logger";

const logger = getLogger("EquityCurveIndicator");

/**
 * Equity Curve Indicator
 *
 * Visualizes portfolio equity over time using the standard indicator system.
 * This is a data renderer - equity calculations are done in sc-app's business logic layer.
 *
 * Architecture:
 * - Extends MarketIndicator to reuse panel management and rendering infrastructure
 * - Uses ScaleType.Value for independent Y-axis scaling
 * - Renders pre-calculated equity data (not from candle evaluations)
 * - Supports line rendering with optional area fill
 * - Can show peak line (running maximum equity)
 */
@customElement("equity-curve-indicator")
export class EquityCurveIndicator extends MarketIndicator {
  private _params: EquityCurveParams = {
    data: [],
    lineColor: "#2196f3",
    lineWidth: 2,
    showPeakLine: false,
    peakLineColor: "#666",
    peakLineStyle: "dotted",
    fillArea: false,
    areaColor: "#2196f3",
    areaOpacity: 0.3,
  };

  constructor(params?: EquityCurveParams) {
    super({
      indicatorId: "equity-curve",
      scale: ScaleType.Value,
      gridStyle: GridStyle.Value,
      showAxis: true,
    });

    if (params) {
      this._params = {
        data: params.data || [],
        lineColor: params.lineColor || "#2196f3",
        lineWidth: params.lineWidth || 2,
        showPeakLine: params.showPeakLine || false,
        peakLineColor: params.peakLineColor || "#666",
        peakLineStyle: params.peakLineStyle || "dotted",
        fillArea: params.fillArea || false,
        areaColor: params.areaColor || params.lineColor || "#2196f3",
        areaOpacity: params.areaOpacity ?? 0.3,
      };
    }
  }

  // Property getter/setter to allow Lit to set params after construction
  get params(): EquityCurveParams {
    return this._params;
  }

  set params(value: EquityCurveParams) {
    this._params = {
      data: value.data || [],
      lineColor: value.lineColor || "#2196f3",
      lineWidth: value.lineWidth || 2,
      showPeakLine: value.showPeakLine || false,
      peakLineColor: value.peakLineColor || "#666",
      peakLineStyle: value.peakLineStyle || "dotted",
      fillArea: value.fillArea || false,
      areaColor: value.areaColor || value.lineColor || "#2196f3",
      areaOpacity: value.areaOpacity ?? 0.3,
    };
    this.draw();
  }

  override getId(): string {
    return "equity-curve-indicator";
  }

  /**
   * Override draw method to render equity curve from pre-calculated data
   * instead of from candle evaluations
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
        (point: EquityPoint) =>
          point.timestamp >= this._state!.timeRange.start &&
          point.timestamp <= this._state!.timeRange.end
      );

      if (visibleData.length === 0) {
        return;
      }

      // Calculate equity range from visible data
      const equityValues = visibleData.map((p: EquityPoint) => p.equity);
      const minEquity = Math.min(...equityValues);
      const maxEquity = Math.max(...equityValues);
      const range = maxEquity - minEquity;
      const padding = range * 0.1; // 10% padding

      const valueRange = {
        min: Math.max(0, minEquity - padding),
        max: maxEquity + padding * 2, // More padding on top
        range: maxEquity + padding * 2 - Math.max(0, minEquity - padding),
      };

      // Update local value range for the value axis
      this.localValueRange = valueRange;

      // Create coordinate mapping functions
      const xMapper = timeToX(canvasWidth, this._state!.timeRange);
      const yMapper = priceToY(canvasHeight, {
        start: valueRange.min,
        end: valueRange.max,
      });

      // Calculate peak line data if enabled
      let peakData: EquityPoint[] = [];
      if (this._params.showPeakLine) {
        let peak = visibleData[0].equity;
        peakData = visibleData.map((point: EquityPoint) => {
          if (point.equity > peak) peak = point.equity;
          return { timestamp: point.timestamp, equity: peak };
        });
      }

      // Draw area fill if enabled
      if (this._params.fillArea) {
        this.drawAreaFill(ctx, dpr, visibleData, xMapper, yMapper, canvasHeight);
      }

      // Draw peak line if enabled (draw before main line so main line is on top)
      if (this._params.showPeakLine && peakData.length > 0) {
        this.drawLine(ctx, dpr, peakData, xMapper, yMapper, {
          color: this._params.peakLineColor!,
          width: 1,
          style: this._params.peakLineStyle!,
        });
      }

      // Draw main equity line
      this.drawLine(ctx, dpr, visibleData, xMapper, yMapper, {
        color: this._params.lineColor!,
        width: this._params.lineWidth!,
        style: "solid",
      });
    } catch (err) {
      logger.error("Error drawing equity curve indicator", err);
    }
  }

  /**
   * Draw a line through the equity points
   */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: EquityPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    style: { color: string; width: number; style: string }
  ): void {
    if (data.length === 0) return;

    ctx.save();
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width * dpr;

    // Set line dash pattern
    if (style.style === "dashed") {
      ctx.setLineDash([10 * dpr, 5 * dpr]);
    } else if (style.style === "dotted") {
      ctx.setLineDash([2 * dpr, 3 * dpr]);
    } else {
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    const firstX = xMapper(data[0].timestamp) * dpr;
    const firstY = yMapper(data[0].equity) * dpr;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < data.length; i++) {
      const x = xMapper(data[i].timestamp) * dpr;
      const y = yMapper(data[i].equity) * dpr;
      ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw area fill under the equity curve
   */
  private drawAreaFill(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: EquityPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    canvasHeight: number
  ): void {
    if (data.length === 0) return;

    ctx.save();
    ctx.fillStyle = this._params.areaColor!;
    ctx.globalAlpha = this._params.areaOpacity!;

    ctx.beginPath();

    // Start from bottom-left
    const firstX = xMapper(data[0].timestamp) * dpr;
    const bottomY = canvasHeight * dpr;
    ctx.moveTo(firstX, bottomY);

    // Draw line to first point
    const firstY = yMapper(data[0].equity) * dpr;
    ctx.lineTo(firstX, firstY);

    // Draw through all points
    for (let i = 1; i < data.length; i++) {
      const x = xMapper(data[i].timestamp) * dpr;
      const y = yMapper(data[i].equity) * dpr;
      ctx.lineTo(x, y);
    }

    // Close path back to bottom
    const lastX = xMapper(data[data.length - 1].timestamp) * dpr;
    ctx.lineTo(lastX, bottomY);
    ctx.closePath();

    ctx.fill();
    ctx.restore();
  }

  /**
   * Update indicator with new data
   */
  public updateData(data: EquityPoint[]): void {
    this._params.data = data;
    this.draw();
  }

  /**
   * Update indicator configuration
   */
  public updateConfig(updates: Partial<EquityCurveParams>): void {
    this._params = { ...this._params, ...updates };
    this.draw();
  }
}
