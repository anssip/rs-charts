import { ChartOptions } from "./chart";
import {
  PriceHistory,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { HairlineGrid } from "./grid";
import { xin } from "xinjs";

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
  private readonly FIXED_GAP_WIDTH = 2; // pixels
  private readonly MIN_CANDLE_WIDTH = 1; // pixels
  private readonly MAX_CANDLE_WIDTH = 500; // pixels

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

    // Calculate number of candles in view
    const timeSpan =
      context.viewportEndTimestamp - context.viewportStartTimestamp;
    const candleCount = Math.ceil(timeSpan / data.granularityMs);
    const availableWidth = canvas.width / dpr;

    // Calculate candle width to fill space with fixed gaps
    const totalGapWidth = ((candleCount - 1) * this.FIXED_GAP_WIDTH) / dpr; // gaps between candles
    const spaceForCandles = availableWidth - totalGapWidth;
    const candleWidth = Math.max(
      this.MIN_CANDLE_WIDTH,
      Math.min(this.MAX_CANDLE_WIDTH, spaceForCandles / candleCount)
    );
    console.log("CandlestickStrategy: timeSpan", timeSpan / (1000 * 60));
    console.log(
      "CandlestickStrategy: granularity",
      data.granularityMs / (1000 * 60 * 60)
    );
    console.log("CandlestickStrategy: candleCount", candleCount);
    console.log("CandlestickStrategy: candleWidth", candleWidth);

    const visibleCandles = data.getCandlesInRange(
      context.viewportStartTimestamp,
      context.viewportEndTimestamp
    );
    if (visibleCandles.length === 0) {
      return;
    }

    // console.log(
    //   "CandlestickStrategy: Drawing, visibleCandles",
    //   JSON.stringify({
    //     viewportStartTimestamp: new Date(context.viewportStartTimestamp),
    //     viewportEndTimestamp: new Date(context.viewportEndTimestamp),
    //     priceRange: context.priceRange,
    //     dataLength: data.length,
    //     canvasWidth: canvas.width,
    //     canvasHeight: canvas.height,
    //     visibleCandlesLength: visibleCandles.length,
    //     dpr,
    //   })
    // );

    visibleCandles.forEach(([timestamp, candle]) => {
      if (`${candle.granularity}` !== `${xin["state.granularity"] as string}`) {
        throw new Error(
          `CandlestickStrategy: Candle granularity does not match state granularity: ${
            candle.granularity
          } !== ${xin["state.granularity"] as string}`
        );
      }
      const centerX = timeToX(timestamp);
      const x = (centerX - candleWidth / 2) / dpr;

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
      const wickX = x + candleWidth / 2;

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
