import {
  CANDLE_INTERVAL,
  ChartContainer,
} from "./components/chart/chart-container";
import { CandleRepository } from "./candle-repository";
import { LiveCandleSubscription, LiveCandle } from "./live-candle-subscription";
import { Firestore } from "firebase/firestore";
import {
  CandleDataByTimestamp,
  SimplePriceHistory,
} from "../server/services/price-data/price-history-model";
import { ChartState } from ".";

export class App {
  private chartContainer: ChartContainer | null = null;
  private readonly API_BASE_URL = "http://localhost:3000";
  private candleRepository: CandleRepository;
  private pendingFetches: Set<string> = new Set();
  private liveCandleSubscription: LiveCandleSubscription;
  private state: ChartState;

  constructor(private firestore: Firestore, state: ChartState) {
    console.log("App: Constructor called");
    this.state = state;

    this.chartContainer = document.querySelector("chart-container");

    this.candleRepository = new CandleRepository(this.API_BASE_URL);
    this.liveCandleSubscription = new LiveCandleSubscription(this.firestore);

    this.initialize();
  }

  async initialize() {
    if (!this.chartContainer) {
      console.error("Chart container component not found");
      return;
    }

    this.chartContainer.addEventListener(
      "chart-ready",
      this.handleChartReady as unknown as EventListener
    );
    this.chartContainer.addEventListener(
      "chart-pan",
      this.handlePan as unknown as EventListener
    );

    console.log("App: Initialized with event listeners");

    this.startLiveCandleSubscription("BTC-USD");
  }

  private handleChartReady = async (
    event: CustomEvent<{ visibleCandles: number }>
  ) => {
    console.log("handleChartReady event:", event);

    const now = Date.now();
    // move a bit forward from now to reach the current candle
    // TODO: this might need to be based on the granularity
    const end = new Date(now + 1000 * 60 * 60);

    const timeRange = {
      end: end.getTime(),
      start: now - 10 * 24 * 60 * 60 * 1000, // 10 days back
    };

    console.log("Initial fetch params:", {
      timeRange: {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
    });

    const candles = await this.candleRepository.fetchCandlesForTimeRange(
      timeRange
    );
    if (candles.size > 0) {
      console.log("Initial data fetched, number of candles:", candles.size);

      this.state.priceHistory = new SimplePriceHistory(
        "ONE_HOUR",
        new Map(candles.entries())
      );

      const visibleCandles = this.chartContainer!.calculateVisibleCandles();
      const timestamps = Array.from(candles.keys()).sort((a, b) => a - b);
      const viewportEndTimestamp = timestamps[timestamps.length - 1];
      const viewportStartTimestamp =
        viewportEndTimestamp - visibleCandles * CANDLE_INTERVAL;

      this.chartContainer!.endTimestamp = viewportEndTimestamp;
      this.chartContainer!.startTimestamp = viewportStartTimestamp;

      this.state.timeRange = { start: viewportStartTimestamp, end: viewportEndTimestamp };

      this.state.priceRange = this.state.priceHistory.getPriceRange(
        viewportStartTimestamp,
        viewportEndTimestamp
      );
      console.log("App: priceRange", this.state.priceRange);
      if (this.chartContainer) {
        this.chartContainer.state = this.state;
      }
    }
  };

  private handlePan = async (event: CustomEvent) => {
    console.log("handlePan event:", event);
    if (!this.chartContainer) return;

    const { timeRange, visibleCandles, needMoreData, isNearEdge, direction } =
      event.detail;

    // Only handle data fetching
    if (needMoreData && timeRange) {
      const rangeKey = `${timeRange.start}-${timeRange.end}`;

      // Check if we're already fetching this range
      if (this.pendingFetches.has(rangeKey)) {
        console.log("Already fetching range:", timeRange);
        return;
      }

      const newCandles = await this.fetchData(timeRange);
      if (newCandles) {
        this.state.priceHistory = new SimplePriceHistory(
          "ONE_HOUR",
          newCandles
        );
        this.chartContainer.state = this.state;
      }
    }
  };

  private fetchData(timeRange: {
    start: number;
    end: number;
  }): Promise<CandleDataByTimestamp | null> {
    const rangeKey = `${timeRange.start}-${timeRange.end}`;

    if (this.pendingFetches.has(rangeKey)) {
      console.log("Already fetching range:", timeRange);
      return Promise.resolve(null);
    }
    try {
      this.pendingFetches.add(rangeKey);
      console.log("fetching time range:", timeRange);

      return this.candleRepository.fetchCandlesForTimeRange(timeRange);
    } finally {
      this.pendingFetches.delete(rangeKey);
    }
  }

  private startLiveCandleSubscription(productId: string): void {
    this.liveCandleSubscription.subscribe(
      productId,
      async (liveCandle: LiveCandle) => {
        console.log("App: Received live candle:", liveCandle);

        const oldState = {
          ...this.state,
        };
        this.state.liveCandle = liveCandle;
        this.chartContainer?.requestUpdate("state", oldState);

        this.chartContainer?.updateLiveCandle(liveCandle);
        if (
          liveCandle.timestamp > (this.state.priceHistory.endTimestamp ?? 0)
        ) {
          console.log("Fetching more data up to the live candle:", liveCandle);
          if (!this.state.priceHistory.endTimestamp) {
            console.error("No end timestamp found");
            return;
          }
          const timeRange = {
            start: this.state.priceHistory.endTimestamp,
            end: liveCandle.timestamp,
          };
          const newCandles = await this.fetchData(timeRange);
          this.state.priceHistory = new SimplePriceHistory(
            "ONE_HOUR",
            new Map(newCandles)
          );
          if (this.chartContainer) {
            this.chartContainer.state = this.state;
          }
        }
      }
    );
  }

  public cleanup(): void {
    // @ts-ignore
    this.liveCandleSubscription!.unsubscribe();
  }
}
