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
  private pulsePhase: number;
  public currentIntensity = 0;
  public targetIntensity = 0;
  public highlightPattern: PatternHighlight | null = null;
  private readonly PULSE_SPEED = 0.003; // Radians per millisecond
  private readonly TRANSITION_SPEED = 0.15; // Smooth transition speed

  constructor() {
    // Start at random phase for organic wave effect across patterns
    this.pulsePhase = Math.random() * Math.PI * 2;
  }

  setHighlight(pattern: PatternHighlight | null) {
    this.highlightPattern = pattern;
    this.targetIntensity = pattern ? 1 : 0;

    // If setting a highlight for the first time, start with some intensity immediately
    if (pattern && this.currentIntensity === 0) {
      this.currentIntensity = 0.5; // Start at 50% immediately for visible effect
    }
  }

  update(deltaTime: number) {
    // Smooth intensity transitions when highlighting changes
    const diff = this.targetIntensity - this.currentIntensity;
    this.currentIntensity += diff * this.TRANSITION_SPEED;

    // Update pulse phase when highlighted
    if (this.currentIntensity > 0.01) {
      this.pulsePhase += deltaTime * this.PULSE_SPEED;
      // Keep phase in 0-2π range
      if (this.pulsePhase > Math.PI * 2) {
        this.pulsePhase -= Math.PI * 2;
      }
    }
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
      // Calculate pulsation for highlighted candles
      const pulse = 0.7 + 0.3 * Math.sin(this.pulsePhase);

      // Draw the candle with highlight colors and pulsation
      this.drawHighlightedCandleSimple(
        ctx,
        candle,
        x,
        candleWidth,
        priceToY,
        pulse,
      );
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

  private drawHighlightedCandleSimple(
    ctx: CanvasRenderingContext2D,
    candle: CandleData,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
    pulse: number = 1,
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
    const patternColor = this.highlightPattern?.color
      ? String(this.highlightPattern.color)
      : "#FFFFFF";
    const patternStyle = this.highlightPattern?.style
      ? String(this.highlightPattern.style)
      : "both";

    // COMMENTED OUT - Save state to not affect other drawings
    // ctx.save();

    // Reset all properties to ensure clean state
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Check style to determine what to draw
    const drawFill = patternStyle === "fill" || patternStyle === "both";
    const drawOutline = patternStyle === "outline" || patternStyle === "both";

    // Draw wick with pattern color - always split into two parts to avoid showing through body
    // Apply pulsation to opacity for a breathing effect
    ctx.globalAlpha = 0.4 + 0.6 * pulse; // Varies between 0.4 and 1.0
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 2 + pulse; // Varies between 2 and 3

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
      // Fill the body with pattern color with pulsating opacity
      ctx.globalAlpha = 0.3 + 0.7 * pulse; // Varies between 0.3 and 1.0
      ctx.fillStyle = patternColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else if (drawOutline) {
      // Draw outline only with pulsating width
      ctx.globalAlpha = 0.5 + 0.5 * pulse; // Varies between 0.5 and 1.0
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 1 + pulse; // Varies between 1 and 2
      ctx.strokeRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else {
      // Fallback: draw filled
      ctx.globalAlpha = 0.3 + 0.7 * pulse;
      ctx.fillStyle = patternColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    }

    // Reset global alpha
    ctx.globalAlpha = 1;

    // COMMENTED OUT - ctx.restore();
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

    // COMMENTED OUT - Save context state before drawing normal candle
    // ctx.save();

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

    // COMMENTED OUT - Restore context state after drawing normal candle
    // ctx.restore();
  }

  reset() {
    // Clear all state when returning to pool
    this.highlightPattern = null;
    this.currentIntensity = 0;
    this.targetIntensity = 0;
    this.pulsePhase = Math.random() * Math.PI * 2; // Randomize phase for next use
  }
}
