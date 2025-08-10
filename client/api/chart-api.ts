// client/api/chart-api.ts
import { ChartContainer } from "../components/chart/chart-container";
import { App } from "../app";
import { ChartState } from "../index";
import { Granularity, getAllGranularities } from "../../server/services/price-data/price-history-model";
import { IndicatorConfig, DisplayType, ScaleType, GridStyle } from "../components/chart/indicators/indicator-types";
import { logger } from "../util/logger";
import { config as chartConfig } from "../config";
import { TrendLine, TrendLineEvent } from "../types/trend-line";

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
  action: 'show' | 'hide';
  indicator?: ApiIndicatorConfig;
  indicatorId?: string;
}

export interface FullscreenChangeEvent {
  isFullscreen?: boolean;
  isFullWindow?: boolean;
  type: 'fullscreen' | 'fullwindow';
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
  style?: 'solid' | 'dashed' | 'dotted';
  extendLeft?: boolean;
  extendRight?: boolean;
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
  'trend-line-added': TrendLineEvent;
  'trend-line-updated': TrendLineEvent;
  'trend-line-removed': TrendLineEvent;
  'trend-line-selected': TrendLineSelectedEvent;
  'trend-line-deselected': TrendLineDeselectedEvent;
  'trend-line-deleted': TrendLineDeletedEvent;
}

/**
 * Valid event names for the Chart API
 */
export type ChartApiEventName = keyof ChartApiEventMap;

/**
 * Event listener callback type for Chart API events
 */
export type ChartApiEventCallback<T extends ChartApiEventName> = (data: ChartApiEventMap[T]) => void;

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

  constructor(options: ChartApiOptions) {
    this.container = options.container;
    this.app = options.app;
    this.state = options.app.getState();
    
    logger.info("ChartApi: Initialized with container and app");
    
    // Listen for chart-ready event from the container and emit ready event
    this.container.addEventListener('chart-ready', () => {
      logger.info("ChartApi: Chart is ready, emitting ready event");
      this.isReady = true;
      this.readyData = {
        timestamp: Date.now(),
        symbol: this.state.symbol,
        granularity: this.state.granularity
      };
      this.emitEvent('ready', this.readyData);
    });
    
    // Listen for trend line events
    this.container.addEventListener('trend-line-added', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-added', customEvent.detail);
    });
    
    this.container.addEventListener('trend-line-updated', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-updated', customEvent.detail);
    });
    
    this.container.addEventListener('trend-line-removed', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-removed', customEvent.detail);
    });
    
    this.container.addEventListener('trend-line-selected', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-selected', customEvent.detail);
    });
    
    this.container.addEventListener('trend-line-deselected', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-deselected', customEvent.detail);
    });
    
    this.container.addEventListener('trend-line-deleted', (event: Event) => {
      const customEvent = event as CustomEvent;
      this.emitEvent('trend-line-deleted', customEvent.detail);
    });
  }

  // ============================================================================
  // Symbol Control
  // ============================================================================

  /**
   * Get the current symbol
   */
  getSymbol(): string {
    return this.state.symbol;
  }

  /**
   * Set the chart symbol (e.g., "BTC-USD", "ETH-USD")
   * @param options Symbol and options
   * @returns Promise that resolves when symbol change is complete
   */
  async setSymbol(options: string | SymbolChangeOptions): Promise<void> {
    const config = typeof options === 'string' 
      ? { symbol: options, refetch: true }
      : { refetch: true, ...options };

    logger.info(`ChartApi: Setting symbol to ${config.symbol}`);
    
    const oldSymbol = this.state.symbol;
    this.state.symbol = config.symbol;
    
    this.emitEvent('symbolChange', {
      oldSymbol,
      newSymbol: config.symbol,
      refetch: config.refetch
    });

    if (config.refetch) {
      // The App class observers will handle the refetch automatically
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow observers to trigger
    }
  }

  // ============================================================================
  // Granularity Control
  // ============================================================================

  /**
   * Get the current granularity
   */
  getGranularity(): Granularity {
    return this.state.granularity;
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
  async setGranularity(options: Granularity | GranularityChangeOptions): Promise<void> {
    const config = typeof options === 'string' 
      ? { granularity: options, refetch: true }
      : { refetch: true, ...options };

    logger.info(`ChartApi: Setting granularity to ${config.granularity}`);
    
    const oldGranularity = this.state.granularity;
    this.state.granularity = config.granularity;
    
    this.emitEvent('granularityChange', {
      oldGranularity,
      newGranularity: config.granularity,
      refetch: config.refetch
    });

    if (config.refetch) {
      // The App class observers will handle the refetch automatically
      await new Promise(resolve => setTimeout(resolve, 100)); // Allow observers to trigger
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
    if (indicatorId === 'volume') {
      return this.container.isIndicatorVisible('volume');
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
      const label = item.label?.toLowerCase().replace(/\s+/g, '-');
      const id = config.id.toLowerCase();
      return label === id || 
             item.label?.toLowerCase() === config.name?.toLowerCase() ||
             (id === 'volume' && item.label === 'Volume') ||
             (id === 'rsi' && item.label === 'RSI') ||
             (id === 'macd' && item.label === 'MACD') ||
             (id === 'bollinger-bands' && item.label === 'Bollinger Bands') ||
             (id === 'moving-averages' && item.label === 'Moving Averages') ||
             (id === 'stochastic' && item.label === 'Stochastic') ||
             (id === 'atr' && item.label === 'ATR');
    });

    if (builtInIndicator && builtInIndicator.action) {
      // Check if indicator is already visible to avoid toggling it off
      const isAlreadyVisible = this.isIndicatorVisible(config.id);
      
      if (isAlreadyVisible) {
        logger.info(`ChartApi: Indicator ${config.id} already visible, skipping action`);
      } else {
        // Use the built-in indicator action which has proper configuration
        builtInIndicator.action();
      }
      
      this.emitEvent('indicatorChange', {
        action: 'show',
        indicator: { ...config, visible: true }
      });
    } else {
      // Fallback to manual configuration
      const indicatorConfig: IndicatorConfig = {
        display: DisplayType.Bottom,
        scale: ScaleType.Value,
        skipFetch: false,
        gridStyle: GridStyle.Standard,
        ...config,
        visible: true
      };

      this.container.handleIndicatorToggle(new CustomEvent('toggle-indicator', {
        detail: indicatorConfig
      }));

      this.emitEvent('indicatorChange', {
        action: 'show',
        indicator: indicatorConfig
      });
    }
  }

  /**
   * Hide an indicator
   * @param indicatorId The ID of the indicator to hide
   */
  hideIndicator(indicatorId: string): void {
    logger.info(`ChartApi: Hiding indicator ${indicatorId}`);
    
    this.container.handleIndicatorToggle(new CustomEvent('toggle-indicator', {
      detail: {
        id: indicatorId,
        visible: false
      }
    }));

    this.emitEvent('indicatorChange', {
      action: 'hide',
      indicatorId
    });
  }

  /**
   * Toggle an indicator's visibility
   * @param indicatorId The ID of the indicator to toggle
   * @param config Optional configuration for when showing the indicator
   */
  toggleIndicator(indicatorId: string, config?: Partial<ApiIndicatorConfig>): void {
    const isVisible = this.isIndicatorVisible(indicatorId);
    
    if (isVisible) {
      this.hideIndicator(indicatorId);
    } else {
      // Get built-in indicator configuration if available
      const builtInIndicators = chartConfig.getBuiltInIndicators(this.container);
      const builtInIndicator = builtInIndicators.find((item: any) => {
        // Match by ID or label (case insensitive)
        const label = item.label?.toLowerCase().replace(/\s+/g, '-');
        const id = indicatorId.toLowerCase();
        return label === id || 
               item.label?.toLowerCase() === config?.name?.toLowerCase() ||
               (id === 'volume' && item.label === 'Volume') ||
               (id === 'rsi' && item.label === 'RSI') ||
               (id === 'macd' && item.label === 'MACD') ||
               (id === 'bollinger-bands' && item.label === 'Bollinger Bands') ||
               (id === 'moving-averages' && item.label === 'Moving Averages') ||
               (id === 'stochastic' && item.label === 'Stochastic') ||
               (id === 'atr' && item.label === 'ATR');
      });

      if (builtInIndicator && builtInIndicator.action) {
        // Use the built-in indicator action which has proper configuration
        builtInIndicator.action();
        
        this.emitEvent('indicatorChange', {
          action: 'show',
          indicator: { id: indicatorId, name: config?.name || indicatorId, visible: true, ...config }
        });
      } else {
        // Fallback to manual configuration
        const indicatorConfig: ApiIndicatorConfig = {
          id: indicatorId,
          name: config?.name || indicatorId,
          visible: true,
          ...config
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
    currentIndicators.forEach(indicator => {
      this.hideIndicator(indicator.id);
    });

    // Show the new indicators
    indicators.forEach(indicator => {
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
      this.emitEvent('fullscreenChange', { 
        isFullscreen: true, 
        type: 'fullscreen' 
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
      this.emitEvent('fullscreenChange', { 
        isFullscreen: false, 
        type: 'fullscreen' 
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
    return this.container.classList.contains('full-window');
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
    this.container.classList.add('full-window');
    
    // Trigger the container's toggle method to handle internal state
    (this.container as any).toggleFullWindow?.();
    
    this.emitEvent('fullscreenChange', { 
      isFullWindow: true, 
      type: 'fullwindow' 
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
    this.container.classList.remove('full-window');
    
    // Trigger the container's toggle method to handle internal state
    (this.container as any).toggleFullWindow?.();
    
    this.emitEvent('fullscreenChange', { 
      isFullWindow: false, 
      type: 'fullwindow' 
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
  // Event System
  // ============================================================================

  /**
   * Add event listener
   * @param event Event name
   * @param callback Event callback
   */
  on<T extends ChartApiEventName>(event: T, callback: ChartApiEventCallback<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
    
    // If this is a 'ready' event listener and the chart is already ready, emit immediately
    if (event === 'ready' && this.isReady && this.readyData) {
      logger.info("ChartApi: Chart already ready, emitting ready event immediately for new listener");
      setTimeout(() => {
        try {
          (callback as ChartApiEventCallback<'ready'>)(this.readyData!);
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
  off<T extends ChartApiEventName>(event: T, callback: ChartApiEventCallback<T>): void {
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
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logger.error(`ChartApi: Error in event listener for ${event}:`, error);
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
  addTrendLine(trendLine: Omit<TrendLine, 'id'> & { selected?: boolean }): string {
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
    
    logger.info(`ChartApi: Added trend line ${id}${selected !== undefined ? ` (selected: ${selected})` : ''}`);
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
      this.emitEvent('trend-line-deleted', { trendLineId: id });
    }
    
    logger.info(`ChartApi: Removed trend line ${id}`);
  }
  
  /**
   * Update an existing trend line
   * @param id The ID of the trend line to update
   * @param updates Partial trend line updates
   */
  updateTrendLine(id: string, updates: Partial<TrendLine>): void {
    logger.debug(`ChartApi: updateTrendLine called with id="${id}" (type: ${typeof id})`);
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
    return trendLines.find(line => line.id === id) || null;
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
   */
  activateTrendLineTool(): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineTool) {
      chartContainer.trendLineTool.activate();
      
      // Update toolbar state
      const toolbar = chartContainer.renderRoot.querySelector("chart-toolbar") as any;
      if (toolbar) toolbar.trendLineToolActive = true;
    }
    
    logger.info("ChartApi: Activated trend line tool");
  }
  
  /**
   * Deactivate the trend line drawing tool
   */
  deactivateTrendLineTool(): void {
    const chartContainer = this.container as any;
    if (chartContainer && chartContainer.trendLineTool) {
      chartContainer.trendLineTool.deactivate();
      
      // Update toolbar state
      const toolbar = chartContainer.renderRoot.querySelector("chart-toolbar") as any;
      if (toolbar) toolbar.trendLineToolActive = false;
    }
    
    logger.info("ChartApi: Deactivated trend line tool");
  }
  
  /**
   * Check if the trend line tool is active
   * @returns true if the tool is active
   */
  isToolActive(tool: 'trendLine'): boolean {
    if (tool === 'trendLine') {
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