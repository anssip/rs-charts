import { LitElement, html, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  granularityToMs,
  SimplePriceHistory,
  TimeRange,
} from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import "./live-decorators";
import "./crosshairs";
import "./indicators/volume-chart";
import "./context-menu";
import "./candle-tooltip";
import "./live-candle-display";
import { CandlestickChart, ChartOptions } from "./chart";
import { DrawingContext } from "./drawing-strategy";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState, Layer } from "../..";
import {
  getCandleInterval,
  priceToY,
  timeToX,
  getDpr,
} from "../../util/chart-util";
import { CoinbaseProduct } from "../../api/firestore-client";
import "./indicators/indicator-container";
import "./indicators/market-indicator";
import { ChartInteractionController } from "./interaction/chart-interaction-controller";
import { ClickToTradeController } from "./interaction/click-to-trade-controller";
import {
  initializeControllers,
  initializeInteractionLayers,
} from "./interaction/controller-factory";
import { EquityCurveController } from "./interaction/equity-curve-controller";
import { RiskZonesController } from "./interaction/risk-zones-controller";
import { TimeMarkersController } from "./interaction/time-markers-controller";
import { AnnotationsController } from "./interaction/annotations-controller";
import { PositionOverlayController } from "./interaction/position-overlay-controller";
import { PatternHighlightsController } from "./interaction/pattern-highlights-controller";
import { touch } from "xinjs";
import { getStyles } from "./styles";
import "./indicators/indicator-stack";
import {
  DisplayType,
  IndicatorConfig,
  ScaleType,
} from "./indicators/indicator-types";
import "./trend-line-layer";
import { TrendLineController } from "./interaction/trend-line-controller";
import { TrendLine } from "../../types/trend-line";
import { TrendLineLayer } from "./trend-line-layer";
import "./pattern-labels-layer";
import { PatternLabelsLayer } from "./pattern-labels-layer";
import { PatternHighlight } from "../../types/markers";
import "./trading-markers-layer";
import "./price-lines-layer";
import "./trade-zones-layer";
import "./annotations-layer";
import "./time-markers-layer";
import "./risk-zones-canvas-layer";
import "./equity-curve-canvas-layer";
import "./position-overlay";
import { TradingMarkersLayer } from "./trading-markers-layer";
import { PriceLinesLayer } from "./price-lines-layer";
import { TradeZonesLayer } from "./trade-zones-layer";
import { AnnotationsLayer } from "./annotations-layer";
import { TimeMarkersLayer } from "./time-markers-layer";
import { PositionOverlay as PositionOverlayComponent } from "./position-overlay";
import { RiskZonesLayer } from "./risk-zones-layer";
import {
  TradeMarker,
  PriceLine,
  TradeZone,
  Annotation,
  TimeMarker,
  RiskZone,
  PositionOverlayConfig,
  ClickToTradeConfig,
  OrderRequestData,
  PriceHoverEvent,
  EquityPoint,
  EquityCurveConfig,
} from "../../types/trading-overlays";
import { getLogger, LogLevel } from "../../util/logger";
import { TradingOverlaysManager } from "./trading-overlays-manager";
import { BrowserIntegration } from "./browser-integration";
import { buildContextMenuItems } from "./context-menu-builder";
import { LayerUpdateCoordinator } from "./layer-update-coordinator";
import { ChartEventHandlers } from "./chart-event-handlers";

const logger = getLogger("ChartContainer");
logger.setLoggerLevel("ChartContainer", LogLevel.INFO);

const BUFFER_MULTIPLIER = 1;
export const TIMELINE_HEIGHT = 30;
export const PRICEAXIS_WIDTH = 70;
export const PRICEAXIS_MOBILE_WIDTH = 45;
const INDICATOR_HEIGHT = 150; // Height per stacked indicator

@customElement("chart-container")
export class ChartContainer extends LitElement {
  @state()
  private _state: ChartState = {
    priceRange: new PriceRangeImpl(0, 0),
    priceHistory: new SimplePriceHistory("ONE_HOUR", new Map()),
    timeRange: { start: 0, end: 0 },
    liveCandle: null,
    canvasWidth: 0,
    canvasHeight: 0,
    symbol: "BTC-USD",
    granularity: "ONE_HOUR",
    patternHighlights: [],
  };

  @state()
  private isTouchOnly = false;

  @state()
  private isFullscreen = false;

  @state()
  private isFullWindow = false;

  @state()
  private showContextMenu = false;

  @state()
  private contextMenuPosition = { x: 0, y: 0 };

  @state()
  private contextMenuMousePosition = { x: 0, y: 0 };

  @property({ type: Array })
  products: CoinbaseProduct[] = [];

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

  private chart: CandlestickChart | null = null;
  private browserIntegration: BrowserIntegration;
  private layerUpdateCoordinator!: LayerUpdateCoordinator;
  private eventHandlers!: ChartEventHandlers;

  private padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 15,
    candleGap: 2,
    minCandleWidth: 2,
    maxCandleWidth: 100,
  };

  // Add zoom factor to control how much the timeline affects the viewport
  private readonly ZOOM_FACTOR = 0.005;

  @state()
  public showVolume = false;

  private resizeAnimationFrame: number | null = null;
  private resizeTimeout: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  @state()
  private priceAxisWidth = PRICEAXIS_WIDTH;

  private readonly DOUBLE_TAP_DELAY = 300; // milliseconds

  @state()
  private indicators: Map<string, IndicatorConfig> = new Map();

  @state()
  private trendLines: TrendLine[] = [];

  @state()
  private tradeMarkers: TradeMarker[] = [];

  @state()
  private priceLines: PriceLine[] = [];

  @state()
  private annotations: Annotation[] = [];

  @state()
  private timeMarkers: TimeMarker[] = [];

  @state()
  private riskZones: RiskZone[] = [];

  @state()
  private positionOverlay: PositionOverlayConfig | null = null;

  @state()
  private candleTooltipData: any = null;

  @state()
  private showCandleTooltip = false;

  private interactionController?: ChartInteractionController;
  public clickToTradeController?: ClickToTradeController;
  public equityCurveController?: EquityCurveController;
  public riskZonesController?: RiskZonesController;
  public timeMarkersController?: TimeMarkersController;
  public annotationsController?: AnnotationsController;
  public positionOverlayController?: PositionOverlayController;
  public patternHighlightsController?: PatternHighlightsController;
  public trendLineController?: TrendLineController;
  public trendLineLayer?: TrendLineLayer;
  public patternLabelsLayer?: PatternLabelsLayer;
  private tradingMarkersLayer?: TradingMarkersLayer;
  private priceLinesLayer?: PriceLinesLayer;
  private tradeZonesLayer?: TradeZonesLayer;
  public annotationsLayer?: AnnotationsLayer;
  private tradingOverlaysManager?: TradingOverlaysManager;
  public timeMarkersLayer?: TimeMarkersLayer;
  private riskZonesInteractionLayer?: RiskZonesLayer;
  public riskZonesCanvasLayer?: any;
  public equityCurveCanvasLayer?: any;
  private positionOverlayComponent?: PositionOverlayComponent;

  constructor() {
    super();

    // Initialize browser integration
    this.browserIntegration = new BrowserIntegration(this, this.shadowRoot!);

    // Initialize event handlers
    this.eventHandlers = new ChartEventHandlers(this);

    // Check if device is touch-only (no mouse/trackpad)
    this.isTouchOnly = this.browserIntegration.isTouchOnlyDevice();

    // Setup mobile detection with change handler
    this.browserIntegration.setupMobileDetection((isMobile) => {
      this.isMobile = isMobile;
      this.priceAxisWidth = isMobile ? PRICEAXIS_MOBILE_WIDTH : PRICEAXIS_WIDTH;
    });
  }

  set startTimestamp(startTimestamp: number) {
    this._state.timeRange.start = startTimestamp;
  }

  set endTimestamp(endTimestamp: number) {
    this._state.timeRange.end = endTimestamp;
  }

  protected update(changedProperties: PropertyValues): void {
    super.update(changedProperties);
    if (changedProperties.has("products")) {
      this.draw();
    }
  }

  firstUpdated() {
    logger.debug("ChartContainer: firstUpdated called");
    const chartArea = this.renderRoot.querySelector(".chart-area");
    if (!chartArea) {
      logger.error("chart area not found");
      return;
    }
    logger.debug(
      "ChartContainer: chart area found, dimensions:",
      chartArea.clientWidth,
      "x",
      chartArea.clientHeight,
    );

    // Get the computed style to check if we have a fixed height
    const computedStyle = getComputedStyle(chartArea);
    const height = parseFloat(computedStyle.height);
    const width = parseFloat(computedStyle.width);
    logger.debug("ChartContainer: computed dimensions:", width, "x", height);

    // Setup browser integration
    this.browserIntegration.setupZoomPrevention();
    this.browserIntegration.setupFocusHandler(() => this.draw());

    // Initialize layer update coordinator
    this.layerUpdateCoordinator = new LayerUpdateCoordinator(
      this.shadowRoot!,
      () => this.chart,
      () => this._state,
      () => this.priceAxisWidth,
      () => this.equityCurveController,
    );

    // Defer initial resize to ensure CSS Grid and flexbox layouts have settled
    // This is critical when indicators are present as they affect the chart-area height
    // We use double RAF + timeout to ensure both CSS Grid and indicator-stack flexbox are calculated
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        // Additional small delay to ensure indicator-stack flexbox has settled
        setTimeout(() => {
          const chartArea = this.renderRoot.querySelector(".chart-area");
          if (chartArea) {
            const latestRect = chartArea.getBoundingClientRect();
            const latestHeight = latestRect.height;
            const latestWidth = latestRect.width;

            logger.info(
              `ChartContainer: Deferred initial resize: ${latestWidth}x${latestHeight}`,
            );

            if (latestHeight > 0 && latestWidth > 0) {
              this.handleResize(latestWidth, latestHeight);
            } else {
              logger.warn(
                "ChartContainer: Invalid dimensions for deferred resize:",
                latestWidth,
                "x",
                latestHeight,
              );
            }
          }
        }, 50); // 50ms delay for flexbox layout calculation
      });
    });

    const initLayer = (elementName: string): Layer => {
      const elem = this.renderRoot.querySelector(elementName);
      if (!elem) throw new Error(`Element ${elementName} not found`);

      const layer = elem as unknown as Layer;
      layer.style.width = `${width}px`;
      layer.style.height = `${height}px`;

      setTimeout(() => {
        this.layerUpdateCoordinator.updateLayer(layer as Layer);
      }, 100);
      return layer;
    };

    // Initialize layers using initLayer helper
    const layersToInit = [
      { selector: "trend-line-layer", property: "trendLineLayer" as const },
      {
        selector: "pattern-labels-layer",
        property: "patternLabelsLayer" as const,
      },
      {
        selector: "trading-markers-layer",
        property: "tradingMarkersLayer" as const,
      },
      { selector: "price-lines-layer", property: "priceLinesLayer" as const },
      { selector: "trade-zones-layer", property: "tradeZonesLayer" as const },
    ];

    layersToInit.forEach(({ selector, property }) => {
      try {
        this[property] = initLayer(selector) as any;
        logger.debug(`ChartContainer: Initialized ${selector}`);
      } catch (error) {
        logger.warn(`ChartContainer: Could not initialize ${selector}`, error);
      }
    });

    // Initialize all controllers using factory
    initializeControllers({
      container: this,
      renderRoot: this.renderRoot,
      state: this._state,
      updateLayer: (layer) => this.layerUpdateCoordinator.updateLayer(layer),
      updateTimeMarkersLayer: () =>
        this.layerUpdateCoordinator.updateTimeMarkersLayer(),
      updateRiskZonesCanvasLayer: () =>
        this.layerUpdateCoordinator.updateRiskZonesCanvasLayer(),
      updateEquityCurveCanvasLayer: () =>
        this.layerUpdateCoordinator.updateEquityCurveCanvasLayer(),
      updatePositionOverlay: () =>
        this.layerUpdateCoordinator.updatePositionOverlay(),
    });

    // Initialize trading overlays manager
    this.tradingOverlaysManager = new TradingOverlaysManager({
      state: this._state,
      tradingMarkersLayer: this.tradingMarkersLayer,
      priceLinesLayer: this.priceLinesLayer,
      tradeZonesLayer: this.tradeZonesLayer,
      requestUpdate: this.requestUpdate.bind(this),
    });
    logger.debug("ChartContainer: Initialized trading overlays manager");

    // Initialize click-to-trade controller (disabled by default)
    this.clickToTradeController = new ClickToTradeController({
      container: this as HTMLElement,
      state: this._state,
      config: { enabled: false }, // Default disabled
      onOrderRequest: (data: OrderRequestData) => {
        this.dispatchEvent(
          new CustomEvent("order-request", {
            detail: data,
            bubbles: true,
            composed: true,
          }),
        );
      },
      onPriceHover: (data: PriceHoverEvent) => {
        this.dispatchEvent(
          new CustomEvent("price-hover", {
            detail: data,
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
    logger.debug("ChartContainer: Initialized click-to-trade controller");

    // Add event listener for candle clicks
    this.addEventListener(
      "candle-click",
      this.eventHandlers.handleCandleClick as EventListener,
    );

    // Add event listeners for dragging interactions from interaction layers
    this.addEventListener(
      "price-line-dragged",
      this.eventHandlers.handlePriceLineDragged as EventListener,
    );
    this.addEventListener(
      "annotation-dragged",
      this.eventHandlers.handleAnnotationDraggedEvent as EventListener,
    );

    // Add event listeners for risk zone interactions
    this.addEventListener(
      "risk-zone-clicked",
      this.eventHandlers.handleRiskZoneClicked as EventListener,
    );
    this.addEventListener(
      "risk-zone-hovered",
      this.eventHandlers.handleRiskZoneHovered as EventListener,
    );

    // Also listen for double-clicks directly on the chart area
    const chartAreaElement = this.renderRoot.querySelector(".chart-area");
    if (chartAreaElement) {
      chartAreaElement.addEventListener(
        "dblclick",
        this.eventHandlers.handleChartAreaDoubleClick as EventListener,
      );
    }

    // Add global click listener to hide tooltip when clicking elsewhere
    document.addEventListener("click", this.eventHandlers.handleDocumentClick);

    // Wait for components to initialize
    setTimeout(() => {
      logger.debug("ChartContainer: Delayed initialization, looking for chart");
      this.chart = this.getChartElement();

      if (this.chart) {
        logger.debug("ChartContainer: Chart found and assigned");
        // Forward chart-ready events from the candlestick chart
        this.chart.addEventListener("chart-ready", (e: Event) => {
          logger.debug("ChartContainer: Got chart-ready event");
          this.dispatchEvent(
            new CustomEvent("chart-ready", {
              detail: (e as CustomEvent).detail,
              bubbles: true,
              composed: true,
            }),
          );

          // Initialize interaction controller after chart is ready
          if (!this.interactionController) {
            logger.debug("ChartContainer: Initializing interaction controller");
            this.initializeInteractionController();
          }
        });
      } else {
        logger.error(
          "ChartContainer: Chart element not found during initialization",
        );
      }
    }, 0);

    // Add click outside listener
    document.addEventListener("click", this.eventHandlers.handleClickOutside);
    document.addEventListener("touchstart", this.eventHandlers.handleClickOutside);

    window.addEventListener("spotcanvas-upgrade", this.eventHandlers.handleUpgrade);

    // Add event listener for indicator toggling
    this.addEventListener(
      "toggle-indicator",
      this.eventHandlers.handleIndicatorToggle as EventListener,
    );

    // Setup ResizeObserver to handle window/container resize
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        const height = entry.contentRect.height;

        logger.info(
          `ChartContainer: ResizeObserver triggered: ${width}x${height}`,
        );

        // Use a debounce mechanism to avoid excessive resize calls
        if (this.resizeTimeout) {
          clearTimeout(this.resizeTimeout);
        }

        this.resizeTimeout = window.setTimeout(() => {
          if (width > 0 && height > 0) {
            logger.info(
              `ChartContainer: ResizeObserver calling handleResize: ${width}x${height}`,
            );
            this.handleResize(width, height);
          }
        }, 100); // 100ms debounce
      }
    });

    // Observe the chart area for size changes
    if (chartArea) {
      this.resizeObserver.observe(chartArea as Element);
      logger.info("ChartContainer: ResizeObserver attached to chart area");
    }
  }

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    this.draw();
  }

  draw() {
    if (!this.isConnected) return;
    if (!this.chart || !this.chart.canvas) return;

    const context: DrawingContext = {
      ctx: this.chart.ctx!,
      chartCanvas: this.chart.canvas!,
      data: this._state.priceHistory,
      options: this.calculateCandleOptions(),
      viewportStartTimestamp: this._state.timeRange.start,
      viewportEndTimestamp: this._state.timeRange.end,
      priceRange: this._state.priceRange,
      patternHighlights: this._state.patternHighlights || [],
      axisMappings: {
        timeToX: timeToX(
          this.chart.canvas!.width / getDpr(),
          this._state.timeRange,
        ),
        priceToY: priceToY(this.chart.canvas!.height / getDpr(), {
          start: this._state.priceRange.min,
          end: this._state.priceRange.max,
        }),
      },
    };
    this.chart.drawWithContext(context);

    // Force redraw on indicators
    this.redrawIndicators();

    // Update all layers with current state using coordinator
    this.layerUpdateCoordinator.updateAllLayers({
      trendLineLayer: this.trendLineLayer,
      patternLabelsLayer: this.patternLabelsLayer,
      tradingMarkersLayer: this.tradingMarkersLayer,
      priceLinesLayer: this.priceLinesLayer,
      tradeZonesLayer: this.tradeZonesLayer,
      annotationsLayer: this.annotationsLayer,
    });
  }

  private redrawIndicators() {
    logger.debug("ChartContainer: Redrawing indicators");

    // Force indicator-stack to redraw
    const indicatorStack = this.renderRoot.querySelector(
      "indicator-stack.main-chart",
    );
    if (indicatorStack) {
      // Get current dimensions for the detail object
      const width = indicatorStack.clientWidth || 100;
      const height = indicatorStack.clientHeight || 100;

      indicatorStack.dispatchEvent(
        new CustomEvent("force-redraw", {
          bubbles: false,
          composed: true,
          detail: { width, height }, // Add detail property
        }),
      );
    }

    // Find and redraw all market indicators
    const indicators = this.renderRoot.querySelectorAll("market-indicator");
    indicators.forEach((indicator) => {
      logger.debug(
        `ChartContainer: Sending redraw to ${
          indicator.getAttribute("slot") || "unknown"
        } indicator`,
      );

      // Get current dimensions for the detail object
      const width = indicator.clientWidth || 100;
      const height = indicator.clientHeight || 100;

      indicator.dispatchEvent(
        new CustomEvent("force-redraw", {
          bubbles: false,
          composed: true,
          detail: { width, height }, // Add detail property
        }),
      );
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeAnimationFrame) {
      cancelAnimationFrame(this.resizeAnimationFrame);
    }
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up browser integration (zoom prevention, focus handler, mobile detection)
    this.browserIntegration.cleanup();

    document.removeEventListener(
      "fullscreenchange",
      this.eventHandlers.handleFullscreenChange,
    );
    document.removeEventListener("click", this.eventHandlers.handleClickOutside);
    document.removeEventListener("touchstart", this.eventHandlers.handleClickOutside);
    document.removeEventListener("click", this.eventHandlers.handleDocumentClick);
    this.removeEventListener(
      "candle-click",
      this.eventHandlers.handleCandleClick as EventListener,
    );

    const chartAreaElement = this.renderRoot.querySelector(".chart-area");
    if (chartAreaElement) {
      chartAreaElement.removeEventListener(
        "dblclick",
        this.eventHandlers.handleChartAreaDoubleClick as EventListener,
      );
    }
    this.removeEventListener("toggle-fullscreen", this.eventHandlers.handleFullScreenToggle);
    this.removeEventListener("toggle-fullwindow", this.eventHandlers.toggleFullWindow);
    this.removeEventListener(
      "toggle-indicator",
      this.eventHandlers.handleIndicatorToggle as EventListener,
    );

    this.interactionController?.detach();
    this.clickToTradeController?.disable();
    this.equityCurveController?.destroy();
  }

  @property({ type: Object })
  set state(state: ChartState) {
    const isInitialState =
      this._state.symbol === "BTC-USD" &&
      this._state.granularity === "ONE_HOUR" &&
      this.indicators.size === 0 &&
      this.trendLines.length === 0;

    // Preserve patternHighlights if they exist in current state but not in new state
    // This prevents loss of highlights when app.ts updates the state
    if (this._state.patternHighlights && !state.patternHighlights) {
      state.patternHighlights = this._state.patternHighlights;
    }

    // Preserve annotations if they exist in current state but not in new state
    // This prevents loss of annotations when app.ts updates the state
    if (this._state.annotations && !state.annotations) {
      state.annotations = this._state.annotations;
    }

    this._state = state;
    (window as any).state = state;

    // Process indicators from initial state if this is the first time setting state
    if (isInitialState && state.indicators && state.indicators.length > 0) {
      logger.debug(
        `ChartContainer: Processing ${state.indicators.length} indicators from initial state`,
      );
      state.indicators.forEach((indicator) => {
        if (indicator.visible) {
          logger.debug(
            `ChartContainer: Auto-showing indicator ${indicator.id} from initial state`,
          );
          this.handleIndicatorToggle(
            new CustomEvent("toggle-indicator", {
              detail: indicator,
            }),
          );
        }
      });
    }

    // Process trend lines from initial state if this is the first time setting state
    if (isInitialState && state.trendLines && state.trendLines.length > 0) {
      logger.debug(
        `ChartContainer: Processing ${state.trendLines.length} trend lines from initial state`,
      );
      logger.debug(
        `ChartContainer: Initial trend line IDs:`,
        state.trendLines.map((l) => l.id),
      );
      this.trendLines = [...state.trendLines];
      this._state.trendLines = this.trendLines;

      // Force update to render trend lines
      this.requestUpdate();

      // Ensure trend line layer gets updated after render and no lines are selected
      requestAnimationFrame(() => {
        logger.debug(
          `ChartContainer: After RAF, trend lines count: ${this.trendLines.length}`,
        );
        if (this.trendLineLayer)
          this.layerUpdateCoordinator.updateLayer(this.trendLineLayer);

        // Ensure no trend lines are selected on initialization
        if (this.trendLineLayer) {
          logger.debug(
            `ChartContainer: Deselecting all trend lines on initialization`,
          );
          this.trendLineLayer.deselectAll();
        }
      });
    }
  }

  private dispatchUpgrade() {
    this.dispatchEvent(
      new CustomEvent("spotcanvas-upgrade", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  public isIndicatorVisible(id: string): boolean {
    // Special case for volume indicator
    if (id === "volume") {
      return this.showVolume;
    }
    // Regular indicators
    return this.indicators.get(id)?.visible || false;
  }

  /**
   * Public API method - delegates to event handlers
   */
  public handleIndicatorToggle(e: CustomEvent) {
    this.eventHandlers.handleIndicatorToggle(e);
  }

  render() {
    const menuItems = buildContextMenuItems({
      isFullWindow: this.isFullWindow,
      showVolume: this.showVolume,
      indicators: this.indicators,
      container: this,
      actions: {
        showCandleTooltip: this.eventHandlers.showCandleTooltipFromContextMenu,
        toggleFullWindow: this.eventHandlers.toggleFullWindow,
      },
    });

    const overlayIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.Overlay,
    );
    const bottomIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.Bottom,
    );
    const stackTopIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.StackTop,
    );
    const stackBottomIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.StackBottom,
    );

    // Calculate grid template rows based on number of stacked indicators
    // Remove timeline from grid since it will be outside
    const gridTemplateRows = `
      ${
        stackTopIndicators.length
          ? `${stackTopIndicators.length * INDICATOR_HEIGHT}px`
          : "0"
      }
      1fr
    `;

    return html`
      <div class="chart-wrapper">
        <div
          class="container ${this.isFullscreen ? "fullscreen" : ""} ${this
            .isFullWindow
            ? "full-window"
            : ""}"
          style="
            --price-axis-width: ${this.priceAxisWidth}px;
            grid-template-rows: ${gridTemplateRows};
          "
        >
          ${stackTopIndicators.length > 0
            ? html`
                <indicator-stack
                  .setAttribute=${() => {}}
                  @connectedCallback=${(e: HTMLElement) =>
                    e.setAttribute("grid-area", "indicators-top")}
                  .indicators=${stackTopIndicators}
                  .valueAxisWidth=${PRICEAXIS_WIDTH}
                  .valueAxisMobileWidth=${PRICEAXIS_MOBILE_WIDTH}
                ></indicator-stack>
              `
            : ""}

          <div
            class="chart-area"
            @connectedCallback=${(e: HTMLElement) =>
              e.setAttribute("grid-area", "chart-area")}
          >
            <!-- Trend line layer -->
            <trend-line-layer
              .trendLines=${this.trendLines}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
              @trend-line-update=${this.eventHandlers.handleTrendLineUpdate}
              @trend-line-remove=${this.eventHandlers.handleTrendLineRemove}
            ></trend-line-layer>

            <!-- Pattern labels layer -->
            <pattern-labels-layer
              .patterns=${this._state.patternHighlights || []}
              .state=${this._state}
              .timeRange=${this._state.timeRange}
              .priceRange=${this._state.priceRange}
              style="--price-axis-width: ${this.priceAxisWidth}px"
              @pattern-click=${this.eventHandlers.handlePatternClick}
            ></pattern-labels-layer>

            <!-- Trade Zones Layer (z-index: 0) -->
            <trade-zones-layer
              .zones=${this._state.tradeZones || []}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></trade-zones-layer>

            <!-- Risk Zones Canvas Layer (z-index: 1) -->
            <risk-zones-canvas-layer
              .zones=${this._state.riskZones || []}
              .state=${this._state}
              .timeRange=${this._state.timeRange}
              .priceRange=${this._state.priceRange}
              .width=${this.chart?.canvas
                ? this.chart.canvas.width / getDpr()
                : 0}
              .height=${this.chart?.canvas
                ? this.chart.canvas.height / getDpr()
                : 0}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></risk-zones-canvas-layer>


            <!-- Time Markers Layer (z-index: 25) -->
            <time-markers-layer
              .markers=${this._state.timeMarkers || []}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></time-markers-layer>

            <!-- Price Lines Layer (z-index: 50) -->
            <price-lines-layer
              .lines=${this._state.priceLines || []}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></price-lines-layer>

            <!-- Position Overlay Entry Line Layer (full width, z-index: 75) -->
            <position-overlay
              .config=${this._state.positionOverlay}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></position-overlay>

            <!-- Top Overlays Container (Live Candle Display + Position Info) -->
            <div class="top-overlays-container">
              <!-- Live Candle Display -->
              <live-candle-display></live-candle-display>

              <!-- Position Info Box -->
              <position-overlay
                .config=${this._state.positionOverlay}
                .state=${this._state}
                .hideEntryLine=${true}
                style="--price-axis-width: ${this.priceAxisWidth}px"
              ></position-overlay>
            </div>

            <!-- Trading Markers Layer (z-index: 100) -->
            <trading-markers-layer
              .markers=${this._state.tradeMarkers || []}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></trading-markers-layer>

            <!-- Annotations Layer (z-index: 200) -->
            <annotations-layer
              .annotations=${this._state.annotations || []}
              .state=${this._state}
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></annotations-layer>

            <div class="chart">
              ${bottomIndicators.map(
                (indicator) => html`
                  <indicator-container
                    data-indicator=${indicator.id}
                    class="bottom-indicators"
                    .name=${indicator.name}
                  >
                    <market-indicator
                      .indicatorId=${indicator.id}
                      .scale=${indicator.scale}
                      .name=${indicator.name}
                      .gridStyle=${indicator.gridStyle}
                    ></market-indicator>
                  </indicator-container>
                `,
              )}

              <indicator-stack
                class="main-chart"
                .valueAxisWidth=${PRICEAXIS_WIDTH}
                .valueAxisMobileWidth=${PRICEAXIS_MOBILE_WIDTH}
                .state=${this._state}
                .options=${this.options}
                @rendered=${() =>
                  logger.debug("ChartContainer: indicator-stack rendered")}
              >
                <indicator-container
                  slot="chart"
                  class="chart-with-overlays overlay-indicators"
                >
                  <!-- Main chart - Important: price-axis in candlestick-chart must receive pointer events -->
                  <candlestick-chart
                    id="main-chart"
                    .state=${this._state}
                    .options=${this.options}
                    .indicatorId="chart"
                    .scale=${ScaleType.Price}
                  ></candlestick-chart>

                  ${overlayIndicators.map(
                    (indicator) => html`
                      <market-indicator
                        .indicatorId=${indicator.id}
                        .scale=${ScaleType.Price}
                        .showAxis=${false}
                        .name=${indicator.name}
                        .gridStyle=${indicator.gridStyle}
                      ></market-indicator>
                    `,
                  )}
                  <live-decorators></live-decorators>
                  <!-- Equity Curve Canvas Layer - positioned at bottom like volume -->
                  <equity-curve-canvas-layer
                    .data=${this._state.equityCurve?.data || []}
                    .config=${this._state.equityCurve}
                    .state=${this._state}
                    .timeRange=${this._state.timeRange}
                    .priceRange=${this._state.priceRange}
                    .width=${this.chart?.canvas
                      ? this.chart.canvas.width / getDpr()
                      : 0}
                    .height=${this.chart?.canvas
                      ? this.chart.canvas.height / getDpr()
                      : 0}
                    style="--price-axis-width: ${this.priceAxisWidth}px"
                  ></equity-curve-canvas-layer>
                  <!-- Volume chart - positioned using flexbox at the bottom -->
                  <div class="volume-chart" ?hidden=${!this.showVolume}>
                    <volume-chart></volume-chart>
                  </div>
                </indicator-container>

                <!-- Bottom stacked indicators (unchanged) -->
                ${stackBottomIndicators.length > 0
                  ? stackBottomIndicators.map((indicator, index) => {
                      const slotId = `indicator-${index + 1}`;
                      logger.debug(
                        `ChartContainer: Adding indicator ${indicator.id} with slot="${slotId}"`,
                      );
                      return html`
                        <market-indicator
                          slot="${slotId}"
                          .indicatorId=${indicator.id}
                          .scale=${indicator.scale}
                          .name=${indicator.name}
                          .state=${this._state}
                          .valueAxisWidth=${this.priceAxisWidth}
                          .gridStyle=${indicator.gridStyle}
                        ></market-indicator>
                      `;
                    })
                  : ""}
              </indicator-stack>
            </div>
          </div>

          <chart-context-menu
            .show=${this.showContextMenu}
            .position=${this.contextMenuPosition}
            .items=${menuItems}
          ></chart-context-menu>

          ${!this.isTouchOnly
            ? html`<chart-crosshairs
                class="grid-crosshairs"
              ></chart-crosshairs>`
            : ""}
        </div>

        <div class="timeline-container">
          <chart-timeline></chart-timeline>
        </div>
      </div>

      <!-- Candle Tooltip -->
      <candle-tooltip
        .data=${this.candleTooltipData}
        .visible=${this.showCandleTooltip}
        @close-tooltip=${() => {
          this.showCandleTooltip = false;
        }}
      ></candle-tooltip>
    `;
  }

  private handleResize(width: number, height: number) {
    if (!this.chart) return;
    if (!this._state?.granularity) return;

    // Calculate the main chart height (excluding bottom stacked indicators)
    // This ensures the candlestick chart and live-decorators have the same canvas height
    let chartHeight = height;
    const indicatorStack = this.renderRoot.querySelector("indicator-stack.main-chart");
    if (indicatorStack) {
      const chartItem = indicatorStack.shadowRoot?.querySelector(".stack-item.chart-item") as HTMLElement;
      if (chartItem && chartItem.clientHeight > 0) {
        chartHeight = chartItem.clientHeight;
      }
    }

    if (this._state.priceHistory.getCandles().size === 0) {
      this.chart.resize(width, chartHeight);
      return;
    }
    if (this._state.timeRange.end === 0) {
      return;
    }
    this.chart.resize(width, chartHeight);

    const visibleCandles = this.calculateVisibleCandles();
    const newStartTimestamp =
      this._state.timeRange.end -
      visibleCandles * getCandleInterval(this._state.granularity);

    if (
      newStartTimestamp > 0 &&
      newStartTimestamp < this._state.timeRange.end
    ) {
      this._state.timeRange = {
        start: newStartTimestamp,
        end: this._state.timeRange.end,
      };
      this.draw();
    }

    // Update all layers after resize using coordinator
    this.layerUpdateCoordinator.updateAllLayers({
      trendLineLayer: this.trendLineLayer,
      tradingMarkersLayer: this.tradingMarkersLayer,
      priceLinesLayer: this.priceLinesLayer,
      tradeZonesLayer: this.tradeZonesLayer,
    });
  }

  private dispatchRefetch(direction: "backward" | "forward") {
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              Number(this._state.priceHistory.startTimestamp) -
              FETCH_BATCH_SIZE * granularityToMs(this._state.granularity),
            end: Number(this._state.priceHistory.startTimestamp),
          }
        : {
            start: Number(this._state.priceHistory.endTimestamp),
            end:
              Number(this._state.priceHistory.endTimestamp) +
              FETCH_BATCH_SIZE * granularityToMs(this._state.granularity),
          };
    this.dispatchEvent(
      new CustomEvent("chart-pan", {
        detail: {
          direction,
          timeRange,
          visibleCandles: this.calculateVisibleCandles(),
          needMoreData: true,
          bubbles: true,
          composed: true,
        },
      }),
    );
  }

  public calculateVisibleCandles(): number {
    if (!this.chart || !this.chart.canvas) return 100; // Return reasonable default
    // Convert canvas width from physical pixels to logical pixels
    const canvasLogicalWidth = this.chart.canvas.width / getDpr();
    const availableWidth =
      canvasLogicalWidth - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(availableWidth / totalCandleWidth);
  }

  private calculateCandleOptions(): ChartOptions {
    if (!this.chart) return this.options;
    if (!this.chart.canvas) {
      logger.warn("ChartContainer: No canvas found, returning default options");
      return this.options;
    }

    const timeRange = this._state.timeRange.end - this._state.timeRange.start;
    const numCandles = timeRange / getCandleInterval(this._state.granularity);

    const availableWidth =
      this.chart.canvas.width / getDpr() -
      this.padding.left -
      this.padding.right;

    const idealCandleWidth = (availableWidth / numCandles) * 0.9; // 90% for candle, 10% for gap
    const idealGapWidth = (availableWidth / numCandles) * 0.1;

    // Clamp the values between min and max
    const candleWidth =
      Math.max(
        this.options.minCandleWidth,
        Math.min(this.options.maxCandleWidth, idealCandleWidth),
      ) / getDpr();
    const candleGap = Math.max(1, idealGapWidth);

    return {
      ...this.options,
      candleWidth,
      candleGap,
    };
  }

  public updateLiveCandle(liveCandle: LiveCandle): boolean {
    const isSuccess = this._state.priceHistory.setLiveCandle({
      timestamp: liveCandle.timestamp * 1000,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
      granularity: this._state.granularity,
      volume: liveCandle.volume,
      live: true,
      evaluations: [],
    });
    if (isSuccess) {
      this.draw();
    }
    return isSuccess;
  }

  public panTimeline(movementSeconds: number, durationSeconds: number = 1) {
    this.interactionController?.panTimeline(movementSeconds, durationSeconds);
  }

  static styles = [getStyles(PRICEAXIS_WIDTH, TIMELINE_HEIGHT)];

  // Helper method to get the chart element from the indicator stack
  private getChartElement(): CandlestickChart | null {
    logger.debug("ChartContainer: Getting chart element");
    const indicatorStack = this.renderRoot.querySelector(
      "indicator-stack.main-chart",
    ) as LitElement | null;

    if (!indicatorStack) {
      logger.warn("ChartContainer: indicator-stack.main-chart not found");
      return null;
    }
    logger.debug("ChartContainer: Found indicator-stack");

    // Find the chart in the new structure - inside indicator-container with class chart-with-overlays
    const chartElement = this.renderRoot.querySelector(
      "indicator-stack.main-chart indicator-container.chart-with-overlays candlestick-chart",
    ) as CandlestickChart | null;

    logger.debug(
      "ChartContainer: candlestick-chart",
      chartElement ? "found" : "NOT FOUND",
    );

    return chartElement;
  }

  /**
   * Pattern highlight management methods have been moved to PatternHighlightsController.
   * Use this.patternHighlightsController.set() and this.patternHighlightsController.clear()
   *
   * For external API access, use ChartApi methods:
   * - api.highlightPatterns(patterns)
   * - api.clearPatternHighlights()
   */

  /**
   * Get current pattern highlights
   */
  public getPatternHighlights(): PatternHighlight[] {
    return this._state.patternHighlights || [];
  }

  // ============================================================================
  // Trading Overlay Methods (Paper Trading & Backtesting)
  // ============================================================================
  // Delegated to TradingOverlaysManager

  /**
   * Add a trade marker to the chart
   */
  public addTradeMarker(marker: TradeMarker): void {
    this.tradingOverlaysManager?.addTradeMarker(marker);
  }

  /**
   * Remove a trade marker from the chart
   */
  public removeTradeMarker(markerId: string): void {
    this.tradingOverlaysManager?.removeTradeMarker(markerId);
  }

  /**
   * Update an existing trade marker
   */
  public updateTradeMarker(markerId: string, marker: TradeMarker): void {
    this.tradingOverlaysManager?.updateTradeMarker(markerId, marker);
  }

  /**
   * Clear all trade markers
   */
  public clearTradeMarkers(): void {
    this.tradingOverlaysManager?.clearTradeMarkers();
  }

  /**
   * Add a price line to the chart
   */
  public addPriceLine(line: PriceLine): void {
    this.tradingOverlaysManager?.addPriceLine(line);
  }

  /**
   * Remove a price line from the chart
   */
  public removePriceLine(lineId: string): void {
    this.tradingOverlaysManager?.removePriceLine(lineId);
  }

  /**
   * Update an existing price line
   */
  public updatePriceLine(lineId: string, line: PriceLine): void {
    this.tradingOverlaysManager?.updatePriceLine(lineId, line);
  }

  /**
   * Clear all price lines
   */
  public clearPriceLines(): void {
    this.tradingOverlaysManager?.clearPriceLines();
  }

  /**
   * Add a trade zone to the chart
   */
  public addTradeZone(zone: TradeZone): void {
    this.tradingOverlaysManager?.addTradeZone(zone);
  }

  /**
   * Remove a trade zone from the chart
   */
  public removeTradeZone(zoneId: string): void {
    this.tradingOverlaysManager?.removeTradeZone(zoneId);
  }

  /**
   * Update an existing trade zone
   */
  public updateTradeZone(zoneId: string, zone: TradeZone): void {
    this.tradingOverlaysManager?.updateTradeZone(zoneId, zone);
  }

  /**
   * Clear all trade zones
   */
  public clearTradeZones(): void {
    this.tradingOverlaysManager?.clearTradeZones();
  }

  private initializeInteractionController() {
    if (!this.chart) return;

    this.interactionController = initializeInteractionLayers({
      container: this,
      chart: this.chart,
      state: this._state,
      priceAxisWidth: this.priceAxisWidth,
      controllers: {
        annotationsController: this.annotationsController,
        trendLineController: this.trendLineController,
        timeMarkersController: this.timeMarkersController,
        riskZonesController: this.riskZonesController,
      },
      callbacks: {
        onStateChange: (updates) => {
          this._state = Object.assign(this._state, updates);
          Object.keys(updates).forEach((key) => {
            touch(`state.${key}`);
          });
          // Need to call draw() for priceRange changes to update indicators and trend lines
          if (updates.priceRange || updates.timeRange) {
            this.draw();
          }
        },
        onNeedMoreData: (direction) => {
          this.dispatchRefetch(direction);
        },
        onContextMenu: (position) => {
          this.showContextMenu = true;
          this.contextMenuPosition = position;
          // Store the context menu mouse position for candle tooltip
          this.contextMenuMousePosition = position;
        },
        shouldSuppressChartClick: () => {
          // Suppress chart-clicked event when trend line tool is active
          return this.trendLineController?.isToolActive() ?? false;
        },
      },
      config: {
        bufferMultiplier: BUFFER_MULTIPLIER,
        zoomFactor: this.ZOOM_FACTOR,
        doubleTapDelay: this.DOUBLE_TAP_DELAY,
      },
    });
  }
}
