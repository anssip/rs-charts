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
    } else if (gridStyle === GridStyle.MACD) {
      // For MACD, emphasize the zero line and create adaptive grid

      // Use the actual visible range rather than the absolute values
      const visibleRange = priceRange.range;

      // Target having approximately 5-7 grid lines in the visible area
      const targetLines = 5;
      let step = visibleRange / targetLines;

      // Round the step to a nice number for readability
      if (step > 10) {
        step = Math.ceil(step / 10) * 10;
      } else if (step > 5) {
        step = Math.ceil(step / 5) * 5;
      } else if (step > 1) {
        step = Math.ceil(step);
      } else if (step > 0.5) {
        step = 0.5;
      } else if (step > 0.25) {
        step = 0.25;
      } else if (step > 0.1) {
        step = 0.1;
      } else {
        step = 0.05;
      }

      // Find the first grid line below the visible area
      const firstLevel = Math.floor(priceRange.min / step) * step;

      // Create array of grid levels within and slightly beyond the visible range
      let levels = [];

      // Add levels from bottom to top
      for (
        let level = firstLevel;
        level <= priceRange.max + step / 2;
        level += step
      ) {
        levels.push(level);
      }

      // Always include zero if it's reasonably close to the visible range
      if (
        !levels.includes(0) &&
        (Math.abs(priceRange.min) < visibleRange * 2 ||
          Math.abs(priceRange.max) < visibleRange * 2)
      ) {
        levels.push(0);
        // Sort levels to maintain proper order
        levels.sort((a, b) => a - b);
      }

      // Draw each level
      for (const level of levels) {
        if (
          level >= priceRange.min - step / 2 &&
          level <= priceRange.max + step / 2
        ) {
          const y = priceY(level);

          if (Math.abs(level) < 0.0001) {
            // Check if level is essentially zero
            // Special styling for zero line
            ctx.strokeStyle = "#BB86FC"; // Accent color
            ctx.lineWidth = 1;

            // Draw dashed zero line with more prominent pattern
            ctx.setLineDash([3, 3]);
          } else if (level > 0) {
            ctx.strokeStyle = "rgba(76, 175, 80, 0.35)"; // Green with transparency
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
          } else {
            ctx.strokeStyle = "rgba(244, 67, 54, 0.35)"; // Red with transparency
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
          }

          ctx.beginPath();
          // Draw the line at precise pixel boundary
          const yPixel = Math.floor(y) + 0.5;
          ctx.moveTo(0, yPixel);
          ctx.lineTo(canvas.width / dpr, yPixel);
          ctx.stroke();
        }
      }

      // Reset line dash
      ctx.setLineDash([]);
    } else if (gridStyle === GridStyle.ATR) {
      // For ATR, create an adaptive grid with proper distribution
      const visibleRange = priceRange.range;

      // Target having approximately 4-6 grid lines in the visible area
      const targetLines = 5;
      let step = visibleRange / targetLines;

      // Round the step to a nice number for readability
      if (step > 10) {
        step = Math.ceil(step / 10) * 10;
      } else if (step > 5) {
        step = Math.ceil(step / 5) * 5;
      } else if (step > 1) {
        step = Math.ceil(step);
      } else if (step > 0.5) {
        step = 0.5;
      } else if (step > 0.25) {
        step = 0.25;
      } else if (step > 0.1) {
        step = 0.1;
      } else {
        step = 0.05;
      }

      // Find the first grid line at or below the min visible value
      const firstLevel = Math.floor(priceRange.min / step) * step;

      // Create array of grid levels across the visible range
      let levels = [];
      // Add levels from bottom to top
      for (
        let level = firstLevel;
        level <= priceRange.max + step / 2;
        level += step
      ) {
        levels.push(level);
      }

      // Draw each level
      for (const level of levels) {
        if (
          level >= priceRange.min - step / 2 &&
          level <= priceRange.max + step / 2
        ) {
          const y = priceY(level);

          ctx.strokeStyle = `rgba(${gridColor}, 0.5)`;
          ctx.lineWidth = 0.5;
          ctx.setLineDash([3, 3]);

          ctx.beginPath();
          // Draw the line at precise pixel boundary
          const yPixel = Math.floor(y) + 0.5;
          ctx.moveTo(0, yPixel);
          ctx.lineTo(canvas.width / dpr, yPixel);
          ctx.stroke();
        }
      }

      // Reset line dash
      ctx.setLineDash([]);
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
