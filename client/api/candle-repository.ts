import {
  Candle,
  CandleDataByTimestamp,
  Granularity,
  granularityToMs,
  TimeRange,
} from "../../server/services/price-data/price-history-model";
import { ApiCache, CacheKey } from "./api-cache";

export interface FetchCandlesOptions {
  symbol: string;
  direction?: "forward" | "backward";
  granularity: Granularity;
  timeRange: TimeRange;
  indicators?: string[];
  skipCache?: boolean;
}

class CandleKey implements CacheKey {
  constructor(private symbol: string, private granularity: Granularity) {}

  toString(): string {
    return `${this.symbol}:${this.granularity}`;
  }
}

export class CandleRepository {
  private cache: ApiCache<number, Candle>;
  private readonly API_BASE_URL: string;

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
    this.cache = new ApiCache();
  }

  async fetchCandles(
    options: FetchCandlesOptions
  ): Promise<CandleDataByTimestamp> {
    const {
      symbol,
      granularity,
      timeRange,
      skipCache,
      indicators = [],
    } = options;
    const key = new CandleKey(symbol, granularity);

    if (
      !skipCache &&
      this.cache.isWithinBufferedRange(key, timeRange, indicators)
    ) {
      return (
        this.cache.get(this.cache.getBaseKey(key, indicators)) || new Map()
      );
    }

    if (this.cache.isPendingFetch(key, timeRange, indicators)) {
      return (
        this.cache.get(this.cache.getBaseKey(key, indicators)) || new Map()
      );
    }

    try {
      this.cache.markFetchPending(key, timeRange, indicators);

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange,
        indicators
      );

      return this.cache.updateCache(
        key,
        timeRange,
        rangeCandles,
        (data) => ({
          min: Math.min(...Array.from(data.keys())),
          max: Math.max(...Array.from(data.keys())),
        }),
        indicators
      );
    } finally {
      this.cache.markFetchComplete(key, timeRange, indicators);
    }
  }

  getCandles(symbol: string, granularity: Granularity): CandleDataByTimestamp {
    const key = new CandleKey(symbol, granularity);
    return this.cache.get(key.toString()) || new Map();
  }

  private async fetchRange(
    symbol: string,
    granularity: Granularity,
    range: TimeRange,
    indicators?: string[]
  ): Promise<CandleDataByTimestamp> {
    const MAX_CANDLES = 200;
    const intervalMs = granularityToMs(granularity);

    // Align timestamps to interval boundaries
    const alignedStart = Math.floor(range.start / intervalMs) * intervalMs;
    const alignedEnd = Math.ceil(range.end / intervalMs) * intervalMs;

    // Always split into smaller batches
    const results = new Map<number, Candle>();
    let currentStart = alignedStart;
    let batchCount = 0;

    while (currentStart < alignedEnd) {
      batchCount++;
      const batchEnd = Math.min(
        currentStart + (MAX_CANDLES - 1) * intervalMs,
        alignedEnd
      );

      const batchCandlesData = await this.fetchSingleRange(
        symbol,
        granularity,
        { start: currentStart, end: batchEnd },
        indicators
      );

      // Merge batch results into main results map
      batchCandlesData.forEach((candle, timestamp) => {
        results.set(timestamp, candle);
      });

      currentStart = batchEnd + intervalMs; // Move to next interval after batch end
    }

    return results;
  }

  private async fetchSingleRange(
    symbol: string,
    granularity: Granularity,
    range: TimeRange,
    indicators?: string[]
  ): Promise<CandleDataByTimestamp> {
    try {
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
            ...(indicators?.length ? { evaluators: indicators.join(",") } : {}),
          })
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: { candles: Candle[] } = await response.json();
      return new Map(
        result.candles.map((candle: Candle) => [
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
