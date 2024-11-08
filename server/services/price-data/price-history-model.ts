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
  getCandlesSorted(): [number, CandleData][];
  getCandles(): CandleDataByTimestamp;
  getTimestampsSorted(): number[];
  numCandles: number;
  startTimestamp: number;
  endTimestamp: number;
  length: number;
  getCandlesInRange(
    startTimestamp: number,
    endTimestamp: number
  ): [number, CandleData][];
  findNearestCandleIndex(timestamp: number): number;
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
      ([timestampA], [timestampB]) => timestampA - timestampB
    );
  }

  /**
   * Get the closest candle to the given timestamp.
   * @param timestamp - The timestamp to search for.
   * @returns The closest candle or undefined if no candle is found within the interval.
   */
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

  /**
   * Get the granularity of the price history.
   * @returns The granularity.
   */
  getGranularity(): Granularity {
    return this.granularity;
  }

  /**
   * Check if a candle is available for the given timestamp.
   * @param timestamp - The timestamp to check.
   * @returns True if a candle is available, false otherwise.
   */
  isCandleAvailable(timestamp: number): boolean {
    return this.getCandle(timestamp) !== undefined;
  }

  /**
   * Get the candles sorted by timestamp.
   * @returns The candles sorted by timestamp.
   */
  getCandlesSorted(): [number, CandleData][] {
    return this.candlesSortedByTimestamp;
  }

  /**
   * Get the timestamps sorted.
   * @returns The timestamps sorted.
   */
  getTimestampsSorted(): number[] {
    return this.candlesSortedByTimestamp.map(([timestamp]) => timestamp);
  }

  /**
   * Get the number of candles.
   * @returns The number of candles.
   */
  get numCandles(): number {
    return this.candlesSortedByTimestamp.length;
  }

  /**
   * Get the start timestamp.
   * @returns The start timestamp.
   */
  get startTimestamp(): number {
    return this.candlesSortedByTimestamp[0][0];
  }

  /**
   * Get the end timestamp.
   * @returns The end timestamp.
   */
  get endTimestamp(): number {
    return this.candlesSortedByTimestamp[
      this.candlesSortedByTimestamp.length - 1
    ][0];
  }

  /**
   * Get the length of the price history.
   * @returns The length of the price history.
   */
  get length(): number {
    return this.candlesSortedByTimestamp.length;
  }

  /**
   * Get the candles.
   * @returns The candles.
   */
  getCandles(): CandleDataByTimestamp {
    return this.candles;
  }

  /**
   * Get all candles within a specified time range, inclusive
   * @param startTimestamp - Start of the range
   * @param endTimestamp - End of the range
   * @returns Array of timestamp-candle pairs within the range
   */
  getCandlesInRange(
    startTimestamp: number,
    endTimestamp: number
  ): [number, CandleData][] {
    const startIdx = this.findNearestCandleIndex(startTimestamp);
    const endIdx = this.findNearestCandleIndex(endTimestamp);

    return this.candlesSortedByTimestamp.slice(
      Math.max(0, startIdx),
      Math.min(endIdx + 1, this.candlesSortedByTimestamp.length)
    );
  }

  /**
   * Find the index of the nearest candle to the given timestamp using binary search
   * @param timestamp - The target timestamp
   * @returns The index of the nearest candle
   */
  findNearestCandleIndex(timestamp: number): number {
    let left = 0;
    let right = this.candlesSortedByTimestamp.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const [candleTime] = this.candlesSortedByTimestamp[mid];

      if (candleTime === timestamp) {
        return mid;
      }

      if (candleTime < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    // If we didn't find an exact match, find the nearest candle
    if (left >= this.candlesSortedByTimestamp.length) {
      return this.candlesSortedByTimestamp.length - 1;
    }
    if (right < 0) {
      return 0;
    }

    const [leftTime] = this.candlesSortedByTimestamp[left];
    const [rightTime] = this.candlesSortedByTimestamp[right];

    return Math.abs(timestamp - leftTime) < Math.abs(timestamp - rightTime)
      ? left
      : right;
  }
}
