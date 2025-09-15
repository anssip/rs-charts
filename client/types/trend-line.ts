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
  name?: string;
  description?: string;

  // New properties for support/resistance visualization
  levelType?: 'swing' | 'horizontal';  // Type of support/resistance level
  opacity?: number;                     // Opacity value (0.0 to 1.0)
  markers?: {                          // Optional markers along the line
    enabled: boolean;
    symbol: 'diamond' | 'circle' | 'square' | 'triangle';
    size: number;                      // Size in pixels
    spacing: number;                   // Spacing between markers in pixels
    color?: string;                    // Marker color (defaults to line color)
  };
  zIndex?: number;                      // Z-index for layering (higher = on top)
  animation?: {                          // Optional animation configuration
    type: 'pulse';                       // Animation type (currently only pulse supported)
    duration?: number;                   // Duration in milliseconds (default: 2000)
    intensity?: number;                  // Intensity of the animation (0.0 to 1.0, default: 0.3)
    enabled?: boolean;                   // Whether animation is enabled (default: true if animation object exists)
  };
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