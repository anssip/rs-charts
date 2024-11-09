import { ChartOptions } from "./chart";
import { PriceHistory, PriceRange } from "../../../server/services/price-data/price-history-model";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  priceRange: PriceRange;
}

export interface ChartDrawingStrategy {
  drawChart(context: DrawingContext): void;
}

export class CandlestickStrategy implements ChartDrawingStrategy {


  // TODO: make this pan and zoomable
  // perhaps this should be in a separate class
  private drawGrid(ctx: CanvasRenderingContext2D, context: DrawingContext): void {
    const { canvas, data, priceRange } = context;
    const dpr = window.devicePixelRatio ?? 1;

    // Set grid style
    ctx.strokeStyle = "#ddd";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    // Draw vertical lines based on granularity
    const startTime = Math.floor(context.viewportStartTimestamp / data.granularityMs) * data.granularityMs;
    const endTime = context.viewportEndTimestamp;

    let gridInterval = data.granularityMs * 10; // Default every 10th candle
    if (data.granularityMs === 60 * 60 * 1000) { // Hourly
      gridInterval = data.granularityMs * 12;
    } else if (data.granularityMs === 30 * 24 * 60 * 60 * 1000) { // Monthly
      gridInterval = data.granularityMs * 6;
    }

    for (let timestamp = startTime; timestamp <= endTime; timestamp += gridInterval) {
      const x = this.calculateXForTime(timestamp, context) / dpr;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height / dpr);
      ctx.stroke();
    }

    // Draw horizontal lines for every 10% price change
    const priceStep = priceRange.range / 10; // 10% intervals
    for (let price = priceRange.min; price <= priceRange.max; price += priceStep) {
      const y = this.priceToY(price, context) / dpr;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width / dpr, y);
      ctx.stroke();
    }
  }

  drawChart(context: DrawingContext): void {
    const { ctx, canvas, data, options } = context;
    const dpr = window.devicePixelRatio ?? 1;

    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    this.drawGrid(ctx, context);

    const candleWidth = options.candleWidth;

    const visibleCandles = data.getCandlesInRange(
      context.viewportStartTimestamp,
      context.viewportEndTimestamp
    );

    visibleCandles.forEach(([timestamp, candle]) => {
      const x = this.calculateXForTime(timestamp, context) / dpr;

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.lineWidth = 1; // Now in logical pixels

      const highY = this.priceToY(candle.high, context) / dpr;
      const lowY = this.priceToY(candle.low, context) / dpr;
      const wickX = x + candleWidth / 2;

      ctx.moveTo(wickX, highY);
      ctx.lineTo(wickX, lowY);
      ctx.stroke();

      // Draw body
      const openY = this.priceToY(candle.open, context) / dpr;
      const closeY = this.priceToY(candle.close, context) / dpr;
      const bodyHeight = Math.abs(closeY - openY);
      const bodyTop = Math.min(closeY, openY);

      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    });
  }


  calculateXForTime(timestamp: number, context: DrawingContext): number {
    const { canvas, viewportStartTimestamp, viewportEndTimestamp } =
      context;
    const availableWidth = canvas.width;
    const timeRange = Math.max(
      viewportEndTimestamp - viewportStartTimestamp,
      1
    );
    const timePosition = (timestamp - viewportStartTimestamp) / timeRange;
    const x = timePosition * availableWidth;
    return x;
  }

  priceToY(price: number, context: DrawingContext): number {
    const priceRange = context.priceRange;

    const dpr = window.devicePixelRatio ?? 1;
    const logicalHeight = context.canvas.height / dpr;
    const percentage =
      (price - priceRange.min) / priceRange.range;
    const logicalY = (1 - percentage) * logicalHeight;
    const y = logicalY * dpr;
    return y;
  }

  calculateVisibleTimeRange(
    canvas: HTMLCanvasElement,
    padding: { left: number; right: number },
    options: ChartOptions,
    candleInterval: number
  ): number {
    const availableWidth = canvas.width - padding.left - padding.right;
    const totalCandleWidth = options.candleWidth + options.candleGap;
    const visibleCandles = Math.floor(availableWidth / totalCandleWidth);
    return visibleCandles * candleInterval;
  }
}
