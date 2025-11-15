/**
 * Trading Indicators Type Definitions
 *
 * Types for equity curve and drawdown indicators that visualize trading performance.
 * These indicators are data renderers - all calculations are done in sc-app (business logic layer).
 */

/**
 * Single point in an equity curve
 * Represents portfolio value at a specific time
 */
export interface EquityPoint {
  timestamp: number;  // Unix timestamp in milliseconds
  equity: number;     // Portfolio value at this time
}

/**
 * Single point in a drawdown curve
 * Represents percentage decline from peak equity
 */
export interface DrawdownPoint {
  timestamp: number;        // Unix timestamp in milliseconds
  drawdownPercent: number;  // Negative percentage (e.g., -15.5 means 15.5% below peak)
}

/**
 * Configuration parameters for Equity Curve Indicator
 */
export interface EquityCurveParams {
  data: EquityPoint[];             // Pre-calculated equity curve (from sc-app)
  lineColor?: string;              // Line color (default: #2196f3)
  lineWidth?: number;              // Line thickness (default: 2)
  showPeakLine?: boolean;          // Show running maximum equity
  peakLineColor?: string;          // Peak line color (default: #666)
  peakLineStyle?: 'solid' | 'dashed' | 'dotted';  // Peak line style
  fillArea?: boolean;              // Fill area under curve
  areaColor?: string;              // Area fill color
  areaOpacity?: number;            // Area opacity (0-1, default: 0.3)
}

/**
 * Configuration parameters for Drawdown Indicator
 */
export interface DrawdownParams {
  data: DrawdownPoint[];           // Pre-calculated drawdown curve (from sc-app)
  fillColor?: string;              // Fill color (default: #ff0000)
  fillOpacity?: number;            // Fill opacity (default: 0.3)
  showZeroLine?: boolean;          // Show horizontal line at 0% (default: true)
  invertYAxis?: boolean;           // True = drawdowns go down (default: true)
  warnThreshold?: number;          // Highlight when drawdown exceeds % (e.g., -10)
  warnColor?: string;              // Color for severe drawdowns (default: #ff0000)
}
