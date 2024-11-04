import {
  CBAdvancedTradeClient,
  GetAdvTradePublicProductCandlesRequest,
} from "coinbase-api";

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}
export type CandleDataByTimestamp = Map<number, CandleData>;

export interface PriceDataOptions {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "30m" | "1h" | "2h" | "6h" | "1d";
  start: Date;
  end: Date;
}

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
    interval = "1h",
    start,
    end,
  }: PriceDataOptions): Promise<CandleDataByTimestamp> {
    try {
      const granularity = this.getGranularity(interval);

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

  private getGranularity(
    interval: string
  ): GetAdvTradePublicProductCandlesRequest["granularity"] {
    switch (interval) {
      case "1m":
        return "ONE_MINUTE";
      case "5m":
        return "FIVE_MINUTE";
      case "15m":
        return "FIFTEEN_MINUTE";
      case "30m":
        return "THIRTY_MINUTE";
      case "1h":
        return "ONE_HOUR";
      case "2h":
        return "TWO_HOUR";
      case "6h":
        return "SIX_HOUR";
      case "1d":
        return "ONE_DAY";
      default:
        return "ONE_HOUR";
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
