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
import "./price-info";
import "./indicators/volume-chart";
import "./context-menu";
import { CandlestickChart, ChartOptions } from "./chart";
import { DrawingContext } from "./drawing-strategy";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getCandleInterval, priceToY, timeToX } from "../../util/chart-util";
import { CoinbaseProduct } from "../../api/firestore-client";
import "./logo";
import { MenuItem } from "./context-menu";
import "./toolbar/chart-toolbar";
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
import { logger } from "../../util/logger";

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

  private interactionController?: ChartInteractionController;

  constructor() {
    super();
    // Check if device is touch-only (no mouse/trackpad)
    this.isTouchOnly = window.matchMedia(
      "(hover: none) and (pointer: coarse)"
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
      chartArea.clientHeight
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
        height
      );
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
            })
          );

          // Initialize interaction controller after chart is ready
          if (!this.interactionController) {
            logger.debug("ChartContainer: Initializing interaction controller");
            this.initializeInteractionController();
          }
        });
      } else {
        logger.error(
          "ChartContainer: Chart element not found during initialization"
        );
      }
    }, 0);

    // Add click outside listener
    document.addEventListener("click", this.handleClickOutside);
    document.addEventListener("touchstart", this.handleClickOutside);

    window.addEventListener("spotcanvas-upgrade", this.handleUpgrade);

    this.setupFocusHandler();

    // Add event listeners for toolbar actions
    this.addEventListener("toggle-fullscreen", this.handleFullScreenToggle);
    this.addEventListener("toggle-fullwindow", this.toggleFullWindow);
    this.addEventListener(
      "toggle-indicator",
      this.handleIndicatorToggle as EventListener
    );

    // Initialize mobile state and add listener
    this.handleMobileChange();
    this.mobileMediaQuery.addEventListener("change", () =>
      this.handleMobileChange()
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
  }

  // Helper method to force redraw of all indicators
  private redrawIndicators() {
    logger.debug("ChartContainer: Redrawing indicators");

    // Force indicator-stack to redraw
    const indicatorStack = this.renderRoot.querySelector(
      "indicator-stack.main-chart"
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
        })
      );
    }

    // Find and redraw all market indicators
    const indicators = this.renderRoot.querySelectorAll("market-indicator");
    indicators.forEach((indicator) => {
      logger.debug(
        `ChartContainer: Sending redraw to ${
          indicator.getAttribute("slot") || "unknown"
        } indicator`
      );

      // Get current dimensions for the detail object
      const width = indicator.clientWidth || 100;
      const height = indicator.clientHeight || 100;

      indicator.dispatchEvent(
        new CustomEvent("force-redraw", {
          bubbles: false,
          composed: true,
          detail: { width, height }, // Add detail property
        })
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
      this.handleFullscreenChange
    );
    document.removeEventListener("click", this.handleClickOutside);
    document.removeEventListener("touchstart", this.handleClickOutside);
    this.removeEventListener("toggle-fullscreen", this.handleFullScreenToggle);
    this.removeEventListener("toggle-fullwindow", this.toggleFullWindow);
    this.removeEventListener(
      "toggle-indicator",
      this.handleIndicatorToggle as EventListener
    );
    this.mobileMediaQuery.removeEventListener("change", () =>
      this.handleMobileChange()
    );
    this.interactionController?.detach();
  }

  @property({ type: Object })
  set state(state: ChartState) {
    this._state = state;
  }

  private dispatchUpgrade() {
    this.dispatchEvent(
      new CustomEvent("spotcanvas-upgrade", {
        bubbles: true,
        composed: true,
      })
    );
  }

  public isIndicatorVisible(id: string): boolean {
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
    } = e.detail;

    // Special handling for volume indicator
    if (id === "volume") {
      this.showVolume = visible;
      logger.debug(
        `ChartContainer: Volume indicator toggled to ${
          visible ? "visible" : "hidden"
        }`
      );
      // Force redraw of the volume chart
      const volumeChart = this.renderRoot.querySelector(
        ".volume-chart"
      ) as HTMLElement;
      if (volumeChart) {
        volumeChart.hidden = !visible;
        logger.debug(
          `ChartContainer: Volume chart container ${
            visible ? "shown" : "hidden"
          }`
        );

        // Force a redraw on the volume-chart element
        const volumeChartElement = volumeChart.querySelector("volume-chart");
        if (volumeChartElement) {
          volumeChartElement.dispatchEvent(
            new CustomEvent("force-redraw", {
              bubbles: false,
              composed: true,
            })
          );
        }
      }
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

  private toggleVolume() {
    this.showVolume = !this.showVolume;
    logger.debug(
      `ChartContainer: Volume toggled to ${
        this.showVolume ? "visible" : "hidden"
      }`
    );

    const volumeChart = this.renderRoot.querySelector(
      ".volume-chart"
    ) as HTMLElement;
    if (volumeChart) {
      volumeChart.hidden = !this.showVolume;
      logger.debug(
        `ChartContainer: Volume chart container ${
          this.showVolume ? "shown" : "hidden"
        }`
      );

      // Force a redraw on the volume-chart element
      const volumeChartElement = volumeChart.querySelector("volume-chart");
      if (volumeChartElement) {
        volumeChartElement.dispatchEvent(
          new CustomEvent("force-redraw", {
            bubbles: false,
            composed: true,
          })
        );
      }
    }

    // Update the chart
    this.requestUpdate();
    setTimeout(() => this.draw(), 10);
  }

  render() {
    const menuItems: MenuItem[] = [
      {
        label: this.isFullWindow ? "Exit Full Window" : "Full Window",
        action: this.toggleFullWindow,
      },
      ...(this.isMobile
        ? []
        : [
            {
              label: this.isFullscreen ? "Exit Full Screen" : "Full Screen",
              action: () =>
                this.handleFullScreenToggle(
                  new CustomEvent("toggle-fullscreen")
                ),
            },
          ]),
      {
        label: "separator",
        separator: true,
      },
      {
        label: "Indicators",
        isHeader: true,
      },
      ...config.getBuiltInIndicators(this),
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
      (indicator) => indicator.display === DisplayType.Overlay
    );
    const bottomIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.Bottom
    );
    const stackTopIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.StackTop
    );
    const stackBottomIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === DisplayType.StackBottom
    );

    // Calculate grid template rows based on number of stacked indicators
    const gridTemplateRows = `
      auto
      ${
        stackTopIndicators.length
          ? `${stackTopIndicators.length * INDICATOR_HEIGHT}px`
          : "0"
      }
      1fr
      ${TIMELINE_HEIGHT}px
    `;

    return html`
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
        <div
          class="price-info"
          @connectedCallback=${(e: HTMLElement) =>
            e.setAttribute("grid-area", "price-info")}
        >
          <price-info
            .product=${this._state.liveCandle?.productId}
            .symbols=${this.products}
            .isFullscreen=${this.isFullscreen}
            .isFullWindow=${this.isFullWindow}
            .showVolume=${this.isIndicatorVisible("volume")}
            .container=${this}
            @toggle-fullscreen=${this.handleFullScreenToggle}
            @toggle-fullwindow=${this.toggleFullWindow}
            @toggle-indicator=${this.handleIndicatorToggle}
            @upgrade-click=${this.dispatchUpgrade}
          ></price-info>
        </div>

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
                  ></market-indicator>
                </indicator-container>
              `
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
                    ></market-indicator>
                  `
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
                      `ChartContainer: Adding indicator ${indicator.id} with slot="${slotId}"`
                    );
                    return html`
                      <market-indicator
                        slot="${slotId}"
                        .indicatorId=${indicator.id}
                        .scale=${indicator.scale}
                        .name=${indicator.name}
                        .state=${this._state}
                        .valueAxisWidth=${this.priceAxisWidth}
                      ></market-indicator>
                    `;
                  })
                : ""}
            </indicator-stack>
          </div>
        </div>

        <div
          class="timeline-container"
          @connectedCallback=${(e: HTMLElement) =>
            e.setAttribute("grid-area", "timeline")}
        >
          <chart-timeline></chart-timeline>
        </div>

        <chart-logo></chart-logo>
        <chart-context-menu
          .show=${this.showContextMenu}
          .position=${this.contextMenuPosition}
          .items=${menuItems}
        ></chart-context-menu>

        ${!this.isTouchOnly
          ? html`<chart-crosshairs class="grid-crosshairs"></chart-crosshairs>`
          : ""}
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
      })
    );
  }

  public calculateVisibleCandles(): number {
    if (!this.chart) return 0;
    const availableWidth =
      this.chart.canvas!.width - this.padding.left - this.padding.right;
    const totalCandleWidth = this.options.candleWidth + this.options.candleGap;
    return Math.floor(
      availableWidth / (totalCandleWidth * window.devicePixelRatio)
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
        Math.min(this.options.maxCandleWidth, idealCandleWidth)
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
      "indicator-stack.main-chart"
    ) as LitElement | null;

    if (!indicatorStack) {
      logger.warn("ChartContainer: indicator-stack.main-chart not found");
      return null;
    }
    logger.debug("ChartContainer: Found indicator-stack");

    // Find the chart in the new structure - inside indicator-container with class chart-with-overlays
    const chartElement = this.renderRoot.querySelector(
      "indicator-stack.main-chart indicator-container.chart-with-overlays candlestick-chart"
    ) as CandlestickChart | null;

    logger.debug(
      "ChartContainer: candlestick-chart",
      chartElement ? "found" : "NOT FOUND"
    );

    return chartElement;
  }

  private initializeInteractionController() {
    if (!this.chart) return;

    this.interactionController = new ChartInteractionController({
      chart: this.chart,
      container: this.renderRoot.querySelector(".chart-area") as HTMLElement,
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
      onFullWindowToggle: () => {
        if (this.isMobile) {
          this.toggleFullWindow();
        }
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
