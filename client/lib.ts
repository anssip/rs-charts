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
export { initChart } from "./init";
export { App } from "./app";

// You might want to export related types if consumers need them
export type { ChartState } from "./index"; // Export ChartState type as well
// Consider defining shared types in a separate file if needed.
