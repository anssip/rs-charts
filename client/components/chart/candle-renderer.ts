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
  private readonly PULSE_SPEED = 0.0035; // Slightly faster for more noticeable pulsation
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

  update(deltaTime: number): boolean {
    // Smooth intensity transitions when highlighting changes
    const diff = this.targetIntensity - this.currentIntensity;
    const intensityChange = diff * this.TRANSITION_SPEED;
    this.currentIntensity += intensityChange;

    // Update pulse phase when highlighted
    let phaseChanged = false;
    if (this.currentIntensity > 0.01) {
      const oldPhase = this.pulsePhase;
      this.pulsePhase += deltaTime * this.PULSE_SPEED;
      // Keep phase in 0-2π range
      if (this.pulsePhase > Math.PI * 2) {
        this.pulsePhase -= Math.PI * 2;
      }
      phaseChanged =
        Math.abs(Math.sin(oldPhase) - Math.sin(this.pulsePhase)) > 0.02;
    }

    // Return true if visual change is significant enough to warrant redraw
    return Math.abs(intensityChange) > 0.01 || phaseChanged;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    candle: CandleData,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
    disableAnimation: boolean = false,
  ) {
    // If highlighted, draw with special colors, otherwise draw normal
    if (this.highlightPattern) {
      // Calculate more dramatic pulsation for highlighted candles (or static if animation disabled)
      // Varies from 0.2 to 1.0 for much more striking effect
      const pulse = disableAnimation
        ? 1.0
        : 0.2 + 0.8 * Math.sin(this.pulsePhase);

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

  private blendColorToWhite(color: string, factor: number): string {
    // Factor: 0 = original color, 1 = pure white
    // Parse hex color or return white blend for any color format
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);

      // Blend toward white
      const blendedR = Math.round(r + (255 - r) * factor);
      const blendedG = Math.round(g + (255 - g) * factor);
      const blendedB = Math.round(b + (255 - b) * factor);

      return `rgb(${blendedR}, ${blendedG}, ${blendedB})`;
    }

    // For non-hex colors, use rgba overlay approach
    return color;
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
    const baseColor = this.highlightPattern?.color
      ? String(this.highlightPattern.color)
      : "#FFFFFF";
    const patternStyle = this.highlightPattern?.style
      ? String(this.highlightPattern.style)
      : "both";
    // Get opacity from pattern, default to 1 if not specified
    const baseOpacity = this.highlightPattern?.opacity ?? 1;

    // Blend color toward white based on pulse intensity for striking effect
    // At peak (pulse = 1.0), color is nearly white
    // At minimum (pulse = 0.2), use original color
    const blendFactor = pulse * 0.8; // Blend up to 80% toward white at peak
    const patternColor = this.blendColorToWhite(baseColor, blendFactor);

    // COMMENTED OUT - Save state to not affect other drawings
    // ctx.save();

    // Reset all properties to ensure clean state
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);

    // Check style to determine what to draw
    const drawFill = patternStyle === "fill" || patternStyle === "both";
    const drawOutline = patternStyle === "outline" || patternStyle === "both";

    // Add subtle glow effect at peak brightness
    if (pulse > 0.7) {
      const glowStrength = (pulse - 0.7) * 3.33; // 0 to 1 for top 30% of pulse
      ctx.shadowColor = patternColor;
      ctx.shadowBlur = 5 * glowStrength;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    } else {
      ctx.shadowBlur = 0;
    }

    // Draw wick with dramatic pulsation - varies opacity from 0.2 to 1.0
    // Apply pulsation to opacity for a breathing effect, scaled by baseOpacity
    ctx.globalAlpha = (0.2 + 0.8 * pulse) * baseOpacity; // Much more dramatic range
    ctx.strokeStyle = patternColor;
    ctx.lineWidth = 1 + pulse * 3; // Varies between 1 and 4 pixels for striking effect

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

    // Draw body based on style with inverted opacity for breathing effect
    if (drawFill) {
      // Fill the body with inverted opacity - darker when bright, lighter when dim
      // This creates a striking "breathing" effect
      const invertedOpacity = (1.2 - pulse * 0.5) * baseOpacity; // Peak opacity at 0.7, valley at 1.2
      ctx.globalAlpha = Math.min(1.0, invertedOpacity); // Cap at 1.0
      ctx.fillStyle = patternColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else if (drawOutline) {
      // Draw outline with dramatic pulsating width
      ctx.globalAlpha = (0.3 + 0.7 * pulse) * baseOpacity; // Strong variation
      ctx.strokeStyle = patternColor;
      ctx.lineWidth = 0.5 + pulse * 2.5; // Varies between 0.5 and 3 pixels
      ctx.strokeRect(candleX, bodyTop, candleWidth, bodyHeight);
    } else {
      // Fallback: draw filled with inverted opacity
      const invertedOpacity = (1.2 - pulse * 0.5) * baseOpacity;
      ctx.globalAlpha = Math.min(1.0, invertedOpacity);
      ctx.fillStyle = patternColor;
      ctx.fillRect(candleX, bodyTop, candleWidth, bodyHeight);
    }

    // Reset global alpha and shadow
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";

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
