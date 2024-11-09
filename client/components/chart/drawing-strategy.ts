import { ChartOptions } from "./chart";
import { PriceHistory, PriceRange } from "../../../server/services/price-data/price-history-model";
import { HairlineGrid } from "./grid";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  chartCanvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  priceRange: PriceRange;
}

export interface Drawable {
  draw(context: DrawingContext): void;
}

export interface GridDrawingContext {
  calculateXForTime(timestamp: number, context: DrawingContext): number;
  priceToY(price: number, context: DrawingContext): number;
}

export class CandlestickStrategy implements Drawable {
  private grid: HairlineGrid = new HairlineGrid();

  draw(context: DrawingContext): void {
    const { ctx, chartCanvas: canvas, data, options } = context;
    const dpr = window.devicePixelRatio ?? 1;

    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    this.grid.draw(ctx, context, {
      calculateXForTime: this.calculateXForTime,
      priceToY: this.priceToY,
    });

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
    const { chartCanvas: canvas, viewportStartTimestamp, viewportEndTimestamp } =
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
    const logicalHeight = context.chartCanvas.height / dpr;
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
