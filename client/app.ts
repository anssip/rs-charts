import { CandlestickChart } from "./components/candlestick-chart";
import { CandleRepository } from "./candle-repository";

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export class App {
  private chart: CandlestickChart | null = null;
  private readonly API_BASE_URL = "http://localhost:3000";
  private candleRepository: CandleRepository;
  private pendingFetches: Set<string> = new Set();

  constructor() {
    this.chart = document.querySelector("candlestick-chart");
    this.candleRepository = new CandleRepository(this.API_BASE_URL);
    this.chart?.addEventListener(
      "chart-ready",
      this.handleChartReady as unknown as EventListener
    );
    this.chart?.addEventListener(
      "chart-pan",
      this.handlePan as unknown as EventListener
    );
  }

  private handleChartReady = async (
    event: CustomEvent<{ visibleCandles: number }>
  ) => {
    const now = Date.now();

    const timeRange = {
      end: now,
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
      this.chart!.data = candles;
      this.chart!.drawChart();
    }
  };

  async initialize() {
    if (!this.chart) {
      console.error("Chart component not found");
      return;
    }
  }

  private async fetchAndUpdateChart(visibleCandles: number) {
    const bufferedCandles = visibleCandles * 2;
    const now = Date.now();
    const timeRange = {
      start: now - bufferedCandles * this.candleRepository.CANDLE_INTERVAL,
      end: now,
    };

    console.log("Fetching time range:", {
      start: new Date(timeRange.start),
      end: new Date(timeRange.end),
      bufferedCandles,
      visibleCandles,
    });

    const candles = await this.candleRepository.fetchCandlesForTimeRange(
      timeRange
    );
    console.log("Fetched candles:", candles.size);
    if (candles.size > 0) {
      this.chart!.data = candles;
      this.chart!.drawChart();
    }
  }

  private handleResize = async () => {
    if (!this.chart) return;
    const visibleCandles = (this.chart as any).calculateVisibleCandles();
    await this.fetchAndUpdateChart(visibleCandles);
  };

  public initializeResizeHandler() {
    window.addEventListener("resize", debounce(this.handleResize, 250));
  }

  private handlePan = async (event: CustomEvent) => {
    console.log("handlePan event:", event);
    if (!this.chart) return;

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

        this.chart.data = await this.candleRepository.fetchCandlesForTimeRange(
          timeRange
        );
        this.chart.drawChart();
      } finally {
        this.pendingFetches.delete(rangeKey);
      }
    }
  };
}

function debounce(func: Function, wait: number) {
  let timeout: Timer;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
