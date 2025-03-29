import { ChartContainer } from "./components/chart/chart-container";
import {
  LiveCandleSubscription,
  LiveCandle,
} from "./api/live-candle-subscription";
import { Firestore } from "firebase/firestore";
import {
  CandleDataByTimestamp,
  Granularity,
  granularityToMs,
  numCandlesInRange,
  SimplePriceHistory,
  TimeRange,
} from "../server/services/price-data/price-history-model";
import { ChartState } from ".";
import { FirestoreClient } from "./api/firestore-client";
import { observe, xinValue } from "xinjs";
import { getCandleInterval } from "./util/chart-util";
import { config } from "./config";
import { CandleRepository } from "./api/candle-repository";

export class App {
  private chartContainer: ChartContainer | null = null;
  private readonly API_BASE_URL = config.apiBaseUrl;
  private candleRepository: CandleRepository;
  private liveCandleSubscription: LiveCandleSubscription;
  private state: ChartState;
  private firestoreClient: FirestoreClient;
  private isInitializing = true;
  private observersInitialized = false;
  private chartReadyHandled = false;

  constructor(private firestore: Firestore, state: ChartState) {
    this.state = state;
    this.chartContainer = document.querySelector("chart-container");
    this.candleRepository = new CandleRepository(this.API_BASE_URL);
    this.liveCandleSubscription = new LiveCandleSubscription(this.firestore);
    this.firestoreClient = new FirestoreClient(this.firestore);
    this.initialize();
    this.setupObservers();
    if (!this.chartContainer) {
      console.error("chart container not found");
    }
  }

  private hasIndicatorData() {
    const activeIndicators = xinValue(this.state.indicators) || [];
    const visibleCandles = this.state.priceHistory.getCandlesInRange(
      this.state.timeRange.start,
      this.state.timeRange.end
    );

    // Get the first candle to check for evaluations
    const firstCandle = visibleCandles[0]?.[1];
    if (!firstCandle) return false;

    // Filter out indicators that have skipFetch set to true
    const indicatorsRequiringData = activeIndicators.filter(
      (indicator) => !indicator.skipFetch
    );
    return indicatorsRequiringData.length === 0;
  }

  private setupObservers() {
    if (this.observersInitialized) return;

    observe("state.symbol", (_) => {
      if (!this.isInitializing) this.refetchData();
    });
    observe("state.granularity", (_) => {
      if (!this.isInitializing) this.refetchData();
    });
    observe("state.indicators", (_) => {
      if (!this.isInitializing) {
        if (!this.hasIndicatorData()) {
          this.refetchData();
        }
      }
    });

    this.observersInitialized = true;
  }

  async initialize() {
    if (!this.chartContainer) {
      return;
    }

    // Wait for chart container to be ready
    await new Promise<void>((resolve) => {
      const checkReady = () => {
        if (this.chartContainer?.isConnected) {
          resolve();
        } else {
          requestAnimationFrame(checkReady);
        }
      };
      checkReady();
    });

    this.chartContainer.addEventListener(
      "chart-ready",
      this.handleChartReady as unknown as EventListener
    );
    this.chartContainer.addEventListener(
      "chart-pan",
      this.handlePan as unknown as EventListener
    );
    this.chartContainer.addEventListener(
      "fetch-next-candle",
      this.handleFetchNextCandle as unknown as EventListener
    );
    this.startLiveCandleSubscription("BTC-USD", "ONE_HOUR");
  }

  getInitialTimeRange(): TimeRange {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;
    return {
      end: now + hourInMs, // 1 hour into the future
      start: now - 300 * hourInMs, // 300 hours back
    };
  }

  private handleChartReady = async (
    _: CustomEvent<{ visibleCandles: number }>
  ) => {
    if (this.chartReadyHandled) {
      return;
    }
    this.chartReadyHandled = true;

    this.isInitializing = true;
    const timeRange = this.getInitialTimeRange();

    const candles = await this.candleRepository.fetchCandles({
      symbol: xinValue(this.state.symbol),
      granularity: xinValue(this.state.granularity),
      timeRange,
      indicators: xinValue(this.state.indicators)?.map((i) => i.id),
      source: "initial-load",
    });

    if (candles.size > 0) {
      this.state.priceHistory = new SimplePriceHistory(
        xinValue(this.state.granularity),
        new Map(candles.entries())
      );

      const visibleCandles = this.chartContainer!.calculateVisibleCandles();
      const timestamps = Array.from(candles.keys()).sort((a, b) => a - b);
      const viewportEndTimestamp = timestamps[timestamps.length - 1];
      const viewportStartTimestamp =
        viewportEndTimestamp -
        visibleCandles * getCandleInterval(this.state.granularity);

      this.chartContainer!.endTimestamp = viewportEndTimestamp;
      this.chartContainer!.startTimestamp = viewportStartTimestamp;

      // Remove the separate buffer fetch since we included it in initial fetch
      this.state.timeRange = {
        start: viewportStartTimestamp,
        end: viewportEndTimestamp,
      };

      this.state.priceRange = this.state.priceHistory.getPriceRange(
        viewportStartTimestamp,
        viewportEndTimestamp
      );
      if (!this.chartContainer) {
        console.error("chart container not found");
        return;
      }
      this.chartContainer.state = this.state;

      const products = await this.firestoreClient.getMinimalProducts();
      this.chartContainer!.products = products;
    }
    observe("state.symbol", (_) => {
      this.refetchData();
    });
    observe("state.granularity", (_) => {
      // TODO: we need to fetch the data when we have both granularity and time range
      // TODO: combine these in the state
      this.refetchData();
    });
    observe("state.indicators", (_) => {
      // Check if we need to refetch by checking if all active indicators have evaluations
      const activeIndicators = xinValue(this.state.indicators) || [];
      const visibleCandles = this.state.priceHistory.getCandlesInRange(
        this.state.timeRange.start,
        this.state.timeRange.end
      );

      // Check if any visible candle is missing evaluations for any active indicator
      const needsRefetch = visibleCandles.some(([_, candle]) => {
        if (!candle.evaluations) return true;
        return activeIndicators.some(
          (indicator) => !candle.evaluations.find((e) => e.id === indicator.id)
        );
      });

      if (needsRefetch) {
        this.refetchData();
      }
    });
    this.isInitializing = false;
    setTimeout(() => {
      const candleInterval = getCandleInterval(this.state.granularity);
      this.chartContainer!.panTimeline(-5 * (candleInterval / 1000), 0.5);
    }, 1000);
  };

  private async refetchData() {
    const newCandles = await this.fetchData(
      this.state.symbol,
      this.state.granularity,
      this.state.timeRange,
      false,
      "refetch-data"
    );
    if (newCandles) {
      this.state.priceHistory = new SimplePriceHistory(
        this.state.granularity,
        newCandles
      );
      this.state.priceRange = this.state.priceHistory.getPriceRange(
        xinValue(this.state.timeRange.start),
        xinValue(this.state.timeRange.end)
      );
      this.chartContainer!.state = this.state;
      this.chartContainer!.draw();

      this.startLiveCandleSubscription(
        this.state.symbol,
        this.state.granularity
      );
    }
  }

  private handlePan = async (event: CustomEvent) => {
    if (!this.chartContainer) return;

    const { timeRange, needMoreData } = event.detail;

    if (needMoreData && timeRange) {
      const newCandles = await this.fetchData(
        this.state.symbol,
        this.state.granularity,
        timeRange,
        false,
        "handle-pan"
      );
      if (newCandles) {
        this.state.priceHistory = new SimplePriceHistory(
          this.state.granularity,
          newCandles
        );
        this.chartContainer.state = this.state;
      }
    }
  };

  private handleFetchNextCandle = async (event: CustomEvent) => {
    const { granularity, timeRange } = event.detail;
    const newCandles = await this.fetchData(
      this.state.symbol,
      granularity,
      timeRange,
      false,
      "fetch-next-candle"
    );
    if (newCandles) {
      this.state.priceHistory = new SimplePriceHistory(granularity, newCandles);
      this.chartContainer!.state = this.state;
    }
  };

  private async fetchData(
    symbol: string,
    granularity: Granularity,
    timeRange: TimeRange,
    skipCache: boolean = false,
    source: string = "unknown"
  ): Promise<CandleDataByTimestamp | null> {
    const candleCount = numCandlesInRange(
      granularity,
      timeRange.start,
      timeRange.end
    );
    const MAX_CANDLES = 300;
    const adjustedTimeRange =
      candleCount > MAX_CANDLES
        ? {
            start: timeRange.end - MAX_CANDLES * granularityToMs(granularity),
            end: timeRange.end,
          }
        : timeRange;

    this.state.loading = true;
    try {
      const candles = await this.candleRepository.fetchCandles({
        symbol,
        granularity,
        timeRange: adjustedTimeRange,
        indicators: xinValue(this.state.indicators)
          ?.filter((i) => !i.skipFetch)
          .map((i) => i.id),
        skipCache,
        source,
      });
      return candles;
    } finally {
      this.state.loading = false;
    }
  }

  private startLiveCandleSubscription(
    symbol: string,
    granularity: Granularity
  ): void {
    this.liveCandleSubscription.subscribe(
      symbol,
      granularity,
      async (liveCandle: LiveCandle) => {
        if (this.chartContainer?.updateLiveCandle(liveCandle)) {
          this.state.liveCandle = liveCandle;
        }
      }
    );
  }

  public async fetchGaps(): Promise<void> {
    const gaps = this.state.priceHistory.getGaps(
      this.state.timeRange.start,
      this.state.timeRange.end
    );
    if (gaps.length === 0) {
      return;
    }
    const widenGap = (gap: TimeRange) => ({
      start: gap.start - this.state.priceHistory.granularityMs,
      end: gap.end + this.state.priceHistory.granularityMs,
    });
    // fetch the data for the gaps
    const results = await Promise.all(
      gaps.map((gap) =>
        this.fetchData(
          this.state.symbol,
          this.state.granularity,
          widenGap(gap),
          true, // skip cache to make sure we get also partially filled live candles
          "fetch-gaps"
        )
      )
    );
    // The last result is the new candles. The CandleRepository always returns
    // all accumulated candles, that it has ever fetched and we can pop the latest one.
    const newCandles = results.pop();

    this.state.priceHistory = new SimplePriceHistory(
      this.state.granularity,
      new Map(newCandles)
    );
    if (this.chartContainer) {
      this.chartContainer.state = this.state;
      this.chartContainer.draw();
    }
  }

  public cleanup(): void {
    // @ts-ignore
    // TODO: Make the subscription handle cleanup on page hide
    this.liveCandleSubscription!.unsubscribe();
  }
}
