import { CandleData } from "./components/candlestick-chart";

export interface TimeRange {
  start: number;
  end: number;
}

export class CandleRepository {
  private candles: Map<number, CandleData> = new Map();
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
  ) {
    const rangeKey = `${range.start}-${range.end}`;

    console.log("Repository: Fetch request:", {
      range: {
        start: new Date(range.start),
        end: new Date(range.end),
      },
      direction: options.direction,
      bufferedRange: this.bufferedRange
        ? {
            start: new Date(this.bufferedRange.start),
            end: new Date(this.bufferedRange.end),
          }
        : null,
      pendingFetches: Array.from(this.pendingFetches),
      candleCount: this.candles.size,
    });

    // Check if we already have this data
    if (this.bufferedRange) {
      const isWithinBuffer =
        range.start >= this.bufferedRange.start &&
        range.end <= this.bufferedRange.end;

      if (isWithinBuffer) {
        console.log(
          "Repository: Range already buffered, returning existing data"
        );
        return this.getCandlesInRange(range);
      }

      // Log what part of the range is missing
      if (range.start < this.bufferedRange.start) {
        console.log("Repository: Missing data before buffer:", {
          requested: new Date(range.start),
          buffered: new Date(this.bufferedRange.start),
        });
      }
      if (range.end > this.bufferedRange.end) {
        console.log("Repository: Missing data after buffer:", {
          requested: new Date(range.end),
          buffered: new Date(this.bufferedRange.end),
        });
      }
    }

    if (this.pendingFetches.has(rangeKey)) {
      console.log("Repository: Fetch already pending for range");
      return this.getCandlesInRange(range);
    }

    try {
      this.pendingFetches.add(rangeKey);

      // Preemptively update buffer range based on direction
      if (this.bufferedRange) {
        const newBufferRange =
          options.direction === "backward"
            ? {
                start: range.start,
                end: this.bufferedRange.end,
              }
            : {
                start: this.bufferedRange.start,
                end: range.end,
              };

        console.log("Repository: Updating buffer range:", {
          old: {
            start: new Date(this.bufferedRange.start),
            end: new Date(this.bufferedRange.end),
          },
          new: {
            start: new Date(newBufferRange.start),
            end: new Date(newBufferRange.end),
          },
        });

        this.bufferedRange = newBufferRange;
      } else {
        this.bufferedRange = range;
      }

      const candles = await this.fetchRange(range);

      console.log("Repository: Fetched candles:", {
        requested: {
          start: new Date(range.start),
          end: new Date(range.end),
        },
        received: candles.length,
      });

      // TODO: clean this up
      this.addCandles(candles);
      return this.getCandlesInRange(range);
    } finally {
      this.pendingFetches.delete(rangeKey);
    }
  }

  private async fetchRange(range: TimeRange): Promise<CandleData[]> {
    try {
      // Validate time range
      if (range.end <= range.start) {
        console.error("Invalid time range:", {
          start: new Date(range.start),
          end: new Date(range.end),
        });
        return [];
      }

      console.log("Repository: Fetching range:", {
        start: new Date(range.start),
        end: new Date(range.end),
        pendingFetches: Array.from(this.pendingFetches),
      });

      const response = await fetch(
        `${this.API_BASE_URL}/api/candles?` +
          new URLSearchParams({
            symbol: "BTC-USD",
            interval: "1h",
            start: range.start.toString(),
            end: range.end.toString(),
          })
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newCandles: CandleData[] = await response.json();
      console.log("Repository: Fetched candles:", {
        received: newCandles.length,
        timeRange: {
          start: new Date(range.start),
          end: new Date(range.end),
        },
      });

      return newCandles;
    } catch (error) {
      console.error("Error fetching candles:", error);
      return [];
    }
  }

  private addCandles(candles: CandleData[]): void {
    candles.forEach((candle) => {
      this.candles.set(candle.timestamp, candle);
    });
  }

  private getCandlesInRange(range: TimeRange): CandleData[] {
    const candles = Array.from(this.candles.values())
      .filter(
        (candle) =>
          candle.timestamp >= range.start && candle.timestamp <= range.end
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    console.log("Repository: Returning candles:", {
      range: {
        start: new Date(range.start),
        end: new Date(range.end),
      },
      found: candles.length,
    });

    return candles;
  }
}
