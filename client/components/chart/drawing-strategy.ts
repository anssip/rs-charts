import { CandleDataByTimestamp } from "../../../server/services/price-data-cb";

export interface ChartOptions {
  candleWidth: number;
  candleGap: number;
  minCandleWidth: number;
  maxCandleWidth: number;
}

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  data: CandleDataByTimestamp;
  sortedTimestamps: number[];
  options: ChartOptions;
  padding: { top: number; right: number; bottom: number; left: number };
  priceToY: (price: number) => number;
}

export interface ChartDrawingStrategy {
  drawChart(context: DrawingContext, viewportStartTimestamp: number): void;
  drawTimeAxis?(context: DrawingContext, timestamps: number[]): void;
}

export class CandlestickStrategy implements ChartDrawingStrategy {
  drawChart(context: DrawingContext, viewportStartTimestamp: number): void {
    const { ctx, canvas, data, sortedTimestamps, options, padding, priceToY } =
      context;

    const visibleCandles = this.calculateVisibleCandles(
      canvas,
      padding,
      options
    );

    let startIndex = this.binarySearch(
      sortedTimestamps,
      viewportStartTimestamp
    );
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const endIndex = Math.min(startIndex + visibleCandles, data.size);
    const visibleTimestamps = sortedTimestamps.slice(startIndex, endIndex);

    // Draw the candles
    visibleTimestamps.forEach((timestamp, i) => {
      const candle = data.get(timestamp);
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

    this.drawTimeAxis(context, visibleTimestamps);
  }

  drawTimeAxis(context: DrawingContext, timestamps: number[]): void {
    const { ctx, canvas, padding, options } = context;
    const y = canvas.height - padding.bottom;

    ctx.textAlign = "center";
    ctx.fillStyle = "#666";
    ctx.font = "12px Arial";

    let lastDate: string | null = null;
    const labelInterval = Math.ceil(timestamps.length / 8);

    timestamps.forEach((ts, i) => {
      if (i % labelInterval === 0) {
        const x = padding.left + i * (options.candleWidth + options.candleGap);
        const date = new Date(ts);

        const timeLabel = date.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        const dateStr = date.toLocaleDateString([], {
          month: "short",
          day: "numeric",
        });
        if (dateStr !== lastDate) {
          ctx.fillText(dateStr, x, y + 25);
          lastDate = dateStr;
        }
        ctx.fillText(timeLabel, x, y + 10);
      }
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
    return -1;
  }
}
