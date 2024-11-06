import { ChartOptions } from "./chart";
import { PriceHistory } from "../../../server/services/price-data/price-history-model";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  padding: { top: number; right: number; bottom: number; left: number };
  priceToY: (price: number) => number;
}

export interface ChartDrawingStrategy {
  drawChart(context: DrawingContext, viewportStartTimestamp: number): void;
}

export class CandlestickStrategy implements ChartDrawingStrategy {
  drawChart(context: DrawingContext, viewportStartTimestamp: number): void {
    console.log("CandlestickStrategy: Drawing chart");
    const { ctx, canvas, data, options, padding, priceToY } = context;

    const visibleCandles = this.calculateVisibleCandles(
      canvas,
      padding,
      options
    );

    // Get sorted timestamps for the viewport
    const sortedTimestamps = data.getTimestampsSorted();
    let startIndex = this.binarySearch(
      sortedTimestamps,
      viewportStartTimestamp
    );

    console.log(
      "CandlestickStrategy: Start index:",
      startIndex,
      "viewportStartTimestamp:",
      viewportStartTimestamp,
      "sortedTimestamps:",
      sortedTimestamps.length
    );

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const endIndex = Math.min(startIndex + visibleCandles, data.length);
    const visibleTimestamps = sortedTimestamps.slice(startIndex, endIndex);

    // Draw the candles
    visibleTimestamps.forEach((timestamp, i) => {
      const candle = data.getCandle(timestamp);
      if (!candle) return;

      const x = padding.left + i * (options.candleWidth + options.candleGap);

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.moveTo(x, priceToY(candle.high));
      ctx.lineTo(x, priceToY(candle.low));
      ctx.stroke();

      // Draw body
      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const bodyHeight = Math.abs(closeY - openY);

      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(
        x - options.candleWidth / 2,
        Math.min(openY, closeY),
        options.candleWidth,
        bodyHeight
      );
    });
  }

  private calculateVisibleCandles(
    canvas: HTMLCanvasElement,
    padding: { left: number; right: number },
    options: ChartOptions
  ): number {
    const availableWidth = canvas.width - padding.left - padding.right;
    const totalCandleWidth = options.candleWidth + options.candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }

  private binarySearch(arr: number[], target: number): number {
    let left = 0;
    let right = arr.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (arr[mid] === target) return mid;
      if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }

    // If exact match not found, return the closest index
    if (right < 0) return 0;
    if (left >= arr.length) return arr.length - 1;
    return Math.abs(arr[left] - target) < Math.abs(arr[right] - target)
      ? left
      : right;
  }
}
