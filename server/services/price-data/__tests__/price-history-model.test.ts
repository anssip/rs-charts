import { expect, test, describe } from "bun:test";
import {
  SimplePriceHistory,
  type Candle,
  type CandleDataByTimestamp,
} from "../price-history-model";

describe("SimplePriceHistory", () => {
  // Helper function to create test data
  function createTestCandles(): CandleDataByTimestamp {
    const candles = new Map<number, Candle>();

    // Add some test candles at 1-hour intervals
    const baseTime = 1700000000000; // Some fixed timestamp
    const testData: Candle[] = [
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
        live: false,
      },
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime + 3600000, // +1 hour
        open: 105,
        high: 115,
        low: 95,
        close: 110,
        volume: 1000,
        live: false,
      },
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime + 7200000, // +2 hours
        open: 110,
        high: 120,
        low: 100,
        close: 115,
        volume: 1000,
        live: false,
      },
    ];

    testData.forEach((candle) => {
      candles.set(candle.timestamp, candle);
    });

    return candles;
  }

  test("getGranularity returns correct granularity", () => {
    const priceHistory = new SimplePriceHistory(
      "ONE_HOUR",
      createTestCandles()
    );
    expect(priceHistory.getGranularity()).toBe("ONE_HOUR");
  });

  test("getCandle returns exact match", () => {
    const candles = createTestCandles();
    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const timestamp = Array.from(candles.keys())[0];

    const result = priceHistory.getCandle(timestamp);
    expect(result).toBeDefined();
    expect(result?.timestamp).toBe(timestamp);
  });

  test("getCandle returns closest match within interval", () => {
    const candles = createTestCandles();
    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const baseTimestamp = Array.from(candles.keys())[0];

    // Test with timestamp 20 minutes after the candle
    const testTimestamp = baseTimestamp + 20 * 60 * 1000;
    const result = priceHistory.getCandle(testTimestamp);

    expect(result).toBeDefined();
    expect(result?.timestamp).toBe(baseTimestamp);
  });

  test("getCandle returns undefined for timestamp outside data range", () => {
    const candles = createTestCandles();
    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const minTimestamp = Math.min(...Array.from(candles.keys()));

    // Test with timestamp way before our data
    const result = priceHistory.getCandle(minTimestamp - 24 * 3600000);
    expect(result).toBeUndefined();
  });

  test("isCandleAvailable returns correct boolean", () => {
    const candles = createTestCandles();
    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const timestamp = Array.from(candles.keys())[0];

    expect(priceHistory.isCandleAvailable(timestamp)).toBe(true);
    expect(priceHistory.isCandleAvailable(timestamp - 24 * 3600000)).toBe(
      false
    );
  });

  test("getCandle handles different granularities correctly", () => {
    // Test with 5-minute granularity
    const fiveMinCandles = new Map<number, Candle>();
    const baseTime = 1700000000000;
    const candle: Candle = {
      granularity: "FIVE_MINUTE",
      timestamp: baseTime,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
      volume: 1000,
      live: false,
    };
    fiveMinCandles.set(baseTime, candle);

    const priceHistory = new SimplePriceHistory("FIVE_MINUTE", fiveMinCandles);

    // Should find candle within 5-minute window
    const result1 = priceHistory.getCandle(baseTime + 2 * 60 * 1000); // +2 minutes
    expect(result1).toBeDefined();

    // Should not find candle outside 5-minute window
    const result2 = priceHistory.getCandle(baseTime + 6 * 60 * 1000); // +6 minutes
    expect(result2).toBeUndefined();
  });

  test("getCandlesSorted returns candles in correct order", () => {
    const candles = new Map<number, Candle>();

    // Add candles in random order
    const timestamps = [1700003600000, 1700000000000, 1700007200000];

    timestamps.forEach((timestamp) => {
      candles.set(timestamp, {
        granularity: "ONE_HOUR",
        timestamp,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
        live: false,
      });
    });

    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const sortedCandles = priceHistory.getCandlesSorted();

    expect(sortedCandles.length).toBe(timestamps.length);

    for (let i = 1; i < sortedCandles.length; i++) {
      const [prevTimestamp] = sortedCandles[i - 1];
      const [currentTimestamp] = sortedCandles[i];
      expect(prevTimestamp).toBeLessThan(currentTimestamp);
    }

    // Check that the first and last timestamps match our expected order
    expect(sortedCandles[0][0]).toBe(1700000000000);
    expect(sortedCandles[sortedCandles.length - 1][0]).toBe(1700007200000);
  });

  test("getTimestampsSorted returns timestamps in correct order", () => {
    const candles = new Map<number, Candle>();

    // Add candles in random order
    const timestamps = [1700003600000, 1700000000000, 1700007200000];

    timestamps.forEach((timestamp) => {
      candles.set(timestamp, {
        granularity: "ONE_HOUR",
        timestamp,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
        live: false,
      });
    });

    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);
    const sortedTimestamps = priceHistory.getTimestampsSorted();

    expect(sortedTimestamps.length).toBe(timestamps.length);

    for (let i = 1; i < sortedTimestamps.length; i++) {
      expect(sortedTimestamps[i - 1]).toBeLessThan(sortedTimestamps[i]);
    }

    expect(sortedTimestamps).toEqual([
      1700000000000, 1700003600000, 1700007200000,
    ]);
  });

  test("getCandlesInRange returns candles in correct range and order", () => {
    const candles = new Map<number, Candle>();

    // Add test candles with 1-hour intervals
    const timestamps = [
      1700000000000, // base
      1700003600000, // +1h
      1700007200000, // +2h
      1700010800000, // +3h
      1700014400000, // +4h
    ];

    timestamps.forEach((timestamp) => {
      candles.set(timestamp, {
        granularity: "ONE_HOUR",
        timestamp,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
        live: false,
      });
    });

    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);

    // Test getting candles from 1h to 3h (should include 1h, 2h, and 3h)
    const rangeCandles = priceHistory.getCandlesInRange(
      1700003600000, // +1h
      1700010800000 // +3h
    );

    // Check length
    expect(rangeCandles.length).toBe(3);

    // Check if timestamps are in ascending order
    for (let i = 1; i < rangeCandles.length; i++) {
      const [prevTimestamp] = rangeCandles[i - 1];
      const [currentTimestamp] = rangeCandles[i];
      expect(prevTimestamp).toBeLessThan(currentTimestamp);
    }

    // Verify exact timestamps included
    expect(rangeCandles.map(([timestamp]) => timestamp)).toEqual([
      1700003600000, // +1h
      1700007200000, // +2h
      1700010800000, // +3h
    ]);
  });

  test("getGaps returns correct gaps in the timeline", () => {
    const candles = new Map<number, Candle>();
    const baseTime = 1700000000000; // base time
    const hourInMs = 3600000; // 1 hour in milliseconds

    // Add candles with gaps
    // We'll add candles at hours 0, 1, 3, 4, 6 (leaving gaps at hours 2 and 5)
    [0, 1, 3, 4, 6].forEach((hour) => {
      candles.set(baseTime + hour * hourInMs, {
        granularity: "ONE_HOUR",
        timestamp: baseTime + hour * hourInMs,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
        live: false,
      });
    });

    const priceHistory = new SimplePriceHistory("ONE_HOUR", candles);

    // Get gaps from start to end (covering all 7 hours)
    const gaps = priceHistory.getGaps(baseTime, baseTime + 6 * hourInMs);

    // Should find two gaps: one at hour 2 and one at hour 5
    expect(gaps.length).toBe(2);

    // Verify the first gap (hour 2)
    expect(gaps[0]).toEqual({
      start: baseTime + 2 * hourInMs,
      end: baseTime + 3 * hourInMs,
    });

    // Verify the second gap (hour 5)
    expect(gaps[1]).toEqual({
      start: baseTime + 5 * hourInMs,
      end: baseTime + 6 * hourInMs,
    });
  });
});
