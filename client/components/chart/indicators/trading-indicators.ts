/**
 * Trading Indicators Registration Module
 *
 * Exports equity curve and drawdown indicators for trading performance visualization.
 * These indicators are designed to work with the standard indicator system in rs-charts.
 */

import { EquityCurveIndicator } from "./equity-curve-indicator";
import { DrawdownIndicator } from "./drawdown-indicator";

export { EquityCurveIndicator, DrawdownIndicator };

// Re-export types for convenience
export type {
  EquityPoint,
  DrawdownPoint,
  EquityCurveParams,
  DrawdownParams,
} from "../../../types/trading-indicators";
