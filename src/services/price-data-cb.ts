import {
  CBAdvancedTradeClient,
  GetAdvTradePublicProductCandlesRequest,
} from "coinbase-api";

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface PriceDataOptions {
  symbol: string;
  interval: "1m" | "5m" | "15m" | "30m" | "1h" | "2h" | "6h" | "1d";
  limit?: number;
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
    limit = 10,
  }: PriceDataOptions): Promise<CandleData[]> {
    try {
      const granularity = this.getGranularity(interval);
      const end = new Date();
      const start = new Date(
        end.getTime() - limit * this.getGranularitySeconds(granularity) * 1000
      );
      console.log({ start, end });

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

  private getGranularitySeconds(
    granularity: GetAdvTradePublicProductCandlesRequest["granularity"]
  ): number {
    switch (granularity) {
      case "ONE_MINUTE":
        return 60;
      case "FIVE_MINUTE":
        return 300;
      case "FIFTEEN_MINUTE":
        return 900;
      case "THIRTY_MINUTE":
        return 1800;
      case "ONE_HOUR":
        return 3600;
      case "TWO_HOUR":
        return 7200;
      case "SIX_HOUR":
        return 21600;
      case "ONE_DAY":
        return 86400;
      default:
        return 3600;
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

  private transformData(candles: any[]): CandleData[] {
    return candles.map((candle) => ({
      timestamp: candle.start * 1000,
      open: parseFloat(candle.open),
      high: parseFloat(candle.high),
      low: parseFloat(candle.low),
      close: parseFloat(candle.close),
    }));
  }
}
