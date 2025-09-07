import {
  Candle,
  CandleDataByTimestamp,
  Granularity,
  granularityToMs,
  TimeRange,
} from "../../server/services/price-data/price-history-model";
import { ApiCache, CacheKey } from "./api-cache";
import { getLogger, LogLevel } from "../util/logger";

const logger = getLogger('candle-repository');
logger.setLoggerLevel('candle-repository', LogLevel.ERROR);

export interface FetchCandlesOptions {
  symbol: string;
  direction?: "forward" | "backward";
  granularity: Granularity;
  timeRange: TimeRange;
  indicators?: string[];
  skipCache?: boolean;
  source: string;
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

    // Check if this exact request is pending
    const pendingPromise = this.cache.isPendingFetch(
      key,
      timeRange,
      indicators
    );
    if (pendingPromise) {
      await pendingPromise;
      const cachedData = this.cache.get(this.cache.getBaseKey(key, indicators));
      return cachedData || new Map();
    }

    // Check if data is in cache
    if (
      !skipCache &&
      this.cache.isWithinBufferedRange(key, timeRange, indicators)
    ) {
      const cachedData = this.cache.get(this.cache.getBaseKey(key, indicators));
      return cachedData || new Map();
    }

    try {
      const pendingPromise = this.cache.markFetchPending(
        key,
        timeRange,
        indicators
      );

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange,
        indicators
      );

      const result = this.cache.updateCache(
        key,
        timeRange,
        rangeCandles,
        (data) => ({
          min: Math.min(...Array.from(data.keys())),
          max: Math.max(...Array.from(data.keys())),
        }),
        indicators
      );

      this.cache.markFetchComplete(key, timeRange, indicators);
      await pendingPromise;

      return result;
    } catch (error) {
      this.cache.markFetchComplete(key, timeRange, indicators);
      throw error;
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

    while (currentStart < alignedEnd) {
      // Calculate remaining candles to fetch
      const remainingTime = alignedEnd - currentStart;
      const remainingCandles = Math.floor(remainingTime / intervalMs) + 1;
      const batchCandles = Math.min(remainingCandles, MAX_CANDLES);
      const batchEnd = Math.min(
        currentStart + (batchCandles - 1) * intervalMs,
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

      currentStart = batchEnd + intervalMs;
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
        return new Map();
      }
      // has indicators if there
      const effectiveIndicators = indicators?.length
        ? indicators.filter((i) => i.length > 0)
        : null;

      const params = new URLSearchParams({
        symbol,
        granularity: granularity ?? "ONE_HOUR",
        start_time: range.start.toString(),
        end_time: range.end.toString(),
        exchange: "coinbase",
      });

      // Append each evaluator as a separate evaluators parameter
      if (effectiveIndicators?.length) {
        effectiveIndicators.forEach((evaluator) => {
          params.append("evaluators", evaluator);
        });
      }

      const response = await fetch(`${this.API_BASE_URL}/history?${params}`);

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
      logger.error("Error fetching candles:", error);
      return new Map();
    }
  }
}
