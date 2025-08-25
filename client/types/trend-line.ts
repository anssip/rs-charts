export interface TrendLinePoint {
  timestamp: number;  // Unix timestamp
  price: number;      // Price value
}

export interface TrendLine {
  id: string;
  startPoint: TrendLinePoint;
  endPoint: TrendLinePoint;
  extendLeft: boolean;
  extendRight: boolean;
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  label?: string;
}

export interface TrendLineEvent {
  type: 'add' | 'update' | 'remove';
  trendLine: TrendLine;
  previousState?: TrendLine;
}

export interface Point {
  x: number;
  y: number;
}

export interface TrendLineDefaults {
  color?: string;
  lineWidth?: number;
  style?: 'solid' | 'dashed' | 'dotted';
  extendLeft?: boolean;
  extendRight?: boolean;
}