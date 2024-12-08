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
  private candles: CandleDataByTimestamp = new Map();
  private readonly API_BASE_URL: string;
  public readonly CANDLE_INTERVAL = 3600000; // 1 hour in milliseconds
  private bufferedRanges: Map<string, TimeRange> = new Map();
  private pendingFetches: Set<string> = new Set();

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
  }

  async fetchCandles(
    options: FetchCandlesOptions
  ): Promise<CandleDataByTimestamp> {
    const { symbol, direction, granularity, timeRange } = options;
    const rangeKey = `${symbol}-${timeRange.start}-${timeRange.end}`;

    const symbolBufferedRange = this.bufferedRanges.get(symbol);

    if (symbolBufferedRange) {
      const isWithinBuffer =
        timeRange.start >= symbolBufferedRange.start &&
        timeRange.end <= symbolBufferedRange.end;

      if (isWithinBuffer) {
        console.log(
          `Repository: Range already buffered for symbol ${symbol}, returning existing data`
        );
        return this.candles;
      }
    }

    if (this.pendingFetches.has(rangeKey)) {
      console.log(`Repository: Fetch already pending for range ${rangeKey}`);
      return this.candles;
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

      this.bufferedRanges.set(symbol, updatedBufferRange);

      const rangeCandles = await this.fetchRange(
        symbol,
        granularity,
        timeRange
      );
      console.log(
        `Repository: Fetched range candles for ${symbol}:`,
        rangeCandles.size
      );
      this.candles = new Map([...this.candles, ...rangeCandles]);
      console.log(`Repository: Fetched candles for ${symbol}:`, {
        requested: {
          start: new Date(timeRange.start),
          end: new Date(timeRange.end),
        },
        received: this.candles.size,
      });
      return this.candles;
    } finally {
      this.pendingFetches.delete(rangeKey);
    }
  }

  getCandles(): CandleDataByTimestamp {
    return this.candles;
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
