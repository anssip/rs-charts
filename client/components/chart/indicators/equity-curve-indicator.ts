import { customElement } from "lit/decorators.js";
import { MarketIndicator } from "./market-indicator";
import { ScaleType, GridStyle } from "./indicator-types";
import {
  EquityCurveParams,
  EquityPoint,
} from "../../../types/trading-indicators";
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
    if (
      !this.canvas ||
      !this.ctx ||
      !this._state ||
      !this._params.data ||
      this._params.data.length === 0
    ) {
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
          point.timestamp <= this._state!.timeRange.end,
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
        this.drawAreaFill(
          ctx,
          dpr,
          visibleData,
          xMapper,
          yMapper,
          canvasHeight,
        );
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
   * Handles gaps in data by breaking the line when timestamps are too far apart
   */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: EquityPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    style: { color: string; width: number; style: string },
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

    // Calculate a reasonable gap threshold based on the chart's granularity
    // If we have state with granularity info, use it; otherwise use a heuristic
    let gapThreshold = 7 * 24 * 60 * 60 * 1000; // Default: 7 days in milliseconds

    if (this._state?.priceHistory) {
      const granularityMs = this._state.priceHistory.granularityMs;
      // Consider a gap if the time difference is more than 5x the granularity
      // This allows for weekends/holidays but breaks on longer gaps
      gapThreshold = granularityMs * 5;
    }

    ctx.beginPath();
    const firstX = xMapper(data[0].timestamp) * dpr;
    const firstY = yMapper(data[0].equity) * dpr;
    ctx.moveTo(firstX, firstY);

    for (let i = 1; i < data.length; i++) {
      const prevTimestamp = data[i - 1].timestamp;
      const currTimestamp = data[i].timestamp;
      const timeDiff = currTimestamp - prevTimestamp;

      const x = xMapper(currTimestamp) * dpr;
      const y = yMapper(data[i].equity) * dpr;

      // If there's a gap in the data, break the line and start a new segment
      if (timeDiff > gapThreshold) {
        // Stroke the current path
        ctx.stroke();
        // Start a new path at the current point
        ctx.beginPath();
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw area fill under the equity curve
   * Handles gaps in data by creating separate fill areas for each continuous segment
   */
  private drawAreaFill(
    ctx: CanvasRenderingContext2D,
    dpr: number,
    data: EquityPoint[],
    xMapper: (timestamp: number) => number,
    yMapper: (price: number) => number,
    canvasHeight: number,
  ): void {
    if (data.length === 0) return;

    ctx.save();
    ctx.fillStyle = this._params.areaColor!;
    ctx.globalAlpha = this._params.areaOpacity!;

    // Calculate gap threshold (same logic as drawLine)
    let gapThreshold = 7 * 24 * 60 * 60 * 1000; // Default: 7 days in milliseconds

    if (this._state?.priceHistory) {
      const granularityMs = this._state.priceHistory.granularityMs;
      gapThreshold = granularityMs * 5;
    }

    const bottomY = canvasHeight * dpr;
    let segmentStart = 0;

    // Draw area fills for each continuous segment
    for (let i = 1; i <= data.length; i++) {
      const isLastPoint = i === data.length;
      const isGap =
        !isLastPoint &&
        data[i].timestamp - data[i - 1].timestamp > gapThreshold;

      if (isGap || isLastPoint) {
        // Draw the segment from segmentStart to i-1 (or i if last point)
        const segmentEnd = isLastPoint ? i : i - 1;
        const segmentData = data.slice(segmentStart, segmentEnd);

        if (segmentData.length > 0) {
          ctx.beginPath();

          // Start from bottom at first point
          const firstX = xMapper(segmentData[0].timestamp) * dpr;
          ctx.moveTo(firstX, bottomY);

          // Draw to first point
          const firstY = yMapper(segmentData[0].equity) * dpr;
          ctx.lineTo(firstX, firstY);

          // Draw through all points in segment
          for (let j = 1; j < segmentData.length; j++) {
            const x = xMapper(segmentData[j].timestamp) * dpr;
            const y = yMapper(segmentData[j].equity) * dpr;
            ctx.lineTo(x, y);
          }

          // Close path back to bottom
          const lastX =
            xMapper(segmentData[segmentData.length - 1].timestamp) * dpr;
          ctx.lineTo(lastX, bottomY);
          ctx.closePath();

          ctx.fill();
        }

        // Start next segment at current index
        segmentStart = i;
      }
    }

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
