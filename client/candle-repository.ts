import {
  CandleData,
  CandleDataByTimestamp,
} from "../server/services/price-data-cb";

export interface TimeRange {
  start: number;
  end: number;
}

export class CandleRepository {
  private candles: CandleDataByTimestamp = new Map();
  private readonly API_BASE_URL: string = "http://localhost:3000";
  public readonly CANDLE_INTERVAL = 3600000; // 1 hour in milliseconds
  private bufferedRange: TimeRange | null = null;
  private pendingFetches: Set<string> = new Set(); // Track pending fetch ranges

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
  }

  async fetchCandlesForTimeRange(
    range: TimeRange,
    options: { direction?: "forward" | "backward" } = {}
  ): Promise<CandleDataByTimestamp> {
    const rangeKey = `${range.start}-${range.end}`;

    if (this.bufferedRange) {
      const isWithinBuffer =
        range.start >= this.bufferedRange.start &&
        range.end <= this.bufferedRange.end;

      if (isWithinBuffer) {
        console.log(
          "Repository: Range already buffered, returning existing data"
        );
        return this.candles;
      }
    }

    if (this.pendingFetches.has(rangeKey)) {
      console.log("Repository: Fetch already pending for range");
      return this.candles;
    }

    try {
      this.pendingFetches.add(rangeKey);

      // Preemptively update buffer range based on direction
      this.bufferedRange = this.bufferedRange
        ? options.direction === "backward"
          ? {
              start: range.start,
              end: this.bufferedRange.end,
            }
          : {
              start: this.bufferedRange.start,
              end: range.end,
            }
        : range;

      const rangeCandles = await this.fetchRange(range);
      console.log("Repository: Fetched range candles:", rangeCandles.size);
      this.candles = new Map([...this.candles, ...rangeCandles]);
      console.log("Repository: Fetched candles:", {
        requested: {
          start: new Date(range.start),
          end: new Date(range.end),
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

  private async fetchRange(range: TimeRange): Promise<CandleDataByTimestamp> {
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
            symbol: "BTC-USD",
            interval: "1h",
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
