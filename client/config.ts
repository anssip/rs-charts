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
  apiBaseUrl: import.meta.env.API_BASE_URL || "http://localhost:8080",

  getBuiltInIndicators: (chartContainer: ChartContainer) => [
    {
      label: "Volume",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "volume",
            show: !chartContainer.isIndicatorVisible("volume"),
            display: "bottom",
            class: VolumeChart,
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
            id: "moving-average",
            show: !chartContainer.isIndicatorVisible("moving-average"),
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
  ],
};
