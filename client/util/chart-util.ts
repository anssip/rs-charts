import { PriceHistory, PriceRange } from "../../server/services/price-data/price-history-model";

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
  // Use same grid interval calculation as grid component
  let interval = data.granularityMs * 10; // Default every 10th candle
  if (data.granularityMs === 60 * 60 * 1000) {
    // Hourly
    interval = data.granularityMs * 12; // Every 12 hours
  } else if (data.granularityMs === 30 * 24 * 60 * 60 * 1000) {
    // Monthly
    interval = data.granularityMs * 6; // Every 6 months
  }
  return interval;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}
