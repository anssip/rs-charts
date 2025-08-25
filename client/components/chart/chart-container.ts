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
import { CandlestickChart, ChartOptions } from "./chart";
import { DrawingContext } from "./drawing-strategy";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getCandleInterval, priceToY, timeToX } from "../../util/chart-util";
import { CoinbaseProduct } from "../../api/firestore-client";
import { MenuItem } from "./context-menu";
import "./indicators/indicator-container";
import "./indicators/market-indicator";
import { config } from "../../config";
import { ChartInteractionController } from "./interaction/chart-interaction-controller";
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
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("ChartContainer");
logger.setLoggerLevel("ChartContainer", LogLevel.ERROR);

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

  private interactionController?: ChartInteractionController;
  private trendLineTool?: TrendLineTool;
  private trendLineLayer?: TrendLineLayer;

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
      axisMappings: {
        timeToX: timeToX(this.chart.canvas!.width, this._state.timeRange),
        priceToY: priceToY(this.chart.canvas!.height, {
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
        const dpr = window.devicePixelRatio || 1;
        trendLineLayer.height = this.chart.canvas.height / dpr;
      }

      // Update the state to ensure trend lines recalculate positions
      trendLineLayer.state = this._state;
      trendLineLayer.requestUpdate();
    }
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
    this.removeEventListener("toggle-fullscreen", this.handleFullScreenToggle);
    this.removeEventListener("toggle-fullwindow", this.toggleFullWindow);
    this.removeEventListener(
      "toggle-indicator",
      this.handleIndicatorToggle as EventListener,
    );
    this.mobileMediaQuery.removeEventListener("change", () =>
      this.handleMobileChange(),
    );
    this.interactionController?.detach();
  }

  @property({ type: Object })
  set state(state: ChartState) {
    const isInitialState =
      this._state.symbol === "BTC-USD" &&
      this._state.granularity === "ONE_HOUR" &&
      this.indicators.size === 0 &&
      this.trendLines.length === 0;
    this._state = state;

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

  render() {
    const menuItems: MenuItem[] = [
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
      {
        label: "separator",
        separator: true,
      },
      {
        label: "Drawing Tools (Pro)",
        action: () => this.dispatchUpgrade(),
      },
      {
        label: "Assets (Pro)",
        action: () => this.dispatchUpgrade(),
      },
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
          ? html`<chart-crosshairs class="grid-crosshairs"></chart-crosshairs>`
          : ""}
      </div>
      
      <div class="timeline-container">
        <chart-timeline></chart-timeline>
      </div>
    </div>
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
    const availableWidth =
      this.chart.canvas.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(
      availableWidth / (totalCandleWidth * window.devicePixelRatio),
    );
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
      this.chart.canvas.width / (window.devicePixelRatio ?? 1) -
      this.padding.left -
      this.padding.right;

    const idealCandleWidth = (availableWidth / numCandles) * 0.9; // 90% for candle, 10% for gap
    const idealGapWidth = (availableWidth / numCandles) * 0.1;

    // Clamp the values between min and max
    const candleWidth =
      Math.max(
        this.options.minCandleWidth,
        Math.min(this.options.maxCandleWidth, idealCandleWidth),
      ) / (window.devicePixelRatio ?? 1);
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
        this.draw();
      },
      onNeedMoreData: (direction) => {
        this.dispatchRefetch(direction);
      },
      onContextMenu: (position) => {
        this.showContextMenu = true;
        this.contextMenuPosition = position;
      },
      bufferMultiplier: BUFFER_MULTIPLIER,
      zoomFactor: this.ZOOM_FACTOR,
      doubleTapDelay: this.DOUBLE_TAP_DELAY,
    });

    this.interactionController.attach(true);
  }
}
