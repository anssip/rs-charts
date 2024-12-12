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
  const interval = granularityToMs(granularity);

  // For SIX_HOUR, align to local time boundaries
  let firstTimestamp = Math.floor(viewportStartTimestamp / interval) * interval;
  if (granularity === "SIX_HOUR") {
    firstTimestamp = getLocalAlignedTimestamp(viewportStartTimestamp, 6);
    // Ensure we start before viewport
    while (firstTimestamp > viewportStartTimestamp - interval) {
      firstTimestamp -= interval;
    }
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

    callback(x, timestamp);
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

/*
  Aligns a timestamp to the local time boundaries for a given interval

  Especially useful for SIX_HOUR, where we want to align to the local time boundaries.

  wondering why we only have this problem with 6 hour candles?

  The issue is specific to 6-hour candles because of how they align with UTC time. Let's break it down:
  For most granularities, the alignment is simpler:

  - ONE_MINUTE to ONE_HOUR: These are natural divisions of an hour
  - TWO_HOUR: Aligns nicely with even hours (0, 2, 4, 6, 8, 10...)
  - ONE_DAY: Aligns with midnight UTC

  But SIX_HOUR is special because:
  The candles are fixed at UTC times: 00:00, 06:00, 12:00, 18:00

  When viewing in different timezones, these UTC times translate to odd local times

  For example, in UTC-5:
    UTC 00:00 → Local 19:00 (previous day)
    UTC 06:00 → Local 01:00
    UTC 12:00 → Local 07:00
    UTC 18:00 → Local 13:00

  Other granularities don't have this issue because:
  Hourly candles are frequent enough that timezone offset doesn't matter much
  Daily candles always align with UTC midnight, which is a clear boundary
  But 6-hour candles are in this awkward middle ground where:
  They're infrequent enough that timezone matters
  But frequent enough that we want them aligned with local time for readability
  This is why we needed the special handling with getLocalAlignedTimestamp and 
  candlesSinceMidnight calculations specifically for the SIX_HOUR case.
*/
export function getLocalAlignedTimestamp(
  timestamp: number,
  intervalHours: number
): number {
  const date = new Date(timestamp);
  const offsetHours = date.getTimezoneOffset() / 60;

  // Adjust timestamp to local time boundaries
  const localHours = date.getUTCHours() - offsetHours;
  const alignedHours = Math.floor(localHours / intervalHours) * intervalHours;

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      alignedHours + offsetHours
    )
  ).getTime();
}
