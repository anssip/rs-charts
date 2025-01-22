import { CandleRepository } from "./candle-repository";
import { FirestoreClient } from "./firestore-client";
import {
  Granularity,
  SimplePriceHistory,
} from "../../server/services/price-data/price-history-model";

export class ApiClient {
  private candleRepository: CandleRepository;
  private firestoreClient: FirestoreClient;

  constructor(
    candleRepository: CandleRepository,
    firestoreClient: FirestoreClient
  ) {
    this.candleRepository = candleRepository;
    this.firestoreClient = firestoreClient;
  }

  async fetchInitialChartData(
    symbol: string,
    granularity: Granularity,
    timeRange: { start: number; end: number }
  ) {
    const [candles, products] = await Promise.all([
      this.candleRepository.fetchCandles({
        symbol,
        granularity,
        timeRange,
      }),
      this.firestoreClient.getProducts("coinbase", "online"),
    ]);
    let priceHistory = null;
    if (candles.size > 0) {
      priceHistory = new SimplePriceHistory(
        granularity,
        new Map(candles.entries())
      );
    }
    return {
      candles,
      products,
      priceHistory,
    };
  }

  async refetchCandles(
    symbol: string,
    granularity: Granularity,
    timeRange: { start: number; end: number }
  ) {
    const candles = await this.candleRepository.fetchCandles({
      symbol,
      granularity,
      timeRange,
    });

    return {
      candles,
      priceHistory:
        candles.size > 0
          ? new SimplePriceHistory(granularity, new Map(candles.entries()))
          : null,
    };
  }
}
