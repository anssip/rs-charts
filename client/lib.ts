// client/lib.ts
// This is the entry point for the NPM package.
// Export only the components and types intended for public use.

import "./components/chart/chart-container"; // Import for side effects (registers the custom element)

export { ChartContainer } from "./components/chart/chart-container";

// Re-export indicator types
export type {
  IndicatorConfig,
  OscillatorConfig,
} from "./components/chart/indicators/indicator-types";
export {
  ScaleType,
  DisplayType,
  GridStyle,
} from "./components/chart/indicators/indicator-types";

// Export initialization function and App class
export { initChart, initChartWithApi } from "./init";
export type { InitChartResult, FirebaseConfigOrApp } from "./init";
export { App } from "./app";

// Export Chart API
export { ChartApi, createChartApi } from "./api/chart-api";
export type {
  ChartApiOptions,
  ApiIndicatorConfig,
  SymbolChangeOptions,
  GranularityChangeOptions,
  SymbolChangeEvent,
  GranularityChangeEvent,
  IndicatorChangeEvent,
  FullscreenChangeEvent,
  ChartApiEventMap,
  ChartApiEventName,
  ChartApiEventCallback,
} from "./api/chart-api";

// Export screenshot utilities
export type { ScreenshotOptions } from "./util/screenshot";

// Export types and utilities from server-side models
export type { Granularity } from "../server/services/price-data/price-history-model";
export { getAllGranularities, granularityLabel } from "../server/services/price-data/price-history-model";

// Export trend line types
export type { TrendLine, TrendLineDefaults, TrendLineEvent, TrendLinePoint } from "./types/trend-line";

// Export trading overlay types for paper trading and backtesting
export type {
  TradeMarker,
  TradeMarkerConfig,
  TradeMarkerClickedEvent,
  TradeMarkerHoveredEvent,
  PriceLine,
  PriceLineConfig,
  PriceLineDraggedEvent,
  PriceLineClickedEvent,
  PriceLineHoveredEvent,
  TradeZone,
  TradeZoneConfig,
  TradeZoneClickedEvent,
  TradeZoneHoveredEvent,
  PositionOverlayConfig,
  PriceClickedEvent,
  TimeClickedEvent,
  CrosshairMovedEvent,
} from "./types/trading-overlays";
export { TRADING_OVERLAY_COLORS, TRADE_MARKER_SIZES } from "./types/trading-overlays";

// You might want to export related types if consumers need them
export type { ChartState } from "./index"; // Export ChartState type as well
// Consider defining shared types in a separate file if needed.

// Helper function to create chart container instances
export function createChartContainer() {
  return document.createElement("chart-container");
}
