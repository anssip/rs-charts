// client/api/chart-api.ts
import { ChartContainer } from "../components/chart/chart-container";
import { App } from "../app";
import { ChartState } from "../index";
import {
  Granularity,
  getAllGranularities,
  TimeRange,
  PriceRange,
  Candle,
} from "../../server/services/price-data/price-history-model";
import {
  IndicatorConfig,
  DisplayType,
  ScaleType,
  GridStyle,
} from "../components/chart/indicators/indicator-types";
import { logger } from "../util/logger";
import { config as chartConfig } from "../config";
import {
  TrendLine,
  TrendLineEvent,
  TrendLineDefaults,
} from "../types/trend-line";
import { PriceRangeImpl } from "../util/price-range";
import { PatternHighlight } from "../types/markers";
import { getCandleInterval, getDpr } from "../util/chart-util";
import {
  captureChartScreenshot,
  dataUrlToBlob,
  downloadScreenshot as downloadScreenshotHelper,
  ScreenshotOptions,
} from "../util/screenshot";
import {
  TradeMarker,
  TradeMarkerConfig,
  TradeMarkerClickedEvent,
  TradeMarkerHoveredEvent,
  PriceLine,
  PriceLineConfig,
  PriceLineDraggedEvent,
  PriceLineClickedEvent,
  PriceLineHoveredEvent,
  PositionOverlayConfig,
  PriceClickedEvent,
  TimeClickedEvent,
  CrosshairMovedEvent,
  ContextMenuEvent as ChartContextMenuEvent,
  TRADING_OVERLAY_COLORS,
  TRADE_MARKER_SIZES,
} from "../types/trading-overlays";

const BUFFER_MULTIPLIER = 1;

export interface ChartApiOptions {
  container: ChartContainer;
  app: App;
}

export interface ApiIndicatorConfig {
  id: string;
  name: string;
  visible: boolean;
  display?: DisplayType;
  scale?: ScaleType;
  params?: any;
  skipFetch?: boolean;
  gridStyle?: GridStyle;
}

export interface SymbolChangeOptions {
  symbol: string;
  /** Whether to refetch data immediately. Default: true */
  refetch?: boolean;
}

export interface GranularityChangeOptions {
  granularity: Granularity;
  /** Whether to refetch data immediately. Default: true */
  refetch?: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export interface SymbolChangeEvent {
  oldSymbol: string;
  newSymbol: string;
  refetch: boolean;
}

export interface GranularityChangeEvent {
  oldGranularity: Granularity;
  newGranularity: Granularity;
  refetch: boolean;
}

export interface IndicatorChangeEvent {
  action: "show" | "hide";
  indicator?: ApiIndicatorConfig;
  indicatorId?: string;
}

export interface FullscreenChangeEvent {
  isFullscreen?: boolean;
  isFullWindow?: boolean;
  type: "fullscreen" | "fullwindow";
}

export interface ReadyEvent {
  timestamp: number;
  symbol: string;
  granularity: Granularity;
}

export interface TrendLineSelectedEvent {
  trendLineId: string;
  trendLine: TrendLine;
}

export interface TrendLineDeselectedEvent {
  trendLineId: string | null;
}

export interface TrendLineDeletedEvent {
  trendLineId: string;
}

export interface TrendLineSettings {
  color?: string;
  lineWidth?: number;
  style?: "solid" | "dashed" | "dotted";
  extendLeft?: boolean;
  extendRight?: boolean;
}

export interface PatternHighlightEvent {
  patterns: PatternHighlight[];
}

export interface PanOptions {
  sensitivity?: number; // Multiplier for pan sensitivity (default: 1.0)
  animate?: boolean; // Whether to animate the pan (default: false)
  duration?: number; // Animation duration in ms (default: 1000)
}

export interface ZoomOptions {
  center?: { x: number; y: number }; // Zoom center point in pixels relative to chart
  sensitivity?: number; // Zoom sensitivity multiplier (default: 1.0)
}

/**
 * Map of Chart API event names to their corresponding event data types
 */
export interface ChartApiEventMap {
  ready: ReadyEvent;
  symbolChange: SymbolChangeEvent;
  granularityChange: GranularityChangeEvent;
  indicatorChange: IndicatorChangeEvent;
  fullscreenChange: FullscreenChangeEvent;
  "trend-line-added": TrendLineEvent;
  "trend-line-updated": TrendLineEvent;
  "trend-line-removed": TrendLineEvent;
  "trend-line-selected": TrendLineSelectedEvent;
  "trend-line-deselected": TrendLineDeselectedEvent;
  "trend-line-deleted": TrendLineDeletedEvent;
  "patterns-highlighted": PatternHighlightEvent;
  "patterns-cleared": void;
  // Trading overlay events
  "trade-marker-clicked": TradeMarkerClickedEvent;
  "trade-marker-hovered": TradeMarkerHoveredEvent;
  "price-line-dragged": PriceLineDraggedEvent;
  "price-line-clicked": PriceLineClickedEvent;
  "price-line-hovered": PriceLineHoveredEvent;
  "price-clicked": PriceClickedEvent;
  "time-clicked": TimeClickedEvent;
  "crosshair-moved": CrosshairMovedEvent;
  "chart-context-menu": ChartContextMenuEvent;
}

/**
 * Valid event names for the Chart API
 */
export type ChartApiEventName = keyof ChartApiEventMap;

/**
 * Event listener callback type for Chart API events
 */
export type ChartApiEventCallback<T extends ChartApiEventName> = (
  data: ChartApiEventMap[T],
) => void;

/**
 * Chart API for external control of chart functionality
 * Provides methods to control symbol, granularity, indicators, and fullscreen modes
 */
export class ChartApi {
  private container: ChartContainer;
  private app: App;
  private state: ChartState;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isReady: boolean = false;
  private readyData: ReadyEvent | null = null;
  private waveInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: ChartApiOptions) {
    this.container = options.container;
    this.app = options.app;
    this.state = options.app.getState();

    logger.info("ChartApi: Initialized with container and app");

    // Listen for chart-ready event from the container and emit ready event
    this.container.addEventListener("chart-ready", () => {
      logger.info("ChartApi: Chart is ready, emitting ready event");
      this.isReady = true;
      this.readyData = {
        timestamp: Date.now(),
        symbol: this.state.symbol,
        granularity: this.state.granularity,
      };
      this.emitEvent("ready", this.readyData);
    });

    // Listen for trend line events
    this.container.addEventListener("trend-line-added", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-added", customEvent.detail);
    });

    this.container.addEventListener("trend-line-updated", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-updated", customEvent.detail);
    });

    this.container.addEventListener("trend-line-removed", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-removed", customEvent.detail);
    });

    this.container.addEventListener("trend-line-selected", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-selected", customEvent.detail);
    });

    this.container.addEventListener("trend-line-deselected", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-deselected", customEvent.detail);
    });

    this.container.addEventListener("trend-line-deleted", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trend-line-deleted", customEvent.detail);
    });

    // Listen for pattern highlight events
    this.container.addEventListener("patterns-highlighted", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("patterns-highlighted", customEvent.detail);
    });

    this.container.addEventListener("patterns-cleared", (event: Event) => {
      this.emitEvent("patterns-cleared", undefined);
    });

    // Listen for trading overlay interaction events
    this.container.addEventListener("trade-marker-clicked", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trade-marker-clicked", customEvent.detail);
    });

    this.container.addEventListener("trade-marker-hovered", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("trade-marker-hovered", customEvent.detail);
    });

    this.container.addEventListener("price-line-dragged", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("price-line-dragged", customEvent.detail);
    });

    this.container.addEventListener("price-line-clicked", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("price-line-clicked", customEvent.detail);
    });

    this.container.addEventListener("price-line-hovered", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("price-line-hovered", customEvent.detail);
    });

    this.container.addEventListener("price-clicked", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("price-clicked", customEvent.detail);
    });

    this.container.addEventListener("time-clicked", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("time-clicked", customEvent.detail);
    });

    this.container.addEventListener("crosshair-moved", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("crosshair-moved", customEvent.detail);
    });

    this.container.addEventListener("chart-context-menu", (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent("chart-context-menu", customEvent.detail);
    });
  }

  // ============================================================================
  // Symbol Control
  // ============================================================================

  /**
   * Get the current symbol
   */
  getSymbol(): string {
    // Return plain string value instead of proxy
    return String(this.state.symbol);
  }

  /**
   * Set the chart symbol (e.g., "BTC-USD", "ETH-USD")
   * @param options Symbol and options
   * @returns Promise that resolves when symbol change is complete
   */
  async setSymbol(options: string | SymbolChangeOptions): Promise<void> {
    const config =
      typeof options === "string"
        ? { symbol: options, refetch: true }
        : { refetch: true, ...options };

    logger.info(`ChartApi: Setting symbol to ${config.symbol}`);

    const oldSymbol = String(this.state.symbol);
    this.state.symbol = config.symbol;

    this.emitEvent("symbolChange", {
      oldSymbol,
      newSymbol: config.symbol,
      refetch: config.refetch,
    });

    if (config.refetch) {
      // The App class observers will handle the refetch automatically
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow observers to trigger
    }
  }

  // ============================================================================
  // Granularity Control
  // ============================================================================

  /**
   * Get the current granularity
   */
  getGranularity(): Granularity {
    // Return plain string value instead of proxy
    return String(this.state.granularity) as Granularity;
  }

  /**
   * Get all available granularities
   */
  getAvailableGranularities(): Granularity[] {
    return getAllGranularities();
  }

  /**
   * Set the chart granularity (e.g., "ONE_HOUR", "ONE_DAY")
   * @param options Granularity and options
   * @returns Promise that resolves when granularity change is complete
   */
  async setGranularity(
    options: Granularity | GranularityChangeOptions,
  ): Promise<void> {
    const config =
      typeof options === "string"
        ? { granularity: options, refetch: true }
        : { refetch: true, ...options };

    logger.info(`ChartApi: Setting granularity to ${config.granularity}`);

    const oldGranularity = String(this.state.granularity) as Granularity;
    this.state.granularity = config.granularity;

    this.emitEvent("granularityChange", {
      oldGranularity,
      newGranularity: config.granularity,
      refetch: config.refetch,
    });

    if (config.refetch) {
      // The App class observers will handle the refetch automatically
      await new Promise((resolve) => setTimeout(resolve, 100)); // Allow observers to trigger
    }
  }

  // ============================================================================
  // Indicator Control
  // ============================================================================

  /**
   * Get all currently visible indicators
   */
  getVisibleIndicators(): IndicatorConfig[] {
    return this.state.indicators || [];
  }

  /**
   * Check if a specific indicator is visible
   */
  isIndicatorVisible(indicatorId: string): boolean {
    if (indicatorId === "volume") {
      return this.container.isIndicatorVisible("volume");
    }
    return this.container.isIndicatorVisible(indicatorId);
  }

  /**
   * Show an indicator
   * @param config Indicator configuration
   */
  showIndicator(config: ApiIndicatorConfig): void {
    logger.info(`ChartApi: Showing indicator ${config.id}`);

    // Get built-in indicator configuration if available
    const builtInIndicators = chartConfig.getBuiltInIndicators(this.container);
    const builtInIndicator = builtInIndicators.find((item: any) => {
      // Match by ID or label (case insensitive)
      const label = item.label?.toLowerCase().replace(/\s+/g, "-");
      const id = config.id.toLowerCase();
      return (
        label === id ||
        item.label?.toLowerCase() === config.name?.toLowerCase() ||
        (id === "volume" && item.label === "Volume") ||
        (id === "rsi" && item.label === "RSI") ||
        (id === "macd" && item.label === "MACD") ||
        (id === "bollinger-bands" && item.label === "Bollinger Bands") ||
        (id === "moving-averages" && item.label === "Moving Averages") ||
        (id === "stochastic" && item.label === "Stochastic") ||
        (id === "atr" && item.label === "ATR")
      );
    });

    if (builtInIndicator && builtInIndicator.action) {
      // Check if indicator is already visible to avoid toggling it off
      const isAlreadyVisible = this.isIndicatorVisible(config.id);

      if (isAlreadyVisible) {
        logger.info(
          `ChartApi: Indicator ${config.id} already visible, skipping action`,
        );
      } else {
        // Use the built-in indicator action which has proper configuration
        builtInIndicator.action();
      }

      this.emitEvent("indicatorChange", {
        action: "show",
        indicator: { ...config, visible: true },
      });
    } else {
      // Fallback to manual configuration
      const indicatorConfig: IndicatorConfig = {
        display: DisplayType.Bottom,
        scale: ScaleType.Value,
        skipFetch: false,
        gridStyle: GridStyle.Standard,
        ...config,
        visible: true,
      };

      this.container.handleIndicatorToggle(
        new CustomEvent("toggle-indicator", {
          detail: indicatorConfig,
        }),
      );

      this.emitEvent("indicatorChange", {
        action: "show",
        indicator: indicatorConfig,
      });
    }
  }

  /**
   * Hide an indicator
   * @param indicatorId The ID of the indicator to hide
   */
  hideIndicator(indicatorId: string): void {
    logger.info(`ChartApi: Hiding indicator ${indicatorId}`);

    this.container.handleIndicatorToggle(
      new CustomEvent("toggle-indicator", {
        detail: {
          id: indicatorId,
          visible: false,
        },
      }),
    );

    this.emitEvent("indicatorChange", {
      action: "hide",
      indicatorId,
    });
  }

  /**
   * Toggle an indicator's visibility
   * @param indicatorId The ID of the indicator to toggle
   * @param config Optional configuration for when showing the indicator
   */
  toggleIndicator(
    indicatorId: string,
    config?: Partial<ApiIndicatorConfig>,
  ): void {
    const isVisible = this.isIndicatorVisible(indicatorId);

    if (isVisible) {
      this.hideIndicator(indicatorId);
    } else {
      // Get built-in indicator configuration if available
      const builtInIndicators = chartConfig.getBuiltInIndicators(
        this.container,
      );
      const builtInIndicator = builtInIndicators.find((item: any) => {
        // Match by ID or label (case insensitive)
        const label = item.label?.toLowerCase().replace(/\s+/g, "-");
        const id = indicatorId.toLowerCase();
        return (
          label === id ||
          item.label?.toLowerCase() === config?.name?.toLowerCase() ||
          (id === "volume" && item.label === "Volume") ||
          (id === "rsi" && item.label === "RSI") ||
          (id === "macd" && item.label === "MACD") ||
          (id === "bollinger-bands" && item.label === "Bollinger Bands") ||
          (id === "moving-averages" && item.label === "Moving Averages") ||
          (id === "stochastic" && item.label === "Stochastic") ||
          (id === "atr" && item.label === "ATR")
        );
      });

      if (builtInIndicator && builtInIndicator.action) {
        // Use the built-in indicator action which has proper configuration
        builtInIndicator.action();

        this.emitEvent("indicatorChange", {
          action: "show",
          indicator: {
            id: indicatorId,
            name: config?.name || indicatorId,
            visible: true,
            ...config,
          },
        });
      } else {
        // Fallback to manual configuration
        const indicatorConfig: ApiIndicatorConfig = {
          id: indicatorId,
          name: config?.name || indicatorId,
          visible: true,
          ...config,
        };
        this.showIndicator(indicatorConfig);
      }
    }
  }

  /**
   * Set multiple indicators at once
   * @param indicators Array of indicator configurations
   */
  setIndicators(indicators: ApiIndicatorConfig[]): void {
    logger.info(`ChartApi: Setting ${indicators.length} indicators`);

    // First hide all current indicators
    const currentIndicators = this.getVisibleIndicators();
    currentIndicators.forEach((indicator) => {
      this.hideIndicator(indicator.id);
    });

    // Show the new indicators
    indicators.forEach((indicator) => {
      if (indicator.visible) {
        this.showIndicator(indicator);
      }
    });
  }

  // ============================================================================
  // Fullscreen Control
  // ============================================================================

  /**
   * Check if chart is in fullscreen mode
   */
  isFullscreen(): boolean {
    return document.fullscreenElement === this.container;
  }

  /**
   * Enter fullscreen mode
   * @returns Promise that resolves when fullscreen is entered
   */
  async enterFullscreen(): Promise<void> {
    if (this.isFullscreen()) {
      logger.info("ChartApi: Already in fullscreen");
      return;
    }

    logger.info("ChartApi: Entering fullscreen");

    try {
      await this.container.requestFullscreen();
      this.emitEvent("fullscreenChange", {
        isFullscreen: true,
        type: "fullscreen",
      });
    } catch (error) {
      logger.error("ChartApi: Failed to enter fullscreen:", error);
      throw error;
    }
  }

  /**
   * Exit fullscreen mode
   * @returns Promise that resolves when fullscreen is exited
   */
  async exitFullscreen(): Promise<void> {
    if (!this.isFullscreen()) {
      logger.info("ChartApi: Not in fullscreen");
      return;
    }

    logger.info("ChartApi: Exiting fullscreen");

    try {
      await document.exitFullscreen();
      this.emitEvent("fullscreenChange", {
        isFullscreen: false,
        type: "fullscreen",
      });
    } catch (error) {
      logger.error("ChartApi: Failed to exit fullscreen:", error);
      throw error;
    }
  }

  /**
   * Toggle fullscreen mode
   * @returns Promise that resolves when fullscreen toggle is complete
   */
  async toggleFullscreen(): Promise<void> {
    if (this.isFullscreen()) {
      await this.exitFullscreen();
    } else {
      await this.enterFullscreen();
    }
  }

  // ============================================================================
  // Full Window Control
  // ============================================================================

  /**
   * Check if chart is in full window mode
   */
  isFullWindow(): boolean {
    return this.container.classList.contains("full-window");
  }

  /**
   * Enter full window mode
   */
  enterFullWindow(): void {
    if (this.isFullWindow()) {
      logger.info("ChartApi: Already in full window");
      return;
    }

    logger.info("ChartApi: Entering full window");
    this.container.classList.add("full-window");

    // Trigger the container's toggle method to handle internal state
    (this.container as any).toggleFullWindow?.();

    this.emitEvent("fullscreenChange", {
      isFullWindow: true,
      type: "fullwindow",
    });
  }

  /**
   * Exit full window mode
   */
  exitFullWindow(): void {
    if (!this.isFullWindow()) {
      logger.info("ChartApi: Not in full window");
      return;
    }

    logger.info("ChartApi: Exiting full window");
    this.container.classList.remove("full-window");

    // Trigger the container's toggle method to handle internal state
    (this.container as any).toggleFullWindow?.();

    this.emitEvent("fullscreenChange", {
      isFullWindow: false,
      type: "fullwindow",
    });
  }

  /**
   * Toggle full window mode
   */
  toggleFullWindow(): void {
    if (this.isFullWindow()) {
      this.exitFullWindow();
    } else {
      this.enterFullWindow();
    }
  }

  // ============================================================================
  // State Access
  // ============================================================================

  /**
   * Get the current chart state
   */
  getState(): ChartState {
    return this.state;
  }

  /**
   * Get loading state
   */
  isLoading(): boolean {
    return this.state.loading || false;
  }

  /**
   * Check if chart is ready for API calls
   */
  isChartReady(): boolean {
    return this.isReady;
  }

  /**
   * Get the currently visible time range
   * @returns TimeRange object with start and end timestamps in milliseconds
   */
  getTimeRange(): TimeRange {
    // Return plain object instead of proxy
    const timeRange = this.state.timeRange;
    return {
      start: Number(timeRange.start),
      end: Number(timeRange.end),
    };
  }

  /**
   * Set a new time range for the chart
   * @param timeRange Time range with start and end timestamps in milliseconds
   */
  setTimeRange(timeRange: TimeRange | { start?: number; end?: number }): void {
    logger.info(`ChartApi: Setting time range`, timeRange);

    // Merge with existing time range if partial
    const newTimeRange: TimeRange = {
      start:
        timeRange.start !== undefined
          ? timeRange.start
          : this.state.timeRange.start,
      end:
        timeRange.end !== undefined ? timeRange.end : this.state.timeRange.end,
    };

    // Validate time range
    if (newTimeRange.start >= newTimeRange.end) {
      logger.error("ChartApi: Invalid time range - start must be before end");
      throw new Error("Invalid time range: start must be before end");
    }

    // Update the state
    this.state.timeRange = newTimeRange;

    // Check if we need to fetch more data
    const bufferTimeRange =
      (newTimeRange.end - newTimeRange.start) * BUFFER_MULTIPLIER;
    const needMoreData =
      newTimeRange.start <
        this.state.priceHistory.startTimestamp + bufferTimeRange ||
      newTimeRange.end > this.state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      // Determine direction based on which boundary we're approaching
      const direction =
        newTimeRange.start <
        this.state.priceHistory.startTimestamp + bufferTimeRange
          ? "backward"
          : "forward";

      // Dispatch event to fetch more data
      this.container.dispatchEvent(
        new CustomEvent("chart-pan", {
          detail: {
            direction,
            timeRange: newTimeRange,
            needMoreData: true,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }

    // Force a redraw
    this.redraw();
  }

  /**
   * Get the currently visible price range
   * @returns PriceRange object with min, max, and range values
   */
  getPriceRange(): PriceRange {
    // Return the actual PriceRange object to preserve methods
    return this.state.priceRange;
  }

  /**
   * Get the candles currently visible in the chart
   * @returns Array of [timestamp, Candle] tuples for visible candles
   */
  getCandles(): [number, Candle][] {
    // Get candles from the price history within the current time range
    const timeRange = this.state.timeRange;
    return this.state.priceHistory.getCandlesInRange(
      timeRange.start,
      timeRange.end,
    );
  }

  /**
   * Set a new price range for the chart
   * @param priceRange Object with min and max price values
   */
  setPriceRange(priceRange: { min: number; max: number }): void {
    logger.info(`ChartApi: Setting price range`, priceRange);

    // Validate price range
    if (priceRange.min >= priceRange.max) {
      logger.error("ChartApi: Invalid price range - min must be less than max");
      throw new Error("Invalid price range: min must be less than max");
    }

    // Create new PriceRangeImpl instance
    const newPriceRange = new PriceRangeImpl(priceRange.min, priceRange.max);

    // Update the state
    this.state.priceRange = newPriceRange;

    // Force a redraw
    this.redraw();
  }

  /**
   * Force a redraw of the chart
   */
  redraw(): void {
    logger.info("ChartApi: Forcing chart redraw");
    this.container.draw();
  }

  /**
   * Get chart container element
   */
  getContainer(): ChartContainer {
    return this.container;
  }

  /**
   * Get app instance
   */
  getApp(): App {
    return this.app;
  }

  // ============================================================================
  // Pan and Zoom Control
  // ============================================================================

  /**
   * Pan the chart by the specified pixel amounts
   * @param deltaX Horizontal pan amount in pixels (positive = pan right, negative = pan left)
   * @param deltaY Vertical pan amount in pixels (positive = pan down, negative = pan up)
   * @param options Optional configuration for pan behavior
   */
  pan(deltaX: number, deltaY: number, options?: PanOptions): void {
    const sensitivity = options?.sensitivity ?? 1.0;
    const animate = options?.animate ?? false;
    const duration = options?.duration ?? 1000;

    if (animate) {
      // Animated pan
      this.animatedPan(deltaX * sensitivity, deltaY * sensitivity, duration);
    } else {
      // Immediate pan
      this.immediateHorizontalPan(deltaX * sensitivity);
      this.immediateVerticalPan(deltaY * sensitivity);
    }
  }

  /**
   * Pan the chart horizontally (time axis)
   * @param deltaX Horizontal pan amount in pixels (positive = pan right, negative = pan left)
   * @param options Optional configuration for pan behavior
   */
  panHorizontal(deltaX: number, options?: PanOptions): void {
    this.pan(deltaX, 0, options);
  }

  /**
   * Pan the chart vertically (price axis)
   * @param deltaY Vertical pan amount in pixels (positive = pan down, negative = pan up)
   * @param options Optional configuration for pan behavior
   */
  panVertical(deltaY: number, options?: PanOptions): void {
    this.pan(0, deltaY, options);
  }

  /**
   * Zoom the time axis
   * @param delta Zoom amount (positive = zoom in, negative = zoom out)
   * @param options Optional zoom configuration including center point
   */
  zoom(delta: number, options?: ZoomOptions): void {
    const sensitivity = options?.sensitivity ?? 1.0;
    const centerX = options?.center?.x;

    // Get container dimensions
    const rect = this.container.getBoundingClientRect();

    // Calculate zoom center (default to chart center)
    const zoomCenter = centerX !== undefined ? centerX / rect.width : 0.5;

    const timeRange = this.state.timeRange.end - this.state.timeRange.start;
    const zoomFactor = 0.005; // Base zoom factor
    const timeAdjustment = timeRange * zoomFactor * delta * sensitivity;

    // Calculate the proposed new time range
    const proposedTimeRange = timeRange - timeAdjustment;

    // Calculate minimum and maximum time ranges
    const candleInterval = getCandleInterval(this.state.granularity);
    const minTimeRange = candleInterval * 10;

    // Calculate maximum time range to prevent candle overlap
    const FIXED_GAP_WIDTH = 6;
    const MIN_CANDLE_WIDTH = 5;
    const dpr = getDpr() ?? 1;
    const canvasWidth = rect.width * dpr;
    const pixelsPerCandle = MIN_CANDLE_WIDTH + FIXED_GAP_WIDTH;
    const maxCandlesInViewport = Math.floor(canvasWidth / pixelsPerCandle);
    const maxTimeRange = maxCandlesInViewport * candleInterval;

    // Enforce both minimum and maximum time range
    const newTimeRange = Math.max(
      minTimeRange,
      Math.min(proposedTimeRange, maxTimeRange),
    );

    const rangeDifference = timeRange - newTimeRange;

    const newStart = this.state.timeRange.start + rangeDifference * zoomCenter;
    const newEnd =
      this.state.timeRange.end - rangeDifference * (1 - zoomCenter);

    // Update time range
    this.setTimeRange({ start: newStart, end: newEnd });
  }

  /**
   * Zoom the price axis
   * @param delta Zoom amount (positive = zoom in, negative = zoom out)
   * @param options Optional zoom configuration including center point
   */
  zoomPrice(delta: number, options?: ZoomOptions): void {
    const sensitivity = options?.sensitivity ?? 1.0;
    const centerY = options?.center?.y;

    // Get container dimensions
    const rect = this.container.getBoundingClientRect();

    // Calculate zoom center (default to chart center)
    const zoomCenter = centerY !== undefined ? centerY / rect.height : 0.5;

    // Apply zoom to price range
    const adjustedDelta = delta * sensitivity * 0.1; // Scale down for price zoom
    (this.state.priceRange as PriceRangeImpl).adjust(adjustedDelta, zoomCenter);

    // Force a redraw
    this.redraw();
  }

  // Private helper methods for panning
  private immediateHorizontalPan(deltaX: number): void {
    const timeRange = this.state.timeRange.end - this.state.timeRange.start;
    const viewportWidth = this.container.clientWidth;
    const timePerPixel = timeRange / viewportWidth;

    // Note: We don't invert deltaX here - the embedding app handles gesture interpretation
    const timeShift = Math.round(deltaX * timePerPixel);

    if (timeShift === 0) return;

    const newStart = this.state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    // Update time range
    this.setTimeRange({ start: newStart, end: newEnd });
  }

  private immediateVerticalPan(deltaY: number): void {
    if (!this.state.priceRange) {
      logger.error("Price range not found");
      return;
    }

    const containerHeight = this.container.clientHeight;
    if (containerHeight === 0) {
      logger.error("Container height is 0");
      return;
    }

    const pricePerPixel = this.state.priceRange.range / containerHeight;
    const priceShift = deltaY * pricePerPixel * 1.5; // 1.5 is sensitivity factor

    if (priceShift === 0) return;

    // Dispatch event for price-axis to update immediately
    this.container.dispatchEvent(
      new CustomEvent("price-axis-pan", {
        detail: {
          priceShift,
          newPriceRange: {
            min: this.state.priceRange.min + priceShift,
            max: this.state.priceRange.max + priceShift,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );

    this.state.priceRange.shift(priceShift);

    // Force a redraw
    this.redraw();
  }

  private animatedPan(deltaX: number, deltaY: number, duration: number): void {
    const startTime = performance.now();
    const startTimeRange = { ...this.state.timeRange };
    const startPriceRange = {
      min: this.state.priceRange.min,
      max: this.state.priceRange.max,
    };

    // Calculate target values
    const timeRange = startTimeRange.end - startTimeRange.start;
    const viewportWidth = this.container.clientWidth;
    const timePerPixel = timeRange / viewportWidth;
    const timeShift = Math.round(deltaX * timePerPixel);

    const containerHeight = this.container.clientHeight;
    const pricePerPixel = this.state.priceRange.range / containerHeight;
    const priceShift = deltaY * pricePerPixel * 1.5;

    const targetTimeRange = {
      start: startTimeRange.start - timeShift,
      end: startTimeRange.end - timeShift,
    };

    const targetPriceRange = {
      min: startPriceRange.min + priceShift,
      max: startPriceRange.max + priceShift,
    };

    const animate = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = this.easeInOutCubic(progress);

      // Update time range
      const currentTimeStart =
        startTimeRange.start +
        (targetTimeRange.start - startTimeRange.start) * easedProgress;
      const currentTimeEnd =
        startTimeRange.end +
        (targetTimeRange.end - startTimeRange.end) * easedProgress;
      this.setTimeRange({ start: currentTimeStart, end: currentTimeEnd });

      // Update price range
      if (deltaY !== 0) {
        const currentPriceMin =
          startPriceRange.min +
          (targetPriceRange.min - startPriceRange.min) * easedProgress;
        const currentPriceMax =
          startPriceRange.max +
          (targetPriceRange.max - startPriceRange.max) * easedProgress;
        this.setPriceRange({ min: currentPriceMin, max: currentPriceMax });
      }

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  private easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  // ============================================================================
  // Event System
  // ============================================================================

  /**
   * Add event listener
   * @param event Event name
   * @param callback Event callback
   */
  on<T extends ChartApiEventName>(
    event: T,
    callback: ChartApiEventCallback<T>,
  ): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    // If this is a 'ready' event listener and the chart is already ready, emit immediately
    if (event === "ready" && this.isReady && this.readyData) {
      logger.info(
        "ChartApi: Chart already ready, emitting ready event immediately for new listener",
      );
      setTimeout(() => {
        try {
          (callback as ChartApiEventCallback<"ready">)(this.readyData!);
        } catch (error) {
          logger.error("ChartApi: Error in ready event callback:", error);
        }
      }, 0);
    }
  }

  /**
   * Remove event listener
   * @param event Event name
   * @param callback Event callback
   */
  off<T extends ChartApiEventName>(
    event: T,
    callback: ChartApiEventCallback<T>,
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Event data
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          logger.error(
            `ChartApi: Error in event listener for ${event}:`,
            error,
          );
        }
      });
    }
  }

  // ============================================================================
  // Trend Line Control
  // ============================================================================

  /**
   * Add a trend line to the chart
   * @param trendLine Trend line configuration (without ID) and options
   * @returns The ID of the created trend line
   */
  addTrendLine(
    trendLine: Omit<TrendLine, "id"> & { selected?: boolean },
  ): string {
    const id = `trend-line-${Date.now()}`;
    const { selected, ...trendLineData } = trendLine;
    const fullTrendLine: TrendLine = { id, ...trendLineData };

    // Access the container's trend line methods
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.addTrendLine) {
      chartContainer.addTrendLine(fullTrendLine);

      // Handle selection state
      if (selected === true && chartContainer.trendLineLayer) {
        // Select the newly created line
        chartContainer.trendLineLayer.selectLine(id);
      } else if (selected === false && chartContainer.trendLineLayer) {
        // Explicitly deselect if selected is false
        chartContainer.trendLineLayer.deselectAll();
      }
      // If selected is undefined, keep the default behavior (line stays selected)
    }

    logger.info(
      `ChartApi: Added trend line ${id}${selected !== undefined ? ` (selected: ${selected})` : ""}`,
    );
    return id;
  }

  /**
   * Remove a trend line from the chart
   * @param id The ID of the trend line to remove
   */
  removeTrendLine(id: string): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      chartContainer.trendLineLayer.removeTrendLine(id);

      // Emit deletion event
      this.emitEvent("trend-line-deleted", { trendLineId: id });
    }

    logger.info(`ChartApi: Removed trend line ${id}`);
  }

  /**
   * Update an existing trend line
   * @param id The ID of the trend line to update
   * @param updates Partial trend line updates
   */
  updateTrendLine(id: string, updates: Partial<TrendLine>): void {
    logger.debug(
      `ChartApi: updateTrendLine called with id="${id}" (type: ${typeof id})`,
    );
    logger.debug(`ChartApi: Updates:`, updates);

    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      logger.debug(`ChartApi: Found trendLineLayer, calling updateTrendLine`);
      chartContainer.trendLineLayer.updateTrendLine(id, updates);
    } else {
      logger.warn(`ChartApi: Could not find trendLineLayer on container`);
    }

    logger.info(`ChartApi: Updated trend line ${id}`);
  }

  /**
   * Get all trend lines
   * @returns Array of trend lines
   */
  getTrendLines(): TrendLine[] {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLines) {
      return chartContainer.trendLines;
    }
    return [];
  }

  /**
   * Get a specific trend line by ID
   * @param id The ID of the trend line
   * @returns The trend line or null if not found
   */
  getTrendLine(id: string): TrendLine | null {
    const trendLines = this.getTrendLines();
    return trendLines.find((line) => line.id === id) || null;
  }

  /**
   * Update trend line settings
   * @param id The ID of the trend line to update
   * @param settings The settings to update
   */
  updateTrendLineSettings(id: string, settings: TrendLineSettings): void {
    this.updateTrendLine(id, settings);
    logger.info(`ChartApi: Updated settings for trend line ${id}`);
  }

  /**
   * Clear all trend lines
   */
  clearTrendLines(): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      chartContainer.trendLineLayer.clearTrendLines();
      chartContainer.trendLines = [];
    }

    logger.info("ChartApi: Cleared all trend lines");
  }

  /**
   * Activate the trend line drawing tool
   * @param defaults Optional default settings for new trend lines
   */
  activateTrendLineTool(defaults?: TrendLineDefaults): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineTool) {
      // Set defaults if provided
      if (defaults) {
        chartContainer.trendLineTool.setDefaults(defaults);
      }
      chartContainer.trendLineTool.activate();

      // Update toolbar state
      const toolbar = chartContainer.renderRoot.querySelector(
        "chart-toolbar",
      ) as any;
      if (toolbar) toolbar.trendLineToolActive = true;
    }

    logger.info("ChartApi: Activated trend line tool", defaults);
  }

  /**
   * Set default settings for new trend lines without activating the tool
   * @param defaults Default settings for new trend lines
   */
  setTrendLineDefaults(defaults: TrendLineDefaults): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineTool) {
      chartContainer.trendLineTool.setDefaults(defaults);
    }

    logger.info("ChartApi: Set trend line defaults", defaults);
  }

  /**
   * Deactivate the trend line drawing tool
   */
  deactivateTrendLineTool(): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineTool) {
      chartContainer.trendLineTool.deactivate();

      // Update toolbar state
      const toolbar = chartContainer.renderRoot.querySelector(
        "chart-toolbar",
      ) as any;
      if (toolbar) toolbar.trendLineToolActive = false;
    }

    logger.info("ChartApi: Deactivated trend line tool");
  }

  /**
   * Check if the trend line tool is active
   * @returns true if the tool is active
   */
  isToolActive(tool: "trendLine"): boolean {
    if (tool === "trendLine") {
      const chartContainer = this.container as any;
      if (chartContainer && chartContainer.trendLineTool) {
        return chartContainer.trendLineTool.isToolActive();
      }
    }
    return false;
  }

  /**
   * Select a trend line by ID
   * @param id The ID of the trend line to select
   */
  selectTrendLine(id: string): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      chartContainer.trendLineLayer.selectLine(id);
      logger.info(`ChartApi: Selected trend line ${id}`);
    }
  }

  /**
   * Deselect all trend lines
   */
  deselectAllTrendLines(): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      chartContainer.trendLineLayer.deselectAll();
      logger.info("ChartApi: Deselected all trend lines");
    }
  }

  /**
   * Get the currently selected trend line ID
   * @returns The ID of the selected trend line or null if none selected
   */
  getSelectedTrendLineId(): string | null {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineLayer) {
      return chartContainer.trendLineLayer.selectedLineId || null;
    }
    return null;
  }

  // ============================================================================
  // Pattern Highlighting
  // ============================================================================

  /**
   * Highlight patterns on the chart
   * @param patterns Array of pattern highlights to display
   */
  highlightPatterns(patterns: PatternHighlight[]): void {
    logger.info(`ChartApi: Highlighting ${patterns.length} patterns`);

    const chartContainer = this.container as ChartContainer;
    if (chartContainer && chartContainer.setPatternHighlights) {
      chartContainer.setPatternHighlights(patterns);
    }

    // Emit event
    this.emitEvent("patterns-highlighted", { patterns });
  }

  /**
   * Clear all pattern highlights from the chart
   */
  clearPatternHighlights(): void {
    logger.info("ChartApi: Clearing all pattern highlights");

    // Stop any running wave animation
    this.stopPulseWave();

    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.clearPatternHighlights) {
      chartContainer.clearPatternHighlights();
    }

    // Emit event
    this.emitEvent("patterns-cleared", undefined);
  }

  /**
   * Get the currently highlighted patterns
   * @returns Array of currently highlighted patterns
   */
  getHighlightedPatterns(): PatternHighlight[] {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.getPatternHighlights) {
      return chartContainer.getPatternHighlights();
    }
    return [];
  }

  /**
   * Create a pulsating wave effect that moves through the chart candles
   * @param options Configuration for the wave effect
   * @param options.speed Speed of the wave movement (default: 5)
   * @param options.color Color of the wave (default: "#ec4899" - pink)
   * @param options.numCandles Number of candles in the wave (default: 20)
   */
  pulseWave(options?: {
    speed?: number;
    color?: string;
    numCandles?: number;
  }): void {
    const config = {
      speed: options?.speed ?? 50,
      color: options?.color ?? "#ec4899",
      numCandles: options?.numCandles ?? 5,
    };

    logger.info(
      `ChartApi: Starting pulse wave with speed=${config.speed}, color=${config.color}, numCandles=${config.numCandles}`,
    );

    // Clear any existing wave animation
    this.stopPulseWave();

    const candles = this.getCandles();
    if (candles.length < config.numCandles) {
      logger.warn(
        `ChartApi: Not enough candles visible for wave effect (need at least ${config.numCandles})`,
      );
      return;
    }

    // Function to create wave patterns
    const createWavePatterns = (wavePosition: number): PatternHighlight[] => {
      const patterns: PatternHighlight[] = [];

      // Create a single wave that moves left to right
      for (let i = 0; i < config.numCandles; i++) {
        const candleIndex = (wavePosition + i) % candles.length;

        const opacity = 0.3 + (0.7 / config.numCandles) * i;

        patterns.push({
          id: `wave_${candleIndex}_${Date.now()}`,
          type: "pattern",
          patternType: "wave_effect",
          name: "", // Empty name to hide labels
          description: "", // Empty description
          candleTimestamps: [candles[candleIndex][0]],
          significance: "effect",
          color: config.color,
          opacity,
          style: "fill",
        });
      }

      return patterns;
    };

    let wavePosition = 0;
    // Animate the wave
    this.waveInterval = setInterval(() => {
      wavePosition = (wavePosition + config.speed) % candles.length;
      const patterns = createWavePatterns(wavePosition);
      this.highlightPatterns(patterns);
    }, 40); // 40ms update rate for smooth animation

    // Auto-stop after 30 seconds to prevent infinite animation
    setTimeout(() => {
      if (this.waveInterval) {
        this.stopPulseWave();
        logger.info("ChartApi: Wave effect stopped (30s timeout)");
      }
    }, 30000);
  }

  /**
   * Stop the pulsating wave effect if it's running
   */
  stopPulseWave(): void {
    if (this.waveInterval) {
      clearInterval(this.waveInterval);
      this.waveInterval = null;
      logger.info("ChartApi: Stopped pulse wave");
    }
  }

  // ============================================================================
  // Trade Markers (Paper Trading & Backtesting)
  // ============================================================================

  /**
   * Add a trade marker to the chart
   * @param config Trade marker configuration
   * @returns The ID of the created trade marker
   */
  addTradeMarker(config: TradeMarkerConfig): string {
    const id = config.id || `trade-marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create full marker with defaults
    const marker: TradeMarker = {
      id,
      timestamp: config.timestamp,
      price: config.price,
      side: config.side,
      shape: config.shape || 'arrow',
      color: config.color || (config.side === 'buy' ? TRADING_OVERLAY_COLORS.buyMarker : TRADING_OVERLAY_COLORS.sellMarker),
      size: config.size || 'medium',
      text: config.text || '',
      tooltip: config.tooltip,
      interactive: config.interactive !== undefined ? config.interactive : true,
      zIndex: config.zIndex !== undefined ? config.zIndex : 100,
    };

    // Add to state array
    if (!this.state.tradeMarkers) {
      this.state.tradeMarkers = [];
    }
    this.state.tradeMarkers.push(marker);

    // Notify container about new marker
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.addTradeMarker) {
      chartContainer.addTradeMarker(marker);
    }

    this.redraw();
    logger.info(`ChartApi: Added trade marker ${id} at ${marker.price} (${marker.side})`);
    return id;
  }

  /**
   * Remove a trade marker from the chart
   * @param markerId The ID of the trade marker to remove
   */
  removeTradeMarker(markerId: string): void {
    if (!this.state.tradeMarkers) {
      logger.warn(`ChartApi: Trade marker ${markerId} not found (no markers)`);
      return;
    }

    const index = this.state.tradeMarkers.findIndex((m) => m.id === markerId);
    if (index === -1) {
      logger.warn(`ChartApi: Trade marker ${markerId} not found`);
      return;
    }

    this.state.tradeMarkers.splice(index, 1);

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.removeTradeMarker) {
      chartContainer.removeTradeMarker(markerId);
    }

    this.redraw();
    logger.info(`ChartApi: Removed trade marker ${markerId}`);
  }

  /**
   * Update an existing trade marker
   * @param markerId The ID of the trade marker to update
   * @param updates Partial trade marker updates
   */
  updateTradeMarker(markerId: string, updates: Partial<TradeMarkerConfig>): void {
    if (!this.state.tradeMarkers) {
      logger.warn(`ChartApi: Trade marker ${markerId} not found (no markers)`);
      return;
    }

    const index = this.state.tradeMarkers.findIndex((m) => m.id === markerId);
    if (index === -1) {
      logger.warn(`ChartApi: Trade marker ${markerId} not found`);
      return;
    }

    // Apply updates
    const marker = this.state.tradeMarkers[index];
    const updatedMarker: TradeMarker = {
      ...marker,
      ...updates,
      id: markerId, // Preserve ID
    };

    this.state.tradeMarkers[index] = updatedMarker;

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.updateTradeMarker) {
      chartContainer.updateTradeMarker(markerId, updatedMarker);
    }

    this.redraw();
    logger.info(`ChartApi: Updated trade marker ${markerId}`);
  }

  /**
   * Get all trade markers
   * @returns Array of trade markers
   */
  getTradeMarkers(): TradeMarker[] {
    return this.state.tradeMarkers || [];
  }

  /**
   * Clear all trade markers
   */
  clearTradeMarkers(): void {
    this.state.tradeMarkers = [];

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.clearTradeMarkers) {
      chartContainer.clearTradeMarkers();
    }

    this.redraw();
    logger.info("ChartApi: Cleared all trade markers");
  }

  // ============================================================================
  // Price Lines (Orders, Stop Losses, Take Profits)
  // ============================================================================

  /**
   * Add a price line to the chart
   * @param config Price line configuration
   * @returns The ID of the created price line
   */
  addPriceLine(config: PriceLineConfig): string {
    const id = config.id || `price-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create full price line with defaults
    const priceLine: PriceLine = {
      id,
      price: config.price,
      color: config.color || TRADING_OVERLAY_COLORS.priceLine,
      lineStyle: config.lineStyle || 'solid',
      lineWidth: config.lineWidth !== undefined ? config.lineWidth : 1,
      label: config.label,
      draggable: config.draggable !== undefined ? config.draggable : false,
      extendLeft: config.extendLeft !== undefined ? config.extendLeft : true,
      extendRight: config.extendRight !== undefined ? config.extendRight : true,
      interactive: config.interactive !== undefined ? config.interactive : true,
      showPriceLabel: config.showPriceLabel !== undefined ? config.showPriceLabel : true,
      metadata: config.metadata,
      zIndex: config.zIndex !== undefined ? config.zIndex : 50,
    };

    // Add to state array
    if (!this.state.priceLines) {
      this.state.priceLines = [];
    }
    this.state.priceLines.push(priceLine);

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.addPriceLine) {
      chartContainer.addPriceLine(priceLine);
    }

    this.redraw();
    logger.info(`ChartApi: Added price line ${id} at ${priceLine.price}`);
    return id;
  }

  /**
   * Remove a price line from the chart
   * @param lineId The ID of the price line to remove
   */
  removePriceLine(lineId: string): void {
    if (!this.state.priceLines) {
      logger.warn(`ChartApi: Price line ${lineId} not found (no lines)`);
      return;
    }

    const index = this.state.priceLines.findIndex((l) => l.id === lineId);
    if (index === -1) {
      logger.warn(`ChartApi: Price line ${lineId} not found`);
      return;
    }

    this.state.priceLines.splice(index, 1);

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.removePriceLine) {
      chartContainer.removePriceLine(lineId);
    }

    this.redraw();
    logger.info(`ChartApi: Removed price line ${lineId}`);
  }

  /**
   * Update an existing price line
   * @param lineId The ID of the price line to update
   * @param updates Partial price line updates
   */
  updatePriceLine(lineId: string, updates: Partial<PriceLineConfig>): void {
    if (!this.state.priceLines) {
      logger.warn(`ChartApi: Price line ${lineId} not found (no lines)`);
      return;
    }

    const index = this.state.priceLines.findIndex((l) => l.id === lineId);
    if (index === -1) {
      logger.warn(`ChartApi: Price line ${lineId} not found`);
      return;
    }

    // Apply updates
    const priceLine = this.state.priceLines[index];
    const updatedLine: PriceLine = {
      ...priceLine,
      ...updates,
      id: lineId, // Preserve ID
    };

    this.state.priceLines[index] = updatedLine;

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.updatePriceLine) {
      chartContainer.updatePriceLine(lineId, updatedLine);
    }

    this.redraw();
    logger.info(`ChartApi: Updated price line ${lineId}`);
  }

  /**
   * Get all price lines
   * @returns Array of price lines
   */
  getPriceLines(): PriceLine[] {
    return this.state.priceLines || [];
  }

  /**
   * Get a specific price line by ID
   * @param lineId The ID of the price line
   * @returns The price line or null if not found
   */
  getPriceLine(lineId: string): PriceLine | null {
    if (!this.state.priceLines) return null;
    return this.state.priceLines.find((l) => l.id === lineId) || null;
  }

  /**
   * Clear all price lines
   */
  clearPriceLines(): void {
    this.state.priceLines = [];

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.clearPriceLines) {
      chartContainer.clearPriceLines();
    }

    this.redraw();
    logger.info("ChartApi: Cleared all price lines");
  }

  // ============================================================================
  // Position Overlay (Current Position Information)
  // ============================================================================

  /**
   * Set or update the position overlay
   * @param config Position overlay configuration (null to hide)
   */
  setPositionOverlay(config: PositionOverlayConfig | null): void {
    this.state.positionOverlay = config;

    // Notify container
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.setPositionOverlay) {
      chartContainer.setPositionOverlay(config);
    }

    this.redraw();

    if (config) {
      logger.info(`ChartApi: Set position overlay for ${config.symbol} (${config.side} ${config.quantity})`);
    } else {
      logger.info("ChartApi: Cleared position overlay");
    }
  }

  /**
   * Get the current position overlay configuration
   * @returns Position overlay config or null if not set
   */
  getPositionOverlay(): PositionOverlayConfig | null {
    return this.state.positionOverlay || null;
  }

  /**
   * Update position overlay with partial updates
   * @param updates Partial position overlay updates
   */
  updatePositionOverlay(updates: Partial<PositionOverlayConfig>): void {
    if (!this.state.positionOverlay) {
      logger.warn("ChartApi: No position overlay to update");
      return;
    }

    const updatedOverlay: PositionOverlayConfig = {
      ...this.state.positionOverlay,
      ...updates,
    };

    this.setPositionOverlay(updatedOverlay);
    logger.info("ChartApi: Updated position overlay");
  }

  // ============================================================================
  // Screenshot
  // ============================================================================

  /**
   * Take a screenshot of the chart
   * Captures the entire chart including main chart, indicators, timeline, price axis, trend lines, and pattern highlights
   * @param options Screenshot options (format, quality, scale, etc.)
   * @returns Promise that resolves to a data URL of the screenshot
   * @example
   * ```typescript
   * // Simple PNG screenshot
   * const dataUrl = await api.takeScreenshot();
   *
   * // High-quality JPEG for social media
   * const dataUrl = await api.takeScreenshot({
   *   format: 'jpeg',
   *   quality: 0.95,
   *   backgroundColor: '#FFFFFF'
   * });
   * ```
   */
  async takeScreenshot(options?: ScreenshotOptions): Promise<string> {
    logger.info("ChartApi: Taking screenshot");
    return captureChartScreenshot(this.container, options);
  }

  /**
   * Take a screenshot and return as Blob (useful for uploads)
   * @param options Screenshot options
   * @returns Promise that resolves to a Blob of the screenshot
   * @example
   * ```typescript
   * // Get blob for upload to server
   * const blob = await api.takeScreenshotBlob({ format: 'jpeg' });
   * const formData = new FormData();
   * formData.append('image', blob, 'chart.jpg');
   * await fetch('/api/upload', { method: 'POST', body: formData });
   * ```
   */
  async takeScreenshotBlob(options?: ScreenshotOptions): Promise<Blob> {
    const dataUrl = await this.takeScreenshot(options);
    return dataUrlToBlob(dataUrl);
  }

  /**
   * Take a screenshot and download it directly
   * @param filename Optional filename (default: chart-{timestamp}.{format})
   * @param options Screenshot options
   * @returns Promise that resolves when download is initiated
   * @example
   * ```typescript
   * // Download as PNG with custom filename
   * await api.downloadScreenshot('my-chart.png');
   *
   * // Download as high-res JPEG
   * await api.downloadScreenshot('chart.jpg', {
   *   format: 'jpeg',
   *   scale: 2,
   *   quality: 0.95
   * });
   * ```
   */
  async downloadScreenshot(
    filename?: string,
    options?: ScreenshotOptions,
  ): Promise<void> {
    logger.info("ChartApi: Downloading screenshot");
    const dataUrl = await this.takeScreenshot(options);
    const actualFilename =
      filename || `chart-${Date.now()}.${options?.format || "png"}`;
    return downloadScreenshotHelper(dataUrl, actualFilename, options?.format);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /**
   * Clean up the API instance
   */
  dispose(): void {
    logger.info("ChartApi: Disposing");
    this.eventListeners.clear();
  }
}

/**
 * Create a Chart API instance
 * @param container Chart container element
 * @param app App instance
 * @returns ChartApi instance
 */
export function createChartApi(container: ChartContainer, app: App): ChartApi {
  return new ChartApi({ container, app });
}
