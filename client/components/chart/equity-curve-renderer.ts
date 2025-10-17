import { EquityPoint, EquityCurveConfig, TRADING_OVERLAY_COLORS } from "../../types/trading-overlays";
import { ViewportTransform } from "./interaction/interaction-layer";
import { getLogger } from "../../util/logger";

const logger = getLogger("EquityCurveRenderer");

/**
 * Renderer for equity curve overlay on canvas
 * Handles line drawing, area fill, and separate Y-axis scaling
 */
export class EquityCurveRenderer {
  private equityRange: { min: number; max: number } | null = null;

  /**
   * Draw the equity curve on the canvas
   */
  drawEquityCurve(
    ctx: CanvasRenderingContext2D,
    data: EquityPoint[],
    config: EquityCurveConfig,
    transform: ViewportTransform
  ): void {
    if (data.length === 0) return;

    // Get visible points
    const visiblePoints = this.getVisiblePoints(data, transform);
    if (visiblePoints.length === 0) return;

    // Calculate equity range for scaling
    this.calculateEquityRange(visiblePoints);
    if (!this.equityRange) return;

    // Save context state
    ctx.save();

    // Set line style based on config
    this.setLineStyle(ctx, config);

    // Draw area fill if enabled
    if (config.showArea) {
      this.drawAreaFill(ctx, visiblePoints, config, transform);
    }

    // Draw the equity curve line
    this.drawLine(ctx, visiblePoints, config, transform);

    // Restore context state
    ctx.restore();

    logger.debug(`Drew equity curve with ${visiblePoints.length} visible points`);
  }

  /**
   * Draw the line connecting equity points
   */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    points: EquityPoint[],
    config: EquityCurveConfig,
    transform: ViewportTransform
  ): void {
    if (points.length < 2) return;

    const color = config.color || TRADING_OVERLAY_COLORS.equityCurve;
    const lineWidth = config.lineWidth || 2;
    const opacity = config.opacity || 0.8;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth * transform.dpr;
    ctx.globalAlpha = opacity;

    // Begin path
    ctx.beginPath();

    // Move to first point
    const firstPoint = points[0];
    const firstX = this.timestampToCanvasX(firstPoint.timestamp, transform);
    const firstY = this.equityToCanvasY(firstPoint.equity, transform);
    ctx.moveTo(firstX, firstY);

    // Draw lines to subsequent points
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const x = this.timestampToCanvasX(point.timestamp, transform);
      const y = this.equityToCanvasY(point.equity, transform);
      ctx.lineTo(x, y);
    }

    // Stroke the path
    ctx.stroke();
  }

  /**
   * Draw area fill under the equity curve
   */
  private drawAreaFill(
    ctx: CanvasRenderingContext2D,
    points: EquityPoint[],
    config: EquityCurveConfig,
    transform: ViewportTransform
  ): void {
    if (points.length < 2) return;

    const areaColor = config.areaColor || config.color || TRADING_OVERLAY_COLORS.equityCurve;
    const opacity = (config.opacity || 0.8) * 0.3; // Area is more transparent than line

    ctx.fillStyle = areaColor;
    ctx.globalAlpha = opacity;

    // Begin path
    ctx.beginPath();

    // Move to first point
    const firstPoint = points[0];
    const firstX = this.timestampToCanvasX(firstPoint.timestamp, transform);
    const firstY = this.equityToCanvasY(firstPoint.equity, transform);
    ctx.moveTo(firstX, firstY);

    // Draw lines to subsequent points
    for (let i = 1; i < points.length; i++) {
      const point = points[i];
      const x = this.timestampToCanvasX(point.timestamp, transform);
      const y = this.equityToCanvasY(point.equity, transform);
      ctx.lineTo(x, y);
    }

    // Close the path to bottom of canvas
    const lastPoint = points[points.length - 1];
    const lastX = this.timestampToCanvasX(lastPoint.timestamp, transform);
    const bottomY = transform.canvasHeight * transform.dpr;
    ctx.lineTo(lastX, bottomY);
    ctx.lineTo(firstX, bottomY);
    ctx.closePath();

    // Fill the area
    ctx.fill();
  }

  /**
   * Set line style (solid, dashed, dotted)
   */
  private setLineStyle(ctx: CanvasRenderingContext2D, config: EquityCurveConfig): void {
    const lineStyle = config.lineStyle || 'solid';

    switch (lineStyle) {
      case 'solid':
        ctx.setLineDash([]);
        break;
      case 'dashed':
        ctx.setLineDash([10, 5]);
        break;
      case 'dotted':
        ctx.setLineDash([2, 4]);
        break;
    }
  }

  /**
   * Convert timestamp to canvas X coordinate
   */
  private timestampToCanvasX(timestamp: number, transform: ViewportTransform): number {
    const { timeRange, canvasWidth, dpr } = transform;
    const range = timeRange.end - timeRange.start;
    const ratio = (timestamp - timeRange.start) / range;
    return ratio * canvasWidth * dpr;
  }

  /**
   * Convert equity value to canvas Y coordinate using separate equity scale
   */
  private equityToCanvasY(equity: number, transform: ViewportTransform): number {
    if (!this.equityRange) return 0;

    const { canvasHeight, dpr } = transform;
    const range = this.equityRange.max - this.equityRange.min;

    // Add 10% padding to top and bottom for better visualization
    const padding = range * 0.1;
    const paddedMin = this.equityRange.min - padding;
    const paddedMax = this.equityRange.max + padding;
    const paddedRange = paddedMax - paddedMin;

    const ratio = (paddedMax - equity) / paddedRange;
    return ratio * canvasHeight * dpr;
  }

  /**
   * Calculate equity range from visible points
   */
  private calculateEquityRange(points: EquityPoint[]): void {
    if (points.length === 0) {
      this.equityRange = null;
      return;
    }

    let min = points[0].equity;
    let max = points[0].equity;

    for (const point of points) {
      if (point.equity < min) min = point.equity;
      if (point.equity > max) max = point.equity;
    }

    // Ensure min and max are not the same
    if (min === max) {
      min = min * 0.99;
      max = max * 1.01;
    }

    this.equityRange = { min, max };
  }

  /**
   * Get visible equity points within the current time range
   */
  getVisiblePoints(points: EquityPoint[], transform: ViewportTransform): EquityPoint[] {
    const { timeRange } = transform;

    return points.filter(point => {
      return point.timestamp >= timeRange.start && point.timestamp <= timeRange.end;
    }).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get current equity range (for external use, e.g., drawing axis)
   */
  getEquityRange(): { min: number; max: number } | null {
    return this.equityRange;
  }

  /**
   * Clear cached equity range
   */
  clearCache(): void {
    this.equityRange = null;
  }
}
