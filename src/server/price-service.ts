interface CMCCandle {
  time_open: string;
  time_close: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap: number;
  timestamp: string;
}

export interface PriceDataOptions {
  symbol: string;
  interval: "1h" | "1d" | "1w" | "1m";
  limit?: number;
}

export class PriceDataService {
  private readonly API_KEY: string;
  private readonly BASE_URL = "https://pro-api.coinmarketcap.com/v1";

  constructor(apiKey: string) {
    this.API_KEY = apiKey;
  }

  async fetchCandles({
    symbol = "BTC",
    interval = "1h",
    limit = 168,
  }: PriceDataOptions) {
    try {
      const response = await fetch(
        `${this.BASE_URL}/cryptocurrency/ohlcv/historical?symbol=${symbol}&interval=${interval}&count=${limit}`,
        {
          headers: {
            "X-CMC_PRO_API_KEY": this.API_KEY,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Error fetching price data:", response);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.transformData(data.data.quotes);
    } catch (error) {
      console.error("Error fetching price data:", error);
      throw error;
    }
  }

  private transformData(cmcCandles: CMCCandle[]) {
    return cmcCandles.map((candle) => ({
      timestamp: new Date(candle.time_open).getTime(),
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
  }
}
