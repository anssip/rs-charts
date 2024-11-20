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
