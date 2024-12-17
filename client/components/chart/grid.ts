import {
  iterateTimeline,
  priceToY,
  getTimelineMarks,
} from "../../util/chart-util";
import { getPriceStep } from "../../util/price-util";
import { DrawingContext, Drawable } from "./drawing-strategy";

export class HairlineGrid implements Drawable {
  public draw(context: DrawingContext): void {
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

    ctx.strokeStyle = "rgba(180, 180, 180, 1)";
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 0.5;

    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        const { tickMark: tickkMark, dateChange } = getTimelineMarks(
          new Date(timestamp),
          data.getGranularity()
        );
        const doDraw =
          data.getGranularity() === "ONE_DAY" ? dateChange : tickkMark;

        if (doDraw && x >= 0 && x <= canvas.width) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height / dpr);
          ctx.stroke();
        }
      },
      granularity: data.getGranularity(),
      viewportStartTimestamp,
      viewportEndTimestamp,
      canvasWidth: canvas.width / dpr,
    });

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
    // No cleanup needed
  }
}
