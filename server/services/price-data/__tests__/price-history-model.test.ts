import { expect, test, describe } from "bun:test";
import {
  SimplePriceHistory,
  type CandleData,
  type CandleDataByTimestamp,
} from "../price-history-model";

describe("SimplePriceHistory", () => {
  // Helper function to create test data
  function createTestCandles(): CandleDataByTimestamp {
    const candles = new Map<number, CandleData>();

    // Add some test candles at 1-hour intervals
    const baseTime = 1700000000000; // Some fixed timestamp
    const testData: CandleData[] = [
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
      },
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime + 3600000, // +1 hour
        open: 105,
        high: 115,
        low: 95,
        close: 110,
      },
      {
        granularity: "ONE_HOUR",
        timestamp: baseTime + 7200000, // +2 hours
        open: 110,
        high: 120,
        low: 100,
        close: 115,
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
    const fiveMinCandles = new Map<number, CandleData>();
    const baseTime = 1700000000000;
    const candle: CandleData = {
      granularity: "FIVE_MINUTE",
      timestamp: baseTime,
      open: 100,
      high: 110,
      low: 90,
      close: 105,
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
});
