import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  granularityToMs,
  SimplePriceHistory,
  TimeRange,
} from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import "./price-axis";
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
import { VolumeChart } from "./indicators/volume-chart";
import { MarketIndicator } from "./indicators/market-indicator";
import { ChartInteractionController } from "./interaction/chart-interaction-controller";
import { touch } from "xinjs";

const BUFFER_MULTIPLIER = 1;
export const TIMELINE_HEIGHT = 30;
export const PRICEAXIS_WIDTH = 70;
export const PRICEAXIS_MOBILE_WIDTH = 45;

interface IndicatorState {
  id: string;
  visible: boolean;
  params?: Record<string, any>;
  display: "fullchart" | "bottom";
  class: typeof VolumeChart | typeof MarketIndicator;
}

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

  private resizeObserver!: ResizeObserver;

  private chart: CandlestickChart | null = null;

  private padding = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };

  @property({ type: Object })
  options: ChartOptions = {
    candleWidth: 7,
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
  private readonly RESIZE_DEBOUNCE_MS = 100;

  @state()
  private priceAxisWidth = PRICEAXIS_WIDTH;

  private readonly DOUBLE_TAP_DELAY = 300; // milliseconds

  @property({ type: Boolean, reflect: true, attribute: "require-activation" })
  requireActivation = false;

  @state()
  private isActive = false;

  @state()
  private indicators: Map<string, IndicatorState> = new Map();

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
    const chartContainer = this.renderRoot.querySelector(".chart");
    if (chartContainer) {
      // Get the computed style to check if we have a fixed height
      const computedStyle = getComputedStyle(chartContainer);
      const height = parseFloat(computedStyle.height);
      const width = parseFloat(computedStyle.width);

      // Initial resize with the computed dimensions
      if (height > 0 && width > 0) {
        this.handleResize(width, height);
      }

      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;

          // Cancel any pending animation frame
          if (this.resizeAnimationFrame) {
            cancelAnimationFrame(this.resizeAnimationFrame);
          }

          // Clear any pending timeout
          if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
          }

          // Set a new timeout for debouncing
          this.resizeTimeout = window.setTimeout(() => {
            this.resizeAnimationFrame = requestAnimationFrame(() => {
              this.handleResize(width, height);
            });
          }, this.RESIZE_DEBOUNCE_MS);
        }
      });
      this.resizeObserver.observe(chartContainer);
    }

    const chartElement = this.renderRoot.querySelector("candlestick-chart");
    this.chart = chartElement as CandlestickChart;

    if (chartElement) {
      document.addEventListener(
        "fullscreenchange",
        this.handleFullscreenChange
      );

      // Add click outside listener
      document.addEventListener("click", this.handleClickOutside);
      document.addEventListener("touchstart", this.handleClickOutside);
    }

    // Forward chart-ready and chart-pan events from the candlestick chart
    if (this.chart) {
      this.chart.addEventListener("chart-ready", (e: Event) => {
        this.dispatchEvent(
          new CustomEvent("chart-ready", {
            detail: (e as CustomEvent).detail,
            bubbles: true,
            composed: true,
          })
        );
      });
    }

    window.addEventListener("spotcanvas-upgrade", this.handleUpgrade);

    this.setupFocusHandler();

    // Add event listeners for toolbar actions
    this.addEventListener("toggle-fullscreen", this.handleFullScreenToggle);
    this.addEventListener("toggle-fullwindow", this.toggleFullWindow);
    this.addEventListener(
      "toggle-indicator",
      this.toggleIndicator as EventListener
    );

    // Initialize mobile state and add listener
    this.handleMobileChange();
    this.mobileMediaQuery.addEventListener("change", () =>
      this.handleMobileChange()
    );

    if (this.chart) {
      this.interactionController = new ChartInteractionController({
        chart: this.chart,
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
        onActivate: () => {
          if (this.requireActivation && !this.isActive) {
            this.isActive = true;
            if (this.isMobile) {
              this.toggleFullWindow();
            }
          }
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
      this.interactionController.attach();
    }
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
    if (changedProperties.has("requireActivation")) {
      // Only set isActive to true if requireActivation is explicitly false
      if (this.requireActivation === false) {
        this.isActive = true;
      } else {
        this.isActive = false;
      }
    }
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
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver?.disconnect();
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
      this.toggleIndicator as EventListener
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

  public toggleIndicator(e: CustomEvent) {
    const indicator: IndicatorState = e.detail;
    const newIndicators = new Map(this.indicators);

    if (indicator.visible) {
      newIndicators.set(indicator.id, indicator);
    } else {
      newIndicators.delete(indicator.id);
    }
    this.indicators = newIndicators;
    requestAnimationFrame(() => {
      this.draw();
    });
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

    const bottomIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === "bottom"
    );
    const overlayIndicators = Array.from(this.indicators.values()).filter(
      (indicator) => indicator.display === "fullchart"
    );

    return html`
      <div
        class="container ${this.isFullscreen ? "fullscreen" : ""} ${this
          .isFullWindow
          ? "full-window"
          : ""}"
        style="--price-axis-width: ${this.priceAxisWidth}px;"
      >
        <div class="price-info">
          <price-info
            .product=${this._state.liveCandle?.productId}
            .symbols=${this.products}
            .isFullscreen=${this.isFullscreen}
            .isFullWindow=${this.isFullWindow}
            .showVolume=${this.isIndicatorVisible("volume")}
            .container=${this}
            @toggle-fullscreen=${this.handleFullScreenToggle}
            @toggle-fullwindow=${this.toggleFullWindow}
            @toggle-indicator=${this.toggleIndicator}
            @upgrade-click=${this.dispatchUpgrade}
          ></price-info>
        </div>
        <div class="chart-area">
          <div class="chart">
            <indicator-container class="overlay-indicators">
              ${overlayIndicators.map(
                (indicator) =>
                  html`
                    <indicator-container
                      data-indicator=${indicator.id}
                      class="overlay-indicators"
                    >
                      ${new indicator.class()}
                    </indicator-container>
                  `
              )}
              <market-indicator></market-indicator>
            </indicator-container>
            <candlestick-chart
              class="${this.isActive ? "active" : ""}"
            ></candlestick-chart>
            ${this.requireActivation
              ? html`<div
                  class="activate-label ${this.isActive ? "hidden" : ""}"
                  @click=${() => {
                    this.isActive = true;
                    if (this.isMobile) {
                      this.toggleFullWindow();
                    }
                  }}
                >
                  Click to activate
                </div>`
              : ""}
          </div>
          ${bottomIndicators.map(
            (indicator) =>
              html`
                <indicator-container
                  data-indicator=${indicator.id}
                  class="bottom-indicators"
                >
                  ${new indicator.class()}
                </indicator-container>
              `
          )}
          <live-decorators></live-decorators>
          ${!this.isTouchOnly && this.isActive
            ? html`<chart-crosshairs></chart-crosshairs>`
            : ""}
          <div class="price-axis-container">
            <price-axis></price-axis>
          </div>
          <div class="timeline-container">
            <chart-timeline></chart-timeline>
          </div>
          <chart-logo></chart-logo>
        </div>
        <chart-context-menu
          .show=${this.showContextMenu}
          .position=${this.contextMenuPosition}
          .items=${menuItems}
        ></chart-context-menu>
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
      console.warn(
        "ChartContainer: No canvas found, returning default options"
      );
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
      console.error("Error attempting to toggle fullscreen:", err);
    }
  };

  private handleFullscreenChange = () => {
    if (this.isMobile) return; // Don't handle fullscreen on mobile
    this.isFullscreen = document.fullscreenElement === this;
    if (!this.isFullscreen) {
      this.handleResize(this.clientWidth, this.clientHeight);
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
    // Force a resize after the class change
    requestAnimationFrame(() => {
      this.handleResize(this.clientWidth, this.clientHeight);
    });
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: var(--spotcanvas-chart-height, 600px);
      min-height: 400px;
    }

    :host(:fullscreen),
    :host(.full-window) {
      background: var(--color-primary-dark);
      padding: 16px;
      box-sizing: border-box;
      height: 100vh;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 1000;
    }

    :host(:fullscreen) .container,
    :host(.full-window) .container {
      height: 100%;
      overflow: hidden;
    }

    .container {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background-color: var(--color-primary-dark);
      gap: 8px;
      padding: 0 16px;
      box-sizing: border-box;
      position: relative;
      overflow: hidden;
      z-index: 1;
      isolation: isolate;
    }

    .chart-area {
      flex: 1;
      position: relative;
      background: var(--color-primary-dark);
      overflow: hidden;
      pointer-events: auto;
      border-radius: 12px;
      margin: 0;
      border: 1px solid rgba(143, 143, 143, 0.2);
      height: calc(100% - 120px);
      transition: box-shadow 0.2s ease-in-out;
      z-index: 1;
    }

    .chart-area:has(candlestick-chart.active) {
      box-shadow: 0 4px 12px
        color-mix(in srgb, var(--color-accent-1) 30%, transparent);
    }

    :host(:fullscreen) .chart-area,
    :host(.full-window) .chart-area {
      height: calc(100vh - 200px);
    }

    .container.fullscreen,
    .container.full-window {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      padding: 16px;
    }

    .container.fullscreen .chart-area,
    .container.full-window .chart-area {
      height: calc(100vh - 120px);
    }

    .price-info {
      flex: 0 0 auto;
      background: var(--color-primary-dark);
      border-radius: 12px;
      margin: 8px 0;
      padding: 12px 16px;
      border: 1px solid rgba(143, 143, 143, 0.2);
      position: relative;
      z-index: 8;
    }

    .chart {
      position: relative;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: calc(100% - ${TIMELINE_HEIGHT}px);
      pointer-events: auto;
      z-index: 1;
    }

    .activate-label {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      backdrop-filter: blur(8px);
      background: transparent;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 1.5em;
      font-weight: 600;
      color: var(--color-accent-2);
      z-index: 10;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s ease-in-out;
      pointer-events: auto;
    }

    .activate-label:hover {
      opacity: 1;
    }

    .activate-label.hidden {
      display: none;
    }

    .volume-chart {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT}px;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: 25%;
      pointer-events: none;
      z-index: 2;
      background: none;
    }

    volume-chart {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      background: none;
    }

    .price-axis-container,
    .timeline-container {
      position: absolute;
      background: var(--color-primary-dark);
      z-index: 4;
    }

    .price-axis-container {
      right: 0;
      top: 0;
      width: var(--price-axis-width, ${PRICEAXIS_WIDTH}px);
      height: calc(100% - ${TIMELINE_HEIGHT}px);
    }

    :host(:fullscreen) .price-axis-container,
    :host(.full-window) .price-axis-container {
      height: calc(100% - ${TIMELINE_HEIGHT}px);
    }

    chart-timeline {
      display: block;
      width: 100%;
      height: 100%;
      pointer-events: auto;
    }

    .timeline-container {
      bottom: 0;
      left: 0px;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: ${TIMELINE_HEIGHT}px;
      pointer-events: auto;
    }

    candlestick-chart {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: calc(100% - ${TIMELINE_HEIGHT}px);
      pointer-events: auto;
      z-index: 2;
      cursor: default;
    }

    candlestick-chart.active {
      cursor: crosshair;
    }

    candlestick-chart.active:active {
      cursor: grabbing;
    }

    live-decorators {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: calc(100% - ${TIMELINE_HEIGHT}px);
      pointer-events: none;
      z-index: 6;
    }

    chart-crosshairs {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      pointer-events: none;
      cursor: crosshair;
    }

    chart-crosshairs > * {
      pointer-events: all;
    }

    price-axis {
      display: block;
      width: 100%;
      height: 100%;
    }

    chart-logo {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT + 8}px;
      z-index: 7;
    }

    indicator-container {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT}px;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: 25%;
      pointer-events: none;
      z-index: 2;
      background: none;
    }

    indicator-container[hidden] {
      display: none;
    }

    .overlay-indicators {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: 100%;
      pointer-events: none;
      z-index: 3;
    }

    .bottom-indicators {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT}px;
      left: 0;
      width: calc(100% - var(--price-axis-width, ${PRICEAXIS_WIDTH}px));
      height: 25%;
      pointer-events: none;
      z-index: 3;
      background: none;
    }

    indicator-container[hidden] {
      display: none;
    }
  `;

  static get properties() {
    return {
      requireActivation: { type: Boolean, attribute: "require-activation" },
    };
  }
}
