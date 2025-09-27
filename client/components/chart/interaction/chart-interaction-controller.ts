import { ChartState } from "../../..";
import { getCandleInterval, getDpr } from "../../../util/chart-util";
import { PriceRangeImpl } from "../../../util/price-range";
import { CandlestickChart } from "../chart";
import { getLogger, LogLevel } from "../../../util/logger";
import { DragGesture, WheelGesture, PinchGesture } from "@use-gesture/vanilla";

const logger = getLogger("ChartInteractionController");
logger.setLoggerLevel("ChartInteractionController", LogLevel.ERROR);

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
  private readonly ZOOM_FACTOR: number;
  private readonly BUFFER_MULTIPLIER: number;
  private wheelInteractionTimeout: number | null = null;

  private readonly options: ChartInteractionOptions;
  private eventTarget: HTMLElement;

  // Gesture instances
  private dragGesture: DragGesture | null = null;
  private wheelGesture: WheelGesture | null = null;
  private pinchGesture: PinchGesture | null = null;

  constructor(options: ChartInteractionOptions) {
    this.options = options;
    this.ZOOM_FACTOR = options.zoomFactor ?? 0.005;
    this.BUFFER_MULTIPLIER = options.bufferMultiplier ?? 1.5;
    this.eventTarget = options.container;
  }

  attach(force = false) {
    if (!this.eventTarget) {
      logger.error("Event target not found");
      return;
    }

    logger.debug(
      "Attaching chart interaction controller to:",
      this.eventTarget,
    );

    // Always ensure we're properly detached first to avoid duplicate listeners
    this.detach();

    // Add event listeners
    logger.debug("Attaching gesture handlers using @use-gesture");

    // Create drag gesture for panning (handles both mouse and touch)
    this.dragGesture = new DragGesture(
      this.eventTarget,
      (state) => this.handleDragGesture(state),
      {
        // Prevent default browser behaviors
        preventDefault: true,
        // Filter out right clicks
        filterTaps: true,
        // Set pointer lock to prevent text selection during drag
        pointer: { lock: true },
      },
    );

    // Create wheel gesture for trackpad/wheel scrolling
    this.wheelGesture = new WheelGesture(
      this.eventTarget,
      (state) => this.handleWheelGesture(state),
      {
        preventDefault: true,
      },
    );

    // Create pinch gesture for zooming (touch and trackpad)
    this.pinchGesture = new PinchGesture(
      this.eventTarget,
      (state) => this.handlePinchGesture(state),
      {
        preventDefault: true,
      },
    );

    // Add timeline and price axis zoom listeners on the chart container
    this.eventTarget.addEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener,
    );
    this.eventTarget.addEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener,
    );
    this.eventTarget.addEventListener(
      "contextmenu",
      this.handleContextMenu as EventListener,
    );
  }

  detach() {
    if (!this.eventTarget) return;

    // Destroy gesture instances
    if (this.dragGesture) {
      this.dragGesture.destroy();
      this.dragGesture = null;
    }
    if (this.wheelGesture) {
      this.wheelGesture.destroy();
      this.wheelGesture = null;
    }
    if (this.pinchGesture) {
      this.pinchGesture.destroy();
      this.pinchGesture = null;
    }

    this.eventTarget.removeEventListener(
      "contextmenu",
      this.handleContextMenu as EventListener,
    );
    this.eventTarget.removeEventListener(
      "timeline-zoom",
      this.handleTimelineZoom as EventListener,
    );
    this.eventTarget.removeEventListener(
      "price-axis-zoom",
      this.handlePriceAxisZoom as EventListener,
    );
  }

  // Gesture handlers
  private handleDragGesture = (state: any) => {
    const {
      active,
      first,
      last,
      movement: [mx, my],
      delta: [dx, dy],
      tap,
    } = state;

    // Ignore taps/clicks
    if (tap) return;

    if (first) {
      // Dispatch interaction start event
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-start", {
          detail: { type: "drag" },
          bubbles: true,
        }),
      );
    }

    if (active) {
      // Pan based on delta (frame-to-frame movement)
      // For drag gestures (mouse and touch), we want the chart to follow the cursor/finger
      // Pass false for isTrackpad so the movement follows the input naturally
      this.handlePan(dx, false);
      this.handleVerticalPan(dy, false);
    }

    if (last) {
      // Dispatch interaction end event
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "drag" },
          bubbles: true,
        }),
      );
    }
  };

  private handleWheelGesture = (state: any) => {
    const {
      active,
      first,
      last,
      delta: [dx, dy],
    } = state;

    if (first) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-start", {
          detail: { type: "wheel" },
          bubbles: true,
        }),
      );
    }

    // For wheel/trackpad, use the delta values
    // Don't invert - trackpad natural scrolling is already handled by the OS
    this.handlePan(dx, true);
    this.handleVerticalPan(dy, true);

    if (last) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "wheel" },
          bubbles: true,
        }),
      );
    }
  };

  private handlePinchGesture = (state: any) => {
    const {
      active,
      first,
      last,
      da: [distance, angle],
      origin: [ox, oy],
      offset: [scale],
    } = state;

    if (first) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-start", {
          detail: { type: "pinch" },
          bubbles: true,
        }),
      );
    }

    if (active) {
      // Convert pinch scale to zoom factor
      const zoomDelta = (scale - 1) * 10; // Adjust sensitivity as needed

      // Get the pinch center relative to the element
      const rect = this.eventTarget.getBoundingClientRect();

      // Dispatch timeline zoom event
      this.eventTarget.dispatchEvent(
        new CustomEvent("timeline-zoom", {
          detail: {
            deltaX: zoomDelta,
            clientX: ox,
            rect,
            isTrackpad: true,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }

    if (last) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "pinch" },
          bubbles: true,
        }),
      );
    }
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
    visibleTimeRange: number,
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
    const adjustedDelta = (isTrackpad ? -deltaY : deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    // Dispatch event for price-axis to update immediately
    this.eventTarget.dispatchEvent(
      new CustomEvent("price-axis-pan", {
        detail: {
          priceShift,
          newPriceRange: {
            min: state.priceRange.min + priceShift,
            max: state.priceRange.max + priceShift,
          },
        },
        bubbles: true,
        composed: true,
      }),
    );

    state.priceRange.shift(priceShift);
    this.options.onStateChange({ priceRange: state.priceRange });
  }

  // Old touch handlers removed - now handled by @use-gesture

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
      currentTarget: event.currentTarget,
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
      Math.min(proposedTimeRange, maxTimeRange),
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
      currentTarget: event.currentTarget,
    });
    const { deltaY, isTrackpad } = event.detail;
    const { state } = this.options;
    const zoomCenter = 0.5;
    const zoomMultiplier = isTrackpad ? 0.5 : 0.1;
    (state.priceRange as PriceRangeImpl).adjust(
      deltaY * zoomMultiplier,
      zoomCenter,
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
