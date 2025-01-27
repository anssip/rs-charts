import {
  CandleData,
  CandleDataByTimestamp,
  Granularity,
  TimeRange,
} from "../../server/services/price-data/price-history-model";
import { ApiCache, CacheKey } from "./api-cache";

export interface FetchCandlesOptions {
  symbol: string;
  direction?: "forward" | "backward";
  granularity: Granularity;
  timeRange: TimeRange;
  skipCache?: boolean;
}

class CandleKey implements CacheKey {
  constructor(private symbol: string, private granularity: Granularity) {}

  toString(): string {
    return `${this.symbol}:${this.granularity}`;
  }
}

export class CandleRepository {
  private cache: ApiCache<number, CandleData>;
  private readonly API_BASE_URL: string;

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
    this.cache = new ApiCache();
  }

  async fetchCandles(
    options: FetchCandlesOptions
  ): Promise<CandleDataByTimestamp> {
    const { symbol, granularity, timeRange, skipCache } = options;
    const key = new CandleKey(symbol, granularity);

    console.log("Fetch request:", {
      symbol,
      granularity,
      timeRange: {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
      skipCache,
    });

    if (!skipCache && this.cache.isWithinBufferedRange(key, timeRange)) {
      console.log("Cache hit");
      return this.cache.get(key.toString()) || new Map();
    }

    if (this.cache.isPendingFetch(key, timeRange)) {
      return this.cache.get(key.toString()) || new Map();
    }

    try {
      this.cache.markFetchPending(key, timeRange);

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange
      );

      return this.cache.updateCache(key, timeRange, rangeCandles, (data) => ({
        min: Math.min(...Array.from(data.keys())),
        max: Math.max(...Array.from(data.keys())),
      }));
    } finally {
      this.cache.markFetchComplete(key, timeRange);
    }
  }

  getCandles(symbol: string, granularity: Granularity): CandleDataByTimestamp {
    const key = new CandleKey(symbol, granularity);
    return this.cache.get(key.toString()) || new Map();
  }

  private async fetchRange(
    symbol: string,
    granularity: Granularity,
    range: TimeRange
  ): Promise<CandleDataByTimestamp> {
    try {
      // Validate time range
      if (Number(range.end) <= Number(range.start)) {
        console.error("Invalid time range:", {
          start: new Date(range.start),
          end: new Date(range.end),
        });
        return new Map();
      }
      const response = await fetch(
        `${this.API_BASE_URL}/history?` +
          new URLSearchParams({
            symbol,
            granularity: granularity ?? "ONE_HOUR",
            start_time: range.start.toString(),
            end_time: range.end.toString(),
            exchange: "coinbase",
          })
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const result: { candles: CandleData[] } = await response.json();
      return new Map(
        result.candles.map((candle: CandleData) => [
          Number(candle.timestamp),
          { ...candle, granularity },
        ])
      );
    } catch (error) {
      console.error("Error fetching candles:", error);
      return new Map();
    }
  }
}
