import {
  formatTime,
  getGridInterval,
  iterateTimeline,
  priceToY,
} from "../../util/chart-util";
import { getPriceStep } from "../../util/price-util";
import { DrawingContext, Drawable } from "./drawing-strategy";

export class HairlineGrid implements Drawable {
  private animationFrameId: number | null = null;

  public draw(context: DrawingContext): void {
    // Cancel any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    // Schedule the actual drawing
    this.animationFrameId = requestAnimationFrame(() => {
      this.drawGrid(context);
    });
  }

  private drawGrid(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      priceRange,
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    const priceY = priceToY(canvas.height, {
      start: priceRange.min,
      end: priceRange.max,
    });

    ctx.strokeStyle = "#ddd";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = "#999";
    ctx.textAlign = "center";

    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        // Only draw if the line is within the visible area
        if (x >= 0 && x <= canvas.width) {
          // Draw grid line
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height / dpr);
          ctx.stroke();

          // Draw time label at the top of grid line
          ctx.fillText(formatTime(new Date(timestamp)), x, 10);
        }
      },
      granularity: data.getGranularity(),
      viewportStartTimestamp,
      viewportEndTimestamp,
      canvasWidth: canvas.width / dpr,
      interval: getGridInterval(data.getGranularity()),
      alignToLocalTime: true,
    });

    // Draw horizontal lines for price levels
    const priceStep = getPriceStep(priceRange.range);
    const firstPriceGridLine =
      Math.floor(priceRange.min / priceStep) * priceStep;

    for (
      let price = firstPriceGridLine;
      price <= priceRange.max + priceStep;
      price += priceStep
    ) {
      const y = priceY(price);

      if (y >= 0 && y <= canvas.height / dpr) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / dpr, y);
        ctx.stroke();
      }
    }
  }

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
}
