import { ChartContainer } from "./components/chart/chart-container";
import { CandleRepository } from "./candle-repository";
import { LiveCandleSubscription, LiveCandle } from './live-candle-subscription';
import { Firestore } from 'firebase/firestore';

export class App {
  private chartContainer: ChartContainer | null = null;
  private readonly API_BASE_URL = "http://localhost:3000";
  private candleRepository: CandleRepository;
  private pendingFetches: Set<string> = new Set();
  private liveCandleSubscription: LiveCandleSubscription;

  constructor(private firestore: Firestore) {
    console.log("App: Constructor called");
    this.chartContainer = document.querySelector("chart-container");
    console.log("App: Found chart container:", !!this.chartContainer);

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

    this.startLiveCandleSubscription('BTC-USD');
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
      this.chartContainer!.data = candles;
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

      try {
        this.pendingFetches.add(rangeKey);
        console.log("fetching time range:", timeRange);

        const newCandles = await this.candleRepository.fetchCandlesForTimeRange(
          timeRange
        );
        this.chartContainer.data = newCandles;
      } finally {
        this.pendingFetches.delete(rangeKey);
      }
    }
  };

  private startLiveCandleSubscription(productId: string): void {
    this.liveCandleSubscription.subscribe(productId, (liveCandle: LiveCandle) => {
      console.log("App: Received live candle:", liveCandle);
      this.chartContainer?.updateLiveCandle(liveCandle);
    });
  }

  public cleanup(): void {
    // @ts-ignore
    this.liveCandleSubscription!.unsubscribe();
  }
}
