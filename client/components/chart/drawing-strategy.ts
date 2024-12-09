import { ChartOptions } from "./chart";
import {
  PriceHistory,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { HairlineGrid } from "./grid";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  chartCanvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  priceRange: PriceRange;
  axisMappings: AxisMappings;
}

export interface Drawable {
  draw(context: DrawingContext): void;
}

export interface AxisMappings {
  timeToX(timestamp: number): number;
  priceToY(price: number): number;
}

export class CandlestickStrategy implements Drawable {
  private grid: HairlineGrid = new HairlineGrid();
  private readonly FIXED_CANDLE_WIDTH = 8; // pixels

  drawGrid(context: DrawingContext): void {
    this.grid.draw(context);
  }

  draw(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      axisMappings: { priceToY, timeToX },
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawGrid(context);

    // Use fixed candle width instead of calculating from available space
    const candleWidth = this.FIXED_CANDLE_WIDTH * dpr;

    const visibleCandles = data.getCandlesInRange(
      context.viewportStartTimestamp,
      context.viewportEndTimestamp
    );

    console.log("CandlestickStrategy: Drawing, visibleCandles", {
      viewportStartTimestamp: new Date(context.viewportStartTimestamp),
      viewportEndTimestamp: new Date(context.viewportEndTimestamp),
      priceRange: context.priceRange,
      dataLength: data.length,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      visibleCandlesLength: visibleCandles.length,
      dpr,
    });

    if (visibleCandles.length === 0) {
      console.warn("CandlestickStrategy: No visible candles to draw");
      return;
    }

    visibleCandles.forEach(([timestamp, candle]) => {
      const x = timeToX(timestamp) / dpr - candleWidth / 2;
      if (candle.live) {
        console.log("Live: Drawing live candle:", candle);
      }

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      ctx.setLineDash([]);
      ctx.lineWidth = 1;

      const highY = priceToY(candle.high);
      const lowY = priceToY(candle.low);
      const wickX = x + candleWidth / dpr;

      ctx.moveTo(wickX, highY);
      ctx.lineTo(wickX, lowY);
      ctx.stroke();

      // Draw body
      const openY = priceToY(candle.open);
      const closeY = priceToY(candle.close);
      const bodyHeight = Math.abs(closeY - openY);
      const bodyTop = Math.min(closeY, openY);

      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    });
  }
}
