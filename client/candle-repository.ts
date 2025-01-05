import {
  CandleData,
  CandleDataByTimestamp,
  Granularity,
  TimeRange,
} from "../server/services/price-data/price-history-model";

export interface FetchCandlesOptions {
  symbol: string;
  direction?: "forward" | "backward";
  granularity: Granularity;
  timeRange: TimeRange;
  skipCache?: boolean;
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
    return `${symbol}:${granularity}:${Math.floor(
      Number(timeRange.start)
    )}:${Math.ceil(Number(timeRange.end))}`;
  }

  async fetchCandles(
    options: FetchCandlesOptions
  ): Promise<CandleDataByTimestamp> {
    const { symbol, granularity, timeRange, skipCache } = options;
    const key = this.getKey(symbol, granularity);
    const rangeKey = this.getRangeKey(symbol, granularity, timeRange);

    if (!this.candles.has(key)) {
      this.candles.set(key, new Map());
    }

    const symbolBufferedRange = this.bufferedRanges.get(key);

    if (symbolBufferedRange && !skipCache) {
      const isWithinBuffer =
        Math.floor(Number(timeRange.start)) >=
          Math.floor(Number(symbolBufferedRange.start)) &&
        Math.ceil(Number(timeRange.end)) <=
          Math.ceil(Number(symbolBufferedRange.end));

      if (isWithinBuffer) {
        return this.candles.get(key)!;
      }
    }

    if (this.pendingFetches.has(rangeKey)) {
      return this.candles.get(key)!;
    }

    try {
      this.pendingFetches.add(rangeKey);

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange
      );
      const minStartInResult = Math.min(...rangeCandles.keys());
      const maxEndInResult = Math.max(...rangeCandles.keys());

      const updatedBufferRange = symbolBufferedRange
        ? {
            start: Math.min(
              minStartInResult,
              Number(symbolBufferedRange.start)
            ),
            end: Math.max(maxEndInResult, Number(symbolBufferedRange.end)),
          }
        : timeRange;

      this.bufferedRanges.set(key, updatedBufferRange);

      const existingCandles = this.candles.get(key)!;
      this.candles.set(key, new Map([...existingCandles, ...rangeCandles]));

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
      if (Number(range.end) <= Number(range.start)) {
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
