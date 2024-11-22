import { formatTime, getGridInterval, priceToY } from "../../util/chart-util";
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
      axisMappings: { timeToX },
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    const priceY = priceToY(canvas.height, {
      start: priceRange.min,
      end: priceRange.max,
    });
    const gridInterval = getGridInterval(data);
    const firstGridTimestamp =
      Math.floor(context.viewportStartTimestamp / gridInterval) * gridInterval;

    ctx.strokeStyle = "#ddd";
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1;

    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = "#999";
    ctx.textAlign = "center";

    // Draw vertical lines until we exceed viewport end
    for (
      let timestamp = firstGridTimestamp;
      timestamp <= context.viewportEndTimestamp + gridInterval; // Add one extra interval to handle partial visibility
      timestamp += gridInterval
    ) {
      const x = timeToX(timestamp) / dpr;

      // Only draw if the line is within the visible area
      if (x >= 0 && x <= canvas.width / dpr) {
        // Draw grid line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height / dpr);
        ctx.stroke();

        // draw time label at the top of grid line
        ctx.fillText(formatTime(new Date(timestamp)), x, 10);
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
      const y = priceY(price);

      if (y >= 0 && y <= canvas.height / dpr) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width / dpr, y);
        ctx.stroke();
      }
    }
  }
}
