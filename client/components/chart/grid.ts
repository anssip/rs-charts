import { getPriceStep } from "../../util/price-util";
import { DrawingContext, Drawable } from "./drawing-strategy";

export class HairlineGrid implements Drawable {
  // TODO: make this zoomable
  public draw(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      priceRange,
      axisMappings: { timeToX, priceToY },
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    // Set grid style
    ctx.strokeStyle = "#ddd";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    // Calculate grid interval based on granularity
    let gridInterval = data.granularityMs * 10; // Default every 10th candle
    if (data.granularityMs === 60 * 60 * 1000) {
      // Hourly
      gridInterval = data.granularityMs * 12; // Every 12 hours
    } else if (data.granularityMs === 30 * 24 * 60 * 60 * 1000) {
      // Monthly
      gridInterval = data.granularityMs * 6; // Every 6 months
    }

    // Find the first grid line timestamp before viewport start
    const firstGridTimestamp =
      Math.floor(context.viewportStartTimestamp / gridInterval) * gridInterval;

    // Draw vertical lines until we exceed viewport end
    for (
      let timestamp = firstGridTimestamp;
      timestamp <= context.viewportEndTimestamp + gridInterval; // Add one extra interval to handle partial visibility
      timestamp += gridInterval
    ) {
      const x = timeToX(timestamp) / dpr;

      // Only draw if the line is within the visible area
      if (x >= 0 && x <= canvas.width / dpr) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / dpr);
        ctx.stroke();
      }
    }

    // Draw horizontal lines for every 10% price change
    const priceStep = getPriceStep(priceRange.range);
    const firstPriceGridLine =
      Math.floor(priceRange.min / priceStep) * priceStep;

    for (
      let price = firstPriceGridLine;
      price <= priceRange.max + priceStep;
      price += priceStep
    ) {
      const y = priceToY(price) / dpr;

      if (y >= 0 && y <= canvas.height / dpr) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / dpr, y);
        ctx.stroke();
      }
    }
  }
}
