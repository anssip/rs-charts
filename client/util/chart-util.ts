import { PriceRange } from "../../server/services/price-data/price-history-model";
import { DrawingContext } from "../components/chart/drawing-strategy";

export type Range = {
  start: number;
  end: number;
};

export const dpr = window.devicePixelRatio ?? 1;

export const timeToX =
  (availableWidth: number, timeRange: Range) => (timestamp: number) => {
    const timePosition =
      (timestamp - timeRange.start) / (timeRange.end - timeRange.start);
    return timePosition * availableWidth * dpr;
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
  const dpr = window.devicePixelRatio ?? 1;
  const availableHeight = canvas.height;
  const percentage =
    (price - priceRange.min) / (priceRange.max - priceRange.min);
  const y = (1 - percentage) * availableHeight;
  return y * dpr;
}

export function calculateXForTime(
  timestamp: number,
  context: DrawingContext
): number {
  const {
    chartCanvas: canvas,
    viewportStartTimestamp,
    viewportEndTimestamp,
  } = context;
  const availableWidth = canvas.width;
  const timeRange = Math.max(viewportEndTimestamp - viewportStartTimestamp, 1);
  const timePosition = (timestamp - viewportStartTimestamp) / timeRange;
  return timePosition * availableWidth;
}
