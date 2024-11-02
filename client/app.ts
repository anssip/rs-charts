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
  private chart: CandlestickChart | null;
  private readonly API_BASE_URL = "http://localhost:3000";
  private candleRepository: CandleRepository;

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
    const { visibleCandles } = event.detail;
    const bufferedCandles = visibleCandles * 2;
    const now = Date.now();

    const timeRange = {
      end: now,
      start: now - bufferedCandles * this.candleRepository.CANDLE_INTERVAL,
    };

    console.log("Initial fetch params:", {
      visibleCandles,
      bufferedCandles,
      timeRange: {
        start: new Date(timeRange.start),
        end: new Date(timeRange.end),
      },
    });

    const candles = await this.candleRepository.fetchCandlesForTimeRange(
      timeRange
    );
    if (candles.length > 0) {
      this.chart!.data = candles;
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
    if (candles.length > 0) {
      this.chart!.data = candles;
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

    const { timeRange, needMoreData } = event.detail;

    // Only handle data fetching
    if (needMoreData && timeRange) {
      console.log("fetching time range:", timeRange);

      const candles = await this.candleRepository.fetchCandlesForTimeRange(
        timeRange
      );

      if (candles.length > 0) {
        const allCandles = [...this.chart.data, ...candles];
        const uniqueCandles = Array.from(
          new Map(allCandles.map((c) => [c.timestamp, c])).values()
        ).sort((a, b) => a.timestamp - b.timestamp);

        this.chart.data = uniqueCandles;
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
