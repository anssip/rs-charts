interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export class App {
  private chart: HTMLElement | null;
  private readonly API_BASE_URL = "http://localhost:3000";

  constructor() {
    this.chart = document.querySelector("candlestick-chart");
  }

  async initialize() {
    try {
      if (!this.chart) {
        throw new Error("Chart element not found");
      }

      const visibleCandles = (this.chart as any).calculateVisibleCandles();
      await this.fetchAndUpdateChart(visibleCandles);
    } catch (error) {
      console.error("Failed to initialize app:", error);
    }
  }

  private async fetchAndUpdateChart(limit: number) {
    try {
      const response = await fetch(
        `${this.API_BASE_URL}/api/candles?` +
          new URLSearchParams({
            symbol: "BTC-USD",
            interval: "1h",
            limit: limit.toString(),
          })
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const candles: CandleData[] = await response.json();
      if (this.chart) {
        (this.chart as any).setData(candles);
      }
    } catch (error) {
      console.error("Error fetching candles:", error);
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
