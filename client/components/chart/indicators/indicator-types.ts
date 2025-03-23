export enum ScaleType {
  Price = "price",
  Percentage = "percentage",
  Custom = "custom",
}

export enum DisplayType {
  Overlay = "overlay",
  Bottom = "bottom",
  StackTop = "stack-top",
  StackBottom = "stack-bottom",
}

export enum GridStyle {
  Standard = "standard", // Regular evenly-spaced grid
  Stochastic = "stochastic", // Special grid for stochastic (0,20,50,80,100)
  RSI = "rsi", // Special grid for RSI (30,50,70)
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
}
