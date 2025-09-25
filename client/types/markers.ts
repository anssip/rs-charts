/**
 * Marker types for the chart
 */

/**
 * Base marker interface
 */
export interface Marker {
  id: string;
  type: string;
}

/**
 * Pattern highlight marker for highlighting candle patterns
 */
export interface PatternHighlight extends Marker {
  type: "pattern";
  patternType: string; // Pattern type (e.g., "doji", "hammer", "bullish_engulfing")
  name: string; // Display name (e.g., "Doji", "Hammer", "Bullish Engulfing")
  description: string; // Detailed description
  candleTimestamps: number[]; // Array of timestamps for candles involved in the pattern
  significance: "low" | "medium" | "high" | "very high" | "effect"; // Pattern significance (effect is for visual effects)
  color?: string; // Optional highlight color (defaults based on pattern type)
  opacity?: number; // Optional opacity value (0-1) for the highlight effect
  style?: "outline" | "fill" | "both"; // How to highlight the candles (default: 'outline')
  nearLevel?: {
    // Optional key level information
    type: "support" | "resistance";
    price: number;
    distance: number; // Percentage distance from the level
  };
}

/**
 * Event emitted when patterns are highlighted
 */
export interface PatternHighlightEvent {
  patterns: PatternHighlight[];
}

/**
 * Event emitted when a pattern is clicked
 */
export interface PatternClickEvent {
  pattern: PatternHighlight;
  x: number;
  y: number;
}

/**
 * Default colors for different pattern types
 */
export const PATTERN_DEFAULT_COLORS: Record<string, string> = {
  // Bullish patterns
  bullish_engulfing: "#4ade80", // Green
  hammer: "#4ade80",
  morning_star: "#4ade80",
  bullish_harami: "#4ade80",
  piercing_line: "#4ade80",

  // Bearish patterns
  bearish_engulfing: "#ef4444", // Red
  shooting_star: "#ef4444",
  evening_star: "#ef4444",
  bearish_harami: "#ef4444",
  dark_cloud_cover: "#ef4444",

  // Neutral/Indecision patterns
  doji: "#fbbf24", // Yellow/Amber
  spinning_top: "#fbbf24",
  inside_bar: "#fbbf24",

  // Default
  default: "#60a5fa", // Blue
};

/**
 * Get default color for a pattern type
 */
export function getPatternDefaultColor(patternType: string): string {
  return (
    PATTERN_DEFAULT_COLORS[patternType] || PATTERN_DEFAULT_COLORS["default"]
  );
}
