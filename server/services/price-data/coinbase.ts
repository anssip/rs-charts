import { CBAdvancedTradeClient } from "coinbase-api";
import {
  CandleData,
  CandleDataByTimestamp,
  Granularity,
  PriceDataOptions,
} from "./price-history-model";

export class CoinbasePriceDataService {
  private readonly client: CBAdvancedTradeClient;

  constructor(apiKey: string, privateKey: string) {
    console.log("Initializing Coinbase client with:");
    console.log("API Key length:", apiKey.length);
    console.log("Private Key starts with:", privateKey.substring(0, 27));

    this.client = new CBAdvancedTradeClient({
      apiKey: apiKey.trim(),
      apiSecret: privateKey.trim(),
    });
  }

  async fetchCandles({
    symbol = "BTC-USD",
    granularity = "ONE_HOUR",
    start,
    end,
  }: PriceDataOptions): Promise<CandleDataByTimestamp> {
    try {
      console.log("Making Coinbase API request with params:", {
        product_id: symbol,
        start: Math.floor(start.getTime() / 1000),
        end: Math.floor(end.getTime() / 1000),
        granularity,
      });

      const response = await this.client.getProductCandles({
        product_id: symbol,
        start: Math.floor(start.getTime() / 1000).toString(),
        end: Math.floor(end.getTime() / 1000).toString(),
        granularity: granularity,
      });

      return this.transformData(response.candles, granularity);
    } catch (error) {
      if (error instanceof Error && "response" in error) {
        const typedError = error as {
          response: {
            status: number;
            statusText: string;
            headers: any;
            data: any;
          };
        };
        console.error("Coinbase API Error Response:", {
          status: typedError.response.status,
          statusText: typedError.response.statusText,
          headers: typedError.response.headers,
          data: typedError.response.data,
        });
      }
      throw error;
    }
  }

  private transformData(
    candles: any[],
    granularity: Granularity
  ): CandleDataByTimestamp {
    return candles.reduce((data, candle) => {
      data.set(candle.start * 1000, {
        timestamp: candle.start * 1000,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        granularity: granularity,
      });
      return data;
    }, new Map<number, CandleData>());
  }
}
