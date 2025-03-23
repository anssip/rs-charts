import {
  iterateTimeline,
  priceToY,
  getTimelineMarks,
} from "../../util/chart-util";
import { getPriceStep } from "../../util/price-util";
import { DrawingContext, Drawable } from "./drawing-strategy";
import { GridStyle } from "./indicators/indicator-types";

export class HairlineGrid implements Drawable {
  public draw(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      priceRange,
      viewportStartTimestamp,
      viewportEndTimestamp,
      gridStyle = GridStyle.Standard, // Default to standard grid if not specified
    } = context;
    const dpr = window.devicePixelRatio ?? 1;

    const priceY = priceToY(canvas.height, {
      start: priceRange.min,
      end: priceRange.max,
    });

    const gridColor = getComputedStyle(document.documentElement)
      .getPropertyValue("--color-background-secondary-rgb")
      .trim();

    ctx.strokeStyle = `rgba(${gridColor}, 0.5)`;
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

    // Use the gridStyle configuration to determine how to draw horizontal grid lines
    if (gridStyle === GridStyle.Stochastic) {
      // Draw stochastic grid with lines at 0, 20, 50, 80, 100
      const stochasticLevels = [0, 20, 50, 80, 100];

      for (const level of stochasticLevels) {
        // Use the same priceY function for consistent positioning
        const y = priceY(level);

        if (y >= 0 && y <= canvas.height / dpr) {
          // Use different styles for oversold/overbought levels
          if (level === 20 || level === 80) {
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = `rgba(${gridColor}, 0.9)`;
          } else {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = `rgba(${gridColor}, 0.5)`;
          }

          ctx.beginPath();
          // Important: Draw exactly at integer pixel position to avoid blurry lines
          const yPixel = Math.floor(y) + 0.5;
          ctx.moveTo(0, yPixel);
          ctx.lineTo(canvas.width / dpr, yPixel);
          ctx.stroke();
        }
      }
    } else if (gridStyle === GridStyle.RSI) {
      // Draw RSI grid with lines at 0, 30, 50, 70, 100
      const rsiLevels = [0, 30, 50, 70, 100];

      for (const level of rsiLevels) {
        // Use the same priceY function for consistent positioning
        const y = priceY(level);

        if (y >= 0 && y <= canvas.height / dpr) {
          // Use different styles for oversold/overbought levels
          if (level === 30 || level === 70) {
            ctx.setLineDash([5, 3]);
            ctx.strokeStyle = `rgba(${gridColor}, 0.9)`;
          } else {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = `rgba(${gridColor}, 0.5)`;
          }

          ctx.beginPath();
          // Important: Draw exactly at integer pixel position to avoid blurry lines
          const yPixel = Math.floor(y) + 0.5;
          ctx.moveTo(0, yPixel);
          ctx.lineTo(canvas.width / dpr, yPixel);
          ctx.stroke();
        }
      }
    } else {
      // Standard grid - evenly spaced lines
      const numLabels = 5;
      const step = priceRange.range / (numLabels - 1);

      for (let i = 0; i < numLabels; i++) {
        const price = priceRange.max - i * step;
        // Use the same priceY function for consistent positioning
        const y = priceY(price);

        if (y >= 0 && y <= canvas.height / dpr) {
          ctx.beginPath();
          // Important: Draw exactly at integer pixel position to avoid blurry lines
          const yPixel = Math.floor(y) + 0.5;
          ctx.moveTo(0, yPixel);
          ctx.lineTo(canvas.width / dpr, yPixel);
          ctx.stroke();
        }
      }
    }
  }

  public destroy(): void {
    // No cleanup needed
  }
}
