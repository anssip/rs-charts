/**
 * Interaction layer for drawing new trend lines.
 *
 * Handles the two-click workflow for creating trend lines:
 * 1. First click: Set start point and show preview
 * 2. Mouse move: Update preview line position
 * 3. Second click: Complete the line
 * 4. ESC key: Cancel drawing
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import {
  TrendLine,
  TrendLinePoint,
  TrendLineDefaults,
} from "../../../../types/trend-line";
import { getLogger, LogLevel } from "../../../../util/logger";
import { getDpr } from "../../../../util/chart-util";
import { xinValue } from "xinjs";

const logger = getLogger("TrendLineDrawingLayer");
logger.setLoggerLevel("TrendLineDrawingLayer", LogLevel.DEBUG);

export class TrendLineDrawingLayer extends BaseInteractionLayer {
  readonly id = "trend-line-drawing";
  readonly priority = 90; // Higher than existing trend lines (80)

  private isActive = false;
  private firstPoint: TrendLinePoint | null = null;
  private previewLine: SVGLineElement | null = null;
  private previewHandle: SVGCircleElement | null = null;
  private previewSvg: SVGSVGElement | null = null;
  private defaults: TrendLineDefaults = {
    color: "#2962ff",
    lineWidth: 2,
    style: "solid",
    extendLeft: false,
    extendRight: false,
  };
  private priceAxisWidth = 70;
  private escapeHandler: ((event: KeyboardEvent) => void) | null = null;
  private isDragging = false; // Track if we're in a drag operation
  private mouseMoveHandler: ((event: MouseEvent) => void) | null = null;
  private lastMouseEvent: MouseEvent | null = null; // Track last mouse event for viewport transform

  constructor(
    container: HTMLElement,
    state: ChartState,
    priceAxisWidth: number = 70,
  ) {
    super(container, state);
    this.priceAxisWidth = priceAxisWidth;
  }

  /**
   * Activate the drawing tool
   */
  activate(defaults?: Partial<TrendLineDefaults>): void {
    if (this.isActive) return;

    this.isActive = true;
    this.firstPoint = null;

    if (defaults) {
      this.defaults = { ...this.defaults, ...defaults };
    }

    this.createPreviewElements();

    // Listen for ESC key to cancel
    this.escapeHandler = this.handleEscape.bind(this);
    document.addEventListener("keydown", this.escapeHandler);

    // Listen for mouse movements to update preview
    this.mouseMoveHandler = this.handleMouseMoveForPreview.bind(this);
    this.container.addEventListener("mousemove", this.mouseMoveHandler);

    logger.debug(
      "TrendLineDrawingLayer: Mousemove listener attached to container:",
      this.container.tagName,
      this.container,
    );

    // Change cursor
    this.container.style.cursor = "crosshair";

    logger.debug("TrendLineDrawingLayer: Activated");
  }

  /**
   * Deactivate the drawing tool
   */
  deactivate(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.firstPoint = null;
    this.lastMouseEvent = null;
    this.removePreviewElements();

    if (this.escapeHandler) {
      document.removeEventListener("keydown", this.escapeHandler);
      this.escapeHandler = null;
    }

    if (this.mouseMoveHandler) {
      this.container.removeEventListener("mousemove", this.mouseMoveHandler);
      this.mouseMoveHandler = null;
    }

    // Reset cursor
    this.container.style.cursor = "";

    logger.debug("TrendLineDrawingLayer: Deactivated");
  }

  /**
   * Test if this layer should handle the event.
   * When active, we claim all events in the chart area.
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    if (!this.isActive) {
      return null;
    }

    // When drawing tool is active, we handle all chart area clicks
    logger.debug("TrendLineDrawingLayer: Hit test succeeded (tool active)");
    return {
      target: this.container,
      type: "click" as const,
      cursor: "crosshair",
      metadata: { isDrawing: true, isFirstClick: !this.firstPoint },
    };
  }

  /**
   * Handle interaction events
   */
  handleInteraction(event: InteractionEvent): boolean {
    if (!this.isActive) {
      return false;
    }

    switch (event.type) {
      case "dragstart":
        // Mark that we're starting a potential drag
        this.isDragging = false;
        // Process as first click
        const clickHandled = this.handleClick(event);

        // If we just set the first point, we want to keep receiving drag events
        // to update the preview, so return true to stay as active layer
        return clickHandled;

      case "drag":
        // During drawing, we treat drag as hover to update preview
        this.isDragging = true; // Now we know it's actually a drag
        return this.handleHover(event);

      case "dragend":
        // Only treat as click if we didn't actually drag
        if (!this.isDragging) {
          // This was a quick tap without movement
          if (this.firstPoint) {
            // We already have first point, so this should stay active
            // to continue receiving mouse movements for preview
            // Don't process as click yet - wait for actual second click
            this.isDragging = false;
            return true; // Stay active to receive mouse movements
          } else {
            // First point was just set in dragstart
            this.isDragging = false;
            return true; // Stay active to receive mouse movements
          }
        }
        // If we did drag, treat dragend as the second click
        this.isDragging = false;
        return this.handleClick(event);

      case "click":
        return this.handleClick(event);

      case "hover":
        return this.handleHover(event);

      default:
        return false;
    }
  }

  /**
   * Handle click events
   */
  private handleClick(event: InteractionEvent): boolean {
    if (!this.isActive) return false;

    const point = this.getPointFromEvent(event.originalEvent);

    if (!this.firstPoint) {
      // First click - set start point
      logger.debug(
        "TrendLineDrawingLayer: First click - setting start point",
        point,
      );
      this.firstPoint = point;
      this.showPreview(event.originalEvent);
    } else {
      // Second click - create trend line
      logger.debug("TrendLineDrawingLayer: Second click - creating trend line");

      // Check if the second point is different from the first
      const distance = Math.hypot(
        point.timestamp - this.firstPoint.timestamp,
        point.price - this.firstPoint.price,
      );

      if (distance < 0.0001) {
        logger.warn(
          "TrendLineDrawingLayer: Second point too close to first, ignoring",
        );
        return true;
      }

      const trendLine = this.createTrendLine(this.firstPoint, point);

      // Dispatch event to create the trend line
      this.container.dispatchEvent(
        new CustomEvent("trend-line-drawing-complete", {
          detail: { trendLine },
          bubbles: true,
          composed: true,
        }),
      );

      // Reset for next line
      this.firstPoint = null;
      this.hidePreview();
      logger.debug("TrendLineDrawingLayer: Trend line created successfully");
    }

    return true; // Event handled
  }

  /**
   * Handle hover/move events to update preview
   */
  private handleHover(event: InteractionEvent): boolean {
    if (!this.isActive || !this.firstPoint) {
      return false;
    }

    this.updatePreview(event.originalEvent);
    return true; // Event handled - prevents chart panning
  }

  /**
   * Handle mouse movement to update preview line
   * This is called directly, not through the interaction controller
   */
  private handleMouseMoveForPreview(event: MouseEvent): void {
    logger.debug(
      "TrendLineDrawingLayer: handleMouseMoveForPreview called",
      "isActive:",
      this.isActive,
      "hasFirstPoint:",
      !!this.firstPoint,
      "position:",
      event.clientX,
      event.clientY,
    );

    if (!this.isActive || !this.firstPoint) {
      return;
    }

    // Update the preview line
    this.updatePreview(event);
    logger.debug("TrendLineDrawingLayer: Preview line updated");
  }

  /**
   * Handle ESC key to cancel drawing
   */
  private handleEscape(event: KeyboardEvent): void {
    if (event.key === "Escape" && this.isActive) {
      if (this.firstPoint) {
        // Cancel current drawing
        logger.debug("TrendLineDrawingLayer: ESC pressed - canceling drawing");
        this.firstPoint = null;
        this.hidePreview();
      } else {
        // Deactivate tool
        logger.debug("TrendLineDrawingLayer: ESC pressed - deactivating tool");
        this.container.dispatchEvent(
          new CustomEvent("trend-line-drawing-cancelled", {
            bubbles: true,
            composed: true,
          }),
        );
      }
    }
  }

  /**
   * Get the canvas element from the chart
   */
  private getCanvas(): HTMLCanvasElement | null {
    const shadowRoot = (this.container as any).shadowRoot;
    const candlestickChart = shadowRoot?.querySelector("candlestick-chart");
    const canvas = candlestickChart?.shadowRoot?.querySelector("canvas");
    return canvas;
  }

  /**
   * Extract point from event
   */
  private getPointFromEvent(event: MouseEvent | TouchEvent): TrendLinePoint {
    const position = this.getEventPosition(event);

    // Get the .chart-area element's bounding rect to calculate position relative to it
    const shadowRoot = (this.container as any).shadowRoot;
    const chartArea = shadowRoot?.querySelector(".chart-area");
    const rect = chartArea
      ? chartArea.getBoundingClientRect()
      : this.container.getBoundingClientRect();

    // Calculate position relative to chart area
    const containerPos = {
      x: position.x - rect.left,
      y: position.y - rect.top,
    };

    // Get canvas dimensions from the actual canvas element
    // The canvas height is the actual chart height (excluding bottom indicators)
    const canvas = this.getCanvas();

    if (!canvas) {
      logger.error("TrendLineDrawingLayer: Could not find canvas element");
      // Fallback to a default point
      return { timestamp: 0, price: 0 };
    }

    const chartWidth = canvas.clientWidth - this.priceAxisWidth;
    const chartHeight = canvas.clientHeight;

    const timestamp = this.canvasXToTimestamp(
      containerPos.x,
      chartWidth,
      this.state.timeRange,
    );
    const price = this.canvasYToPrice(
      containerPos.y,
      chartHeight,
      this.state.priceRange,
    );

    return { timestamp, price };
  }

  /**
   * Create preview SVG elements
   */
  private createPreviewElements(): void {
    if (this.previewSvg) return;

    this.previewSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    this.previewSvg.style.position = "absolute";
    this.previewSvg.style.top = "0";
    this.previewSvg.style.left = "0";
    this.previewSvg.style.width = `calc(100% - ${this.priceAxisWidth}px)`;
    this.previewSvg.style.height = "100%";
    this.previewSvg.style.pointerEvents = "none";
    this.previewSvg.style.zIndex = "1000";

    this.previewLine = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line",
    );
    this.previewLine.setAttribute("stroke", this.defaults.color || "#2962ff");
    this.previewLine.setAttribute(
      "stroke-width",
      (this.defaults.lineWidth || 2).toString(),
    );
    this.previewLine.setAttribute("stroke-dasharray", "5,5");
    this.previewLine.style.display = "none";

    this.previewSvg.appendChild(this.previewLine);

    // Create handle circle for point A
    this.previewHandle = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    this.previewHandle.setAttribute("r", "5");
    this.previewHandle.setAttribute("fill", "white");
    this.previewHandle.setAttribute("stroke", this.defaults.color || "#2962ff");
    this.previewHandle.setAttribute("stroke-width", "2");
    this.previewHandle.style.display = "none";

    this.previewSvg.appendChild(this.previewHandle);

    // Add to the chart-area inside shadow DOM
    const shadowRoot = (this.container as any).shadowRoot;
    if (shadowRoot) {
      // Find the .chart-area element inside shadow DOM
      const chartArea = shadowRoot.querySelector(".chart-area");
      if (chartArea) {
        chartArea.appendChild(this.previewSvg);
        logger.debug(
          "TrendLineDrawingLayer: Preview elements added to .chart-area",
        );
      } else {
        // Fallback: add directly to shadow root
        shadowRoot.appendChild(this.previewSvg);
        logger.debug(
          "TrendLineDrawingLayer: Preview elements added to shadow root",
        );
      }
    } else {
      this.container.appendChild(this.previewSvg);
      logger.debug(
        "TrendLineDrawingLayer: Preview elements added to light DOM",
      );
    }

    logger.debug("TrendLineDrawingLayer: Preview elements created");
  }

  /**
   * Remove preview SVG elements
   */
  private removePreviewElements(): void {
    if (this.previewSvg) {
      this.previewSvg.remove();
      this.previewSvg = null;
      this.previewLine = null;
      this.previewHandle = null;
      logger.debug("TrendLineDrawingLayer: Preview elements removed");
    }
  }

  /**
   * Show preview line and handle
   */
  private showPreview(event: MouseEvent | TouchEvent): void {
    if (!this.previewLine || !this.previewHandle || !this.firstPoint) return;

    // Show the preview line and handle
    this.previewLine.style.display = "block";
    this.previewHandle.style.display = "block";

    // Update the preview line coordinates (including infinite extension)
    this.updatePreview(event);

    logger.debug("TrendLineDrawingLayer: Preview shown");
  }

  /**
   * Update preview line position with infinite extension
   */
  private updatePreview(event: MouseEvent | TouchEvent): void {
    if (!this.previewLine || !this.firstPoint) return;

    // Store the last mouse event for viewport transform recalculation
    if (event instanceof MouseEvent) {
      this.lastMouseEvent = event;
    }

    const position = this.getEventPosition(event);

    // Get the .chart-area element's bounding rect
    const shadowRoot = (this.container as any).shadowRoot;
    const chartArea = shadowRoot?.querySelector(".chart-area");
    const rect = chartArea
      ? chartArea.getBoundingClientRect()
      : this.container.getBoundingClientRect();

    // Get canvas dimensions for proper coordinate calculations
    const canvas = this.getCanvas();
    if (!canvas) {
      logger.error("TrendLineDrawingLayer: Could not find canvas element");
      return;
    }

    const chartWidth = canvas.clientWidth - this.priceAxisWidth;
    const chartHeight = canvas.clientHeight;

    // Current mouse position in canvas coordinates
    const mouseX = position.x - rect.left;
    const mouseY = position.y - rect.top;

    // Point A coordinates (first click) in canvas coordinates
    const pointAX = this.timestampToCanvasX(
      this.firstPoint.timestamp,
      chartWidth,
      this.state.timeRange,
    );
    const pointAY = this.priceToCanvasY(
      this.firstPoint.price,
      chartHeight,
      this.state.priceRange,
    );

    // Calculate slope and determine extension direction
    const dx = mouseX - pointAX;
    const dy = mouseY - pointAY;

    let x1: number, y1: number;
    const x2 = mouseX;
    const y2 = mouseY;

    // Determine extension based on drawing direction
    if (Math.abs(dx) > 0.001) {
      // Not a vertical line
      const slope = dy / dx;

      if (dx > 0) {
        // Drawing right: extend to the left edge (x = 0)
        x1 = 0;
        y1 = pointAY - slope * pointAX;
      } else {
        // Drawing left: extend to the right edge (x = chartWidth)
        x1 = chartWidth;
        y1 = pointAY + slope * (chartWidth - pointAX);
      }

      // Clamp y1 to canvas bounds if it goes out of range
      if (!isFinite(y1)) {
        y1 = y1 > 0 ? chartHeight : 0;
      }
      y1 = Math.max(0, Math.min(chartHeight, y1));
    } else {
      // Nearly vertical line: extend vertically
      x1 = pointAX;
      if (dy > 0) {
        // Drawing down: extend to top
        y1 = 0;
      } else {
        // Drawing up: extend to bottom
        y1 = chartHeight;
      }
    }

    // Set the preview line coordinates
    this.previewLine.setAttribute("x1", x1.toString());
    this.previewLine.setAttribute("y1", y1.toString());
    this.previewLine.setAttribute("x2", x2.toString());
    this.previewLine.setAttribute("y2", y2.toString());

    // Position the handle at point A
    if (this.previewHandle) {
      this.previewHandle.setAttribute("cx", pointAX.toString());
      this.previewHandle.setAttribute("cy", pointAY.toString());
    }
  }

  /**
   * Hide preview line and handle
   */
  private hidePreview(): void {
    if (this.previewLine) {
      this.previewLine.style.display = "none";
    }
    if (this.previewHandle) {
      this.previewHandle.style.display = "none";
    }
    logger.debug("TrendLineDrawingLayer: Preview hidden");
  }

  /**
   * Create trend line object with extension direction based on drawing direction
   */
  private createTrendLine(
    startPoint: TrendLinePoint,
    endPoint: TrendLinePoint,
  ): Omit<TrendLine, "id"> {
    // Determine extension direction based on the drawing direction
    // If drawing left-to-right (endPoint is to the right of startPoint), extend left
    // If drawing right-to-left (endPoint is to the left of startPoint), extend right
    const drawingRight = endPoint.timestamp > startPoint.timestamp;

    return {
      startPoint,
      endPoint,
      extendLeft: drawingRight ? true : false,
      extendRight: drawingRight ? false : true,
      color: this.defaults.color,
      lineWidth: this.defaults.lineWidth,
      style: this.defaults.style,
    };
  }

  /**
   * Handle viewport transform (pan/zoom)
   * Update preview line if it's visible, recalculating infinite extension
   */
  onTransform(transform: ViewportTransform): void {
    if (this.firstPoint && this.previewLine && this.lastMouseEvent) {
      // Recalculate the entire preview line with infinite extension
      // using the last known mouse position
      this.updatePreview(this.lastMouseEvent);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.deactivate();
    this.firstPoint = null;
    logger.debug("TrendLineDrawingLayer: Destroyed");
  }
}
