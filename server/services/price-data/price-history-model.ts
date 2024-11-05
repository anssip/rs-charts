export type Granularity =
  | "ONE_MINUTE"
  | "FIVE_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "TWO_HOUR"
  | "SIX_HOUR"
  | "ONE_DAY";

export interface CandleData {
  granularity: Granularity;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export type CandleDataByTimestamp = Map<number, CandleData>;

export interface PriceDataOptions {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "30m" | "1h" | "2h" | "6h" | "1d";
  start: Date;
  end: Date;
}

export interface PriceHistory {
  getGranularity(): Granularity;
  getCandle(timestamp: number): CandleData | undefined;
  isCandleAvailable(timestamp: number): boolean;
}

export class SimplePriceHistory implements PriceHistory {
  private granularity: Granularity;
  private candles: CandleDataByTimestamp;

  private static readonly GRANULARITY_TO_MS = new Map([
    ["ONE_MINUTE", 60 * 1000],
    ["FIVE_MINUTE", 5 * 60 * 1000],
    ["FIFTEEN_MINUTE", 15 * 60 * 1000],
    ["THIRTY_MINUTE", 30 * 60 * 1000],
    ["ONE_HOUR", 60 * 60 * 1000],
    ["TWO_HOUR", 2 * 60 * 60 * 1000],
    ["SIX_HOUR", 6 * 60 * 60 * 1000],
    ["ONE_DAY", 24 * 60 * 60 * 1000],
  ]);
  private candlesSortedByTimestamp: [number, CandleData][];

  constructor(granularity: Granularity, candles: CandleDataByTimestamp) {
    this.granularity = granularity;
    this.candles = candles;
    // Convert map entries to sorted array for binary search
    this.candlesSortedByTimestamp = Array.from(this.candles.entries()).sort(
      ([a], [b]) => a - b
    );
  }

  getCandle(timestamp: number): CandleData | undefined {
    const intervalMs =
      SimplePriceHistory.GRANULARITY_TO_MS.get(this.granularity) ??
      60 * 60 * 1000;

    let left = 0;
    let right = this.candlesSortedByTimestamp.length - 1;
    let closestIndex = -1;
    let minDiff = Infinity;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const [candleTime] = this.candlesSortedByTimestamp[mid];
      const diff = Math.abs(candleTime - timestamp);

      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = mid;
      }

      if (candleTime === timestamp) {
        break;
      } else if (candleTime < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return minDiff < intervalMs
      ? this.candlesSortedByTimestamp[closestIndex][1]
      : undefined;
  }

  getGranularity(): Granularity {
    return this.granularity;
  }

  isCandleAvailable(timestamp: number): boolean {
    return this.getCandle(timestamp) !== undefined;
  }
}
