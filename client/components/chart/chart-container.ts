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
import "./live-price-label";
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
import { MenuItem } from "./context-menu";
import "./indicators/indicator-container";
import "./indicators/market-indicator";
import { config } from "../../config";
import { ChartInteractionController } from "./interaction/chart-interaction-controller";
import { ClickToTradeController } from "./interaction/click-to-trade-controller";
import { EquityCurveController } from "./interaction/equity-curve-controller";
import { PriceLinesInteractionLayer } from "./interaction/layers/price-lines-layer";
import { AnnotationsInteractionLayer } from "./interaction/layers/annotations-layer";
import { TrendLinesInteractionLayer } from "./interaction/layers/trend-lines-layer";
import { TimeMarkersInteractionLayer } from "./interaction/layers/time-markers-layer";
import { LiveCandleInteractionLayer } from "./interaction/layers/live-candle-layer";
import { touch } from "xinjs";
import { getStyles } from "./styles";
import "./indicators/indicator-stack";
import {
  DisplayType,
  IndicatorConfig,
  ScaleType,
} from "./indicators/indicator-types";
import "./trend-line-layer";
import { TrendLineTool } from "./tools/trend-line-tool";
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
  private trendLineTool?: TrendLineTool;
  private trendLineLayer?: TrendLineLayer;
  private patternLabelsLayer?: PatternLabelsLayer;
  private tradingMarkersLayer?: TradingMarkersLayer;
  private priceLinesLayer?: PriceLinesLayer;
  private tradeZonesLayer?: TradeZonesLayer;
  private annotationsLayer?: AnnotationsLayer;
  private timeMarkersLayer?: TimeMarkersLayer;
  private riskZonesInteractionLayer?: RiskZonesLayer;
  private riskZonesCanvasLayer?: any;
  private equityCurveCanvasLayer?: any;
  private positionOverlayComponent?: PositionOverlayComponent;

  constructor() {
    super();
    // Check if device is touch-only (no mouse/trackpad)
    this.isTouchOnly = window.matchMedia(
      "(hover: none) and (pointer: coarse)",
    ).matches;

    // Initialize mobile state and width
    this.handleMobileChange();

    // Add mobile media query listener
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
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

    // Add keyboard event listeners to prevent browser zoom
    this.setupZoomPrevention();

    // Get the computed style to check if we have a fixed height
    const computedStyle = getComputedStyle(chartArea);
    const height = parseFloat(computedStyle.height);
    const width = parseFloat(computedStyle.width);
    logger.debug("ChartContainer: computed dimensions:", width, "x", height);

    // Initial resize with the computed dimensions
    if (height > 0 && width > 0) {
      this.handleResize(width, height);
    } else {
      logger.warn(
        "ChartContainer: Invalid dimensions for initial resize:",
        width,
        "x",
        height,
      );
    }

    // Initialize trend line tool
    this.initializeTrendLineTool();

    const initLayer = <T extends HTMLElement>(
      elementName: string,
      updateLayer: () => void,
    ) => {
      const layer = this.renderRoot.querySelector(elementName) as T;
      if (layer) {
        layer.style.width = `${width}px`;
        layer.style.height = `${height}px`;
      }
    };

    // Get trend line layer reference and set initial dimensions
    this.trendLineLayer = this.renderRoot.querySelector(
      "trend-line-layer",
    ) as TrendLineLayer;
    if (this.trendLineLayer) {
      // Set initial dimensions after a small delay to ensure chart is ready
      setTimeout(() => {
        this.updateTrendLineLayer();
      }, 100);
    }

    // Get pattern labels layer reference and set initial dimensions
    this.patternLabelsLayer = this.renderRoot.querySelector(
      "pattern-labels-layer",
    ) as PatternLabelsLayer;
    if (this.patternLabelsLayer) {
      logger.debug("ChartContainer: Found pattern labels layer");
      // Set initial dimensions after a small delay to ensure chart is ready
      setTimeout(() => {
        this.updatePatternLabelsLayer();
      }, 100);
    }

    // Get trading markers layer reference and set initial dimensions
    this.tradingMarkersLayer = this.renderRoot.querySelector(
      "trading-markers-layer",
    ) as TradingMarkersLayer;
    if (this.tradingMarkersLayer) {
      logger.debug("ChartContainer: Found trading markers layer");
      setTimeout(() => {
        this.updateTradingMarkersLayer();
      }, 100);
    }

    // Get price lines layer reference and set initial dimensions
    this.priceLinesLayer = this.renderRoot.querySelector(
      "price-lines-layer",
    ) as PriceLinesLayer;
    if (this.priceLinesLayer) {
      logger.debug("ChartContainer: Found price lines layer");
      setTimeout(() => {
        this.updatePriceLinesLayer();
      }, 100);
    }

    // Get trade zones layer reference and set initial dimensions
    this.tradeZonesLayer = this.renderRoot.querySelector(
      "trade-zones-layer",
    ) as TradeZonesLayer;
    if (this.tradeZonesLayer) {
      logger.debug("ChartContainer: Found trade zones layer");
      setTimeout(() => {
        this.updateTradeZonesLayer();
      }, 100);
    }

    // Get annotations layer reference and set initial dimensions
    this.annotationsLayer = this.renderRoot.querySelector(
      "annotations-layer",
    ) as AnnotationsLayer;
    if (this.annotationsLayer) {
      logger.debug("ChartContainer: Found annotations layer");
      setTimeout(() => {
        this.updateAnnotationsLayer();
      }, 100);
    }

    // Get time markers layer reference and set initial dimensions
    this.timeMarkersLayer = this.renderRoot.querySelector(
      "time-markers-layer",
    ) as TimeMarkersLayer;
    if (this.timeMarkersLayer) {
      logger.debug("ChartContainer: Found time markers layer");
      setTimeout(() => {
        this.updateTimeMarkersLayer();
      }, 100);
    }

    // Get risk zones canvas layer reference and set initial dimensions
    this.riskZonesCanvasLayer = this.renderRoot.querySelector(
      "risk-zones-canvas-layer",
    ) as any;
    if (this.riskZonesCanvasLayer) {
      logger.debug("ChartContainer: Found risk zones canvas layer");
      setTimeout(() => {
        this.updateRiskZonesCanvasLayer();
      }, 100);
    }

    // Get equity curve canvas layer reference and initialize controller
    this.equityCurveCanvasLayer = this.renderRoot.querySelector(
      "equity-curve-canvas-layer",
    ) as any;
    if (this.equityCurveCanvasLayer) {
      logger.debug("ChartContainer: Found equity curve canvas layer");

      // Initialize equity curve controller
      this.equityCurveController = new EquityCurveController({
        container: this,
        state: this._state,
        equityCurveLayer: this.equityCurveCanvasLayer,
      });
      logger.debug("ChartContainer: Initialized equity curve controller");

      setTimeout(() => {
        this.updateEquityCurveCanvasLayer();
      }, 100);
    }

    // Get position overlay reference and set initial dimensions
    this.positionOverlayComponent = this.renderRoot.querySelector(
      "position-overlay",
    ) as PositionOverlayComponent;
    if (this.positionOverlayComponent) {
      logger.debug("ChartContainer: Found position overlay");
      setTimeout(() => {
        this.updatePositionOverlay();
      }, 100);
    }

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
      this.handleCandleClick as EventListener,
    );

    // Add event listeners for dragging interactions from interaction layers
    this.addEventListener(
      "price-line-dragged",
      this.handlePriceLineDragged as EventListener,
    );
    this.addEventListener(
      "annotation-dragged",
      this.handleAnnotationDragged as EventListener,
    );

    // Add event listeners for risk zone interactions
    this.addEventListener(
      "risk-zone-clicked",
      this.handleRiskZoneClicked as EventListener,
    );
    this.addEventListener(
      "risk-zone-hovered",
      this.handleRiskZoneHovered as EventListener,
    );

    // Also listen for double-clicks directly on the chart area
    const chartAreaElement = this.renderRoot.querySelector(".chart-area");
    if (chartAreaElement) {
      chartAreaElement.addEventListener(
        "dblclick",
        this.handleChartAreaDoubleClick as EventListener,
      );
    }

    // Add global click listener to hide tooltip when clicking elsewhere
    document.addEventListener("click", this.handleDocumentClick);

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
    document.addEventListener("click", this.handleClickOutside);
    document.addEventListener("touchstart", this.handleClickOutside);

    window.addEventListener("spotcanvas-upgrade", this.handleUpgrade);

    this.setupFocusHandler();

    // Add event listener for indicator toggling
    this.addEventListener(
      "toggle-indicator",
      this.handleIndicatorToggle as EventListener,
    );

    // Initialize mobile state and add listener
    this.handleMobileChange();
    this.mobileMediaQuery.addEventListener("change", () =>
      this.handleMobileChange(),
    );
  }

  private handleMobileChange = () => {
    this.isMobile = this.mobileMediaQuery.matches;
    this.priceAxisWidth = this.isMobile
      ? PRICEAXIS_MOBILE_WIDTH
      : PRICEAXIS_WIDTH;
  };

  private setupZoomPrevention() {
    // Prevent keyboard zoom shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      // Check if Ctrl or Cmd is pressed
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      if (isCtrlOrCmd) {
        // Prevent Ctrl/Cmd + Plus/Minus/0 (zoom controls)
        if (
          e.key === "+" ||
          e.key === "-" ||
          e.key === "=" || // Plus key without shift
          e.key === "0" ||
          e.keyCode === 187 || // Plus/Equals key
          e.keyCode === 189 || // Minus key
          e.keyCode === 48 // Zero key
        ) {
          e.preventDefault();
          logger.debug(
            "ChartContainer: Prevented browser zoom keyboard shortcut",
          );
          return false;
        }
      }
    };

    // Prevent wheel zoom with Ctrl/Cmd
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        logger.debug("ChartContainer: Prevented browser zoom wheel event");
        return false;
      }
    };

    // Add listeners to the component and its shadow root
    this.addEventListener("keydown", handleKeydown);
    this.addEventListener("wheel", handleWheel, { passive: false });

    // Also add to the document when this element has focus
    const documentKeydownHandler = (e: KeyboardEvent) => {
      // Only prevent if the chart container or its children have focus
      if (
        this.contains(document.activeElement) ||
        this.shadowRoot?.contains(document.activeElement as Element)
      ) {
        handleKeydown(e);
      }
    };

    document.addEventListener("keydown", documentKeydownHandler);

    // Store handlers for cleanup
    (this as any)._zoomPreventionHandlers = {
      keydown: handleKeydown,
      wheel: handleWheel,
      documentKeydown: documentKeydownHandler,
    };
  }

  private handleUpgrade = async () => {
    if (this.isFullscreen) {
      await document.exitFullscreen();
    }
  };

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

    // Update trend line layer with current state
    this.updateTrendLineLayer();

    // Update pattern labels layer with current state
    this.updatePatternLabelsLayer();

    // Update trading overlay layers
    this.updateTradingMarkersLayer();
    this.updatePriceLinesLayer();
    this.updateTradeZonesLayer();
    this.updateAnnotationsLayer();
    this.updateTimeMarkersLayer();
    this.updateRiskZonesCanvasLayer();
    this.updateEquityCurveCanvasLayer();
    this.updatePositionOverlay();
  }

  private updateLayer(layer: Layer) {
    if (!layer) return;
    if (this.chart?.canvas) {
      // Get the chart area dimensions
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        // Use the chart area width minus price axis (same as what the tool uses)
        layer.width = chartArea.clientWidth - this.priceAxisWidth;

        // Use the actual canvas height
        const dpr = getDpr(); // Use fixed DPR
        layer.height = this.chart.canvas.height / dpr;
      }

      // Update the state to ensure trend lines recalculate positions
      layer.state = this._state;
      layer.requestUpdate();
    }
  }

  // Helper method to force redraw of all indicators
  private updateTrendLineLayer() {
    const trendLineLayer = this.renderRoot.querySelector(
      "trend-line-layer",
    ) as TrendLineLayer;
    if (trendLineLayer && this.chart?.canvas) {
      // Get the chart area dimensions
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        // Use the chart area width minus price axis (same as what the tool uses)
        trendLineLayer.width = chartArea.clientWidth - this.priceAxisWidth;

        // Use the actual canvas height
        const dpr = getDpr(); // Use fixed DPR
        trendLineLayer.height = this.chart.canvas.height / dpr;
      }

      // Update the state to ensure trend lines recalculate positions
      trendLineLayer.state = this._state;
      trendLineLayer.requestUpdate();
    }
  }

  private updatePatternLabelsLayer() {
    const patternLabelsLayer = this.renderRoot.querySelector(
      "pattern-labels-layer",
    ) as PatternLabelsLayer;
    if (patternLabelsLayer && this.chart?.canvas) {
      // Get the chart area dimensions
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        // Use the chart area width minus price axis (same as what the tool uses)
        patternLabelsLayer.width = chartArea.clientWidth - this.priceAxisWidth;

        // Use the actual canvas height
        const dpr = getDpr(); // Use fixed DPR
        patternLabelsLayer.height = this.chart.canvas.height / dpr;
      }

      // Update the state to ensure labels recalculate positions
      patternLabelsLayer.state = this._state;
      patternLabelsLayer.requestUpdate();
    }
  }

  private updateTradingMarkersLayer() {
    const tradingMarkersLayer = this.renderRoot.querySelector(
      "trading-markers-layer",
    ) as TradingMarkersLayer;
    if (tradingMarkersLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        tradingMarkersLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        tradingMarkersLayer.height = this.chart.canvas.height / dpr;
      }

      tradingMarkersLayer.state = this._state;
      tradingMarkersLayer.requestUpdate();
    }
  }

  private updatePriceLinesLayer() {
    const priceLinesLayer = this.renderRoot.querySelector(
      "price-lines-layer",
    ) as PriceLinesLayer;
    if (priceLinesLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        priceLinesLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        priceLinesLayer.height = this.chart.canvas.height / dpr;
      }

      priceLinesLayer.state = this._state;
      priceLinesLayer.requestUpdate();
    }
  }

  private updateTradeZonesLayer() {
    const tradeZonesLayer = this.renderRoot.querySelector(
      "trade-zones-layer",
    ) as TradeZonesLayer;
    if (tradeZonesLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        tradeZonesLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        tradeZonesLayer.height = this.chart.canvas.height / dpr;
      }

      tradeZonesLayer.state = this._state;
      tradeZonesLayer.requestUpdate();
    }
  }

  private updateAnnotationsLayer() {
    const annotationsLayer = this.renderRoot.querySelector(
      "annotations-layer",
    ) as AnnotationsLayer;
    if (annotationsLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        annotationsLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        annotationsLayer.height = this.chart.canvas.height / dpr;
      }

      annotationsLayer.state = this._state;
      annotationsLayer.requestUpdate();
    }
  }

  private updateTimeMarkersLayer() {
    const timeMarkersLayer = this.renderRoot.querySelector(
      "time-markers-layer",
    ) as TimeMarkersLayer;
    if (timeMarkersLayer) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea) {
        timeMarkersLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        // Use full chart-area height to span over all indicators
        timeMarkersLayer.height = chartArea.clientHeight;
      }

      timeMarkersLayer.state = this._state;
      timeMarkersLayer.requestUpdate();
    }
  }

  private updatePositionOverlay() {
    const positionOverlay = this.renderRoot.querySelector(
      "position-overlay",
    ) as PositionOverlayComponent;
    if (positionOverlay && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        positionOverlay.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        positionOverlay.height = this.chart.canvas.height / dpr;
      }

      positionOverlay.state = this._state;
      positionOverlay.requestUpdate();
    }
  }

  private updateRiskZonesCanvasLayer() {
    const riskZonesLayer = this.renderRoot.querySelector(
      "risk-zones-canvas-layer",
    ) as any;
    if (riskZonesLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        riskZonesLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        riskZonesLayer.height = this.chart.canvas.height / dpr;
      }

      riskZonesLayer.state = this._state;
      riskZonesLayer.timeRange = this._state.timeRange;
      riskZonesLayer.priceRange = this._state.priceRange;
      riskZonesLayer.requestUpdate();
    }
  }

  private updateEquityCurveCanvasLayer() {
    if (!this.equityCurveController) {
      return;
    }

    // Update dimensions
    const equityCurveLayer = this.renderRoot.querySelector(
      "equity-curve-canvas-layer",
    ) as any;
    if (equityCurveLayer && this.chart?.canvas) {
      const chartArea = this.renderRoot.querySelector(
        ".chart-area",
      ) as HTMLElement;
      if (chartArea && this.chart.canvas) {
        equityCurveLayer.width = chartArea.clientWidth - this.priceAxisWidth;
        const dpr = getDpr();
        equityCurveLayer.height = this.chart.canvas.height / dpr;
      }
    }

    // Delegate to controller for state/data updates
    this.equityCurveController.updateLayer();
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
    window.removeEventListener("focus", this.handleWindowFocus);
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange,
    );
    document.removeEventListener("click", this.handleClickOutside);
    document.removeEventListener("touchstart", this.handleClickOutside);
    document.removeEventListener("click", this.handleDocumentClick);
    this.removeEventListener(
      "candle-click",
      this.handleCandleClick as EventListener,
    );

    const chartAreaElement = this.renderRoot.querySelector(".chart-area");
    if (chartAreaElement) {
      chartAreaElement.removeEventListener(
        "dblclick",
        this.handleChartAreaDoubleClick as EventListener,
      );
    }
    this.removeEventListener("toggle-fullscreen", this.handleFullScreenToggle);
    this.removeEventListener("toggle-fullwindow", this.toggleFullWindow);
    this.removeEventListener(
      "toggle-indicator",
      this.handleIndicatorToggle as EventListener,
    );
    this.mobileMediaQuery.removeEventListener("change", () =>
      this.handleMobileChange(),
    );

    // Clean up zoom prevention handlers
    const handlers = (this as any)._zoomPreventionHandlers;
    if (handlers) {
      this.removeEventListener("keydown", handlers.keydown);
      this.removeEventListener("wheel", handlers.wheel);
      document.removeEventListener("keydown", handlers.documentKeydown);
    }

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
        this.updateTrendLineLayer();

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

  public handleIndicatorToggle(e: CustomEvent) {
    const {
      id,
      visible,
      display,
      class: indicatorClass,
      params,
      skipFetch,
      scale,
      name,
      gridStyle,
    } = e.detail;

    logger.debug(
      `ChartContainer: Indicator ${id} toggled to ${
        visible ? "visible" : "hidden"
      }`,
    );

    // Special handling for volume indicator
    if (id === "volume") {
      this.showVolume = visible;
      logger.debug(
        `ChartContainer: Volume indicator toggled to ${
          visible ? "visible" : "hidden"
        }`,
      );
      // Force redraw of the volume chart
      const volumeChart = this.renderRoot.querySelector(
        ".volume-chart",
      ) as HTMLElement;
      if (volumeChart) {
        volumeChart.hidden = !visible;
        logger.debug(
          `ChartContainer: Volume chart container ${
            visible ? "shown" : "hidden"
          }`,
        );

        // Force a redraw on the volume-chart element
        const volumeChartElement = volumeChart.querySelector("volume-chart");
        if (volumeChartElement) {
          volumeChartElement.dispatchEvent(
            new CustomEvent("force-redraw", {
              bubbles: false,
              composed: true,
            }),
          );
        }
      }

      // Skip adding volume to indicators map - it has special handling
      return;
    }

    if (visible) {
      this.indicators.set(id, {
        id,
        visible,
        display,
        class: indicatorClass,
        params,
        skipFetch,
        scale,
        name,
        gridStyle,
        ...e.detail,
      });
      // Update state.indicators
      this._state.indicators = Array.from(this.indicators.values())
        .filter((ind) => ind.visible)
        .map((ind) => ind);
    } else {
      this.indicators.delete(id);
      // Update state.indicators
      this._state.indicators = Array.from(this.indicators.values());
    }

    this.requestUpdate();
  }

  private showCandleTooltipFromContextMenu = () => {
    if (!this.chart || !this.contextMenuMousePosition) return;

    const chartRect = this.chart.getBoundingClientRect();
    const x = this.contextMenuMousePosition.x - chartRect.left;
    const y = this.contextMenuMousePosition.y - chartRect.top;

    const candle = this.chart.getCandleAtPosition(x, y);
    if (candle) {
      const containerRect = this.getBoundingClientRect();
      this.candleTooltipData = {
        timestamp: candle.timestamp,
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        x: this.contextMenuMousePosition.x - containerRect.left,
        y: this.contextMenuMousePosition.y - containerRect.top,
      };
      this.showCandleTooltip = true;
      this.showContextMenu = false;
    }
  };

  render() {
    const menuItems: MenuItem[] = [
      {
        label: "Show Candle Details",
        action: this.showCandleTooltipFromContextMenu,
      },
      {
        label: "separator",
        separator: true,
      },
      {
        label: this.isFullWindow ? "Exit Full Window" : "Full Window",
        action: this.toggleFullWindow,
      },
      {
        label: "separator",
        separator: true,
      },
      {
        label: "Indicators",
        isHeader: true,
      },
      // Transform the built-in indicators to have active state
      ...config.getBuiltInIndicators(this).map((item) => {
        // Skip separators and headers
        if (item.separator || item.isHeader) {
          return item;
        }

        // For Volume indicator, check showVolume property
        if (item.label === "Volume") {
          return {
            ...item,
            active: this.showVolume,
          };
        }

        // For other indicators, determine ID based on the label
        const indicatorId = item.label.toLowerCase().replace(/\s+/g, "-");
        return {
          ...item,
          active: this.isIndicatorVisible(indicatorId),
        };
      }),
    ];

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
              @trend-line-add=${this.handleTrendLineAdd}
              @trend-line-update=${this.handleTrendLineUpdate}
              @trend-line-remove=${this.handleTrendLineRemove}
            ></trend-line-layer>

            <!-- Pattern labels layer -->
            <pattern-labels-layer
              .patterns=${this._state.patternHighlights || []}
              .state=${this._state}
              .timeRange=${this._state.timeRange}
              .priceRange=${this._state.priceRange}
              style="--price-axis-width: ${this.priceAxisWidth}px"
              @pattern-click=${this.handlePatternClick}
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

            <!-- Equity Curve Canvas Layer (z-index: 15) -->
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

            <!-- Live Price Label -->
            <live-price-label
              style="--price-axis-width: ${this.priceAxisWidth}px"
            ></live-price-label>

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

    if (this._state.priceHistory.getCandles().size === 0) {
      this.chart.resize(width, height);
      return;
    }
    if (this._state.timeRange.end === 0) {
      return;
    }
    this.chart.resize(width, height);

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

    // Update trend line layer after resize
    this.updateTrendLineLayer();
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

  private setupFocusHandler() {
    window.addEventListener("focus", this.handleWindowFocus);
  }

  private handleWindowFocus = () => {
    this.draw();
  };

  private handleCandleClick = (event: CustomEvent) => {
    event.stopPropagation();
    const { candle, x, y } = event.detail;
    const chartId = (this as any)._chartId || "unknown";

    logger.debug(
      `handleCandleClick called for chart ${chartId} with candle:`,
      candle,
      "x:",
      x,
      "y:",
      y,
    );

    // x and y are already relative coordinates from the event detail
    // but we should ensure they're relative to the chart container
    const containerRect = this.getBoundingClientRect();
    this.candleTooltipData = {
      timestamp: candle.timestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
      volume: candle.volume,
      x: x - containerRect.left,
      y: y - containerRect.top,
    };
    this.showCandleTooltip = true;
    logger.debug(
      `Set showCandleTooltip to true for chart ${chartId}, data:`,
      this.candleTooltipData,
    );
  };

  /**
   * Handle price line dragged events from interaction layer
   */
  private handlePriceLineDragged = (event: CustomEvent) => {
    const { lineId, newPrice, line } = event.detail;

    // Update the price line with the new price
    const updatedLine = { ...line, price: newPrice };
    this.updatePriceLine(lineId, updatedLine);
  };

  /**
   * Handle annotation dragged events from interaction layer
   */
  private handleAnnotationDragged = (event: CustomEvent) => {
    const { annotationId, newTimestamp, newPrice, annotation } = event.detail;

    // Update the annotation with the new position
    const updatedAnnotation = {
      ...annotation,
      timestamp: newTimestamp,
      price: newPrice,
    };
    this.updateAnnotation(annotationId, updatedAnnotation);
  };

  /**
   * Handle risk zone clicked events from interaction layer
   */
  private handleRiskZoneClicked = (event: CustomEvent) => {
    const { zoneId, zone } = event.detail;
    logger.debug(`ChartContainer: Risk zone clicked: ${zoneId}`);

    // Forward event to Chart API
    this.dispatchEvent(
      new CustomEvent("risk-zone-clicked", {
        detail: { zoneId, zone },
        bubbles: true,
        composed: true,
      }),
    );
  };

  /**
   * Handle risk zone hovered events from interaction layer
   */
  private handleRiskZoneHovered = (event: CustomEvent) => {
    const { zoneId, zone } = event.detail;
    logger.debug(`ChartContainer: Risk zone hovered: ${zoneId}`);

    // Forward event to Chart API
    this.dispatchEvent(
      new CustomEvent("risk-zone-hovered", {
        detail: { zoneId, zone },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleDocumentClick = (event: MouseEvent) => {
    // Hide tooltip if clicking outside the chart
    const target = event.target as Element;
    // Check if the click is within this chart container or the tooltip itself
    const tooltip = this.renderRoot.querySelector("candle-tooltip");
    const isInTooltip = tooltip && tooltip.contains(target);

    if (!this.contains(target) && !isInTooltip) {
      // Only hide if we're showing a tooltip and click is outside both chart and tooltip
      if (this.showCandleTooltip) {
        const chartId = (this as any)._chartId || "unknown";
        logger.debug(
          `Hiding tooltip for chart ${chartId} due to outside click`,
        );
        this.showCandleTooltip = false;
      }
    }
  };

  private handleChartAreaDoubleClick = (event: MouseEvent) => {
    const chartId = (this as any)._chartId || "unknown";
    logger.debug(`handleChartAreaDoubleClick called for chart ${chartId}`);

    // Try to find the chart and canvas
    const chart = this.renderRoot.querySelector("candlestick-chart") as any;
    if (!chart || !chart.shadowRoot) {
      logger.debug(`No chart or shadowRoot found for chart ${chartId}`);
      return;
    }

    const canvas = chart.shadowRoot.querySelector("canvas");
    if (!canvas) {
      logger.debug(`No canvas found for chart ${chartId}`);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    // Don't multiply by DPR - our stored positions are in logical pixels
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    logger.debug(`Double-click position for chart ${chartId} - x:`, x, "y:", y);

    // Use the drawing strategy to find candle at position
    if (
      chart.drawingStrategy &&
      typeof chart.drawingStrategy.getCandleAtPosition === "function"
    ) {
      logger.debug(`Drawing strategy available for chart ${chartId}`);
      const candle = chart.drawingStrategy.getCandleAtPosition(x, y);
      logger.debug(
        `Found candle from double-click in chart ${chartId}:`,
        candle,
      );

      if (candle) {
        // Get the chart container's position to convert to relative coordinates
        const containerRect = this.getBoundingClientRect();
        this.candleTooltipData = {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          x: event.clientX - containerRect.left,
          y: event.clientY - containerRect.top,
        };
        this.showCandleTooltip = true;
        logger.debug(`Set showCandleTooltip to true for chart ${chartId}`);
      } else {
        this.showCandleTooltip = false;
        logger.debug(`No candle found, hiding tooltip for chart ${chartId}`);
      }
    } else {
      logger.debug(
        `Drawing strategy or getCandleAtPosition not available for chart ${chartId}`,
      );
    }
  };

  private handleFullScreenToggle = async (e: Event) => {
    if (this.isMobile) return;
    if (e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();

    try {
      if (!this.isFullscreen) {
        await this.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      logger.error("Error attempting to toggle fullscreen:", err);
    }
  };

  private handleFullscreenChange = () => {
    if (this.isMobile) return; // Don't handle fullscreen on mobile
    this.isFullscreen = document.fullscreenElement === this;
    if (!this.isFullscreen) {
      // Add a small delay to ensure dimensions are properly updated
      setTimeout(() => {
        this.handleResize(this.clientWidth, this.clientHeight);
      }, 100);
    }
  };

  private handleClickOutside = (e: MouseEvent | TouchEvent) => {
    const target = e.target as HTMLElement;
    const contextMenu = this.renderRoot.querySelector("chart-context-menu");
    if (contextMenu && !contextMenu.contains(target)) {
      this.showContextMenu = false;
    }
  };

  private toggleFullWindow = (e?: Event) => {
    if (e?.defaultPrevented) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    this.isFullWindow = !this.isFullWindow;
    if (this.isFullWindow) {
      this.classList.add("full-window");
    } else {
      this.classList.remove("full-window");
    }
    // Force a resize after the class change with a small delay
    setTimeout(() => {
      this.handleResize(this.clientWidth, this.clientHeight);
    }, 100);
  };

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

  private initializeTrendLineTool() {
    const chartArea = this.renderRoot.querySelector(
      ".chart-area",
    ) as HTMLElement;
    if (!chartArea) {
      logger.error("Chart area not found for trend line tool");
      return;
    }

    // Pass a function to get the current state, the price axis width, and a function to get the chart canvas
    this.trendLineTool = new TrendLineTool(
      chartArea,
      () => this._state,
      this.priceAxisWidth,
      () => this.chart?.canvas || null,
    );

    // Listen for trend line creation
    chartArea.addEventListener("trend-line-created", (event: Event) => {
      const customEvent = event as CustomEvent;
      const trendLineData = customEvent.detail.trendLine;
      const trendLine: TrendLine = {
        id: `trend-line-${Date.now()}`,
        ...trendLineData,
      };

      this.addTrendLine(trendLine);
    });
  }

  private handleTrendLineToolToggle = () => {
    if (!this.trendLineTool) return;

    if (this.trendLineTool.isToolActive()) {
      this.trendLineTool.deactivate();
    } else {
      this.trendLineTool.activate();
    }
  };

  private addTrendLine(trendLine: TrendLine) {
    this.trendLines = [...this.trendLines, trendLine];

    // Force update to trigger re-render with new trend line
    this.requestUpdate();

    // Update state
    this._state.trendLines = this.trendLines;
    touch("state.trendLines");

    // Select the newly created trend line
    if (this.trendLineLayer) {
      this.trendLineLayer.selectLine(trendLine.id);
    }

    // Ensure trend line layer has correct dimensions after adding line
    // Use requestAnimationFrame to wait for render to complete
    requestAnimationFrame(() => {
      this.updateTrendLineLayer();
    });

    // Emit API event
    this.dispatchEvent(
      new CustomEvent("trend-line-added", {
        detail: { trendLine },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTrendLineAdd = (event: CustomEvent) => {
    logger.debug(
      `ChartContainer: handleTrendLineAdd called (should not be used)`,
    );
    // This is already handled by the layer itself
  };

  private handleTrendLineUpdate = (event: CustomEvent) => {
    logger.debug(`ChartContainer: handleTrendLineUpdate called`, event.detail);
    const { trendLine } = event.detail;
    // Convert Proxy IDs to strings for comparison
    const index = this.trendLines.findIndex(
      (l) => String(l.id) === String(trendLine.id),
    );
    logger.debug(
      `ChartContainer: Looking for trend line with ID ${String(trendLine.id)}, found at index: ${index}`,
    );
    if (index !== -1) {
      this.trendLines = [
        ...this.trendLines.slice(0, index),
        trendLine,
        ...this.trendLines.slice(index + 1),
      ];

      // Update state
      this._state.trendLines = this.trendLines;
      touch("state.trendLines");

      // Emit API event
      this.dispatchEvent(
        new CustomEvent("trend-line-updated", {
          detail: event.detail,
          bubbles: true,
          composed: true,
        }),
      );
    } else {
      logger.warn(
        `ChartContainer: Could not find trend line with ID ${String(trendLine.id)} to update`,
      );
    }
  };

  private handleTrendLineRemove = (event: CustomEvent) => {
    logger.debug(`ChartContainer: handleTrendLineRemove called, event:`, event);
    logger.debug(`ChartContainer: Event detail:`, event.detail);
    logger.debug(`ChartContainer: Event type:`, event.detail?.type);

    const eventDetail = event.detail;
    const trendLine = eventDetail.trendLine || eventDetail;

    if (!trendLine || !trendLine.id) {
      logger.error(
        `ChartContainer: Invalid event detail, cannot find trend line`,
        eventDetail,
      );
      return;
    }

    const lineId = String(trendLine.id);
    logger.debug(`ChartContainer: Removing trend line ${lineId}`);
    logger.debug(
      `ChartContainer: Before removal, trendLines:`,
      this.trendLines.map((l) => String(l.id)),
    );

    // Use String conversion for Proxy comparison
    this.trendLines = this.trendLines.filter((l) => String(l.id) !== lineId);

    // Update state
    this._state.trendLines = this.trendLines;
    touch("state.trendLines");

    // Force update to ensure UI reflects the change
    this.requestUpdate();

    logger.debug(
      `ChartContainer: After removal, ${this.trendLines.length} lines remaining:`,
      this.trendLines.map((l) => String(l.id)),
    );

    // Emit API event
    this.dispatchEvent(
      new CustomEvent("trend-line-removed", {
        detail: event.detail,
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handlePatternClick = (event: CustomEvent) => {
    // Pattern click is already handled by the markers layer itself
    // This is here if we need to do additional processing at the container level
    logger.debug("ChartContainer: Pattern clicked", event.detail);
  };

  /**
   * Set pattern highlights to be displayed on the chart
   */
  public setPatternHighlights(patterns: PatternHighlight[]) {
    // Store in state like we do with trendLines
    this._state.patternHighlights = patterns;
    touch("state.patternHighlights");

    if (this.patternLabelsLayer) {
      // Ensure dimensions are up to date before setting patterns
      this.updatePatternLabelsLayer();
      this.patternLabelsLayer.setPatterns(patterns);
    }
    this.requestUpdate();

    // Force immediate redraw to show highlights
    this.draw();

    // Emit API event
    this.dispatchEvent(
      new CustomEvent("patterns-highlighted", {
        detail: { patterns },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Clear all pattern highlights
   */
  public clearPatternHighlights() {
    this._state.patternHighlights = [];
    touch("state.patternHighlights");

    if (this.patternLabelsLayer) {
      this.patternLabelsLayer.clearPatterns();
    }
    this.requestUpdate();

    // Emit API event
    this.dispatchEvent(
      new CustomEvent("patterns-cleared", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Get current pattern highlights
   */
  public getPatternHighlights(): PatternHighlight[] {
    return this._state.patternHighlights || [];
  }

  // ============================================================================
  // Trading Overlay Methods (Paper Trading & Backtesting)
  // ============================================================================

  /**
   * Add a trade marker to the chart
   */
  public addTradeMarker(marker: TradeMarker): void {
    if (!this._state.tradeMarkers) {
      this._state.tradeMarkers = [];
    }
    this._state.tradeMarkers.push(marker);
    touch("state.tradeMarkers");
    this.requestUpdate();
    this.updateTradingMarkersLayer();
    logger.debug(`ChartContainer: Added trade marker ${marker.id}`);
  }

  /**
   * Remove a trade marker from the chart
   */
  public removeTradeMarker(markerId: string): void {
    if (!this._state.tradeMarkers) return;

    const index = this._state.tradeMarkers.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      this._state.tradeMarkers.splice(index, 1);
      touch("state.tradeMarkers");
      this.requestUpdate();
      this.updateTradingMarkersLayer();
      logger.debug(`ChartContainer: Removed trade marker ${markerId}`);
    }
  }

  /**
   * Update an existing trade marker
   */
  public updateTradeMarker(markerId: string, marker: TradeMarker): void {
    if (!this._state.tradeMarkers) return;

    const index = this._state.tradeMarkers.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      this._state.tradeMarkers[index] = marker;
      touch("state.tradeMarkers");
      this.requestUpdate();
      this.updateTradingMarkersLayer();
      logger.debug(`ChartContainer: Updated trade marker ${markerId}`);
    }
  }

  /**
   * Clear all trade markers
   */
  public clearTradeMarkers(): void {
    this._state.tradeMarkers = [];
    touch("state.tradeMarkers");
    this.requestUpdate();
    this.updateTradingMarkersLayer();
    logger.debug("ChartContainer: Cleared all trade markers");
  }

  /**
   * Add a price line to the chart
   */
  public addPriceLine(line: PriceLine): void {
    if (!this._state.priceLines) {
      this._state.priceLines = [];
    }
    this._state.priceLines.push(line);
    touch("state.priceLines");
    this.requestUpdate();
    this.updatePriceLinesLayer();
    logger.debug(`ChartContainer: Added price line ${line.id}`);
  }

  /**
   * Remove a price line from the chart
   */
  public removePriceLine(lineId: string): void {
    if (!this._state.priceLines) return;

    const index = this._state.priceLines.findIndex((l) => l.id === lineId);
    if (index !== -1) {
      this._state.priceLines.splice(index, 1);
      touch("state.priceLines");
      this.requestUpdate();
      this.updatePriceLinesLayer();
      logger.debug(`ChartContainer: Removed price line ${lineId}`);
    }
  }

  /**
   * Update an existing price line
   */
  public updatePriceLine(lineId: string, line: PriceLine): void {
    if (!this._state.priceLines) return;

    const index = this._state.priceLines.findIndex((l) => l.id === lineId);
    if (index !== -1) {
      this._state.priceLines[index] = line;
      touch("state.priceLines");
      this.requestUpdate();
      this.updatePriceLinesLayer();
      logger.debug(`ChartContainer: Updated price line ${lineId}`);
    }
  }

  /**
   * Clear all price lines
   */
  public clearPriceLines(): void {
    this._state.priceLines = [];
    touch("state.priceLines");
    this.requestUpdate();
    this.updatePriceLinesLayer();
    logger.debug("ChartContainer: Cleared all price lines");
  }

  /**
   * Add a trade zone to the chart
   */
  public addTradeZone(zone: TradeZone): void {
    if (!this._state.tradeZones) {
      this._state.tradeZones = [];
    }
    this._state.tradeZones.push(zone);
    touch("state.tradeZones");
    this.requestUpdate();
    this.updateTradeZonesLayer();
    logger.debug(`ChartContainer: Added trade zone ${zone.id}`);
  }

  /**
   * Remove a trade zone from the chart
   */
  public removeTradeZone(zoneId: string): void {
    if (!this._state.tradeZones) return;

    const index = this._state.tradeZones.findIndex((z) => z.id === zoneId);
    if (index !== -1) {
      this._state.tradeZones.splice(index, 1);
      touch("state.tradeZones");
      this.requestUpdate();
      this.updateTradeZonesLayer();
      logger.debug(`ChartContainer: Removed trade zone ${zoneId}`);
    }
  }

  /**
   * Update an existing trade zone
   */
  public updateTradeZone(zoneId: string, zone: TradeZone): void {
    if (!this._state.tradeZones) return;

    const index = this._state.tradeZones.findIndex((z) => z.id === zoneId);
    if (index !== -1) {
      this._state.tradeZones[index] = zone;
      touch("state.tradeZones");
      this.requestUpdate();
      this.updateTradeZonesLayer();
      logger.debug(`ChartContainer: Updated trade zone ${zoneId}`);
    }
  }

  /**
   * Clear all trade zones
   */
  public clearTradeZones(): void {
    this._state.tradeZones = [];
    touch("state.tradeZones");
    this.requestUpdate();
    this.updateTradeZonesLayer();
    logger.debug("ChartContainer: Cleared all trade zones");
  }

  /**
   * Set or update the position overlay
   */
  public setPositionOverlay(config: PositionOverlayConfig | null): void {
    this._state.positionOverlay = config;
    touch("state.positionOverlay");
    this.requestUpdate();
    this.updatePositionOverlay();

    if (config) {
      logger.debug(`ChartContainer: Set position overlay for ${config.symbol}`);
    } else {
      logger.debug("ChartContainer: Cleared position overlay");
    }
  }

  /**
   * Add an annotation to the chart
   */
  public addAnnotation(annotation: Annotation): void {
    if (!this._state.annotations) {
      this._state.annotations = [];
    }
    this._state.annotations.push(annotation);
    touch("state.annotations");
    this.requestUpdate();
    this.updateAnnotationsLayer();
    logger.debug(`ChartContainer: Added annotation ${annotation.id}`);
  }

  /**
   * Remove an annotation from the chart
   */
  public removeAnnotation(annotationId: string): void {
    if (!this._state.annotations) return;

    const index = this._state.annotations.findIndex(
      (a) => a.id === annotationId,
    );
    if (index !== -1) {
      this._state.annotations.splice(index, 1);
      touch("state.annotations");
      this.requestUpdate();
      this.updateAnnotationsLayer();
      logger.debug(`ChartContainer: Removed annotation ${annotationId}`);
    }
  }

  /**
   * Update an existing annotation
   */
  public updateAnnotation(annotationId: string, annotation: Annotation): void {
    if (!this._state.annotations) return;

    const index = this._state.annotations.findIndex(
      (a) => a.id === annotationId,
    );
    if (index !== -1) {
      // Create new array reference to trigger Lit's reactive update
      this._state.annotations = [
        ...this._state.annotations.slice(0, index),
        annotation,
        ...this._state.annotations.slice(index + 1),
      ];
      touch("state.annotations");
      this.requestUpdate();
      this.updateAnnotationsLayer();
      logger.debug(`ChartContainer: Updated annotation ${annotationId}`);
    }
  }

  /**
   * Clear all annotations
   */
  public clearAnnotations(): void {
    this._state.annotations = [];
    touch("state.annotations");
    this.requestUpdate();
    this.updateAnnotationsLayer();
    logger.debug("ChartContainer: Cleared all annotations");
  }

  /**
   * Get all annotations
   */
  public getAnnotations(): Annotation[] {
    return this._state.annotations || [];
  }

  /**
   * Get a specific annotation by ID
   */
  public getAnnotation(annotationId: string): Annotation | undefined {
    return this._state.annotations?.find((a) => a.id === annotationId);
  }

  /**
   * Add a time marker to the chart
   */
  public addTimeMarker(marker: TimeMarker): void {
    if (!this._state.timeMarkers) {
      this._state.timeMarkers = [];
    }
    this._state.timeMarkers.push(marker);
    touch("state.timeMarkers");
    this.requestUpdate();
    this.updateTimeMarkersLayer();
    logger.debug(`ChartContainer: Added time marker ${marker.id}`);
  }

  /**
   * Remove a time marker from the chart
   */
  public removeTimeMarker(markerId: string): void {
    if (!this._state.timeMarkers) return;

    const index = this._state.timeMarkers.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      this._state.timeMarkers.splice(index, 1);
      touch("state.timeMarkers");
      this.requestUpdate();
      this.updateTimeMarkersLayer();
      logger.debug(`ChartContainer: Removed time marker ${markerId}`);
    }
  }

  /**
   * Update an existing time marker
   */
  public updateTimeMarker(markerId: string, marker: TimeMarker): void {
    if (!this._state.timeMarkers) return;

    const index = this._state.timeMarkers.findIndex((m) => m.id === markerId);
    if (index !== -1) {
      this._state.timeMarkers[index] = marker;
      touch("state.timeMarkers");
      this.requestUpdate();
      this.updateTimeMarkersLayer();
      logger.debug(`ChartContainer: Updated time marker ${markerId}`);
    }
  }

  /**
   * Clear all time markers
   */
  public clearTimeMarkers(): void {
    this._state.timeMarkers = [];
    touch("state.timeMarkers");
    this.requestUpdate();
    this.updateTimeMarkersLayer();
    logger.debug("ChartContainer: Cleared all time markers");
  }

  /**
   * Get all time markers
   */
  public getTimeMarkers(): TimeMarker[] {
    return this._state.timeMarkers || [];
  }

  /**
   * Get a specific time marker by ID
   */
  public getTimeMarker(markerId: string): TimeMarker | undefined {
    return this._state.timeMarkers?.find((m) => m.id === markerId);
  }

  // ============================================================================
  // Risk Zones Methods
  // ============================================================================

  /**
   * Add a risk zone to the chart
   */
  public addRiskZone(zone: RiskZone): void {
    if (!this._state.riskZones) {
      this._state.riskZones = [];
    }
    this._state.riskZones.push(zone);
    this.riskZones = this._state.riskZones;
    touch("state.riskZones");

    // Update the interaction layer
    if (this.riskZonesInteractionLayer) {
      this.riskZonesInteractionLayer.setZones(this._state.riskZones);
    }

    this.requestUpdate();
    logger.debug(`ChartContainer: Added risk zone ${zone.id}`);
  }

  /**
   * Remove a risk zone from the chart
   */
  public removeRiskZone(zoneId: string): void {
    if (!this._state.riskZones) return;

    const index = this._state.riskZones.findIndex(
      (z: RiskZone) => z.id === zoneId,
    );
    if (index !== -1) {
      this._state.riskZones.splice(index, 1);
      this.riskZones = this._state.riskZones;
      touch("state.riskZones");

      // Update the interaction layer
      if (this.riskZonesInteractionLayer) {
        this.riskZonesInteractionLayer.setZones(this._state.riskZones);
      }

      this.requestUpdate();
      logger.debug(`ChartContainer: Removed risk zone ${zoneId}`);
    }
  }

  /**
   * Update an existing risk zone
   */
  public updateRiskZone(zoneId: string, zone: RiskZone): void {
    if (!this._state.riskZones) return;

    const index = this._state.riskZones.findIndex(
      (z: RiskZone) => z.id === zoneId,
    );
    if (index !== -1) {
      this._state.riskZones[index] = zone;
      this.riskZones = this._state.riskZones;
      touch("state.riskZones");

      // Update the interaction layer
      if (this.riskZonesInteractionLayer) {
        this.riskZonesInteractionLayer.setZones(this._state.riskZones);
      }

      this.requestUpdate();
      logger.debug(`ChartContainer: Updated risk zone ${zoneId}`);
    }
  }

  /**
   * Clear all risk zones
   */
  public clearRiskZones(): void {
    this._state.riskZones = [];
    this.riskZones = [];
    touch("state.riskZones");

    // Update the interaction layer
    if (this.riskZonesInteractionLayer) {
      this.riskZonesInteractionLayer.setZones([]);
    }

    this.requestUpdate();
    logger.debug("ChartContainer: Cleared all risk zones");
  }

  /**
   * Get all risk zones
   */
  public getRiskZones(): RiskZone[] {
    return this._state.riskZones || [];
  }

  /**
   * Get a specific risk zone by ID
   */
  public getRiskZone(zoneId: string): RiskZone | undefined {
    return this._state.riskZones?.find((z: RiskZone) => z.id === zoneId);
  }

  // ============================================================================
  // Click-to-Trade Methods (Removed - use Chart API with direct controller access)
  // ============================================================================

  // Public click-to-trade methods have been removed.
  // Access controller directly via: chartContainer.clickToTradeController
  // The Chart API provides the public interface for enabling/disabling click-to-trade mode.

  private initializeInteractionController() {
    if (!this.chart) return;

    this.interactionController = new ChartInteractionController({
      chart: this.chart,
      container: this as HTMLElement,
      state: this._state,
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
      bufferMultiplier: BUFFER_MULTIPLIER,
      zoomFactor: this.ZOOM_FACTOR,
      doubleTapDelay: this.DOUBLE_TAP_DELAY,
    });

    this.interactionController.attach(true);

    // Register interaction layers (highest priority first)
    // Priority order: Annotations (100) > Price Lines (90) > Trend Lines (80) > Time Markers (40) > Live Candle (10)

    // Annotations layer - highest priority (100)
    const annotationsLayer = new AnnotationsInteractionLayer(
      this as HTMLElement,
      this._state,
      () => this._state.annotations || [],
    );
    this.interactionController.registerLayer(annotationsLayer);

    // Price lines layer - priority 90
    const priceLinesLayer = new PriceLinesInteractionLayer(
      this as HTMLElement,
      this._state,
      () => this._state.priceLines || [],
    );
    this.interactionController.registerLayer(priceLinesLayer);

    // Trend lines layer - priority 80
    const trendLinesLayer = new TrendLinesInteractionLayer(
      this as HTMLElement,
      this._state,
    );
    this.interactionController.registerLayer(trendLinesLayer);

    // Time markers layer - priority 40
    const timeMarkersLayer = new TimeMarkersInteractionLayer(
      this as HTMLElement,
      this._state,
      () => this._state.timeMarkers || [],
    );
    this.interactionController.registerLayer(timeMarkersLayer);

    // Risk zones layer - priority 10 (canvas-based rendering)
    if (this.chart.canvas) {
      this.riskZonesInteractionLayer = new RiskZonesLayer(this.chart.canvas);
      this.riskZonesInteractionLayer.setZones(this._state.riskZones || []);
      this.interactionController.registerLayer(this.riskZonesInteractionLayer);
    }

    // Live candle layer - lowest priority (10)
    const liveCandleLayer = new LiveCandleInteractionLayer(
      this as HTMLElement,
      this._state,
    );
    this.interactionController.registerLayer(liveCandleLayer);

    logger.debug("ChartContainer: All interaction layers registered");
  }
}
