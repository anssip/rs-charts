import { PriceRangeImpl } from "../../../client/util/price-range";

export interface TimeRange {
  start: number;
  end: number;
}

export type Granularity =
  | "ONE_MINUTE"
  | "FIVE_MINUTE"
  | "FIFTEEN_MINUTE"
  | "THIRTY_MINUTE"
  | "ONE_HOUR"
  | "TWO_HOUR"
  | "SIX_HOUR"
  | "ONE_DAY";

export function getAllGranularities(): Granularity[] {
  return [
    "ONE_MINUTE",
    "FIVE_MINUTE",
    "FIFTEEN_MINUTE",
    "THIRTY_MINUTE",
    "ONE_HOUR",
    "TWO_HOUR",
    "SIX_HOUR",
    "ONE_DAY",
  ];
}

export function granularityLabel(granularity: Granularity): string {
  const labels = new Map([
    ["ONE_MINUTE", "1m"],
    ["FIVE_MINUTE", "5m"],
    ["FIFTEEN_MINUTE", "15m"],
    ["THIRTY_MINUTE", "30m"],
    ["ONE_HOUR", "1h"],
    ["TWO_HOUR", "2h"],
    ["SIX_HOUR", "6h"],
    ["ONE_DAY", "1d"],
  ]);
  return labels.get(String(granularity)) ?? String(granularity);
}

export interface CandleData {
  granularity: Granularity;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  live: boolean;
  evaluations: any; // TODO: define type
}
export type CandleDataByTimestamp = Map<number, CandleData>;

export interface PriceDataOptions {
  symbol: string;
  granularity: Granularity;
  start: Date;
  end: Date;
}

export interface PriceRange {
  min: number;
  max: number;
  range: number;
  shift(amount: number): void;
  setMin(min: number): void;
  setMax(max: number): void;
}

export interface PriceHistory {
  getGranularity(): Granularity;
  get granularityMs(): number;
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
  getPriceRange(startTimestamp: number, endTimestamp: number): PriceRange;
  setLiveCandle(candle: CandleData): boolean;
  getGaps(startTimestamp: number, endTimestamp: number): TimeRange[];
}

const GRANULARITY_TO_MS = new Map([
  ["ONE_MINUTE", 60 * 1000],
  ["FIVE_MINUTE", 5 * 60 * 1000],
  ["FIFTEEN_MINUTE", 15 * 60 * 1000],
  ["THIRTY_MINUTE", 30 * 60 * 1000],
  ["ONE_HOUR", 60 * 60 * 1000],
  ["TWO_HOUR", 2 * 60 * 60 * 1000],
  ["SIX_HOUR", 6 * 60 * 60 * 1000],
  ["ONE_DAY", 24 * 60 * 60 * 1000],
]) as ReadonlyMap<Granularity, number>;

export function asGranularity(granularity: Granularity | string): Granularity {
  return typeof granularity === "string"
    ? (granularity as Granularity)
    : ((granularity + "") as Granularity);
}

export function granularityToMs(granularity: Granularity): number {
  if (!GRANULARITY_TO_MS.has(asGranularity(granularity))) {
    throw new Error(`Unknown granularity: '${granularity}'`);
  }
  return GRANULARITY_TO_MS.get(asGranularity(granularity)) ?? 60 * 60 * 1000;
}

export function numCandlesInRange(
  granularity: Granularity,
  startTimestamp: number,
  endTimestamp: number
): number {
  return Math.ceil(
    (endTimestamp - startTimestamp) / granularityToMs(granularity)
  );
}

export class SimplePriceHistory implements PriceHistory {
  private granularity: Granularity;
  private candles: CandleDataByTimestamp;

  private candlesSortedByTimestamp: [number, CandleData][];

  constructor(granularity: Granularity, candles: CandleDataByTimestamp) {
    this.granularity = asGranularity(granularity);
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
      GRANULARITY_TO_MS.get(this.granularity) ?? 60 * 60 * 1000;

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
    if (this.candlesSortedByTimestamp.length === 0) {
      return 0;
    }
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

  getPriceRange(startTimestamp: number, endTimestamp: number): PriceRange {
    const candlesInRange = this.getCandlesInRange(startTimestamp, endTimestamp);
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const [_, candle] of candlesInRange) {
      minPrice = Math.min(minPrice, candle.low);
      maxPrice = Math.max(maxPrice, candle.high);
    }
    return new PriceRangeImpl(minPrice, maxPrice);
  }

  get granularityMs(): number {
    return GRANULARITY_TO_MS.get(`${this.granularity}`) ?? 60 * 60 * 1000;
  }

  /**
   * Set a live candle to the price history.
   * @param candle - The live candle to set.
   * @returns True if the candle was set, false otherwise.
   */
  setLiveCandle(candle: CandleData): boolean {
    if (this.candles.size === 0) {
      return false;
    }
    if (candle.granularity.valueOf() !== this.granularity) {
      return false;
    }
    if (candle.timestamp < this.endTimestamp) {
      return false;
    }

    const existingCandle = this.getCandle(candle.timestamp);

    if (existingCandle) {
      // For an existing candle:
      // - Keep the original open price
      // - Update high/low if the new price exceeds current bounds
      // - Update close price with the latest price
      const newCandle: CandleData = {
        timestamp: candle.timestamp,
        open: existingCandle.open, // Keep original open price
        high: Math.max(existingCandle.high, candle.high, candle.close),
        low: Math.min(existingCandle.low, candle.low, candle.close),
        close: candle.close, // Always update to latest price
        volume: candle.volume,
        live: true,
        granularity: this.granularity,
      };

      this.candles.set(newCandle.timestamp, newCandle);
      const index = this.findNearestCandleIndex(existingCandle.timestamp);
      this.candlesSortedByTimestamp[index] = [newCandle.timestamp, newCandle];
    } else {
      const newCandle: CandleData = {
        ...candle,
        granularity: this.granularity,
      };
      this.candles.set(newCandle.timestamp, newCandle);
      this.candlesSortedByTimestamp.push([newCandle.timestamp, newCandle]);
      // Keep the array sorted
      this.candlesSortedByTimestamp.sort(([a], [b]) => a - b);
    }

    return true;
  }

  getGaps(startTimestamp: number, endTimestamp: number): TimeRange[] {
    const granularityMs = this.granularityMs;
    // accumulate all gaps from the timeline. A gap is a period where this price history does not have a candle
    const numSteps = Math.ceil((endTimestamp - startTimestamp) / granularityMs);
    return Array.from({ length: numSteps }).reduce<TimeRange[]>(
      (gaps, _, i) => {
        const currentTimestamp = startTimestamp + i * granularityMs;
        const nextTimestamp = currentTimestamp + granularityMs;
        if (!this.isCandleAvailable(currentTimestamp)) {
          gaps.push({ start: currentTimestamp, end: nextTimestamp });
        }
        return gaps;
      },
      []
    );
  }
}
