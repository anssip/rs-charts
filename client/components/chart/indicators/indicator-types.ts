export enum ScaleType {
  Price = "price",
  Percentage = "percentage",
  Volume = "volume",
}

export enum DisplayType {
  Overlay = "overlay",
  Bottom = "bottom",
  StackBottom = "stack-bottom",
  StackTop = "stack-top",
}

export interface IndicatorConfig {
  id: string;
  visible: boolean;
  params?: Record<string, any>;
  display: DisplayType;
  class: any; // This will be the indicator class type
  skipFetch?: boolean;
  scale?: ScaleType;
  name?: string;
}
