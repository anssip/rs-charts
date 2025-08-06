import { ChartState } from "../../..";
import { getCandleInterval } from "../../../util/chart-util";
import { PriceRangeImpl } from "../../../util/price-range";
import { CandlestickChart } from "../chart";
import { getLogger, LogLevel } from "../../../util/logger";

const logger = getLogger('ChartInteractionController');
logger.setLoggerLevel('ChartInteractionController', LogLevel.ERROR);

interface ChartInteractionOptions {
  chart: CandlestickChart;
  container: HTMLElement;
  state: ChartState;
  onStateChange: (updates: Partial<ChartState>) => void;
  onNeedMoreData: (direction: "forward" | "backward") => void;
  onContextMenu?: (position: { x: number; y: number }) => void;
  bufferMultiplier?: number;
  zoomFactor?: number;
  onActivate?: () => void;
  onFullWindowToggle?: () => void;
  doubleTapDelay?: number;
  isActive?: () => boolean;
  requireActivation?: boolean;
  onDeactivate?: () => void;
}

export class ChartInteractionController {
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private lastTouchDistance = 0;
  private isZooming = false;
  private readonly ZOOM_FACTOR: number;
  private readonly BUFFER_MULTIPLIER: number;
  private readonly DOUBLE_TAP_DELAY: number;
  private lastTapTime = 0;

  private readonly options: ChartInteractionOptions;
  private eventTarget: HTMLElement;

  constructor(options: ChartInteractionOptions) {
    this.options = options;
    this.ZOOM_FACTOR = options.zoomFactor ?? 0.005;
    this.BUFFER_MULTIPLIER = options.bufferMultiplier ?? 1;
    this.DOUBLE_TAP_DELAY = options.doubleTapDelay ?? 300;
    this.eventTarget = options.container;
  }

  attach(force = false) {
    if (!this.eventTarget) {
      logger.error("Event target not found");
      return;
    }

    logger.debug(
      "Attaching chart interaction controller to:",
      this.eventTarget
    );

    // Always ensure we're properly detached first to avoid duplicate listeners
    this.detach();

    // Add event listeners
    logger.debug("Attaching full interaction handlers");

    // Mouse events
    this.eventTarget.addEventListener("mousedown", this.handleDragStart);
    this.eventTarget.addEventListener("mousemove", this.handleDragMove);
    this.eventTarget.addEventListener("mouseup", this.handleDragEnd);
    this.eventTarget.addEventListener("mouseleave", this.handleDragEnd);
    this.eventTarget.addEventListener("wheel", this.handleWheel, {
      passive: false,
    });

    // Touch events
    this.eventTarget.addEventListener("touchstart", this.handleTouchStart, {
      passive: false,
    });
    this.eventTarget.addEventListener("touchmove", this.handleTouchMove, {
      passive: false,
    });
    this.eventTarget.addEventListener("touchend", this.handleTouchEnd);
    this.eventTarget.addEventListener("touchcancel", this.handleTouchEnd);

    // Add timeline and price axis zoom listeners on the chart container
    this.eventTarget.addEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );
    this.eventTarget.addEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener
    );
    this.eventTarget.addEventListener(
      "contextmenu",
      this.handleContextMenu as EventListener
    );
  }

  detach() {
    if (!this.eventTarget) return;

    this.eventTarget.removeEventListener("mousedown", this.handleDragStart);
    this.eventTarget.removeEventListener("mousemove", this.handleDragMove);
    this.eventTarget.removeEventListener("mouseup", this.handleDragEnd);
    this.eventTarget.removeEventListener("mouseleave", this.handleDragEnd);
    this.eventTarget.removeEventListener("wheel", this.handleWheel);

    this.eventTarget.removeEventListener("touchstart", this.handleTouchStart);
    this.eventTarget.removeEventListener("touchmove", this.handleTouchMove);
    this.eventTarget.removeEventListener("touchend", this.handleTouchEnd);
    this.eventTarget.removeEventListener("touchcancel", this.handleTouchEnd);

    this.eventTarget.removeEventListener(
      "contextmenu",
      this.handleContextMenu as EventListener
    );
    this.eventTarget.removeEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener
    );
    this.eventTarget.removeEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener
    );
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
    const { state } = this.options;
    if (!state.timeRange) {
      logger.error("Time range not found");
      return;
    }

    const timeRange = state.timeRange.end - state.timeRange.start;
    const viewportWidth = this.eventTarget?.clientWidth ?? 0;
    const timePerPixel = timeRange / viewportWidth;

    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    const newStart = state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    this.options.onStateChange({
      timeRange: { start: newStart, end: newEnd },
    });

    this.checkNeedMoreData(newStart, newEnd, timeRange);
  }

  private checkNeedMoreData(
    newStart: number,
    newEnd: number,
    visibleTimeRange: number
  ) {
    const { state } = this.options;
    const bufferZone = visibleTimeRange * this.BUFFER_MULTIPLIER;

    const now = Date.now();
    if (newEnd > now) {
      return;
    }

    const needMoreDataBackward =
      newStart < Number(state.priceHistory.startTimestamp) + bufferZone;
    const needMoreDataForward =
      newEnd > Number(state.priceHistory.endTimestamp) - bufferZone;

    if (needMoreDataBackward) {
      this.options.onNeedMoreData("backward");
    } else if (needMoreDataForward && newEnd <= now) {
      this.options.onNeedMoreData("forward");
    }
  }

  private handleVerticalPan(deltaY: number, isTrackpad = false) {
    const { state } = this.options;
    if (!state.priceRange) {
      logger.error("Price range not found");
      return;
    }

    const availableHeight = this.eventTarget?.clientHeight ?? 0;
    const pricePerPixel = state.priceRange.range / availableHeight;

    const sensitivity = 1.5;
    const adjustedDelta = (isTrackpad ? -deltaY : deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    state.priceRange.shift(priceShift);
    this.options.onStateChange({ priceRange: state.priceRange });
  }

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();

    const currentTime = new Date().getTime();
    const tapLength = currentTime - this.lastTapTime;
    if (tapLength < this.DOUBLE_TAP_DELAY && tapLength > 0) {
      this.options.onFullWindowToggle?.();
      return;
    }
    this.lastTapTime = currentTime;

    this.isDragging = true;

    if (e.touches.length === 2) {
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.isDragging) return;
    e.preventDefault();

    if (e.touches.length === 2 && this.isZooming) {
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const deltaDistance = currentDistance - this.lastTouchDistance;
      const zoomSensitivity = 0.5;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();

      const adjustedDelta = deltaDistance * zoomSensitivity;

      this.eventTarget.dispatchEvent(
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

  public panTimeline(movementSeconds: number, durationSeconds: number = 1) {
    const { state } = this.options;
    if (!state.timeRange) {
      logger.error("Time range not found");
      return;
    }

    const durationMs = durationSeconds * 1000;
    const FRAMES_PER_SECOND = 60;
    const totalFrames = (durationMs / 1000) * FRAMES_PER_SECOND;
    let currentFrame = 0;

    const startRange = { ...state.timeRange };
    const candleInterval = getCandleInterval(state.granularity);
    const numCandles = Math.abs(movementSeconds / (candleInterval / 1000));
    const movementMs = numCandles * candleInterval;
    const targetRange = {
      start:
        startRange.start - (movementSeconds > 0 ? movementMs : -movementMs),
      end: startRange.end - (movementSeconds > 0 ? movementMs : -movementMs),
    };

    const animate = () => {
      currentFrame++;
      const progress = currentFrame / totalFrames;
      const easeProgress = this.easeInOutCubic(progress);

      const newTimeRange = {
        start:
          startRange.start +
          (targetRange.start - startRange.start) * easeProgress,
        end: startRange.end + (targetRange.end - startRange.end) * easeProgress,
      };

      this.options.onStateChange({ timeRange: newTimeRange });

      if (currentFrame < totalFrames) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  private easeInOutCubic(x: number): number {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  handleTimelineZoom = (event: CustomEvent) => {
    logger.debug("Received timeline-zoom event", {
      deltaX: event.detail.deltaX,
      target: event.target,
      currentTarget: event.currentTarget
    });
    const { deltaX, clientX, rect, isTrackpad } = event.detail;
    const { state } = this.options;

    const zoomMultiplier = isTrackpad ? 1 : 0.1;
    const timeRange = state.timeRange.end - state.timeRange.start;
    const zoomCenter = (clientX - rect.left) / rect.width;
    const timeAdjustment =
      timeRange * this.ZOOM_FACTOR * deltaX * zoomMultiplier;
    const newTimeRange = Math.max(
      timeRange - timeAdjustment,
      getCandleInterval(state.granularity) * 10
    );
    const rangeDifference = timeRange - newTimeRange;

    const newStart = state.timeRange.start + rangeDifference * zoomCenter;
    const newEnd = state.timeRange.end - rangeDifference * (1 - zoomCenter);

    if (newEnd - newStart < getCandleInterval(state.granularity) * 10) {
      const center = (newStart + newEnd) / 2;
      const minHalfRange = getCandleInterval(state.granularity) * 5;
      this.options.onStateChange({
        timeRange: {
          start: center - minHalfRange,
          end: center + minHalfRange,
        },
      });
    } else {
      this.options.onStateChange({
        timeRange: { start: newStart, end: newEnd },
      });
    }

    const bufferTimeRange = newTimeRange * this.BUFFER_MULTIPLIER;
    const needMoreData =
      state.timeRange.start <
        state.priceHistory.startTimestamp + bufferTimeRange ||
      state.timeRange.end > state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.options.onNeedMoreData(deltaX > 0 ? "backward" : "forward");
    }
  };

  private handlePriceAxisZoom = (event: CustomEvent) => {
    logger.debug("Received price-axis-zoom event", {
      deltaY: event.detail.deltaY,
      target: event.target,
      currentTarget: event.currentTarget
    });
    const { deltaY, isTrackpad } = event.detail;
    const { state } = this.options;
    const zoomCenter = 0.5;
    const zoomMultiplier = isTrackpad ? 0.5 : 0.1;
    (state.priceRange as PriceRangeImpl).adjust(
      deltaY * zoomMultiplier,
      zoomCenter
    );
    this.options.onStateChange({ priceRange: state.priceRange });
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    if (this.options.onContextMenu) {
      this.options.onContextMenu({ x: e.clientX, y: e.clientY });
    }
  };
}
