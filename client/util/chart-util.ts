import {
  Granularity,
  granularityToMs,
  PriceRange,
} from "../../server/services/price-data/price-history-model";
import { formatPrice } from "./price-util";

export type Range = {
  start: number;
  end: number;
};

export const dpr = window.devicePixelRatio ?? 1;

export const timeToX =
  (availableWidth: number, timeRange: Range) => (timestamp: number) => {
    const timePosition =
      (timestamp - timeRange.start) / (timeRange.end - timeRange.start);
    return timePosition * availableWidth;
  };

export const priceToY =
  (availableHeight: number, priceRange: Range) => (price: number) => {
    const percentage =
      (price - priceRange.start) / (priceRange.end - priceRange.start);
    const y = (1 - percentage) * availableHeight;
    return y;
  };

export const priceToCanvasY =
  (canvas: HTMLCanvasElement, priceRange: PriceRange) =>
  (price: number): number =>
    priceToY(canvas.height, {
      start: priceRange.min,
      end: priceRange.max,
    })(price);

export function getGridInterval(granularity: Granularity): number {
  let interval = granularityToMs(granularity) * 10; // Default every 10th candle

  if (granularity === "ONE_HOUR") {
    interval = granularityToMs(granularity) * 12; // Every 12 hours
  } else if (granularity === "ONE_DAY") {
    interval = granularityToMs(granularity) * 2; // Every 2 days instead of 6
  }
  return interval;
}

export type TimelineIteratorProps = {
  granularity: Granularity;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  canvasWidth: number;
  callback: (x: number, timestamp: number) => void;
};

export function iterateTimeline({
  callback,
  granularity,
  viewportStartTimestamp,
  viewportEndTimestamp,
  canvasWidth,
}: TimelineIteratorProps): void {
  const granularityMs = granularityToMs(granularity);

  // Use fixed intervals based on granularity
  const interval =
    granularity === "ONE_HOUR"
      ? 12 * granularityMs // Every 12 hours
      : 2 * granularityMs; // Every 2 days for daily

  // Find the first timestamp aligned with interval
  const date = new Date(viewportStartTimestamp);
  const baseTimestamp =
    granularity === "ONE_HOUR"
      ? new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          Math.floor(date.getHours() / 12) * 12, // Align to 12-hour intervals
          0,
          0,
          0
        ).getTime()
      : new Date(
          date.getFullYear(),
          date.getMonth(),
          date.getDate(),
          0,
          0,
          0,
          0
        ).getTime();

  // Start from the first interval before viewport
  let firstTimestamp = baseTimestamp;
  while (firstTimestamp > viewportStartTimestamp - interval) {
    firstTimestamp -= interval;
  }

  for (
    let timestamp = firstTimestamp;
    timestamp <= viewportEndTimestamp + interval;
    timestamp += interval
  ) {
    const x = timeToX(canvasWidth, {
      start: viewportStartTimestamp,
      end: viewportEndTimestamp,
    })(timestamp);

    // Only draw if within visible area with some padding
    if (x >= -50 && x <= canvasWidth + 50) {
      callback(x, timestamp);
    }
  }
}

export function getFirstLabelTimestamp(
  startTimestamp: number,
  granularity: Granularity
) {
  const firstMidnight = new Date(startTimestamp).setHours(0, 0, 0, 0);
  const gridInterval = getGridInterval(granularity);
  const granularityMs = granularityToMs(granularity);

  return (
    (Array.from(
      {
        length: Math.ceil(gridInterval / granularityMs),
      },
      (_, i) => firstMidnight + i * granularityMs
    ).find((t) => t >= firstMidnight + gridInterval) ?? firstMidnight) -
    gridInterval
  );
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
  });
}

export function canvasYToPrice(
  y: number,
  canvas: HTMLCanvasElement,
  priceRange: PriceRange
): number {
  const availableHeight = canvas.height;
  // Invert the percentage calculation
  const percentage = 1 - y / availableHeight;
  // Convert percentage to price
  return priceRange.min + percentage * (priceRange.max - priceRange.min);
}

export function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  x: number,
  y: number,
  backgroundColor: string = "#333",
  textColor: string = "#fff",
  width: number = 100
) {
  // const dpr = window.devicePixelRatio ?? 1;
  ctx.font = `${10}px Arial`;

  const formattedPrice = formatPrice(price);
  const padding = 2 * dpr;

  const textMetrics = ctx.measureText(formattedPrice);
  const rectHeight =
    textMetrics.actualBoundingBoxAscent +
    textMetrics.actualBoundingBoxDescent +
    padding;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y - (rectHeight + padding) / 2, width, rectHeight + padding);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.fillStyle = textColor;
  const textX = x + textMetrics.width + padding;
  // const textX = x + width - padding / 2;
  ctx.fillText(formattedPrice, textX, y);
}

export function drawTimeLabel(
  ctx: CanvasRenderingContext2D,
  time: number,
  x: number,
  y: number,
  backgroundColor: string = "#eee",
  textColor: string = "#000"
) {
  const dpr = window.devicePixelRatio ?? 1;
  const timeText = formatTime(new Date(time));
  const padding = 6 * dpr;

  // Measure text
  const textMetrics = ctx.measureText(timeText);
  const rectWidth = textMetrics.width + padding;
  const rectHeight =
    textMetrics.actualBoundingBoxAscent +
    textMetrics.actualBoundingBoxDescent +
    padding;

  // Draw background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(
    x - rectWidth / 2, // Center the box on x
    y - rectHeight / 2,
    rectWidth,
    rectHeight
  );

  // Draw text
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = textColor;
  ctx.fillText(timeText, x, y);
}
