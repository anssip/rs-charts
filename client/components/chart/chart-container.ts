import { LitElement, html, css } from "lit";
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
import "./volume-chart";
import { CandlestickChart, ChartOptions } from "./chart";
import { DrawingContext } from "./drawing-strategy";
import { PriceRangeImpl } from "../../util/price-range";
import { LiveCandle } from "../../api/live-candle-subscription";
import { ChartState } from "../..";
import { getCandleInterval, priceToY, timeToX } from "../../util/chart-util";
import { touch } from "xinjs";
import { CoinbaseProduct } from "../../api/firestore-client";
import "./logo";

// We store data 5 times the visible range to allow for zooming and panning without fetching more data
const BUFFER_MULTIPLIER = 1;
export const TIMELINE_HEIGHT = 40;
export const PRICEAXIS_WIDTH = 70;

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

  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver!: ResizeObserver;
  private lastTouchDistance = 0;
  private isZooming = false;

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

  constructor() {
    super();
    // Check if device is touch-only (no mouse/trackpad)
    this.isTouchOnly = window.matchMedia(
      "(hover: none) and (pointer: coarse)"
    ).matches;
  }

  set startTimestamp(startTimestamp: number) {
    this._state.timeRange.start = startTimestamp;
  }

  set endTimestamp(endTimestamp: number) {
    this._state.timeRange.end = endTimestamp;
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
          this.handleResize(width, height);
        }
      });
      this.resizeObserver.observe(chartContainer);
    }

    const chartElement = this.renderRoot.querySelector("candlestick-chart");
    this.chart = chartElement as CandlestickChart;

    if (chartElement) {
      // Mouse events
      chartElement.addEventListener(
        "mousedown",
        this.handleDragStart as EventListener
      );
      chartElement.addEventListener(
        "mousemove",
        this.handleDragMove as EventListener
      );
      chartElement.addEventListener(
        "mouseup",
        this.handleDragEnd as EventListener
      );
      chartElement.addEventListener(
        "mouseleave",
        this.handleDragEnd as EventListener
      );
      chartElement.addEventListener("wheel", this.handleWheel as EventListener);
      chartElement.addEventListener(
        "dblclick",
        this.handleDoubleClick as EventListener
      );
      chartElement.addEventListener(
        "contextmenu",
        this.handleContextMenu as EventListener
      );

      // Touch events
      chartElement.addEventListener(
        "touchstart",
        this.handleTouchStart as EventListener
      );
      chartElement.addEventListener(
        "touchmove",
        this.handleTouchMove as EventListener
      );
      chartElement.addEventListener(
        "touchend",
        this.handleTouchEnd as EventListener
      );
      chartElement.addEventListener(
        "touchcancel",
        this.handleTouchEnd as EventListener
      );
      document.addEventListener(
        "fullscreenchange",
        this.handleFullscreenChange
      );
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

    window.addEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );

    window.addEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener
    );

    this.setupFocusHandler();
  }

  protected updated(changedProperties: Map<string, unknown>) {
    super.updated(changedProperties);
    this.draw();
  }

  draw() {
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
    window.removeEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );
    window.removeEventListener("focus", this.handleWindowFocus);
    document.removeEventListener(
      "fullscreenchange",
      this.handleFullscreenChange
    );
  }

  @property({ type: Object })
  set state(state: ChartState) {
    this._state = state;
  }

  render() {
    return html`
      <div
        class="container ${this.isFullscreen ? "fullscreen" : ""} ${this
          .isFullWindow
          ? "full-window"
          : ""}"
      >
        <div class="price-info">
          <price-info
            .product=${this._state.liveCandle?.productId}
            .symbols=${this.products}
          ></price-info>
        </div>
        <div class="chart-area">
          <div class="chart">
            <candlestick-chart></candlestick-chart>
          </div>
          <div class="volume-chart">
            <volume-chart></volume-chart>
          </div>

          <live-decorators></live-decorators>
          ${!this.isTouchOnly
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

        ${this.showContextMenu
          ? html`
              <div
                class="context-menu"
                style="left: ${this.contextMenuPosition.x}px; top: ${this
                  .contextMenuPosition.y}px"
              >
                <div class="menu-item" @click=${this.toggleFullWindow}>
                  ${this.isFullWindow ? "Exit Full Window" : "Full Window"}
                </div>
              </div>
            `
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

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    this.handlePan(deltaX);
    this.handleVerticalPan(deltaY);

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;

    this.handlePan(e.deltaX, isTrackpad);
    this.handleVerticalPan(e.deltaY, isTrackpad);
  };

  private handlePan(deltaX: number, isTrackpad = false) {
    if (!this.chart) return;

    const timeRange = this._state.timeRange.end - this._state.timeRange.start;

    const viewportWidth =
      this.chart.canvas!.width / (window.devicePixelRatio ?? 1);
    const timePerPixel = timeRange / viewportWidth;

    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    const newStart = this._state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    this._state.timeRange = { start: newStart, end: newEnd };
    this.draw();

    const visibleTimeRange = timeRange;
    const bufferZone = visibleTimeRange * BUFFER_MULTIPLIER;

    const direction = timeShift > 0 ? "backward" : "forward";
    const needMoreData =
      (direction === "backward" &&
        newStart <
          Number(this._state.priceHistory.startTimestamp) + bufferZone) ||
      (direction === "forward" &&
        newEnd > Number(this._state.priceHistory.endTimestamp) - bufferZone);

    if (needMoreData) {
      this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
    }
  }

  private handleVerticalPan(deltaY: number, isTrackpad = false) {
    if (!this.chart || !this._state.priceRange) return;

    const availableHeight =
      this.chart.canvas!.height / (window.devicePixelRatio ?? 1);
    const pricePerPixel = this._state.priceRange.range / availableHeight;

    const sensitivity = 1.5;
    const adjustedDelta = (isTrackpad ? -deltaY : deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    this._state.priceRange.shift(priceShift);
    touch("state.priceRange"); // trigger observers as shift() call does not cause it to happen

    this.draw();
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

  private handleTimelineZoom = (event: CustomEvent) => {
    const { deltaX, clientX, rect, isTrackpad } = event.detail;

    const zoomMultiplier = isTrackpad ? 1 : 0.1;
    const timeRange = this._state.timeRange.end - this._state.timeRange.start;
    const zoomCenter = (clientX - rect.left) / rect.width;
    const timeAdjustment =
      timeRange * this.ZOOM_FACTOR * deltaX * zoomMultiplier;
    const newTimeRange = Math.max(
      timeRange - timeAdjustment,
      getCandleInterval(this._state.granularity) * 10
    );
    const rangeDifference = timeRange - newTimeRange;

    const newStart = this._state.timeRange.start + rangeDifference * zoomCenter;
    const newEnd =
      this._state.timeRange.end - rangeDifference * (1 - zoomCenter);

    if (newEnd - newStart < getCandleInterval(this._state.granularity) * 10) {
      const center = (newStart + newEnd) / 2;
      const minHalfRange = getCandleInterval(this._state.granularity) * 5;
      this._state.timeRange = {
        start: center - minHalfRange,
        end: center + minHalfRange,
      };
    } else {
      this._state.timeRange = { start: newStart, end: newEnd };
    }

    this.draw();

    // Check if we need more data
    const bufferTimeRange = newTimeRange * BUFFER_MULTIPLIER;
    const needMoreData =
      this._state.timeRange.start <
        this._state.priceHistory.startTimestamp + bufferTimeRange ||
      this._state.timeRange.end >
        this._state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.dispatchRefetch(deltaX > 0 ? "backward" : "forward");
    }
  };

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

  private handlePriceAxisZoom = (event: CustomEvent) => {
    const { deltaY, isTrackpad } = event.detail;
    const zoomCenter = 0.5; // Always zoom from the center
    const zoomMultiplier = isTrackpad ? 0.5 : 0.1;
    (this._state.priceRange as PriceRangeImpl).adjust(
      deltaY * zoomMultiplier,
      zoomCenter
    );
    touch("state.priceRange");
    this.draw();
  };

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

  // TODO: This kind of stuff should be moved to a public API
  public panTimeline(movementSeconds: number, durationSeconds: number = 1) {
    if (!this.chart) return;

    const durationMs = durationSeconds * 1000;
    const FRAMES_PER_SECOND = 60;
    const totalFrames = (durationMs / 1000) * FRAMES_PER_SECOND;
    let currentFrame = 0;

    const startRange = { ...this._state.timeRange };
    const candleInterval = getCandleInterval(this._state.granularity);
    const numCandles = Math.abs(movementSeconds / (candleInterval / 1000)); // Convert movement to number of candles
    const movementMs = numCandles * candleInterval; // Total movement in ms based on candle intervals
    const targetRange = {
      start:
        startRange.start - (movementSeconds > 0 ? movementMs : -movementMs),
      end: startRange.end - (movementSeconds > 0 ? movementMs : -movementMs),
    };

    const animate = () => {
      currentFrame++;
      const progress = currentFrame / totalFrames;
      const easeProgress = this.easeInOutCubic(progress);

      // Interpolate between start and target ranges
      const newTimeRange = {
        start:
          startRange.start +
          (targetRange.start - startRange.start) * easeProgress,
        end: startRange.end + (targetRange.end - startRange.end) * easeProgress,
      };

      this._state.timeRange = newTimeRange;

      touch("state.timeRange");
      // TODO: Make the drawingStrategy listen to state.timeRange
      this.draw();

      if (currentFrame < totalFrames) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  // Cubic easing function for smooth animation
  private easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  private setupFocusHandler() {
    window.addEventListener("focus", this.handleWindowFocus);
    document.addEventListener(
      "visibilitychange",
      this.handleVisibilityChange.bind(this)
    );
  }

  private handleWindowFocus = () => {
    this.draw();
  };

  private handleVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      this.draw();
    }
  }

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault(); // Prevent scrolling while touching the chart
    this.isDragging = true;

    if (e.touches.length === 2) {
      // Initialize pinch-to-zoom
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      // Single touch for panning
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.isDragging) return;

    if (e.touches.length === 2 && this.isZooming) {
      // Handle pinch-to-zoom
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const deltaDistance = currentDistance - this.lastTouchDistance;
      const zoomSensitivity = 0.5;

      // Use the midpoint of the two touches as the zoom center
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();

      // Apply zoom sensitivity to the delta and invert for natural pinch behavior
      const adjustedDelta = deltaDistance * zoomSensitivity;

      // Dispatch zoom event similar to mouse wheel zoom
      this.dispatchEvent(
        new CustomEvent("timeline-zoom", {
          detail: {
            deltaX: adjustedDelta,
            clientX: centerX,
            rect,
            isTrackpad: true,
          },
          bubbles: true,
          composed: true,
        })
      );

      this.lastTouchDistance = currentDistance;
    } else if (e.touches.length === 1) {
      // Handle panning
      const deltaX = e.touches[0].clientX - this.lastX;
      const deltaY = e.touches[0].clientY - this.lastY;

      this.handlePan(deltaX);
      this.handleVerticalPan(deltaY);

      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchEnd = () => {
    this.isDragging = false;
    this.isZooming = false;
  };

  private handleDoubleClick = async () => {
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
    this.isFullscreen = document.fullscreenElement === this;
    if (!this.isFullscreen) {
      this.handleResize(this.clientWidth, this.clientHeight);
    }
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.contextMenuPosition = { x: e.clientX, y: e.clientY };
    this.showContextMenu = true;

    // Add one-time click listener to close menu when clicking outside
    setTimeout(() => {
      document.addEventListener(
        "click",
        () => {
          this.showContextMenu = false;
        },
        { once: true }
      );
    }, 0);
  };

  private toggleFullWindow = () => {
    this.isFullWindow = !this.isFullWindow;
    this.showContextMenu = false;
    if (this.isFullWindow) {
      this.classList.add("full-window");
    } else {
      this.classList.remove("full-window");
    }
    this.handleResize(this.clientWidth, this.clientHeight);
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    :host(:fullscreen),
    :host(.full-window) {
      background: var(--color-primary-dark);
      padding: 16px;
      box-sizing: border-box;
      --spotcanvas-chart-height: 100%;
    }

    :host(:fullscreen) .container,
    :host(.full-window) .container {
      height: 100%;
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

    .toolbar-top {
      position: absolute;
      top: 8px;
      left: 8px;
      z-index: 7;
      background: transparent;
      width: fit-content;
    }

    .price-info {
      flex: 0 0 auto;
      background: var(--color-primary-dark);
      border-radius: 12px;
      margin: 8px 0;
      padding: 12px 16px;
      border: 1px solid rgba(143, 143, 143, 0.2);
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
    }

    .chart {
      position: relative;
      width: calc(100% - ${PRICEAXIS_WIDTH}px);
      height: var(--spotcanvas-chart-height, calc(100% - ${TIMELINE_HEIGHT}px));
      pointer-events: auto;
    }

    .volume-chart {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT}px;
      left: 0;
      width: calc(100% - ${PRICEAXIS_WIDTH}px);
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
      width: ${PRICEAXIS_WIDTH}px;
      height: var(--spotcanvas-chart-height, 100%);
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
      width: calc(100% - ${PRICEAXIS_WIDTH}px);
      height: ${TIMELINE_HEIGHT}px;
      pointer-events: auto;
    }

    candlestick-chart {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - ${PRICEAXIS_WIDTH}px);
      height: var(--spotcanvas-chart-height, calc(100% - ${TIMELINE_HEIGHT}px));
      pointer-events: auto;
      z-index: 1;
      cursor: crosshair;
    }

    candlestick-chart:active {
      cursor: grabbing;
    }

    live-decorators {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - ${PRICEAXIS_WIDTH}px);
      height: var(--spotcanvas-chart-height, calc(100% - ${TIMELINE_HEIGHT}px));
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
    }

    chart-crosshairs > * {
      pointer-events: all;
    }

    price-axis {
      display: block;
      width: 100%;
      height: var(--spotcanvas-chart-height, calc(100% - ${TIMELINE_HEIGHT}px));
    }

    chart-logo {
      position: absolute;
      bottom: ${TIMELINE_HEIGHT + 8}px;
      left: 8px;
      z-index: 7;
    }

    .context-menu {
      position: fixed;
      background: var(--color-primary-dark);
      border: 1px solid rgba(143, 143, 143, 0.2);
      border-radius: 4px;
      padding: 4px 0;
      min-width: 150px;
      z-index: 1001;
    }

    .menu-item {
      padding: 8px 16px;
      cursor: pointer;
      color: var(--color-text-primary);
      font-size: 14px;
    }

    .menu-item:hover {
      background: rgba(143, 143, 143, 0.1);
    }
  `;
}
