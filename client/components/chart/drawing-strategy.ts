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

  draw(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      options,
      axisMappings: { priceToY },
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.grid.draw(context);

    const candleWidth = options.candleWidth;

    const visibleCandles = data.getCandlesInRange(
      context.viewportStartTimestamp,
      context.viewportEndTimestamp
    );

    visibleCandles.forEach(([timestamp, candle]) => {
      const x = this.calculateXForTime(timestamp, context) / dpr;

      if (candle.live) {
        console.log("CandlestickStrategy: Drawing live candle:", candle);
      }

      // Draw wick
      ctx.beginPath();
      ctx.strokeStyle = candle.close > candle.open ? "green" : "red";
      // set line dash to no dash
      ctx.setLineDash([]);
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

      if (candle.live) {
        console.log("CandlestickStrategy: Drawing live candle:", candle);
        // dispatch an event with the x position
        dispatchEvent(
          new CustomEvent("candlestick-live-price", {
            detail: {
              x,
              closeY,
              candle,
            },
          })
        );
      }

      ctx.fillStyle = candle.close > candle.open ? "green" : "red";
      ctx.fillRect(x, bodyTop, candleWidth, bodyHeight);
    });
  }

  calculateXForTime(timestamp: number, context: DrawingContext): number {
    const {
      chartCanvas: canvas,
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;
    const availableWidth = canvas.width;
    const timeRange = Math.max(
      viewportEndTimestamp - viewportStartTimestamp,
      1
    );
    const timePosition = (timestamp - viewportStartTimestamp) / timeRange;
    const x = timePosition * availableWidth;
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
