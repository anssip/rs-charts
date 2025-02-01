import { ChartContainer } from "./components/chart/chart-container";
import { MenuItem } from "./components/chart/context-menu";
import { MarketIndicator } from "./components/chart/indicators/market-indicator";
import { VolumeChart } from "./components/chart/indicators/volume-chart";

interface Config {
  apiBaseUrl: string;
  getBuiltInIndicators: (chartContainer: ChartContainer) => MenuItem[];
}

// Use import.meta.env for Bun's build-time environment variables
export const config: Config = {
  apiBaseUrl: import.meta.env.API_BASE_URL || "https://market.spotcanvas.com",

  getBuiltInIndicators: (chartContainer: ChartContainer) => [
    {
      label: "Volume",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "volume",
            display: "bottom",
            class: VolumeChart,
            visible: !chartContainer.isIndicatorVisible("volume"),
            skipFetch: true,
          },
          bubbles: true,
          composed: true,
        });
        chartContainer.dispatchEvent(event);
      },
    },
    {
      label: "Moving Average 200",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "moving-averages",
            visible: !chartContainer.isIndicatorVisible("moving-average"),
            params: { period: 200 },
            display: "fullchart",
            class: MarketIndicator,
          },
          bubbles: true,
          composed: true,
        });
        chartContainer.dispatchEvent(event);
      },
    },
    {
      label: "Bollinger Bands",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "bollinger-bands",
            visible: !chartContainer.isIndicatorVisible("bollinger-bands"),
            params: { period: 20, stdDev: 2 },
            display: "fullchart",
            class: MarketIndicator,
          },
          bubbles: true,
          composed: true,
        });
        chartContainer.dispatchEvent(event);
      },
    },
    {
      label: "RSI",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "rsi",
            visible: !chartContainer.isIndicatorVisible("rsi"),
            params: { period: 14 }, // Standard RSI period is 14
            display: "bottom",
            class: MarketIndicator,
          },
          bubbles: true,
          composed: true,
        });
        chartContainer.dispatchEvent(event);
      },
    },
  ],
};
