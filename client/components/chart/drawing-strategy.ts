import { ChartOptions } from "./chart";
import {
  PriceHistory,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { HairlineGrid } from "./grid";
import { xin } from "xinjs";
import { iterateTimeline } from "../../util/chart-util";
import { GridStyle, OscillatorConfig } from "./indicators/indicator-types";

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  chartCanvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  priceRange: PriceRange;
  axisMappings: AxisMappings;
  gridStyle?: GridStyle;
  oscillatorConfig?: OscillatorConfig; // Configuration for oscillator indicators
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
  private readonly FIXED_GAP_WIDTH = 6; // pixels
  private readonly MIN_CANDLE_WIDTH = 1; // pixels
  private readonly MAX_CANDLE_WIDTH = 500; // pixels
  private animationFrameId: number | null = null;

  drawGrid(context: DrawingContext): void {
    this.grid.draw(context);
  }

  draw(context: DrawingContext): void {
    this.drawCandles(context);
  }

  private drawCandles(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      axisMappings: { priceToY },
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    // 1. Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 2. Draw the grid first (it will be in the background)
    this.drawGrid(context);

    // 3. Save the canvas state before drawing candles
    ctx.save();

    // Calculate candle width
    const timeSpan = viewportEndTimestamp - viewportStartTimestamp;
    const candleCount = Math.ceil(timeSpan / data.granularityMs);
    const availableWidth = canvas.width / dpr;

    const totalGapWidth = ((candleCount - 1) * this.FIXED_GAP_WIDTH) / dpr;
    const spaceForCandles = availableWidth - totalGapWidth;
    const candleWidth = Math.max(
      this.MIN_CANDLE_WIDTH,
      Math.min(this.MAX_CANDLE_WIDTH, spaceForCandles / candleCount)
    );

    // 4. Draw candles on top
    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        const candle = data.getCandle(timestamp);
        if (!candle) return;

        if (
          `${candle.granularity}` !== `${xin["state.granularity"] as string}`
        ) {
          throw new Error(
            `CandlestickStrategy: Candle granularity does not match state granularity: ${
              candle.granularity
            } !== ${xin["state.granularity"] as string}`
          );
        }

        // Calculate x position for candle
        const candleX = x - candleWidth / 2;

        // Draw wick
        ctx.beginPath();
        ctx.strokeStyle =
          candle.close > candle.open
            ? getComputedStyle(document.documentElement)
                .getPropertyValue("--color-accent-1")
                .trim()
            : getComputedStyle(document.documentElement)
                .getPropertyValue("--color-error")
                .trim();
        ctx.setLineDash([]);
        ctx.lineWidth = 1;

        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        const wickX = candleX + candleWidth / 2;

        ctx.moveTo(wickX, highY);
        ctx.lineTo(wickX, lowY);
        ctx.stroke();

        // Draw body
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const bodyHeight = Math.abs(closeY - openY);
        const bodyTop = Math.min(closeY, openY);

        ctx.fillStyle =
          candle.close > candle.open
            ? getComputedStyle(document.documentElement)
                .getPropertyValue("--color-accent-1")
                .trim()
            : getComputedStyle(document.documentElement)
                .getPropertyValue("--color-error")
                .trim();
        ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
      },
      granularity: data.getGranularity(),
      viewportStartTimestamp,
      viewportEndTimestamp,
      canvasWidth: canvas.width / dpr,
      interval: data.granularityMs,
      alignToLocalTime: false,
    });

    // 5. Restore the canvas state
    ctx.restore();
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.grid.destroy();
  }
}
