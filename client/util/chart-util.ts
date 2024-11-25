import {
  PriceHistory,
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
    return y * dpr;
  };

export function priceToCanvasY(
  price: number,
  canvas: HTMLCanvasElement,
  priceRange: PriceRange
): number {
  const availableHeight = canvas.height;
  const percentage =
    (price - priceRange.min) / (priceRange.max - priceRange.min);
  const y = (1 - percentage) * availableHeight;
  return y * dpr;
}

export function getGridInterval(data: PriceHistory): number {
  let interval = data.granularityMs * 10; // Default every 10th candle

  if (data.getGranularity() === "ONE_HOUR") {
    interval = data.granularityMs * 12; // Every 12 hours
  } else if (data.getGranularity() === "ONE_DAY") {
    // Monthly
    interval = data.granularityMs * 6; // Every 6 months
  }
  return interval;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function canvasYToPrice(
  y: number,
  canvas: HTMLCanvasElement,
  priceRange: PriceRange
): number {
  const availableHeight = canvas.height;
  // First remove DPR scaling
  const logicalY = y / dpr;
  // Invert the percentage calculation
  const percentage = 1 - logicalY / availableHeight;
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
  const dpr = window.devicePixelRatio ?? 1;
  const formattedPrice = formatPrice(price);
  const padding = 6 * dpr;

  const textMetrics = ctx.measureText(formattedPrice);
  const rectHeight =
    textMetrics.actualBoundingBoxAscent +
    textMetrics.actualBoundingBoxDescent +
    padding;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(x, y - rectHeight / 2, width, rectHeight);

  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  ctx.fillStyle = textColor;
  const textX = x + width - padding / 2;
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
