import {
  CandleData,
  CandleDataByTimestamp,
  Granularity,
} from "../server/services/price-data/price-history-model";

export interface TimeRange {
  start: number;
  end: number;
}

export interface FetchCandlesOptions {
  symbol: string;
  direction?: "forward" | "backward";
  granularity: Granularity;
  timeRange: TimeRange;
}

export class CandleRepository {
  private candles: Map<string, CandleDataByTimestamp> = new Map();
  private readonly API_BASE_URL: string;
  private bufferedRanges: Map<string, TimeRange> = new Map();
  private pendingFetches: Set<string> = new Set();

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
  }

  private getKey(symbol: string, granularity: Granularity): string {
    return `${symbol}:${granularity}`;
  }

  private getRangeKey(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange
  ): string {
    return `${symbol}:${granularity}:${timeRange.start}:${timeRange.end}`;
  }

  async fetchCandles(
    options: FetchCandlesOptions
  ): Promise<CandleDataByTimestamp> {
    const { symbol, direction, granularity, timeRange } = options;
    const key = this.getKey(symbol, granularity);
    const rangeKey = this.getRangeKey(symbol, granularity, timeRange);

    if (!this.candles.has(key)) {
      this.candles.set(key, new Map());
    }

    const symbolBufferedRange = this.bufferedRanges.get(key);

    if (symbolBufferedRange) {
      const isWithinBuffer =
        timeRange.start >= symbolBufferedRange.start &&
        timeRange.end <= symbolBufferedRange.end;

      if (isWithinBuffer) {
        console.log(
          `Repository: Range already buffered for ${key}, returning existing data`
        );
        return this.candles.get(key)!;
      }
    }

    if (this.pendingFetches.has(rangeKey)) {
      console.log(`Repository: Fetch already pending for range ${rangeKey}`);
      return this.candles.get(key)!;
    }

    try {
      this.pendingFetches.add(rangeKey);

      const updatedBufferRange = symbolBufferedRange
        ? direction === "backward"
          ? {
              start: timeRange.start,
              end: symbolBufferedRange.end,
            }
          : {
              start: symbolBufferedRange.start,
              end: timeRange.end,
            }
        : timeRange;

      this.bufferedRanges.set(key, updatedBufferRange);

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange
      );

      const existingCandles = this.candles.get(key)!;
      this.candles.set(key, new Map([...existingCandles, ...rangeCandles]));

      console.log(`Repository: Fetched candles for ${key}:`, {
        requested: {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end),
        },
        received: rangeCandles.size,
        total: this.candles.get(key)!.size,
      });

      return this.candles.get(key)!;
    } finally {
      this.pendingFetches.delete(rangeKey);
    }
  }

  getCandles(symbol: string, granularity: Granularity): CandleDataByTimestamp {
    const key = this.getKey(symbol, granularity);
    return this.candles.get(key) || new Map();
  }

  private async fetchRange(
    symbol: string,
    granularity: Granularity,
    range: TimeRange
  ): Promise<CandleDataByTimestamp> {
    try {
      // Validate time range
      if (range.end <= range.start) {
        console.error("Invalid time range:", {
          start: new Date(range.start),
          end: new Date(range.end),
        });
        return new Map();
      }
      const response = await fetch(
        `${this.API_BASE_URL}/api/candles?` +
          new URLSearchParams({
            symbol,
            granularity: granularity ?? "ONE_HOUR",
            start: range.start.toString(),
            end: range.end.toString(),
          })
      );
      console.log("Repository: Fetch response:", response);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      return new Map(
        Object.entries(data).map(([timestamp, value]) => [
          Number(timestamp),
          value as CandleData,
        ])
      );
    } catch (error) {
      console.error("Error fetching candles:", error);
      return new Map();
    }
  }
}
