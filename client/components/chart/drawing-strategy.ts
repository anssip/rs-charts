import { ChartOptions } from "./chart";
import { PriceHistory } from "../../../server/services/price-data/price-history-model";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  padding: { top: number; right: number; bottom: number; left: number };
  priceToY: (price: number) => number;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
}

export interface ChartDrawingStrategy {
  drawChart(context: DrawingContext): void;
  calculateTimeForX(x: number, context: DrawingContext): number;
  calculateXForTime(timestamp: number, context: DrawingContext): number;
}

export class CandlestickStrategy implements ChartDrawingStrategy {
  drawChart(context: DrawingContext): void {
    const { ctx, canvas, data, options, padding, priceToY } = context;
    const dpr = window.devicePixelRatio ?? 1;

    // Clear in logical pixels (context is already scaled)
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Draw debug rectangle
    ctx.strokeStyle = "blue";
    ctx.strokeRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Use logical pixels for candle dimensions
    const candleWidth = options.candleWidth;
    const candleGap = options.candleGap;

    // Get visible candles
    const visibleCandles = data.getCandlesInRange(
      context.viewportStartTimestamp,
      context.viewportEndTimestamp
    );

    console.log("Drawing candles:", {
      numCandles: visibleCandles.length,
      canvasWidth: canvas.width / dpr,
      availableWidth: canvas.width / dpr - padding.left - padding.right,
      candleWidth,
      candleGap,
      dpr,
      viewportStart: new Date(context.viewportStartTimestamp),
      viewportEnd: new Date(context.viewportEndTimestamp),
    });

    visibleCandles.forEach(([timestamp, candle]) => {
      const x = this.calculateXForTime(timestamp, context) / dpr; // Convert to logical pixels

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.lineWidth = 1; // Now in logical pixels

      const highY = priceToY(candle.high) / dpr;
      const lowY = priceToY(candle.low) / dpr;
      const wickX = x + candleWidth / 2;

      ctx.moveTo(wickX, highY);
      ctx.lineTo(wickX, lowY);
      ctx.stroke();

      // Draw body
      const openY = priceToY(candle.open) / dpr;
      const closeY = priceToY(candle.close) / dpr;
      const bodyHeight = Math.abs(closeY - openY);
      const bodyTop = Math.min(closeY, openY);

      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);

      // Debug logging
      console.log("Drawing candle:", {
        x,
        wickX,
        highY,
        lowY,
        bodyTop,
        bodyHeight,
        candleWidth,
        logical: {
          canvasWidth: canvas.width / dpr,
          canvasHeight: canvas.height / dpr,
        },
      });
    });
  }

  calculateTimeForX(x: number, context: DrawingContext): number {
    const { canvas, padding, viewportStartTimestamp, viewportEndTimestamp } =
      context;
    const availableWidth = canvas.width - padding.left - padding.right;
    const timeRange = viewportEndTimestamp - viewportStartTimestamp;
    const relativeX = x - padding.left;

    return viewportStartTimestamp + (relativeX / availableWidth) * timeRange;
  }

  calculateXForTime(timestamp: number, context: DrawingContext): number {
    const { canvas, padding, viewportStartTimestamp, viewportEndTimestamp } =
      context;
    const dpr = window.devicePixelRatio ?? 1;

    // Calculate available width in device pixels
    const availableWidth = canvas.width - (padding.left + padding.right) * dpr;

    // Calculate time position as a ratio (0 = oldest, 1 = newest)
    const timeRange = Math.max(
      viewportEndTimestamp - viewportStartTimestamp,
      1
    );
    const timePosition = (timestamp - viewportStartTimestamp) / timeRange;

    // Convert to canvas coordinates, starting from left padding
    const x = padding.left * dpr + timePosition * availableWidth;

    console.log("calculateXForTime:", {
      timestamp: new Date(timestamp).toISOString(),
      timePosition,
      x,
      availableWidth,
      canvasWidth: canvas.width,
      viewportStart: new Date(viewportStartTimestamp),
      viewportEnd: new Date(viewportEndTimestamp),
    });

    return x;
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
