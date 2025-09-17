import {  ChartState } from "../../..";
import {  getCandleInterval } getDpr } from "../../../util/chart-util";
import {  PriceRangeImpl } from "../../../util/price-range";
import {  CandlestickChart } from "../chart";
import {  getLogger, LogLevel } from "../../../util/logger";

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
  private lastTouchDistanceX = 0;
  private lastTouchDistanceY = 0;
  private isZooming = false;
  private readonly ZOOM_FACTOR: number;
  private readonly BUFFER_MULTIPLIER: number;

  private readonly options: ChartInteractionOptions;
  private eventTarget: HTMLElement;

  constructor(options: ChartInteractionOptions) {
    this.options = options;
    this.ZOOM_FACTOR = options.zoomFactor ?? 0.005;
    this.BUFFER_MULTIPLIER = options.bufferMultiplier ?? 1;
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

  private dragStartX = 0;
  private dragStartY = 0;
  private dragThreshold = 5; // pixels - minimum movement to consider it a drag

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    // Check if we've moved enough to consider this a drag
    const totalMovement = Math.sqrt(
      Math.pow(e.clientX - this.dragStartX, 2) +
      Math.pow(e.clientY - this.dragStartY, 2)
    );

    // Only pan if we've moved beyond the threshold
    if (totalMovement > this.dragThreshold) {
      this.handlePan(deltaX);
      this.handleVerticalPan(deltaY);
    }

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragEnd = (e: MouseEvent) => {
    // Check if this was a click (minimal movement)
    const totalMovement = Math.sqrt(
      Math.pow(e.clientX - this.dragStartX, 2) +
      Math.pow(e.clientY - this.dragStartY, 2)
    );

    if (totalMovement <= this.dragThreshold) {
      // This was a click, not a drag - let it propagate
      // Don't prevent default or stop propagation
    }

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

    // For mouse drag: dragging left (negative deltaX) should move backward in time
    // For trackpad: horizontal scroll right (positive deltaX) should move forward in time
    const adjustedDelta = isTrackpad ? -deltaX : -deltaX;
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

    // Use the container height (where mouse events are captured)
    // This matches the actual draggable area
    const containerHeight = this.eventTarget?.clientHeight ?? 0;
    if (containerHeight === 0) {
      logger.error("Container height is 0");
      return;
    }

    const pricePerPixel = state.priceRange.range / containerHeight;

    const sensitivity = 1.5;
    // Fix the direction: dragging down (positive deltaY) should show lower prices (negative shift)
    // For trackpad, the direction is already inverted in the browser
    const adjustedDelta = (isTrackpad ? -deltaY : -deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    // Dispatch event for price-axis to update immediately
    this.eventTarget.dispatchEvent(
      new CustomEvent("price-axis-pan", {
        detail: {
          priceShift,
          newPriceRange: {
            min: state.priceRange.min + priceShift,
            max: state.priceRange.max + priceShift
          }
        },
        bubbles: true,
        composed: true,
      })
    );

    state.priceRange.shift(priceShift);
    this.options.onStateChange({ priceRange: state.priceRange });
  }

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();

    this.isDragging = true;

    if (e.touches.length === 2) {
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      // Store separate X and Y distances for directional zoom detection
      this.lastTouchDistanceX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
      this.lastTouchDistanceY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
    } else if (e.touches.length === 1) {
      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    if (!this.isDragging) return;
    e.preventDefault();

    if (e.touches.length === 2 && this.isZooming) {
      const currentDistanceX = Math.abs(e.touches[0].clientX - e.touches[1].clientX);
      const currentDistanceY = Math.abs(e.touches[0].clientY - e.touches[1].clientY);
      
      const deltaDistanceX = currentDistanceX - this.lastTouchDistanceX;
      const deltaDistanceY = currentDistanceY - this.lastTouchDistanceY;
      
      const zoomSensitivity = 0.5;
      
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      
      // Determine the dominant zoom direction based on the larger delta
      const isHorizontalZoom = Math.abs(deltaDistanceX) > Math.abs(deltaDistanceY);
      
      // Apply directional zoom based on pinch direction
      if (isHorizontalZoom && Math.abs(deltaDistanceX) > 1) {
        // Horizontal pinch - zoom timeline (X axis)
        const adjustedDeltaX = deltaDistanceX * zoomSensitivity;
        
        this.eventTarget.dispatchEvent(
          new CustomEvent("timeline-zoom", {
            detail: {
              deltaX: adjustedDeltaX,
              clientX: centerX,
              rect,
              isTrackpad: true,
            },
            bubbles: true,
            composed: true,
          })
        );
      } else if (!isHorizontalZoom && Math.abs(deltaDistanceY) > 1) {
        // Vertical pinch - zoom price axis (Y axis)
        const adjustedDeltaY = deltaDistanceY * zoomSensitivity;
        
        this.eventTarget.dispatchEvent(
          new CustomEvent("price-axis-zoom", {
            detail: {
              deltaY: adjustedDeltaY,
              clientY: centerY,
              rect,
              isTrackpad: true,
            },
            bubbles: true,
            composed: true,
          })
        );
      }
      
      this.lastTouchDistanceX = currentDistanceX;
      this.lastTouchDistanceY = currentDistanceY;
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

    // Constants from drawing-strategy.ts
    const FIXED_GAP_WIDTH = 6; // pixels
    const MIN_CANDLE_WIDTH = 5; // pixels
    const dpr = getDpr() ?? 1;
    
    const zoomMultiplier = isTrackpad ? 1 : 0.1;
    const timeRange = state.timeRange.end - state.timeRange.start;
    const zoomCenter = (clientX - rect.left) / rect.width;
    const timeAdjustment =
      timeRange * this.ZOOM_FACTOR * deltaX * zoomMultiplier;
    
    // Calculate the proposed new time range
    let proposedTimeRange = timeRange - timeAdjustment;
    
    // Calculate maximum time range to prevent candle overlap
    // Each candle needs MIN_CANDLE_WIDTH + FIXED_GAP_WIDTH pixels
    const canvasWidth = rect.width * dpr;
    const pixelsPerCandle = MIN_CANDLE_WIDTH + FIXED_GAP_WIDTH;
    const maxCandlesInViewport = Math.floor(canvasWidth / pixelsPerCandle);
    const candleInterval = getCandleInterval(state.granularity);
    const maxTimeRange = maxCandlesInViewport * candleInterval;
    
    // Enforce both minimum and maximum time range
    const minTimeRange = candleInterval * 10; // Keep original minimum
    const newTimeRange = Math.max(
      minTimeRange,
      Math.min(proposedTimeRange, maxTimeRange)
    );
    
    const rangeDifference = timeRange - newTimeRange;

    const newStart = state.timeRange.start + rangeDifference * zoomCenter;
    const newEnd = state.timeRange.end - rangeDifference * (1 - zoomCenter);

    if (newEnd - newStart < minTimeRange) {
      const center = (newStart + newEnd) / 2;
      const minHalfRange = minTimeRange / 2;
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
