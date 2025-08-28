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
import { getLogger, LogLevel } from "./util/logger";
import { getLocalChartId } from "./util/state-context";

const logger = getLogger("App");
logger.setLoggerLevel("App", LogLevel.ERROR);

export class App {
  private chartContainer: ChartContainer;
  private readonly API_BASE_URL = config.apiBaseUrl;
  private candleRepository: CandleRepository;
  private liveCandleSubscription: LiveCandleSubscription;
  private state: ChartState;
  private firestoreClient: FirestoreClient;
  private isInitializing = true;
  private isChangingGranularity = false;
  private observersInitialized = false;
  private chartReadyHandled = false;
  private _chartId: string = "state";

  constructor(
    chartContainerElement: ChartContainer,
    private firestore: Firestore,
    state: ChartState,
  ) {
    this.state = state;
    this.chartContainer = chartContainerElement;
    this.chartContainer = chartContainerElement;
    this.candleRepository = new CandleRepository(this.API_BASE_URL);
    this.liveCandleSubscription = new LiveCandleSubscription(this.firestore);
    this.firestoreClient = new FirestoreClient(this.firestore);

    if (!this.chartContainer) {
      logger.error(
        "App constructor received an invalid chart container element.",
      );
      return;
    }

    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this.chartContainer);

    this.initialize();
    this.setupObservers();
  }

  private hasIndicatorData() {
    const activeIndicators = xinValue(this.state.indicators) || [];
    const visibleCandles = this.state.priceHistory.getCandlesInRange(
      this.state.timeRange.start,
      this.state.timeRange.end,
    );

    // Get the first candle to check for evaluations
    const firstCandle = visibleCandles[0]?.[1];
    if (!firstCandle) return false;

    // Filter out indicators that have skipFetch set to true
    const indicatorsRequiringData = activeIndicators.filter(
      (indicator) => !indicator.skipFetch,
    );
    return indicatorsRequiringData.length === 0;
  }

  private setupObservers() {
    if (this.observersInitialized) return;

    observe(`${this._chartId}.symbol`, (_) => {
      if (!this.isInitializing) {
        this.refetchData();
        // Restart live subscription with new symbol
        this.startLiveCandleSubscription(this.state.symbol, this.state.granularity);
      }
    });
    observe(`${this._chartId}.granularity`, (_) => {
      if (!this.isInitializing) {
        this.handleGranularityChange();
      }
    });
    observe(`${this._chartId}.indicators`, (_) => {
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
      logger.error("Initialization skipped: Chart container not available.");
      logger.error("Initialization skipped: Chart container not available.");
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
      this.handleChartReady as unknown as EventListener,
    );
    this.chartContainer.addEventListener(
      "chart-pan",
      this.handlePan as unknown as EventListener,
    );
    this.chartContainer.addEventListener(
      "fetch-next-candle",
      this.handleFetchNextCandle as unknown as EventListener,
    );
    this.startLiveCandleSubscription(
      xinValue(this.state.symbol) || "BTC-USD", 
      xinValue(this.state.granularity) || "ONE_HOUR"
    );
  }

  getInitialTimeRange(): TimeRange {
    const now = Date.now();
    const granularity = xinValue(this.state.granularity) || "ONE_HOUR";
    const intervalMs = granularityToMs(granularity);
    
    // Calculate minimum candles needed:
    // - Base amount for visible viewport (estimate ~100 candles for typical screen)
    // - Add buffer for panning (2x the visible amount on each side)
    // This gives us ~5x the visible amount total
    const visibleCandles = this.chartContainer?.calculateVisibleCandles() || 100;
    const minCandlesNeeded = visibleCandles * 5;
    
    // Use a minimum of 300 candles to ensure good initial coverage
    // but scale up for larger granularities to ensure adequate time coverage
    const targetCandles = Math.max(300, minCandlesNeeded);
    
    // For daily candles, ensure we have at least 365 days (1 year) of data
    // For 6-hour candles, ensure at least 90 days
    // For smaller granularities, the 300 minimum is sufficient
    let adjustedCandles = targetCandles;
    if (granularity === "ONE_DAY") {
      adjustedCandles = Math.max(365, targetCandles);
    } else if (granularity === "SIX_HOUR") {
      adjustedCandles = Math.max(360, targetCandles); // 90 days * 4 candles per day
    } else if (granularity === "TWO_HOUR") {
      adjustedCandles = Math.max(360, targetCandles); // 30 days * 12 candles per day
    }
    
    // Calculate time range based on the adjusted candle count
    const totalTimeMs = adjustedCandles * intervalMs;
    
    return {
      end: now + intervalMs, // 1 candle into the future
      start: now - totalTimeMs, // Calculated candles back
    };
  }

  private handleChartReady = async (
    _: CustomEvent<{ visibleCandles: number }>,
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
      logger.debug("App: setting price history with candles: ", candles.size);
      this.state.priceHistory = new SimplePriceHistory(
        xinValue(this.state.granularity),
        new Map(candles.entries()),
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
        viewportEndTimestamp,
      );
      if (!this.chartContainer) {
        logger.error("chart container not found");
        return;
      }
      this.chartContainer.state = this.state;

      const products = await this.firestoreClient.getMinimalProducts();
      this.chartContainer!.products = products;
    }
    // Start live subscription with the chart's actual symbol and granularity
    this.startLiveCandleSubscription(
      xinValue(this.state.symbol),
      xinValue(this.state.granularity)
    );
    this.isInitializing = false;
    setTimeout(() => {
      const candleInterval = getCandleInterval(this.state.granularity);
      this.chartContainer!.panTimeline(-5 * (candleInterval / 1000), 0.5);
    }, 1000);
  };

  private async handleGranularityChange() {
    // Set flag to prevent premature drawing
    this.isChangingGranularity = true;
    this.state.isTransitioning = true;
    
    // Constants from drawing-strategy.ts to ensure consistency
    const FIXED_GAP_WIDTH = 6; // pixels
    const MIN_CANDLE_WIDTH = 5; // pixels
    const dpr = window.devicePixelRatio ?? 1;
    
    // Get canvas width
    const canvasWidth = (this.chartContainer?.clientWidth || 800) * dpr;
    
    // Get current state
    const currentEnd = this.state.timeRange.end;
    const currentStart = this.state.timeRange.start;
    const currentTimeRange = currentEnd - currentStart;
    const oldGranularityMs = granularityToMs(this.state.priceHistory?.getGranularity() || "ONE_HOUR");
    const newGranularityMs = granularityToMs(this.state.granularity);
    
    console.log("=== Granularity Change Debug ===");
    console.log("Old granularity:", this.state.priceHistory?.getGranularity(), "ms:", oldGranularityMs);
    console.log("New granularity:", this.state.granularity, "ms:", newGranularityMs);
    console.log("Current viewport:", new Date(currentStart).toISOString(), "to", new Date(currentEnd).toISOString());
    console.log("Canvas width:", canvasWidth / dpr, "px (without dpr)");
    
    // Determine if we're near the right edge or in a panned/zoomed state
    const lastPossibleCandleTime = Math.floor(currentEnd / oldGranularityMs) * oldGranularityMs;
    
    // Check if we're looking at current/live data or shifted data (past or future)
    const now = Date.now();
    const hoursFromNow = (now - currentEnd) / (1000 * 60 * 60);
    // Consider it shifted data if viewing data >2 hours in the past OR any future data
    const isViewingShiftedData = hoursFromNow > 2 || currentEnd > now;
    
    // Check if the last candle is even in the viewport
    const isLastCandleVisible = lastPossibleCandleTime >= currentStart && lastPossibleCandleTime <= currentEnd;
    
    let lastCandleX = 0;
    let distanceFromRightEdge = 0;
    let isNearRightEdge = false;
    
    if (isLastCandleVisible) {
      lastCandleX = ((lastPossibleCandleTime - currentStart) / currentTimeRange) * (canvasWidth / dpr);
      distanceFromRightEdge = (canvasWidth / dpr) - lastCandleX;
      // Only consider it "near edge" if we're viewing current data and physically near the edge
      isNearRightEdge = !isViewingShiftedData && distanceFromRightEdge < 20;
    } else {
      // If last candle isn't visible, we're definitely panned/zoomed
      isNearRightEdge = false;
      console.log("Last candle not visible in viewport - using center preservation");
    }
    
    console.log("Last possible candle time:", new Date(lastPossibleCandleTime).toISOString());
    console.log("Current time:", new Date(now).toISOString());
    console.log("Hours from now:", hoursFromNow.toFixed(1));
    console.log("Is viewing shifted data (past or future):", isViewingShiftedData);
    console.log("Is last candle visible:", isLastCandleVisible);
    if (isLastCandleVisible) {
      console.log("Last candle position:", lastCandleX, "px, distance from edge:", distanceFromRightEdge, "px");
    }
    console.log("Is near right edge:", isNearRightEdge);
    
    let referenceTime;
    let targetScreenPosition; // X position in pixels from left
    
    if (isNearRightEdge) {
      // When near the edge, preserve the rightmost candle position
      referenceTime = lastPossibleCandleTime;
      targetScreenPosition = lastCandleX;
      console.log("Using edge preservation mode - keeping rightmost candle at", targetScreenPosition, "px");
    } else {
      // When panned/zoomed, find the candle closest to viewport center
      const viewportCenterX = (canvasWidth / dpr) / 2;
      let closestCandle = null;
      let minDistance = Infinity;
      
      // Find all visible candles
      for (let t = Math.floor(currentStart / oldGranularityMs) * oldGranularityMs; 
           t <= currentEnd; 
           t += oldGranularityMs) {
        if (t >= currentStart && t <= currentEnd) {
          const x = ((t - currentStart) / currentTimeRange) * (canvasWidth / dpr);
          const distance = Math.abs(x - viewportCenterX);
          if (distance < minDistance) {
            minDistance = distance;
            closestCandle = { time: t, x: x };
          }
        }
      }
      
      if (closestCandle) {
        referenceTime = closestCandle.time;
        targetScreenPosition = closestCandle.x;
        console.log("Using center preservation mode - keeping candle at", targetScreenPosition, "px");
      } else {
        // Fallback
        referenceTime = currentStart + (currentTimeRange / 2);
        targetScreenPosition = viewportCenterX;
        console.log("Using fallback center mode");
      }
    }
    
    console.log("Reference time:", new Date(referenceTime).toISOString());
    console.log("Target screen position:", targetScreenPosition, "px from left");
    
    // Find the corresponding candle in the new granularity
    // This is the candle at or just before the same timestamp
    let targetCandleTime = Math.floor(referenceTime / newGranularityMs) * newGranularityMs;
    
    console.log("Target candle in new granularity:", new Date(targetCandleTime).toISOString());
    
    // Calculate how many candles should be visible
    const pixelsPerCandle = MIN_CANDLE_WIDTH + FIXED_GAP_WIDTH;
    const maxCandlesInViewport = Math.floor(canvasWidth / pixelsPerCandle);
    let targetCandleCount = Math.ceil(currentTimeRange / oldGranularityMs);
    targetCandleCount = Math.min(targetCandleCount, maxCandlesInViewport);
    targetCandleCount = Math.max(10, targetCandleCount);
    
    console.log("Target candle count:", targetCandleCount);
    console.log("Max candles that can fit:", maxCandlesInViewport);
    
    // Calculate new viewport to preserve the pixel position
    const newTimeSpan = targetCandleCount * newGranularityMs;
    
    // We want the targetCandleTime to be at the same screen position
    // So: (targetCandleTime - newStart) / newTimeSpan = targetScreenPosition / (canvasWidth / dpr)
    // Rearranging: targetCandleTime - newStart = (targetScreenPosition / (canvasWidth / dpr)) * newTimeSpan
    // Therefore: newStart = targetCandleTime - (targetScreenPosition / (canvasWidth / dpr)) * newTimeSpan
    
    const proportionFromLeft = targetScreenPosition / (canvasWidth / dpr);
    const newStart = targetCandleTime - (proportionFromLeft * newTimeSpan);
    const newEnd = newStart + newTimeSpan;
    
    console.log("Proportion from left:", proportionFromLeft);
    console.log("New time span:", newTimeSpan / (1000 * 60 * 60), "hours");
    console.log("New viewport:", new Date(newStart).toISOString(), "to", new Date(newEnd).toISOString());
    
    // Verify the position will be preserved
    const verifyX = ((targetCandleTime - newStart) / newTimeSpan) * (canvasWidth / dpr);
    console.log("Verification - new X position will be:", verifyX, "px from left");
    console.log("Verification - difference from target:", verifyX - targetScreenPosition, "px");
    console.log("=== End Debug ===");
    
    // Create new time range object
    const adjustedTimeRange = {
      start: newStart,
      end: newEnd
    };
    
    // Fetch data with the new granularity and adjusted time range
    const newCandles = await this.fetchData(
      this.state.symbol,
      this.state.granularity,
      adjustedTimeRange,
      false,
      "granularity-change",
    );
    
    if (newCandles) {
      // Create new price history with the new granularity
      const newPriceHistory = new SimplePriceHistory(
        this.state.granularity,
        newCandles,
      );
      
      // Calculate price range for the new viewport
      const newPriceRange = newPriceHistory.getPriceRange(
        adjustedTimeRange.start,
        adjustedTimeRange.end,
      );
      
      // Batch update all state properties at once
      // This ensures only one draw() call with all correct values
      this.state.timeRange = adjustedTimeRange;
      this.state.priceHistory = newPriceHistory;
      this.state.priceRange = newPriceRange;
      
      // Clear the transitioning flag before final state update
      this.state.isTransitioning = false;
      
      // Now update the chart container with the complete, consistent state
      // This triggers only one draw() with all values correctly set
      this.chartContainer!.state = this.state;
      
      // Clear the internal flag
      this.isChangingGranularity = false;
      
      // Trigger a single draw with all correct values
      this.chartContainer!.draw();
    } else {
      // Clear flags even if fetch failed
      this.state.isTransitioning = false;
      this.chartContainer!.state = this.state;
    }
    
    // Clear the flag even if fetch failed
    this.isChangingGranularity = false;
    
    // Restart live subscription with new granularity
    this.startLiveCandleSubscription(this.state.symbol, this.state.granularity);
  }

  private async refetchData() {
    const newCandles = await this.fetchData(
      this.state.symbol,
      this.state.granularity,
      this.state.timeRange,
      false,
      "refetch-data",
    );
    if (newCandles) {
      this.state.priceHistory = new SimplePriceHistory(
        this.state.granularity,
        newCandles,
      );
      this.state.priceRange = this.state.priceHistory.getPriceRange(
        xinValue(this.state.timeRange.start),
        xinValue(this.state.timeRange.end),
      );
      this.chartContainer!.state = this.state;
      this.chartContainer!.draw();

      this.startLiveCandleSubscription(
        this.state.symbol,
        this.state.granularity,
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
        "handle-pan",
      );
      if (newCandles) {
        this.state.priceHistory = new SimplePriceHistory(
          this.state.granularity,
          newCandles,
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
      "fetch-next-candle",
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
    source: string = "unknown",
  ): Promise<CandleDataByTimestamp | null> {
    const candleCount = numCandlesInRange(
      granularity,
      timeRange.start,
      timeRange.end,
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
    granularity: Granularity,
  ): void {
    this.liveCandleSubscription.subscribe(
      symbol,
      granularity,
      async (liveCandle: LiveCandle) => {
        if (this.chartContainer?.updateLiveCandle(liveCandle)) {
          this.state.liveCandle = liveCandle;
        }
      },
    );
  }

  public async fetchGaps(): Promise<void> {
    const gaps = this.state.priceHistory.getGaps(
      this.state.timeRange.start,
      this.state.timeRange.end,
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
          "fetch-gaps",
        ),
      ),
    );
    // The last result is the new candles. The CandleRepository always returns
    // all accumulated candles, that it has ever fetched and we can pop the latest one.
    const newCandles = results.pop();

    this.state.priceHistory = new SimplePriceHistory(
      this.state.granularity,
      new Map(newCandles),
    );
    if (this.chartContainer) {
      this.chartContainer.state = this.state;
      this.chartContainer.draw();
    }
  }

  public cleanup(): void {
    // Clean up live candle subscription completely
    if (this.liveCandleSubscription) {
      this.liveCandleSubscription.dispose();
    }
    
    // Remove event listeners
    if (this.chartContainer) {
      this.chartContainer.removeEventListener(
        "chart-ready",
        this.handleChartReady as unknown as EventListener,
      );
      this.chartContainer.removeEventListener(
        "chart-pan",
        this.handlePan as unknown as EventListener,
      );
      this.chartContainer.removeEventListener(
        "fetch-next-candle",
        this.handleFetchNextCandle as unknown as EventListener,
      );
    }
  }

  public getState(): ChartState {
    return this.state;
  }
}
