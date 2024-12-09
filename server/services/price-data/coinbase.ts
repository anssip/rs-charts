import { CBAdvancedTradeClient } from "coinbase-api";
import {
  CandleData,
  CandleDataByTimestamp,
  PriceDataOptions,
} from "./price-history-model";

export class CoinbasePriceDataService {
  private readonly client: CBAdvancedTradeClient;

  constructor(apiKey: string, privateKey: string) {
    this.client = new CBAdvancedTradeClient({
      apiKey,
      apiSecret: privateKey,
    });
  }

  async fetchCandles({
    symbol = "BTC-USD",
    granularity = "ONE_HOUR",
    start,
    end,
  }: PriceDataOptions): Promise<CandleDataByTimestamp> {
    try {
      console.log("Fetching candles with time range:", {
        start: start,
        end: end,
        granularity,
      });

      const response = await this.client.getProductCandles({
        product_id: symbol,
        start: Math.floor(start.getTime() / 1000).toString(),
        end: Math.floor(end.getTime() / 1000).toString(),
        granularity: granularity,
      });

      return this.transformData(response.candles);
    } catch (error) {
      console.error("Error fetching price data:", error);
      throw error;
    }
  }

  private transformData(candles: any[]): CandleDataByTimestamp {
    return candles.reduce((data, candle) => {
      data.set(candle.start * 1000, {
        timestamp: candle.start * 1000,
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
      });
      return data;
    }, new Map<number, CandleData>());
  }
}
