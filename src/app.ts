export class App {
  private chart: HTMLElement | null;

  constructor() {
    this.chart = document.querySelector("candlestick-chart");
  }

  async initialize() {
    try {
      const response = await fetch(
        "/api/candles?symbol=BTC-USD&interval=1h&limit=10"
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const candles = await response.json();

      if (this.chart) {
        (this.chart as any).setData(candles);
      }
    } catch (error) {
      console.error("Failed to initialize app:", error);
    }
  }
}
