interface CoinGeckoCandle {
  [0]: number; // timestamp
  [1]: number; // open
  [2]: number; // high
  [3]: number; // low
  [4]: number; // close
  [5]: number; // volume
}

export interface PriceDataOptions {
  symbol: string;
  interval: "hourly" | "daily";
  limit?: number;
}

export class PriceDataService {
  private readonly BASE_URL = "https://api.coingecko.com/api/v3";

  constructor(private apiKey: string) {
    this.apiKey = apiKey;
  }

  async fetchCandles({
    symbol = "bitcoin",
    interval = "hourly",
    limit = 168,
  }: PriceDataOptions): Promise<CandleData[]> {
    try {
      const response = await fetch(
        `${this.BASE_URL}/coins/${symbol}/ohlc?vs_currency=usd&days=${Math.ceil(
          limit / 24
        )}&interval=${interval}`,
        {
          headers: {
            "x-cg-demo-api-key": this.apiKey,
          },
        }
      );

      if (!response.ok) {
        console.error("Error fetching price data:", response);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: CoinGeckoCandle[] = await response.json();
      return this.transformData(data, interval);
    } catch (error) {
      console.error("Error fetching price data:", error);
      throw error;
    }
  }

  private transformData(
    candles: CoinGeckoCandle[],
    interval: string
  ): CandleData[] {
    // Filter data based on interval
    const filteredCandles = candles.filter((_, index) => {
      if (interval === "1h") return true; // Use all data for 1h interval
      if (interval === "1d") return index % 24 === 0; // Use every 24th data point for 1d interval
      // Add more interval logic as needed
      return true;
    });

    return filteredCandles.map((candle) => ({
      timestamp: candle[0],
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
    }));
  }
}
