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
    const {
      ctx,
      canvas,
      data,
      options,
      padding,
      priceToY,
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate dimensions with device pixel ratio
    const dpr = window.devicePixelRatio;
    const candleWidth = options.candleWidth * dpr;
    const candleGap = options.candleGap * dpr;
    const totalCandleWidth = candleWidth + candleGap;
    const candleInterval =
      data.getGranularity() === "ONE_HOUR" ? 60 * 60 * 1000 : 5 * 60 * 1000;

    // Draw candles
    let currentTime = viewportStartTimestamp;
    while (currentTime <= viewportEndTimestamp) {
      const candle = data.getCandle(currentTime);
      if (candle) {
        // Calculate base X position
        const baseX = this.calculateXForTime(candle.timestamp, context);

        // Add half the gap to position the candle with proper spacing
        const x = baseX + candleGap / 2;

        // Draw wick (centered on the candle)
        ctx.beginPath();
        ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
        ctx.moveTo(x + candleWidth / 2, priceToY(candle.high));
        ctx.lineTo(x + candleWidth / 2, priceToY(candle.low));
        ctx.stroke();

        // Draw body
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const bodyHeight = Math.abs(closeY - openY);

        ctx.fillStyle = candle.close > candle.open ? "green" : "red";
        ctx.fillRect(x, Math.min(openY, closeY), candleWidth, bodyHeight);
      }

      currentTime += candleInterval;
    }
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
    const availableWidth = canvas.width - padding.left - padding.right;
    const timeRange = viewportEndTimestamp - viewportStartTimestamp;
    const timePosition = (timestamp - viewportStartTimestamp) / timeRange;

    return padding.left + timePosition * availableWidth;
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
