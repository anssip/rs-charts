/**
 * Type definitions for trading overlays - paper trading and backtesting visualization
 *
 * These types support the visualization layer for trading features.
 * All business logic (order execution, position management, P&L calculations)
 * is handled by the consuming application (sc-app).
 *
 * rs-charts responsibilities:
 * - Display trade markers, price lines, and overlays
 * - Handle chart interactions (clicks, hovers, drags)
 * - Emit events with price/timestamp data
 * - Provide visual feedback
 *
 * sc-app responsibilities:
 * - Order entry forms and confirmation dialogs
 * - Order types, quantities, and validation
 * - Trade execution and position updates
 * - Account balances and P&L calculations
 * - Data persistence to Firestore
 */

// ============================================================================
// Trade Markers (Buy/Sell Execution Points)
// ============================================================================

/**
 * Configuration for creating a trade marker
 */
export interface TradeMarkerConfig {
  id?: string;                    // Auto-generated if not provided
  timestamp: number;              // Unix timestamp (X-axis position)
  price: number;                  // Price level (Y-axis position)
  side: 'buy' | 'sell';          // Trade direction
  shape?: 'arrow' | 'flag' | 'triangle' | 'circle';  // Marker shape
  color?: string;                 // Default: green for buy, red for sell
  size?: 'small' | 'medium' | 'large';  // Marker size
  text?: string;                  // Optional label text (e.g., "Entry", "Exit")
  tooltip?: {                     // Hover information
    title: string;                // e.g., "Buy BTC-USD"
    details: string[];            // e.g., ["Qty: 0.5", "Price: $45,000"]
  };
  interactive?: boolean;          // Enable click/hover events (default: true)
  zIndex?: number;                // Layer ordering (default: 100)
}

/**
 * Complete trade marker with generated ID
 */
export interface TradeMarker extends Required<Omit<TradeMarkerConfig, 'id' | 'tooltip'>> {
  id: string;                     // Always present after creation
  tooltip?: {                     // Optional hover information
    title: string;
    details: string[];
  };
}

/**
 * Event emitted when a trade marker is clicked
 */
export interface TradeMarkerClickedEvent {
  markerId: string;
  marker: TradeMarker;
}

/**
 * Event emitted when mouse hovers over a trade marker
 */
export interface TradeMarkerHoveredEvent {
  markerId: string;
  marker: TradeMarker;
}

// ============================================================================
// Price Level Lines (Orders, Stop Losses, Take Profits)
// ============================================================================

/**
 * Configuration for creating a horizontal price line
 */
export interface PriceLineConfig {
  id?: string;                    // Auto-generated if not provided
  price: number;                  // Y-axis price level
  color?: string;                 // Line color (default: gray)
  lineStyle?: 'solid' | 'dashed' | 'dotted';  // Line style (default: solid)
  lineWidth?: number;             // Line thickness (default: 1)
  label?: {                       // Optional label
    text: string;                 // e.g., "Limit Order @ $45,000"
    position: 'left' | 'right';   // Label position (default: right)
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
  };
  draggable?: boolean;            // Allow user to drag the line up/down (default: false)
  extendLeft?: boolean;           // Extend line to left edge (default: true)
  extendRight?: boolean;          // Extend line to right edge (default: true)
  interactive?: boolean;          // Enable click/hover events (default: true)
  showPriceLabel?: boolean;       // Show price on Y-axis (default: true)
  metadata?: any;                 // Store custom data (e.g., order ID)
  zIndex?: number;                // Layer ordering (default: 50)
}

/**
 * Complete price line with generated ID
 */
export interface PriceLine extends Required<Omit<PriceLineConfig, 'id' | 'label' | 'metadata'>> {
  id: string;
  price: number;
  label?: PriceLineConfig['label'];
  metadata?: any;
}

/**
 * Event emitted when a draggable price line is moved
 */
export interface PriceLineDraggedEvent {
  lineId: string;
  oldPrice: number;
  newPrice: number;
  line: PriceLine;
}

/**
 * Event emitted when a price line is clicked
 */
export interface PriceLineClickedEvent {
  lineId: string;
  line: PriceLine;
}

/**
 * Event emitted when mouse hovers over a price line
 */
export interface PriceLineHoveredEvent {
  lineId: string;
  line: PriceLine;
}

// ============================================================================
// Position Overlay (Current Position Information)
// ============================================================================

/**
 * Configuration for displaying position information overlay
 */
export interface PositionOverlayConfig {
  symbol: string;                 // e.g., "BTC-USD"
  quantity: number;               // Position size
  side: 'long' | 'short';        // Position direction
  entryPrice: number;             // Average entry price
  currentPrice: number;           // Current market price
  unrealizedPnL: number;          // P&L in dollars
  unrealizedPnLPercent: number;   // P&L as percentage
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';  // Overlay position
  showEntryLine?: boolean;        // Show line at entry price (default: true)
  entryLineColor?: string;
  backgroundColor?: string;       // Overlay background color
  textColor?: string;             // Text color
  opacity?: number;               // Overlay opacity (0-1, default: 0.9)
  compact?: boolean;              // Show compact view (default: false)
}

// ============================================================================
// Trade Zones (Completed Trade Duration Visualization)
// ============================================================================

/**
 * Configuration for creating a trade zone
 */
export interface TradeZoneConfig {
  id?: string;
  startTimestamp: number;         // Trade entry time
  endTimestamp: number;           // Trade exit time
  entryPrice: number;             // Entry price level
  exitPrice: number;              // Exit price level
  fillColor?: string;             // Semi-transparent background (default: green/red based on P&L)
  fillOpacity?: number;           // Opacity 0-1 (default: 0.2)
  borderColor?: string;           // Border color
  borderWidth?: number;           // Border thickness
  showPnL?: boolean;              // Display P&L text in zone (default: true)
  textColor?: string;             // Text color for P&L label (default: auto based on P&L - green/red)
  metadata?: {
    quantity?: number;
    pnl?: number;
    pnlPercent?: number;
    side?: 'long' | 'short';
    fees?: number;
  };
  zIndex?: number;                // Layer ordering (default: 0)
}

/**
 * Complete trade zone with generated ID
 */
export interface TradeZone extends Required<Omit<TradeZoneConfig, 'id' | 'metadata' | 'textColor'>> {
  id: string;
  textColor?: string;
  metadata?: TradeZoneConfig['metadata'];
}

/**
 * Event emitted when a trade zone is clicked
 */
export interface TradeZoneClickedEvent {
  zoneId: string;
  zone: TradeZone;
}

/**
 * Event emitted when mouse hovers over a trade zone
 */
export interface TradeZoneHoveredEvent {
  zoneId: string;
  zone: TradeZone;
}

// ============================================================================
// Annotations (Custom Notes and Alerts)
// ============================================================================

/**
 * Configuration for creating an annotation
 */
export interface AnnotationConfig {
  id?: string;
  timestamp: number;              // Time position
  price?: number;                 // Price position (if undefined, anchor to top/bottom)
  text: string;                   // Annotation text
  type?: 'note' | 'alert' | 'milestone' | 'custom';  // Annotation type
  position?: 'above' | 'below' | 'left' | 'right';   // Relative to point
  color?: string;                 // Text color
  backgroundColor?: string;       // Background color
  borderColor?: string;
  fontSize?: number;
  icon?: string;                  // SVG icon or emoji
  draggable?: boolean;            // Allow repositioning (default: false)
  showLine?: boolean;             // Show line connecting to price level (default: true)
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  zIndex?: number;                // Layer ordering (default: 200)
}

/**
 * Complete annotation with generated ID
 */
export interface Annotation extends Required<Omit<AnnotationConfig, 'id' | 'price'>> {
  id: string;
  price?: number;
}

// ============================================================================
// Click-to-Trade Interface
// ============================================================================

/**
 * Configuration for click-to-trade functionality
 */
export interface ClickToTradeConfig {
  enabled: boolean;                     // Enable/disable feature
  showCrosshair?: boolean;              // Show enhanced crosshair cursor (default: true)
  showPriceLabel?: boolean;             // Show price label on Y-axis when hovering (default: true)
  showOrderPreview?: boolean;           // Show preview line at hover position (default: true)
  clickBehavior?: 'single' | 'double' | 'hold';  // Single-click, double-click, or click-and-hold
  defaultSide?: 'buy' | 'sell';        // Default order side (can be toggled with Shift)
  allowSideToggle?: boolean;            // Allow Shift key to toggle buy/sell (default: true)
  onOrderRequest?: (orderData: OrderRequestData) => void;  // Callback for order requests
}

/**
 * Data emitted when user clicks to request an order
 */
export interface OrderRequestData {
  price: number;                      // Price level clicked
  timestamp: number;                  // Time coordinate clicked
  side: 'buy' | 'sell';              // Buy or sell (based on defaultSide + Shift)
  modifiers: {                        // Keyboard modifiers pressed during click
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
  };
}

/**
 * Event emitted when user hovers over price level in click-to-trade mode
 */
export interface PriceHoverEvent {
  price: number;
  timestamp: number;
}

// ============================================================================
// Enhanced Chart Events
// ============================================================================

/**
 * Event emitted when user clicks on a specific price level
 */
export interface PriceClickedEvent {
  price: number;
  timestamp: number;
  mouseX: number;
  mouseY: number;
}

/**
 * Event emitted when user clicks on a specific time
 */
export interface TimeClickedEvent {
  timestamp: number;
  price: number;
  mouseX: number;
  mouseY: number;
}

/**
 * Event emitted when crosshair position changes
 */
export interface CrosshairMovedEvent {
  price: number | null;
  timestamp: number | null;
  mouseX: number;
  mouseY: number;
}

/**
 * Event emitted when user right-clicks on chart
 */
export interface ContextMenuEvent {
  price: number;
  timestamp: number;
  mouseX: number;
  mouseY: number;
}

// ============================================================================
// Time Markers (Vertical Event Lines)
// ============================================================================

/**
 * Configuration for creating a time marker
 */
export interface TimeMarkerConfig {
  id?: string;
  timestamp: number;              // Unix timestamp
  label?: string;                 // Optional label text
  color?: string;                 // Line color
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  lineWidth?: number;
  showLabel?: boolean;            // Show label at top/bottom (default: true)
  labelPosition?: 'top' | 'bottom';
  zIndex?: number;                // Layer ordering (default: 25)
}

/**
 * Complete time marker with generated ID
 */
export interface TimeMarker extends Required<Omit<TimeMarkerConfig, 'id' | 'label'>> {
  id: string;
  label?: string;
}

// ============================================================================
// Risk Zones (Price Range Highlights)
// ============================================================================

/**
 * Configuration for creating a risk zone
 */
export interface RiskZoneConfig {
  id?: string;
  startPrice: number;             // Lower price boundary
  endPrice: number;               // Upper price boundary
  label?: string;                 // e.g., "Stop Loss Zone"
  color?: string;                 // Zone color (default: red with transparency)
  opacity?: number;               // Fill opacity (0-1, default: 0.2)
  pattern?: 'solid' | 'striped' | 'dotted';  // Fill pattern
  borderColor?: string;
  borderWidth?: number;
  extendLeft?: boolean;           // Extend to left edge (default: true)
  extendRight?: boolean;          // Extend to right edge (default: true)
  zIndex?: number;                // Layer ordering (default: 1)
}

/**
 * Complete risk zone with generated ID
 */
export interface RiskZone extends Required<Omit<RiskZoneConfig, 'id' | 'label'>> {
  id: string;
  label?: string;
}

// ============================================================================
// Equity Curve Overlay
// ============================================================================

/**
 * Single point on equity curve
 */
export interface EquityPoint {
  timestamp: number;              // Unix timestamp
  equity: number;                 // Portfolio value at this time
}

/**
 * Configuration for equity curve overlay
 */
export interface EquityCurveConfig {
  data: EquityPoint[];
  color?: string;                 // Line color (default: blue)
  lineWidth?: number;             // Line thickness (default: 2)
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  showArea?: boolean;             // Fill area under curve (default: false)
  areaColor?: string;             // Area fill color
  opacity?: number;               // Line/area opacity (0-1, default: 0.8)
  yAxisPosition?: 'left' | 'right' | 'separate';  // Y-axis placement
}

// ============================================================================
// Drawdown Visualization
// ============================================================================

/**
 * Single point on drawdown curve
 */
export interface DrawdownPoint {
  timestamp: number;
  drawdownPercent: number;        // Negative percentage
}

// ============================================================================
// Trading Chart State (Complete State Management)
// ============================================================================

/**
 * Complete state of all trading overlays for persistence
 */
export interface TradingChartState {
  tradeMarkers: TradeMarker[];
  priceLines: PriceLine[];
  tradeZones: TradeZone[];
  annotations: Annotation[];
  timeMarkers: TimeMarker[];
  riskZones: RiskZone[];
  positionOverlay: PositionOverlayConfig | null;
  clickToTrade: ClickToTradeConfig | null;
  equityCurve: EquityCurveConfig | null;
}

// ============================================================================
// Default Colors
// ============================================================================

/**
 * Default colors for trading overlays
 */
export const TRADING_OVERLAY_COLORS = {
  buyMarker: '#10b981',           // Green
  sellMarker: '#ef4444',          // Red
  priceLine: '#6b7280',           // Gray
  profitZone: '#10b981',          // Green
  lossZone: '#ef4444',            // Red
  riskZone: '#ef4444',            // Red
  equityCurve: '#3b82f6',         // Blue
  annotation: '#8b5cf6',          // Purple
} as const;

/**
 * Default sizes for markers
 */
export const TRADE_MARKER_SIZES = {
  small: 8,
  medium: 12,
  large: 16,
} as const;
