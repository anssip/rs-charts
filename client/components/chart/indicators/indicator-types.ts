export enum ScaleType {
  Price = "price",
  Percentage = "percentage",
  Custom = "custom",
  Value = "value",
}

export enum DisplayType {
  Overlay = "overlay",
  Bottom = "bottom",
  StackTop = "stack-top",
  StackBottom = "stack-bottom",
}

export enum GridStyle {
  Standard = "standard", // Regular evenly-spaced grid
  MACD = "macd", // Special grid for MACD with zero baseline emphasis
  Value = "value", // Grid for custom value indicators (adaptive to value range)
  PercentageOscillator = "percentage-oscillator", // Configurable grid for percentage oscillators (RSI, Stochastic, etc.)
}

// Configuration for the PercentageOscillator grid style
export interface OscillatorConfig {
  levels: number[]; // The reference levels to display (e.g., [0, 30, 50, 70, 100])
  thresholds: number[]; // The threshold levels to highlight (e.g., [30, 70])
  format?: string; // Format string for labels (e.g., "%d%")
}

export interface IndicatorConfig {
  id: string;
  name: string;
  visible: boolean;
  display: DisplayType;
  scale?: ScaleType;
  params?: any;
  class?: any;
  skipFetch?: boolean;
  gridStyle?: GridStyle; // Add grid style configuration
  oscillatorConfig?: OscillatorConfig; // Configuration for oscillator indicators
}
