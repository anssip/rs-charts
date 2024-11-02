import { CandleData } from "./components/candlestick-chart";

interface TimeRange {
  start: number;
  end: number;
}

export class CandleRepository {
  private candles: Map<number, CandleData> = new Map();
  private readonly API_BASE_URL: string = "http://localhost:3000";
  public readonly CANDLE_INTERVAL = 3600000; // 1 hour in milliseconds

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
  }

  async fetchCandlesForTimeRange(range: TimeRange): Promise<CandleData[]> {
    const missingRanges = this.getMissingRanges(range);

    if (missingRanges.length > 0) {
      await Promise.all(missingRanges.map((range) => this.fetchRange(range)));
    }
    return this.getCandlesInRange(range);
  }

  private getMissingRanges(requested: TimeRange): TimeRange[] {
    if (this.candles.size === 0) {
      return [requested];
    }
    const timestamps = Array.from(this.candles.keys()).sort((a, b) => a - b);
    const cachedRange = {
      start: timestamps[0],
      end: timestamps[timestamps.length - 1],
    };

    return [
      ...(requested.start < cachedRange.start
        ? [
            {
              start: requested.start,
              end: cachedRange.start - this.CANDLE_INTERVAL,
            },
          ]
        : []),
      ...(requested.end > cachedRange.end
        ? [
            {
              start: cachedRange.end + this.CANDLE_INTERVAL,
              end: requested.end,
            },
          ]
        : []),
    ];
  }

  private async fetchRange(range: TimeRange): Promise<void> {
    try {
      const candleCount = Math.ceil(
        (range.end - range.start) / this.CANDLE_INTERVAL
      );
      if (range.end < range.start) {
        throw new Error("End time is before start time", { cause: range });
      }

      const response = await fetch(
        `${this.API_BASE_URL}/api/candles?` +
          new URLSearchParams({
            symbol: "BTC-USD",
            interval: "1h",
            start: range.start.toString(),
            end: range.end.toString(),
            limit: candleCount.toString(),
          })
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const newCandles: CandleData[] = await response.json();
      console.log("Fetched candles:", {
        requested: candleCount,
        received: newCandles.length,
        timeRange: {
          start: new Date(range.start),
          end: new Date(range.end),
        },
      });

      this.addCandles(newCandles);
    } catch (error) {
      console.error("Error fetching candles:", error);
    }
  }

  private addCandles(newCandles: CandleData[]) {
    newCandles.forEach((candle) => {
      this.candles.set(candle.timestamp, candle);
    });
  }

  private getCandlesInRange(range: TimeRange): CandleData[] {
    return Array.from(this.candles.values())
      .filter(
        (candle) =>
          candle.timestamp >= range.start && candle.timestamp <= range.end
      )
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  // Helper method to calculate time range based on visible candles
  getTimeRangeForVisibleCandles(
    centerTimestamp: number,
    candleCount: number
  ): TimeRange {
    console.log("Getting time range for visible candles:", {
      centerTimestamp,
      candleCount,
    });
    const totalDuration = candleCount * this.CANDLE_INTERVAL;
    const halfDuration = Math.floor(totalDuration / 2);

    return {
      start: centerTimestamp - halfDuration,
      end: centerTimestamp + halfDuration,
    };
  }
}
