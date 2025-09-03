import {
  Candle,
  CandleDataByTimestamp,
  Granularity,
  granularityToMs,
  TimeRange,
} from "../../server/services/price-data/price-history-model";
import { IndexedDBCache } from "./indexeddb-cache";
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

export class CandleRepository {
  private cache: IndexedDBCache;
  private readonly API_BASE_URL: string;
  private serviceWorkerReady: Promise<void>;
  private prefetchedRanges: Map<string, TimeRange> = new Map();

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
    this.cache = new IndexedDBCache();
    this.serviceWorkerReady = this.initServiceWorker();
  }

  private async initServiceWorker(): Promise<void> {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
        logger.info('Service worker communication established');
      } catch (error) {
        logger.warn('Service worker not available:', error);
      }
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, data, symbol, granularity, timeRange, indicators } = event.data;
    
    if (type === 'PREFETCH_COMPLETE' && data) {
      // Store prefetched data in IndexedDB
      const candles: CandleDataByTimestamp = new Map(
        data.candles.map((candle: Candle) => [
          Number(candle.timestamp),
          { ...candle, granularity },
        ])
      );
      
      this.cache.updateCache(symbol, granularity, timeRange, candles, indicators)
        .then(() => {
          logger.debug(`Prefetched data stored for ${symbol}:${granularity}`);
        })
        .catch((error) => {
          logger.error('Failed to store prefetched data:', error);
        });
    }
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

    // Wait for service worker to be ready
    await this.serviceWorkerReady;

    // Check if this exact request is pending
    const pendingPromise = this.cache.isPendingFetch(
      symbol,
      granularity,
      timeRange,
      indicators
    );
    if (pendingPromise) {
      await pendingPromise;
      return await this.cache.getCachedCandles(symbol, granularity, timeRange, indicators);
    }

    // Check if data is in IndexedDB cache
    if (!skipCache) {
      const isInCache = await this.cache.isWithinCachedRange(
        symbol,
        granularity,
        timeRange,
        indicators
      );
      
      if (isInCache) {
        const cachedData = await this.cache.getCachedCandles(
          symbol,
          granularity,
          timeRange,
          indicators
        );
        
        if (cachedData.size > 0) {
          // Notify service worker about viewport for intelligent prefetching
          this.notifyViewportUpdate(symbol, granularity, timeRange, indicators);
          return cachedData;
        }
      }
    }

    try {
      const pendingPromise = this.cache.markFetchPending(
        symbol,
        granularity,
        timeRange,
        indicators
      );

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange,
        indicators
      );

      // Store in IndexedDB
      await this.cache.updateCache(
        symbol,
        granularity,
        timeRange,
        rangeCandles,
        indicators
      );

      this.cache.markFetchComplete(symbol, granularity, timeRange, indicators);
      await pendingPromise;

      // Notify service worker for prefetching
      this.notifyViewportUpdate(symbol, granularity, timeRange, indicators);
      
      // Request prefetch of adjacent data
      this.requestPrefetch(symbol, granularity, timeRange, indicators);

      return rangeCandles;
    } catch (error) {
      this.cache.markFetchComplete(symbol, granularity, timeRange, indicators);
      throw error;
    }
  }

  async getCandles(
    symbol: string, 
    granularity: Granularity,
    timeRange?: TimeRange,
    indicators?: string[]
  ): Promise<CandleDataByTimestamp> {
    if (!timeRange) {
      // If no time range specified, get all cached data
      const now = Date.now();
      timeRange = {
        start: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
        end: now,
      };
    }
    
    return await this.cache.getCachedCandles(
      symbol,
      granularity,
      timeRange,
      indicators || []
    );
  }

  private notifyViewportUpdate(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[]
  ): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'VIEWPORT_UPDATE',
        data: {
          symbol,
          granularity,
          timeRange,
          indicators,
        },
      });
    }
  }

  private requestPrefetch(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    indicators: string[]
  ): void {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const intervalMs = granularityToMs(granularity);
      const viewportWidth = timeRange.end - timeRange.start;
      const prefetchWidth = viewportWidth * 2; // Prefetch 2x viewport width
      
      // Request prefetch for data before current range
      navigator.serviceWorker.controller.postMessage({
        type: 'PREFETCH_REQUEST',
        data: {
          symbol,
          granularity,
          timeRange: {
            start: timeRange.start - prefetchWidth,
            end: timeRange.start,
          },
          indicators,
          priority: 5,
        },
      });
      
      // Request prefetch for data after current range
      navigator.serviceWorker.controller.postMessage({
        type: 'PREFETCH_REQUEST',
        data: {
          symbol,
          granularity,
          timeRange: {
            start: timeRange.end,
            end: timeRange.end + prefetchWidth,
          },
          indicators,
          priority: 5,
        },
      });
    }
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
