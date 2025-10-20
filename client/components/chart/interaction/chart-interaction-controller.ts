import { ChartState } from "../../..";
import { getCandleInterval, getDpr } from "../../../util/chart-util";
import { PriceRangeImpl } from "../../../util/price-range";
import { CandlestickChart } from "../chart";
import { getLogger, LogLevel } from "../../../util/logger";
import {
  InteractionLayer,
  InteractionEvent,
  InteractionState,
  ViewportTransform,
  HitTestResult,
} from "./interaction-layer";

const logger = getLogger("ChartInteractionController");
logger.setLoggerLevel("ChartInteractionController", LogLevel.DEBUG);

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
  shouldSuppressChartClick?: () => boolean;
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
  private wheelInteractionTimeout: number | null = null;

  private readonly options: ChartInteractionOptions;
  private eventTarget: HTMLElement;

  // Layer management
  private layers: Map<string, InteractionLayer> = new Map();
  private interactionState: InteractionState = {
    activeLayer: null,
    interactionType: null,
    isActive: false,
    hoveredLayer: null,
    lastHitResult: null,
  };

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

    // Cleanup layers
    this.layers.forEach((layer) => layer.destroy?.());
    this.layers.clear();
  }

  /**
   * Register an interaction layer.
   * Layers are queried in priority order (highest first) to determine which should handle interactions.
   */
  registerLayer(layer: InteractionLayer): void {
    logger.debug(
      `Registering layer: ${layer.id} (priority: ${layer.priority})`,
    );
    this.layers.set(layer.id, layer);
  }

  /**
   * Unregister an interaction layer.
   */
  unregisterLayer(layerId: string): void {
    const layer = this.layers.get(layerId);
    if (layer) {
      logger.debug(`Unregistering layer: ${layerId}`);
      layer.destroy?.();
      this.layers.delete(layerId);
    }
  }

  /**
   * Get all registered layers sorted by priority (highest first).
   */
  getLayersByPriority(): InteractionLayer[] {
    return Array.from(this.layers.values()).sort(
      (a, b) => b.priority - a.priority,
    );
  }

  /**
   * Broadcast viewport transform to all registered layers.
   * Called when the chart pans or zooms.
   */
  private broadcastTransform(): void {
    const { state } = this.options;
    if (!state.timeRange || !state.priceRange) return;

    const transform: ViewportTransform = {
      timeRange: {
        start: state.timeRange.start,
        end: state.timeRange.end,
      },
      priceRange: {
        min: state.priceRange.min,
        max: state.priceRange.max,
      },
      canvasWidth: this.eventTarget?.clientWidth ?? 0,
      canvasHeight: this.eventTarget?.clientHeight ?? 0,
      dpr: getDpr() ?? 1,
    };

    this.layers.forEach((layer) => {
      layer.onTransform?.(transform);
    });
  }

  /**
   * Query layers to find which should handle this interaction.
   * Returns the first layer (by priority) that claims the interaction.
   */
  private queryLayersForHit(
    event: MouseEvent | TouchEvent,
  ): { layer: InteractionLayer; hitResult: HitTestResult } | null {
    const sortedLayers = this.getLayersByPriority();

    for (const layer of sortedLayers) {
      const hitResult = layer.hitTest(event);
      if (hitResult) {
        logger.debug(
          `Layer ${layer.id} claimed interaction (type: ${hitResult.type})`,
        );
        return { layer, hitResult };
      }
    }

    return null;
  }

  /**
   * Create a normalized interaction event from a browser event.
   */
  private createInteractionEvent(
    type: InteractionEvent["type"],
    event: MouseEvent | TouchEvent,
  ): InteractionEvent {
    const position = this.getEventPosition(event);
    const rect = this.eventTarget.getBoundingClientRect();
    const containerPos = {
      x: position.x - rect.left,
      y: position.y - rect.top,
    };
    const dpr = getDpr() ?? 1;
    const canvasPosition = {
      x: containerPos.x * dpr,
      y: containerPos.y * dpr,
    };

    return {
      type,
      originalEvent: event,
      position,
      canvasPosition,
      modifiers: {
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        alt: event.altKey,
        meta: event.metaKey,
      },
    };
  }

  /**
   * Extract position from mouse or touch event.
   */
  private getEventPosition(event: MouseEvent | TouchEvent): {
    x: number;
    y: number;
  } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: 0, y: 0 };
  }

  private dragStartX = 0;
  private dragStartY = 0;
  private dragThreshold = 5; // pixels - minimum movement to consider it a drag

  private handleDragStart = (e: MouseEvent) => {
    // Query registered layers to see if any should handle this interaction
    const layerHit = this.queryLayersForHit(e);

    if (layerHit) {
      // A layer claimed this interaction
      logger.debug(
        `Layer ${layerHit.layer.id} handling interaction (cursor: ${layerHit.hitResult.cursor})`,
      );

      this.interactionState.activeLayer = layerHit.layer;
      this.interactionState.isActive = true;
      this.interactionState.interactionType = "drag";
      this.interactionState.lastHitResult = layerHit.hitResult;

      // Update cursor if specified
      if (layerHit.hitResult.cursor) {
        this.eventTarget.style.cursor = layerHit.hitResult.cursor;
      }

      // Send dragstart event to the layer
      const interactionEvent = this.createInteractionEvent("dragstart", e);
      layerHit.layer.handleInteraction(interactionEvent);

      // Don't start default chart dragging
      return;
    }

    // Fallback: Check for draggable elements using composed path (backward compatibility)
    const path = e.composedPath();
    const isDraggableElement = path.some((element) => {
      if (element instanceof HTMLElement) {
        const isDraggableAnnotation =
          element.classList.contains("annotation") &&
          element.classList.contains("draggable");
        const isTrendLine = element.classList.contains("trend-line");
        const isDraggablePriceLine =
          element.classList.contains("price-line") &&
          element.classList.contains("draggable");
        return isDraggableAnnotation || isTrendLine || isDraggablePriceLine;
      }
      return false;
    });

    if (isDraggableElement) {
      logger.debug("Skipping chart drag - draggable element detected (legacy)");
      return;
    }

    // No layer claimed it, proceed with default chart panning
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.dragStartX = e.clientX;
    this.dragStartY = e.clientY;

    this.interactionState.interactionType = "pan";
    this.interactionState.isActive = true;

    // Dispatch interaction start event
    this.eventTarget.dispatchEvent(
      new CustomEvent("interaction-start", {
        detail: { type: "drag" },
        bubbles: true,
      }),
    );
  };

  private handleDragMove = (e: MouseEvent) => {
    // If a layer is handling this interaction, route to it
    if (this.interactionState.activeLayer) {
      const interactionEvent = this.createInteractionEvent("drag", e);
      this.interactionState.activeLayer.handleInteraction(interactionEvent);
      return;
    }

    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    // Check if we've moved enough to consider this a drag
    const totalMovement = Math.sqrt(
      Math.pow(e.clientX - this.dragStartX, 2) +
        Math.pow(e.clientY - this.dragStartY, 2),
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
    // If a layer was handling this interaction, send it the dragend event
    if (this.interactionState.activeLayer) {
      const interactionEvent = this.createInteractionEvent("dragend", e);
      this.interactionState.activeLayer.handleInteraction(interactionEvent);

      // Reset cursor
      this.eventTarget.style.cursor = "";

      // Reset interaction state
      this.interactionState.activeLayer = null;
      this.interactionState.isActive = false;
      this.interactionState.interactionType = null;
      this.interactionState.lastHitResult = null;

      return;
    }

    // Check if this was a click (minimal movement)
    const totalMovement = Math.sqrt(
      Math.pow(e.clientX - this.dragStartX, 2) +
        Math.pow(e.clientY - this.dragStartY, 2),
    );

    if (totalMovement <= this.dragThreshold) {
      // This was a click, not a drag
      // Check if chart-clicked should be suppressed (e.g., when trend line tool is active)
      if (this.options.shouldSuppressChartClick?.()) {
        logger.debug("Suppressing chart-clicked event (tool active)");
        return;
      }

      // Emit chart-clicked event
      const rect = this.eventTarget.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const price = this.calculatePriceFromY(mouseY);
      const timestamp = this.calculateTimestampFromX(mouseX);

      // Emit chart-clicked event
      this.eventTarget.dispatchEvent(
        new CustomEvent("chart-clicked", {
          detail: {
            price,
            timestamp,
            mouseX,
            mouseY,
          },
          bubbles: true,
          composed: true,
        }),
      );
    }

    const wasDragging = this.isDragging;
    this.isDragging = false;

    // Reset interaction state
    this.interactionState.interactionType = null;
    this.interactionState.isActive = false;

    // Dispatch interaction end event if we were dragging
    if (wasDragging) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "drag" },
          bubbles: true,
        }),
      );
    }
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;

    // Dispatch interaction start on first wheel event
    if (!this.wheelInteractionTimeout) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-start", {
          detail: { type: "wheel" },
          bubbles: true,
        }),
      );
    }

    // Clear existing timeout
    if (this.wheelInteractionTimeout) {
      clearTimeout(this.wheelInteractionTimeout);
    }

    this.handlePan(e.deltaX, isTrackpad);
    this.handleVerticalPan(e.deltaY, isTrackpad);

    // Set timeout to dispatch interaction end after wheel stops
    this.wheelInteractionTimeout = setTimeout(() => {
      this.wheelInteractionTimeout = null;
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "wheel" },
          bubbles: true,
        }),
      );
    }, 150) as unknown as number; // 150ms debounce
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
    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    const newStart = state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    this.options.onStateChange({
      timeRange: { start: newStart, end: newEnd },
    });

    this.checkNeedMoreData(newStart, newEnd, timeRange);

    // Broadcast transform to all layers
    this.broadcastTransform();
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
    // Fix the direction: dragging down (positive deltaY) should show lower prices (negative shift)
    // For trackpad, the direction is already inverted in the browser
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

    // Broadcast transform to all layers
    this.broadcastTransform();
  }

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();

    this.isDragging = true;

    // Dispatch interaction start event
    this.eventTarget.dispatchEvent(
      new CustomEvent("interaction-start", {
        detail: { type: "touch" },
        bubbles: true,
      }),
    );

    if (e.touches.length === 2) {
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      // Store separate X and Y distances for directional zoom detection
      this.lastTouchDistanceX = Math.abs(
        e.touches[0].clientX - e.touches[1].clientX,
      );
      this.lastTouchDistanceY = Math.abs(
        e.touches[0].clientY - e.touches[1].clientY,
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
      const currentDistanceX = Math.abs(
        e.touches[0].clientX - e.touches[1].clientX,
      );
      const currentDistanceY = Math.abs(
        e.touches[0].clientY - e.touches[1].clientY,
      );

      const deltaDistanceX = currentDistanceX - this.lastTouchDistanceX;
      const deltaDistanceY = currentDistanceY - this.lastTouchDistanceY;

      const zoomSensitivity = 0.5;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = (e.target as HTMLElement).getBoundingClientRect();

      // Determine the dominant zoom direction based on the larger delta
      const isHorizontalZoom =
        Math.abs(deltaDistanceX) > Math.abs(deltaDistanceY);

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
          }),
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
          }),
        );
      }

      this.lastTouchDistanceX = currentDistanceX;
      this.lastTouchDistanceY = currentDistanceY;
    } else if (e.touches.length === 1) {
      const deltaX = e.touches[0].clientX - this.lastX;
      const deltaY = e.touches[0].clientY - this.lastY;

      // For touch devices, pass false for isTrackpad parameter
      // This ensures touch follows finger direction like mouse drag
      this.handlePan(deltaX, false);
      this.handleVerticalPan(deltaY, false);

      this.lastX = e.touches[0].clientX;
      this.lastY = e.touches[0].clientY;
    }
  };

  private handleTouchEnd = () => {
    const wasDragging = this.isDragging;
    this.isDragging = false;
    this.isZooming = false;

    // Dispatch interaction end event if we were interacting
    if (wasDragging) {
      this.eventTarget.dispatchEvent(
        new CustomEvent("interaction-end", {
          detail: { type: "touch" },
          bubbles: true,
        }),
      );
    }
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

    // Broadcast transform to all layers
    this.broadcastTransform();
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

    // Broadcast transform to all layers
    this.broadcastTransform();
  };

  private handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();

    // Calculate price and timestamp from mouse position
    const rect = this.eventTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const price = this.calculatePriceFromY(mouseY);
    const timestamp = this.calculateTimestampFromX(mouseX);

    // Emit enhanced context-menu event with price and timestamp
    this.eventTarget.dispatchEvent(
      new CustomEvent("chart-context-menu", {
        detail: {
          price,
          timestamp,
          mouseX,
          mouseY,
        },
        bubbles: true,
        composed: true,
      }),
    );

    // Keep backward compatibility callback
    if (this.options.onContextMenu) {
      this.options.onContextMenu({ x: e.clientX, y: e.clientY });
    }
  };

  /**
   * Calculate price from Y position (top to bottom)
   */
  private calculatePriceFromY(y: number): number {
    const { state } = this.options;
    if (!state.priceRange) return 0;

    const containerHeight = this.eventTarget?.clientHeight ?? 0;
    if (containerHeight === 0) return 0;

    const priceRange = state.priceRange.max - state.priceRange.min;
    const price = state.priceRange.max - (y / containerHeight) * priceRange;

    return price;
  }

  /**
   * Calculate timestamp from X position (left to right)
   */
  private calculateTimestampFromX(x: number): number {
    const { state } = this.options;
    if (!state.timeRange) return 0;

    const containerWidth = this.eventTarget?.clientWidth ?? 0;
    if (containerWidth === 0) return 0;

    const timeSpan = state.timeRange.end - state.timeRange.start;
    const timestamp = state.timeRange.start + (x / containerWidth) * timeSpan;

    return timestamp;
  }
}
