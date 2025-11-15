import { MenuItem } from "./context-menu";
import { IndicatorConfig } from "./indicators/indicator-types";
import { config } from "../../config";

export interface ContextMenuBuilderParams {
  isFullWindow: boolean;
  showVolume: boolean;
  indicators: Map<string, IndicatorConfig>;
  container: any; // ChartContainer - using any to avoid circular dependency
  actions: {
    showCandleTooltip: () => void;
    toggleFullWindow: () => void;
  };
}

/**
 * Builds context menu items for the chart
 */
export function buildContextMenuItems(
  params: ContextMenuBuilderParams,
): MenuItem[] {
  const {
    isFullWindow,
    showVolume,
    indicators,
    container,
    actions,
  } = params;

  const menuItems: MenuItem[] = [
    {
      label: "Show Candle Details",
      action: actions.showCandleTooltip,
    },
    {
      label: "separator",
      separator: true,
    },
    {
      label: isFullWindow ? "Exit Full Window" : "Full Window",
      action: actions.toggleFullWindow,
    },
    {
      label: "separator",
      separator: true,
    },
    {
      label: "Indicators",
      isHeader: true,
    },
    // Transform the built-in indicators to have active state
    ...config.getBuiltInIndicators(container).map((item) => {
      // Skip separators and headers
      if (item.separator || item.isHeader) {
        return item;
      }

      // For Volume indicator, check showVolume property
      if (item.label === "Volume") {
        return {
          ...item,
          active: showVolume,
        };
      }

      // For other indicators, determine ID based on the label
      const indicatorId = item.label.toLowerCase().replace(/\s+/g, "-");
      return {
        ...item,
        active: indicators.get(indicatorId)?.visible || false,
      };
    }),
  ];

  return menuItems;
}
