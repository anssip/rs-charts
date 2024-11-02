import { CandleData } from "./components/candlestick-chart";

export interface TimeRange {
  start: number;
  end: number;
}

export class CandleRepository {
  private candles: Map<number, CandleData> = new Map();
  private readonly API_BASE_URL: string = "http://localhost:3000";
  public readonly CANDLE_INTERVAL = 3600000; // 1 hour in milliseconds
  private readonly BUFFER_MULTIPLIER = 2;
  private bufferedRange: TimeRange | null = null;

  constructor(apiBaseUrl: string) {
    this.API_BASE_URL = apiBaseUrl;
  }

  async fetchCandlesForTimeRange(range: TimeRange): Promise<CandleData[]> {
    console.log("Fetching with buffer state:", {
      range,
      currentBuffer: this.bufferedRange,
      candles: this.candles.size,
    });

    console.log("Current buffer state:", {
      hasBuffer: this.bufferedRange !== null,
      bufferedRange: this.bufferedRange,
      requestedRange: range,
    });

    // If we have no buffer yet, do initial fetch
    if (!this.bufferedRange) {
      try {
        const fetchedCandles = await this.fetchRange(range);
        if (fetchedCandles.length > 0) {
          const timestamps = fetchedCandles
            .map((c) => c.timestamp)
            .sort((a, b) => a - b);
          this.bufferedRange = {
            start: timestamps[0],
            end: timestamps[timestamps.length - 1],
          };
          this.addCandles(fetchedCandles);
          console.log("Initial buffer set to:", this.bufferedRange);
        }
        return this.getCandlesInRange(range);
      } catch (error) {
        console.error("Error during initial fetch:", error);
        return [];
      }
    }

    // Check if requested range is within our buffer
    if (
      range.start >= this.bufferedRange.start &&
      range.end <= this.bufferedRange.end
    ) {
      console.log("Request within buffered range - no fetch needed");
      return this.getCandlesInRange(range);
    }

    // Calculate missing ranges
    const missingRanges: TimeRange[] = [];

    if (range.start < this.bufferedRange.start) {
      missingRanges.push({
        start: range.start,
        end: this.bufferedRange.start,
      });
    }

    if (range.end > this.bufferedRange.end) {
      missingRanges.push({
        start: this.bufferedRange.end,
        end: range.end,
      });
    }
    console.log("Missing ranges:", missingRanges);

    // Validate ranges before fetching
    const validRanges = missingRanges.filter((r) => r.end > r.start);

    if (validRanges.length > 0) {
      try {
        // Fetch all missing ranges
        const fetchPromises = validRanges.map((range) =>
          this.fetchRange(range)
        );
        const fetchedCandlesArrays = await Promise.all(fetchPromises);

        // Flatten and add all fetched candles
        const allFetchedCandles = fetchedCandlesArrays.flat();
        if (allFetchedCandles.length > 0) {
          console.log("Adding fetched candles:", allFetchedCandles.length);
          this.addCandles(allFetchedCandles);

          // Update buffer range
          const timestamps = [...this.candles.values()]
            .map((c) => c.timestamp)
            .sort((a, b) => a - b);
          this.bufferedRange = {
            start: timestamps[0],
            end: timestamps[timestamps.length - 1],
          };
        }
      } catch (error) {
        console.error("Error fetching missing ranges:", error);
      }
    }

    return this.getCandlesInRange(range);
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
      console.log("Fetched candles:", {
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
    visibleCandles: number
  ): TimeRange | null {
    const totalDuration = visibleCandles * this.CANDLE_INTERVAL;
    const halfDuration = Math.floor(totalDuration / 2);

    const requestedRange = {
      start: centerTimestamp - halfDuration,
      end: centerTimestamp + halfDuration,
    };

    // Add buffer zone calculation
    const bufferSize = totalDuration * 2; // Double the buffer size
    const bufferedRequestRange = {
      start: requestedRange.start - bufferSize,
      end: requestedRange.end + bufferSize,
    };

    console.log("Range check:", {
      requestedRange,
      bufferedRequestRange,
      currentBuffer: this.bufferedRange,
      wouldFetch:
        !this.bufferedRange ||
        bufferedRequestRange.start < this.bufferedRange.start ||
        bufferedRequestRange.end > this.bufferedRange.end,
    });

    // Only fetch if we're outside our buffered range or getting close to the edge
    if (
      !this.bufferedRange ||
      bufferedRequestRange.start < this.bufferedRange.start ||
      bufferedRequestRange.end > this.bufferedRange.end
    ) {
      return requestedRange;
    }

    return null;
  }
}
