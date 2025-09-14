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
    priceToY(canvas.height / dpr, {
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
  interval?: number;
  alignToLocalTime?: boolean;
};

export function iterateTimeline({
  callback,
  granularity,
  viewportStartTimestamp,
  viewportEndTimestamp,
  canvasWidth,
  interval: intervalProp,
  alignToLocalTime = true,
}: TimelineIteratorProps): void {
  const interval = intervalProp ?? granularityToMs(granularity);

  // Calculate exact x positions based on time proportion
  const timeToX = (timestamp: number) => {
    const timePosition =
      (timestamp - viewportStartTimestamp) /
      (viewportEndTimestamp - viewportStartTimestamp);
    return timePosition * canvasWidth;
  };

  let firstTimestamp = Math.floor(viewportStartTimestamp / interval) * interval;

  // Always align SIX_HOUR granularity, regardless of alignToLocalTime
  if (granularity === "SIX_HOUR" || alignToLocalTime) {
    firstTimestamp = getLocalAlignedTimestamp(
      viewportStartTimestamp,
      granularity === "SIX_HOUR" ? 6 : interval / (60 * 60 * 1000)
    );
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
    const ts =
      granularity === "SIX_HOUR" || alignToLocalTime
        ? getLocalAlignedTimestamp(
            timestamp,
            granularity === "SIX_HOUR" ? 6 : interval / (60 * 60 * 1000)
          )
        : timestamp;
    const x = timeToX(ts);
    callback(x, ts);
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

export function formatDateTime(date: Date): string {
  const dateStr = date.toLocaleDateString([], {
    month: "numeric",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  return `${dateStr} ${timeStr}`;
}

export function canvasYToPrice(
  y: number,
  canvas: HTMLCanvasElement,
  priceRange: PriceRange
): number {
  const availableHeight = canvas.height / dpr;
  // Invert the percentage calculation
  const percentage = 1 - y / availableHeight;
  // Convert percentage to price
  return priceRange.min + percentage * (priceRange.max - priceRange.min);
}

export function yToPrice(
  y: number,
  height: number,
  priceRange: PriceRange
): number {
  const availableHeight = height / dpr;
  // Invert the percentage calculation
  const percentage = 1 - y / availableHeight;
  // Convert percentage to price
  return priceRange.min + percentage * (priceRange.max - priceRange.min);
}

export type PriceLabelOptions = {
  price: number;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  width: number;
  height: number;
};

export function drawTimeLabel(
  ctx: CanvasRenderingContext2D,
  time: number,
  x: number,
  y: number,
  backgroundColor: string = "#eee",
  textColor: string = "#000",
  showFullDateTime: boolean = false
) {
  const dpr = window.devicePixelRatio ?? 1;
  const timeText = showFullDateTime
    ? formatDateTime(new Date(time))
    : formatTime(new Date(time));
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

export function drawPriceLabel(
  ctx: CanvasRenderingContext2D,
  price: number,
  y: number,
  labelWidth: number
) {
  // Draw price label
  const textColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-accent-2")
    .trim();
  const backgroundColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary-dark")
    .trim();
  const borderColor = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-primary")
    .trim();

  // Set font
  const fontFamily = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-primary")
    .trim();
  ctx.font = `${10}px ${fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Draw price label
  const labelHeight = 20;
  const labelX = ctx.canvas.width / dpr - labelWidth;
  const labelY = y;

  // Draw background
  const cornerRadius = 4;
  ctx.beginPath();
  ctx.roundRect(
    labelX,
    labelY - labelHeight / 2,
    labelWidth,
    labelHeight,
    cornerRadius
  );
  ctx.fillStyle = backgroundColor;
  ctx.fill();

  // Draw border
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Draw text
  ctx.fillStyle = textColor;
  ctx.fillText(formatPrice(price), labelX + labelWidth / 2, labelY);
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

type TimelineMarks = {
  tickMark: boolean;
  dateChange: boolean;
};

export function getTimelineMarks(
  date: Date,
  granularity: string
): TimelineMarks {
  let tickMark = false;
  let dateChange = false;

  // Convert UTC timestamp to local time for checking
  const localDate = new Date(date.getTime());

  if (
    granularity !== "ONE_DAY" &&
    localDate.getHours() === 0 &&
    localDate.getMinutes() === 0
  ) {
    dateChange = true;
  }

  switch (granularity) {
    case "ONE_MINUTE":
      tickMark = localDate.getMinutes() % 15 === 0; // Every 15 minutes
      break;
    case "FIVE_MINUTE":
      tickMark = localDate.getMinutes() % 30 === 0; // Every 30 minutes
      break;
    case "FIFTEEN_MINUTE":
      tickMark = localDate.getMinutes() === 0; // Every hour
      break;
    case "THIRTY_MINUTE":
      tickMark = localDate.getHours() % 4 === 0 && localDate.getMinutes() === 0; // Every 4th hour
      break;
    case "ONE_HOUR":
      tickMark = localDate.getHours() % 12 === 0; // Every 12 hours
      break;
    case "TWO_HOUR":
      tickMark = localDate.getHours() % 12 === 0; // Every 12 hours
      break;
    case "SIX_HOUR":
      const alignedTimestamp = getLocalAlignedTimestamp(date.getTime(), 6);

      const candlesSinceMidnight = Math.floor(
        (date.getTime() - getLocalAlignedTimestamp(date.getTime(), 24)) /
          (6 * 60 * 60 * 1000)
      );

      // Rvery 4th candle starting from midnight
      tickMark =
        candlesSinceMidnight % 4 === 0 && alignedTimestamp === date.getTime();

      // Date change at midnight
      dateChange =
        candlesSinceMidnight === 0 && alignedTimestamp === date.getTime();
      break;
    case "ONE_DAY":
      // no tick marks
      tickMark = false;
      // date change every 4th day
      dateChange = localDate.getDate() % 4 === 0;
      break;
    default:
      // Default to 12 hours
      tickMark = localDate.getHours() % 12 === 0;
  }
  return { tickMark, dateChange };
}

export function getCandleInterval(granularity: Granularity): number {
  return granularityToMs(granularity);
}
