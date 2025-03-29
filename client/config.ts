import { ChartContainer } from "./components/chart/chart-container";
import { MenuItem } from "./components/chart/context-menu";
import {
  DisplayType,
  IndicatorConfig,
  ScaleType,
  GridStyle,
} from "./components/chart/indicators/indicator-types";
import { MarketIndicator } from "./components/chart/indicators/market-indicator";
import { VolumeChart } from "./components/chart/indicators/volume-chart";

export type MenuActionEvent = CustomEvent<IndicatorConfig>;

interface Config {
  apiBaseUrl: string;
  getBuiltInIndicators: (chartContainer: ChartContainer) => MenuItem[];
}

function dispatchMenuActionEvent(
  chartContainer: ChartContainer,
  event: MenuActionEvent
): void {
  chartContainer.dispatchEvent(event);
}

export const config: Config = {
  apiBaseUrl: import.meta.env.API_BASE_URL || "https://market.spotcanvas.com",

  getBuiltInIndicators: (chartContainer: ChartContainer): MenuItem[] => [
    {
      label: "Volume",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "volume",
            name: "",
            display: DisplayType.Bottom,
            class: VolumeChart,
            visible: !chartContainer.isIndicatorVisible("volume"),
            skipFetch: true,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
    {
      label: "Moving Averages",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "moving-averages",
            name: "Moving Averages",
            visible: !chartContainer.isIndicatorVisible("moving-averages"),
            params: { period: 200 },
            display: DisplayType.Overlay,
            class: MarketIndicator,
            scale: ScaleType.Price,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
    {
      label: "Bollinger Bands",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "bollinger-bands",
            name: "Bollinger Bands",
            visible: !chartContainer.isIndicatorVisible("bollinger-bands"),
            params: { period: 20, stdDev: 2 },
            display: DisplayType.Overlay,
            class: MarketIndicator,
            scale: ScaleType.Price,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
    {
      label: "RSI",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "rsi",
            name: "RSI",
            visible: !chartContainer.isIndicatorVisible("rsi"),
            params: { period: 14 },
            display: DisplayType.StackBottom,
            class: MarketIndicator,
            scale: ScaleType.Percentage,
            gridStyle: GridStyle.RSI,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
    {
      label: "MACD",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "macd",
            name: "MACD",
            visible: !chartContainer.isIndicatorVisible("macd"),
            params: {
              period: 12,
              fastPeriod: 12,
              slowPeriod: 26,
              signalPeriod: 9,
            },
            display: DisplayType.StackBottom,
            class: MarketIndicator,
            gridStyle: GridStyle.MACD,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
    {
      label: "Stochastic",
      action: () => {
        const event = new CustomEvent("toggle-indicator", {
          detail: {
            id: "stochastic",
            name: "Stochastic",
            visible: !chartContainer.isIndicatorVisible("stochastic"),
            params: { period: 14, smoothK: 1, smoothD: 3 },
            display: DisplayType.StackBottom,
            class: MarketIndicator,
            scale: ScaleType.Percentage,
            gridStyle: GridStyle.Stochastic,
          },
          bubbles: true,
          composed: true,
        });
        dispatchMenuActionEvent(chartContainer, event);
      },
    },
  ],
};
