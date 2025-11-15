import { RiskZone, TRADING_OVERLAY_COLORS } from "../../types/trading-overlays";
import { ViewportTransform } from "./interaction/interaction-layer";
import { getLogger } from "../../util/logger";

const logger = getLogger("RiskZonesRenderer");

/**
 * Renderer for risk zones on canvas
 * Handles pattern creation, drawing, and position calculations
 */
export class RiskZonesRenderer {
  private patternCache: Map<string, CanvasPattern | null> = new Map();

  /**
   * Draw a single risk zone on the canvas
   */
  drawRiskZone(
    ctx: CanvasRenderingContext2D,
    zone: RiskZone,
    transform: ViewportTransform
  ): void {
    const { startPrice, endPrice, color, opacity, pattern, borderColor, borderWidth, label } = zone;

    // Calculate pixel coordinates
    const y1 = this.priceToCanvasY(startPrice, transform);
    const y2 = this.priceToCanvasY(endPrice, transform);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    const height = maxY - minY;

    // Determine X boundaries based on extend flags
    const x = zone.extendLeft ? 0 : 0; // Always extend for now
    const width = zone.extendRight ? transform.canvasWidth * transform.dpr : transform.canvasWidth * transform.dpr;

    // Save context state
    ctx.save();

    // Draw fill
    this.drawZoneFill(ctx, x, minY, width, height, color, opacity, pattern);

    // Draw border
    if (borderWidth > 0 && borderColor) {
      this.drawZoneBorder(ctx, x, minY, width, height, borderColor, borderWidth);
    }

    // Draw label if present
    if (label) {
      this.drawZoneLabel(ctx, x, minY, width, height, label, color);
    }

    // Restore context state
    ctx.restore();
  }

  /**
   * Draw zone fill with pattern support
   */
  private drawZoneFill(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    opacity: number,
    pattern: 'solid' | 'striped' | 'dotted'
  ): void {
    ctx.globalAlpha = opacity;

    if (pattern === 'solid') {
      // Simple solid fill
      ctx.fillStyle = color;
      ctx.fillRect(x, y, width, height);
    } else if (pattern === 'striped') {
      // Striped pattern
      const stripePattern = this.createStripedPattern(ctx, color, opacity);
      if (stripePattern) {
        ctx.fillStyle = stripePattern;
        ctx.globalAlpha = 1; // Pattern already has opacity baked in
        ctx.fillRect(x, y, width, height);
      }
    } else if (pattern === 'dotted') {
      // Dotted pattern
      const dottedPattern = this.createDottedPattern(ctx, color, opacity);
      if (dottedPattern) {
        ctx.fillStyle = dottedPattern;
        ctx.globalAlpha = 1; // Pattern already has opacity baked in
        ctx.fillRect(x, y, width, height);
      }
    }

    ctx.globalAlpha = 1; // Reset alpha
  }

  /**
   * Draw zone border
   */
  private drawZoneBorder(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    color: string,
    lineWidth: number
  ): void {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw zone label
   */
  private drawZoneLabel(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    labelText: string,
    color: string
  ): void {
    // Position label in center of zone
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Set text style
    ctx.font = '12px sans-serif';
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.8;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure text for background
    const metrics = ctx.measureText(labelText);
    const textWidth = metrics.width;
    const textHeight = 16;

    // Draw semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(
      centerX - textWidth / 2 - 4,
      centerY - textHeight / 2 - 2,
      textWidth + 8,
      textHeight + 4
    );

    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 1;
    ctx.fillText(labelText, centerX, centerY);
  }

  /**
   * Create striped pattern
   */
  private createStripedPattern(
    ctx: CanvasRenderingContext2D,
    color: string,
    opacity: number
  ): CanvasPattern | null {
    const cacheKey = `striped-${color}-${opacity}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey) || null;
    }

    // Create pattern canvas
    const patternCanvas = document.createElement('canvas');
    const size = 10;
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return null;

    // Draw diagonal stripes
    pctx.strokeStyle = color;
    pctx.globalAlpha = opacity;
    pctx.lineWidth = 2;

    // Draw multiple lines for complete coverage
    pctx.beginPath();
    pctx.moveTo(0, size);
    pctx.lineTo(size, 0);
    pctx.stroke();

    pctx.beginPath();
    pctx.moveTo(-5, size + 5);
    pctx.lineTo(size + 5, -5);
    pctx.stroke();

    // Create pattern
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    this.patternCache.set(cacheKey, pattern);
    return pattern;
  }

  /**
   * Create dotted pattern
   */
  private createDottedPattern(
    ctx: CanvasRenderingContext2D,
    color: string,
    opacity: number
  ): CanvasPattern | null {
    const cacheKey = `dotted-${color}-${opacity}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey) || null;
    }

    // Create pattern canvas
    const patternCanvas = document.createElement('canvas');
    const size = 8;
    patternCanvas.width = size;
    patternCanvas.height = size;
    const pctx = patternCanvas.getContext('2d');
    if (!pctx) return null;

    // Draw dots
    pctx.fillStyle = color;
    pctx.globalAlpha = opacity;
    pctx.beginPath();
    pctx.arc(size / 2, size / 2, 1.5, 0, Math.PI * 2);
    pctx.fill();

    // Create pattern
    const pattern = ctx.createPattern(patternCanvas, 'repeat');
    this.patternCache.set(cacheKey, pattern);
    return pattern;
  }

  /**
   * Convert price to canvas Y coordinate
   */
  private priceToCanvasY(price: number, transform: ViewportTransform): number {
    const { priceRange, canvasHeight, dpr } = transform;
    const range = priceRange.max - priceRange.min;
    const ratio = (priceRange.max - price) / range;
    return ratio * canvasHeight * dpr;
  }

  /**
   * Check if a point is within a zone's boundaries
   * Used for hit testing
   */
  isPointInZone(
    x: number,
    y: number,
    zone: RiskZone,
    transform: ViewportTransform
  ): boolean {
    const y1 = this.priceToCanvasY(zone.startPrice, transform);
    const y2 = this.priceToCanvasY(zone.endPrice, transform);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);

    // Check Y coordinate (price range)
    if (y < minY || y > maxY) {
      return false;
    }

    // Check X coordinate if not extending
    const xMin = zone.extendLeft ? 0 : 0; // Always extend for now
    const xMax = zone.extendRight ? transform.canvasWidth * transform.dpr : transform.canvasWidth * transform.dpr;

    return x >= xMin && x <= xMax;
  }

  /**
   * Clear pattern cache
   */
  clearCache(): void {
    this.patternCache.clear();
  }

  /**
   * Get visible zones within the current viewport
   */
  getVisibleZones(zones: RiskZone[], transform: ViewportTransform): RiskZone[] {
    const { priceRange } = transform;

    return zones.filter(zone => {
      // Check if zone's price range overlaps with viewport price range
      const zoneMin = Math.min(zone.startPrice, zone.endPrice);
      const zoneMax = Math.max(zone.startPrice, zone.endPrice);

      // Zone is visible if it overlaps with the viewport price range
      return !(zoneMax < priceRange.min || zoneMin > priceRange.max);
    }).sort((a, b) => {
      // Sort by z-index (lower z-index drawn first, so they appear behind)
      return a.zIndex - b.zIndex;
    });
  }
}
