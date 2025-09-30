import { PatternHighlight, getPatternDefaultColor } from "../../types/markers";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("CandleRenderer");
logger.setLoggerLevel("CandleRenderer", LogLevel.ERROR);

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  live?: boolean;
}

export class CandleRenderer {
  public highlightPattern: PatternHighlight | null = null;

  constructor() {}

  setHighlight(pattern: PatternHighlight | null) {
    this.highlightPattern = pattern;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    candle: CandleData,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
  ) {
    // If highlighted, draw with special colors, otherwise draw normal
    if (this.highlightPattern) {
      // Draw the candle with highlight colors at full brightness
      this.drawHighlightedCandle(ctx, candle, x, candleWidth, priceToY);
    } else {
      // Draw normal candle
      this.drawNormalCandle(
        ctx,
        candle,
        x,
        candleWidth,
        priceToY,
        candle.live || false,
      );
    }
  }

  private drawHighlightedCandle(
    ctx: CanvasRenderingContext2D,
    candle: CandleData,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
  ) {
    const candleX = x - candleWidth / 2;

    // Calculate positions
    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const highY = priceToY(candle.high);
    const lowY = priceToY(candle.low);

    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    // Convert Proxy color to string and use it, or fallback to white
    const baseColor = this.highlightPattern?.color
      ? String(this.highlightPattern.color)
      : "#FFFFFF";
    const patternStyle = this.highlightPattern?.style
      ? String(this.highlightPattern.style)
      : "both";
    // Get opacity from pattern, default to 1 if not specified
    const baseOpacity = this.highlightPattern?.opacity ?? 1;

    // Reset all properties to ensure clean state
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

    // Check style to determine what to draw
    const drawFill = patternStyle === "fill" || patternStyle === "both";
    const drawOutline = patternStyle === "outline" || patternStyle === "both";

    // Draw wick at full opacity
    ctx.globalAlpha = baseOpacity;
    ctx.strokeStyle = baseColor;
    ctx.lineWidth = 2;

    if (Math.abs(highY - lowY) > 0.5) {
      ctx.beginPath();

      // Always draw wick in two parts to avoid overlap with body
      // Top wick (from high to body top)
      if (highY < bodyTop) {
        ctx.moveTo(x, highY);
        ctx.lineTo(x, bodyTop);
      }

      // Bottom wick (from body bottom to low)
      if (lowY > bodyBottom) {
        ctx.moveTo(x, bodyBottom);
        ctx.lineTo(x, lowY);
      }

      ctx.stroke();
    }

    // Draw body based on style
    if (drawFill) {
      // Fill the body
      ctx.globalAlpha = baseOpacity;
      ctx.fillStyle = baseColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else if (drawOutline) {
      // Draw outline
      ctx.globalAlpha = baseOpacity;
      ctx.strokeStyle = baseColor;
      ctx.lineWidth = 2;
      ctx.strokeRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else {
      // Fallback: draw filled
      ctx.globalAlpha = baseOpacity;
      ctx.fillStyle = baseColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    }

    // Reset global alpha
    ctx.globalAlpha = 1;
  }

  private drawNormalCandle(
    ctx: CanvasRenderingContext2D,
    candle: CandleData,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
    isLive: boolean,
  ) {
    const candleX = x - candleWidth / 2;

    // Calculate positions
    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const highY = priceToY(candle.high);
    const lowY = priceToY(candle.low);

    const bodyTop = Math.min(openY, closeY);
    const bodyBottom = Math.max(openY, closeY);
    const bodyHeight = Math.max(1, bodyBottom - bodyTop);

    // Determine colors
    const isGreen = candle.close > candle.open;
    const wickColor = isGreen
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim();

    // Draw wick
    ctx.strokeStyle = wickColor;
    ctx.lineWidth = isLive ? 1.5 : 1;
    ctx.setLineDash(isLive ? [2, 2] : []);

    if (Math.abs(highY - lowY) > 0.5) {
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw body
    ctx.fillStyle = wickColor;
    ctx.globalAlpha = isLive ? 0.9 : 1;
    ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    ctx.globalAlpha = 1;
  }

  reset() {
    // Clear all state when returning to pool
    this.highlightPattern = null;
  }
}
