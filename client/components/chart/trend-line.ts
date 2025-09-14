import { LitElement, html, css, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TrendLine as TrendLineData, Point } from "../../types/trend-line";
import {
  TimeRange,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("trend-line");
logger.setLoggerLevel("trend-line", LogLevel.DEBUG);

@customElement("trend-line")
export class TrendLineElement extends LitElement {
  @property({ type: Object })
  trendLine!: TrendLineData;

  @property({ type: Object })
  timeRange!: TimeRange;

  @property({ type: Object })
  priceRange!: PriceRange;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  @property({ type: Boolean, reflect: true })
  selected = false;

  @state()
  private hovered = false;

  @state()
  private showTooltip = false;

  private tooltipTimeout?: number;

  connectedCallback() {
    super.connectedCallback();
    // Don't override the selected property if it's being set from parent
    if (this.selected === undefined) {
      this.selected = false;
    }
    this.hovered = false;
  }

  updated(changedProperties: Map<string, any>) {
    super.updated(changedProperties);
    if (changedProperties.has("selected")) {
      logger.debug(
        `Trend line ${this.trendLine?.id} selected state changed to:`,
        this.selected,
      );
    }
    if (changedProperties.has("trendLine")) {
      const oldValue = changedProperties.get("trendLine");
      logger.debug(`Trend line ${this.trendLine?.id} data updated:`, {
        old: oldValue,
        new: this.trendLine,
        lineWidth: this.trendLine?.lineWidth,
        color: this.trendLine?.color,
        style: this.trendLine?.style,
      });
      // Force re-render when trend line data changes
      this.requestUpdate();
    }
    // Also re-render when time or price ranges change
    if (
      changedProperties.has("timeRange") ||
      changedProperties.has("priceRange")
    ) {
      this.requestUpdate();
    }
  }

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    svg {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .trend-line {
      /* stroke-width is set inline based on lineWidth property */
      fill: none;
      pointer-events: none;
      transition:
        stroke-width 0.15s ease,
        stroke-opacity 0.2s ease,
        opacity 0.15s ease;
    }

    .trend-line-hit-area {
      stroke: transparent;
      fill: none;
      pointer-events: stroke;
      cursor: move;
    }

    .trend-line-hit-area:active {
      cursor: grabbing;
    }

    .trend-line.solid {
      stroke-dasharray: none;
    }

    .trend-line.dashed {
      stroke-dasharray: 5, 5;
    }

    .trend-line.dotted {
      stroke-dasharray: 2, 2;
    }

    .trend-line:hover {
      stroke-width: 3;
      opacity: 0.9;
    }

    /* Different hover effects based on level type */
    .trend-line[data-level-type="swing"]:hover {
      filter: drop-shadow(0 0 4px currentColor);
    }

    .trend-line[data-level-type="horizontal"]:hover {
      filter: drop-shadow(0 0 2px currentColor);
    }

    /* Marker animations */
    .marker-point {
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    .handle {
      fill: white;
      stroke: currentColor;
      stroke-width: 2;
      cursor: grab;
      transition: opacity 0.2s ease;
    }

    .handle:hover {
      r: 6;
    }

    .handle.dragging {
      cursor: grabbing;
    }

    .trend-name {
      font-size: 12px;
      fill: white;
      stroke: black;
      stroke-width: 3;
      paint-order: stroke;
      pointer-events: none;
      user-select: none;
      font-family: Arial, sans-serif;
      font-weight: 600;
    }

    .tooltip {
      position: absolute;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 0.5em;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      max-width: 250px;
      white-space: normal;
      text-align: left !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      transition: opacity 0.2s ease;
      display: block;
      line-height: 1.4;
    }

    .tooltip.hidden {
      opacity: 0;
    }
  `;

  private timeToX(timestamp: number): number {
    if (!this.timeRange || this.width === 0) return 0;
    const range = this.timeRange.end - this.timeRange.start;
    if (range === 0) return 0;
    const x = ((timestamp - this.timeRange.start) / range) * this.width;
    return isFinite(x) ? x : 0;
  }

  private priceToY(price: number): number {
    if (!this.priceRange || this.height === 0) return 0;
    const range = this.priceRange.max - this.priceRange.min;
    if (range === 0) return this.height / 2;
    const y =
      this.height - ((price - this.priceRange.min) / range) * this.height;
    return isFinite(y) ? y : this.height / 2;
  }

  private calculateExtendedPoints(): [Point, Point] {
    if (!this.trendLine || !this.timeRange || !this.priceRange) {
      return [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
    }

    const start = {
      x: this.timeToX(this.trendLine.startPoint.timestamp),
      y: this.priceToY(this.trendLine.startPoint.price),
    };

    const end = {
      x: this.timeToX(this.trendLine.endPoint.timestamp),
      y: this.priceToY(this.trendLine.endPoint.price),
    };

    // Validate start and end points
    if (
      !isFinite(start.x) ||
      !isFinite(start.y) ||
      !isFinite(end.x) ||
      !isFinite(end.y)
    ) {
      logger.warn("Invalid coordinates detected in trend line points", {
        start,
        end,
        trendLine: this.trendLine,
      });
      return [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ];
    }

    let extendedStart = { ...start };
    let extendedEnd = { ...end };

    // Calculate slope
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (Math.abs(dx) > 0.001) {
      // Avoid division by very small numbers
      const slope = dy / dx;

      // Extend left
      // Using point-slope form: y - y1 = m(x - x1)
      // Rearranged: y = y1 + m(x - x1)
      if (this.trendLine.extendLeft) {
        const targetX = 0;
        // Use the start point as reference for left extension
        extendedStart.x = targetX;
        extendedStart.y = start.y + slope * (targetX - start.x);

        // Clamp y values to viewport bounds if they're invalid
        if (!isFinite(extendedStart.y)) {
          extendedStart.y = extendedStart.y > 0 ? this.height : 0;
        }
      }

      // Extend right
      // Use the end point as reference for right extension
      if (this.trendLine.extendRight) {
        const targetX = this.width;
        extendedEnd.x = targetX;
        extendedEnd.y = end.y + slope * (targetX - end.x);

        // Clamp y values to viewport bounds if they're invalid
        if (!isFinite(extendedEnd.y)) {
          extendedEnd.y = extendedEnd.y > 0 ? this.height : 0;
        }
      }
    } else {
      // Nearly vertical line
      if (this.trendLine.extendLeft) {
        extendedStart.y = 0;
      }
      if (this.trendLine.extendRight) {
        extendedEnd.y = this.height;
      }
    }

    return [extendedStart, extendedEnd];
  }

  private handleLineClick = (event: MouseEvent) => {
    logger.debug("Line clicked:", this.trendLine.id);
    event.stopPropagation();
    event.preventDefault();
    this.dispatchEvent(
      new CustomEvent("trend-line-select", {
        detail: { trendLine: this.trendLine },
        bubbles: true,
        composed: true,
      }),
    );
  };

  private handleLineMouseDown = (event: MouseEvent) => {
    logger.debug("Line mousedown:", this.trendLine.id);
    event.stopPropagation();
    event.preventDefault();

    // First select the line
    this.dispatchEvent(
      new CustomEvent("trend-line-select", {
        detail: { trendLine: this.trendLine },
        bubbles: true,
        composed: true,
      }),
    );

    // Start dragging the entire line
    this.handleLineDragStart(event);
  };

  private handleLineTouchStart = (event: TouchEvent) => {
    logger.debug("Line touchstart:", this.trendLine.id);
    if (event.touches.length !== 1) return;

    event.stopPropagation();
    event.preventDefault();

    // First select the line
    this.dispatchEvent(
      new CustomEvent("trend-line-select", {
        detail: { trendLine: this.trendLine },
        bubbles: true,
        composed: true,
      }),
    );

    // Start dragging the entire line
    this.handleLineTouchDragStart(event);
  };

  private handleLineDragStart = (event: MouseEvent) => {
    const rect = this.getBoundingClientRect();
    const startX = event.clientX - rect.left;
    const startY = event.clientY - rect.top;

    // Store initial positions
    const initialStartTimestamp = this.trendLine.startPoint.timestamp;
    const initialStartPrice = this.trendLine.startPoint.price;
    const initialEndTimestamp = this.trendLine.endPoint.timestamp;
    const initialEndPrice = this.trendLine.endPoint.price;

    const onMouseMove = (e: MouseEvent) => {
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      // Calculate the delta in pixels
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Convert pixel deltas to time/price deltas
      const timeDelta = this.pixelDeltaToTimeDelta(deltaX);
      const priceDelta = this.pixelDeltaToPriceDelta(deltaY);

      // Update both endpoints with the same delta to move the entire line
      const updatedLine = { ...this.trendLine };
      updatedLine.startPoint = {
        timestamp: initialStartTimestamp + timeDelta,
        price: initialStartPrice + priceDelta,
      };
      updatedLine.endPoint = {
        timestamp: initialEndTimestamp + timeDelta,
        price: initialEndPrice + priceDelta,
      };

      this.dispatchEvent(
        new CustomEvent("trend-line-update", {
          detail: { trendLine: updatedLine },
          bubbles: true,
          composed: true,
        }),
      );
    };

    const onMouseUp = (e: MouseEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this.handleDragEnd();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  private handleLineTouchDragStart = (event: TouchEvent) => {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const rect = this.getBoundingClientRect();
    const startX = touch.clientX - rect.left;
    const startY = touch.clientY - rect.top;

    // Store initial positions
    const initialStartTimestamp = this.trendLine.startPoint.timestamp;
    const initialStartPrice = this.trendLine.startPoint.price;
    const initialEndTimestamp = this.trendLine.endPoint.timestamp;
    const initialEndPrice = this.trendLine.endPoint.price;

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;

      const currentTouch = e.touches[0];
      const currentX = currentTouch.clientX - rect.left;
      const currentY = currentTouch.clientY - rect.top;

      // Calculate the delta in pixels
      const deltaX = currentX - startX;
      const deltaY = currentY - startY;

      // Convert pixel deltas to time/price deltas
      const timeDelta = this.pixelDeltaToTimeDelta(deltaX);
      const priceDelta = this.pixelDeltaToPriceDelta(deltaY);

      // Update both endpoints with the same delta to move the entire line
      const updatedLine = { ...this.trendLine };
      updatedLine.startPoint = {
        timestamp: initialStartTimestamp + timeDelta,
        price: initialStartPrice + priceDelta,
      };
      updatedLine.endPoint = {
        timestamp: initialEndTimestamp + timeDelta,
        price: initialEndPrice + priceDelta,
      };

      this.dispatchEvent(
        new CustomEvent("trend-line-update", {
          detail: { trendLine: updatedLine },
          bubbles: true,
          composed: true,
        }),
      );
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      this.handleDragEnd();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  };

  private pixelDeltaToTimeDelta(pixelDelta: number): number {
    if (!this.timeRange || this.width === 0) return 0;
    const range = this.timeRange.end - this.timeRange.start;
    return (pixelDelta / this.width) * range;
  }

  private pixelDeltaToPriceDelta(pixelDelta: number): number {
    if (!this.priceRange || this.height === 0) return 0;
    const range = this.priceRange.max - this.priceRange.min;
    // Note: negative because Y increases downward
    return -(pixelDelta / this.height) * range;
  }

  private handleMouseEnter = () => {
    this.hovered = true;
    if (this.trendLine.description) {
      // Start timer for tooltip
      this.tooltipTimeout = window.setTimeout(() => {
        this.showTooltip = true;
      }, 500); // 500ms delay
    }
  };

  private handleMouseLeave = () => {
    this.hovered = false;
    this.showTooltip = false;
    if (this.tooltipTimeout) {
      clearTimeout(this.tooltipTimeout);
      this.tooltipTimeout = undefined;
    }
  };

  private handleDragStart = (handle: "start" | "end", event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    const handleElement = event.target as SVGElement;
    handleElement.classList.add("dragging");

    const onMouseMove = (e: MouseEvent) => {
      this.handleDragMove(handle, e);
    };

    const onMouseUp = (e: MouseEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      handleElement.classList.remove("dragging");
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      this.handleDragEnd();

      // Prevent the trend line tool from interpreting this as a click
      // Add a small delay to ensure event doesn't propagate
      setTimeout(() => {
        // Reset any state that might have been affected
      }, 10);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  private handleTouchDragStart = (
    handle: "start" | "end",
    event: TouchEvent,
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const handleElement = event.target as SVGElement;
    handleElement.classList.add("dragging");

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        this.handleTouchDragMove(handle, e);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      handleElement.classList.remove("dragging");
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchEnd);
      this.handleDragEnd();
    };

    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
    document.addEventListener("touchcancel", onTouchEnd);
  };

  private handleDragMove(handle: "start" | "end", event: MouseEvent) {
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Convert pixel coordinates to price/time
    const timestamp = this.xToTime(x);
    const price = this.yToPrice(y);

    // Emit update event
    const updatedLine = { ...this.trendLine };
    if (handle === "start") {
      updatedLine.startPoint = { timestamp, price };
    } else {
      updatedLine.endPoint = { timestamp, price };
    }

    this.dispatchEvent(
      new CustomEvent("trend-line-update", {
        detail: { trendLine: updatedLine },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTouchDragMove(handle: "start" | "end", event: TouchEvent) {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    const rect = this.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // Convert pixel coordinates to price/time
    const timestamp = this.xToTime(x);
    const price = this.yToPrice(y);

    // Emit update event
    const updatedLine = { ...this.trendLine };
    if (handle === "start") {
      updatedLine.startPoint = { timestamp, price };
    } else {
      updatedLine.endPoint = { timestamp, price };
    }

    this.dispatchEvent(
      new CustomEvent("trend-line-update", {
        detail: { trendLine: updatedLine },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleDragEnd() {
    this.dispatchEvent(
      new CustomEvent("trend-line-update-complete", {
        detail: { trendLine: this.trendLine },
        bubbles: true,
        composed: true,
      }),
    );

    // Dispatch event to notify that dragging has ended
    this.dispatchEvent(
      new CustomEvent("trend-line-drag-end", {
        bubbles: true,
        composed: true,
      }),
    );
  }

  private xToTime(x: number): number {
    if (!this.timeRange || this.width === 0) return Date.now();
    const range = this.timeRange.end - this.timeRange.start;
    if (range === 0) return this.timeRange.start;
    const timestamp = this.timeRange.start + (x / this.width) * range;
    return isFinite(timestamp) ? timestamp : this.timeRange.start;
  }

  private yToPrice(y: number): number {
    if (!this.priceRange || this.height === 0) return 0;
    const range = this.priceRange.max - this.priceRange.min;
    if (range === 0) return this.priceRange.min;
    const price =
      this.priceRange.min + ((this.height - y) / this.height) * range;
    return isFinite(price) ? price : this.priceRange.min;
  }

  private calculateNamePosition(): {
    x: number;
    y: number;
    angle: number;
  } | null {
    if (!this.trendLine.name || !this.timeRange || !this.priceRange) {
      return null;
    }

    // Get the actual line endpoints in pixel coordinates
    const startX = this.timeToX(this.trendLine.startPoint.timestamp);
    const startY = this.priceToY(this.trendLine.startPoint.price);
    const endX = this.timeToX(this.trendLine.endPoint.timestamp);
    const endY = this.priceToY(this.trendLine.endPoint.price);

    // Calculate line angle
    const angle = Math.atan2(endY - startY, endX - startX);

    // Find the visible portion of the line
    const [extendedStart, extendedEnd] = this.calculateExtendedPoints();

    let x1 = extendedStart.x;
    let y1 = extendedStart.y;
    let x2 = extendedEnd.x;
    let y2 = extendedEnd.y;

    // Determine which part of the line is visible
    const leftEdge = 0;
    const rightEdge = this.width;
    const topEdge = 0;
    const bottomEdge = this.height;

    // Find intersection points with viewport edges if line extends beyond
    if (
      x1 < leftEdge ||
      x1 > rightEdge ||
      y1 < topEdge ||
      y1 > bottomEdge ||
      x2 < leftEdge ||
      x2 > rightEdge ||
      y2 < topEdge ||
      y2 > bottomEdge
    ) {
      // Clip line to viewport
      const clipped = this.clipLineToViewport(x1, y1, x2, y2);
      if (clipped) {
        x1 = clipped.x1;
        y1 = clipped.y1;
        x2 = clipped.x2;
        y2 = clipped.y2;
      }
    }

    // Position name at the midpoint of the visible line segment
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    // Offset perpendicular to the line direction
    const offsetDistance = 2;
    const offsetX = -Math.sin(angle) * offsetDistance;
    const offsetY = Math.cos(angle) * offsetDistance;

    return {
      x: midX + offsetX,
      y: midY + offsetY,
      angle: (angle * 180) / Math.PI,
    };
  }

  private clipLineToViewport(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): { x1: number; y1: number; x2: number; y2: number } | null {
    const left = 0;
    const right = this.width;
    const top = 0;
    const bottom = this.height;

    // Cohen-Sutherland line clipping algorithm
    const computeOutCode = (x: number, y: number) => {
      let code = 0;
      if (x < left) code |= 1;
      else if (x > right) code |= 2;
      if (y < top) code |= 4;
      else if (y > bottom) code |= 8;
      return code;
    };

    let outcode1 = computeOutCode(x1, y1);
    let outcode2 = computeOutCode(x2, y2);

    while (true) {
      if (!(outcode1 | outcode2)) {
        // Both points inside
        return { x1, y1, x2, y2 };
      } else if (outcode1 & outcode2) {
        // Both points outside on same side
        return null;
      } else {
        // Calculate intersection
        let x = 0,
          y = 0;
        const outcode = outcode1 ? outcode1 : outcode2;

        if (outcode & 8) {
          x = x1 + ((x2 - x1) * (bottom - y1)) / (y2 - y1);
          y = bottom;
        } else if (outcode & 4) {
          x = x1 + ((x2 - x1) * (top - y1)) / (y2 - y1);
          y = top;
        } else if (outcode & 2) {
          y = y1 + ((y2 - y1) * (right - x1)) / (x2 - x1);
          x = right;
        } else if (outcode & 1) {
          y = y1 + ((y2 - y1) * (left - x1)) / (x2 - x1);
          x = left;
        }

        if (outcode === outcode1) {
          x1 = x;
          y1 = y;
          outcode1 = computeOutCode(x1, y1);
        } else {
          x2 = x;
          y2 = y;
          outcode2 = computeOutCode(x2, y2);
        }
      }
    }
  }


  // New helper method to render markers along the line
  private renderMarkers(start: Point, end: Point): any {
    const markers = this.trendLine.markers!;
    const spacing = markers.spacing || 100;
    const markerColor = markers.color || this.trendLine.color || '#2962ff';
    const markerSize = markers.size || 4;

    // Calculate line length
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lineLength = Math.sqrt(dx * dx + dy * dy);

    // Calculate number of markers
    const numMarkers = Math.floor(lineLength / spacing);

    if (numMarkers <= 0) return svg``;

    // Generate marker positions
    const markerPositions: Point[] = [];
    for (let i = 1; i <= numMarkers; i++) {
      const t = (i * spacing) / lineLength;
      if (t < 1) {
        markerPositions.push({
          x: start.x + dx * t,
          y: start.y + dy * t
        });
      }
    }

    // Render actual marker shapes at calculated positions
    return svg`
      ${markerPositions.map(pos => this.renderMarkerAtPosition(pos, markers.symbol, markerSize, markerColor))}
    `;
  }

  private renderMarkerAtPosition(pos: Point, symbol: string, size: number, color: string): any {
    switch (symbol) {
      case 'diamond':
        return svg`
          <polygon
            points="${pos.x},${pos.y - size} ${pos.x + size},${pos.y} ${pos.x},${pos.y + size} ${pos.x - size},${pos.y}"
            fill="${color}"
            opacity="${this.trendLine.opacity ?? 1.0}"
          />
        `;
      case 'circle':
        return svg`
          <circle
            cx="${pos.x}"
            cy="${pos.y}"
            r="${size/2}"
            fill="${color}"
            opacity="${this.trendLine.opacity ?? 1.0}"
          />
        `;
      case 'square':
        return svg`
          <rect
            x="${pos.x - size/2}"
            y="${pos.y - size/2}"
            width="${size}"
            height="${size}"
            fill="${color}"
            opacity="${this.trendLine.opacity ?? 1.0}"
          />
        `;
      case 'triangle':
        return svg`
          <polygon
            points="${pos.x},${pos.y - size} ${pos.x + size},${pos.y + size} ${pos.x - size},${pos.y + size}"
            fill="${color}"
            opacity="${this.trendLine.opacity ?? 1.0}"
          />
        `;
      default:
        return svg``;
    }
  }

  render() {
    if (
      !this.trendLine ||
      !this.timeRange ||
      !this.priceRange ||
      this.width === 0 ||
      this.height === 0
    ) {
      return html``;
    }

    const [extendedStart, extendedEnd] = this.calculateExtendedPoints();
    const handleStart = {
      x: this.timeToX(this.trendLine.startPoint.timestamp),
      y: this.priceToY(this.trendLine.startPoint.price),
    };
    const handleEnd = {
      x: this.timeToX(this.trendLine.endPoint.timestamp),
      y: this.priceToY(this.trendLine.endPoint.price),
    };

    const lineColor = this.trendLine.color || "#2962ff";
    const lineStyle = this.trendLine.style || "solid";
    const lineWidth = this.trendLine.lineWidth || 2;
    const opacity = this.trendLine.opacity ?? 1.0;  // New: opacity support
    const zIndex = this.trendLine.zIndex ?? 0;      // New: z-index support
    const showHandles = this.hovered || this.selected;
    const namePosition = this.calculateNamePosition();

    return html`
      <svg
        class="${this.hovered ? "hovered" : ""} ${this.selected
          ? "selected"
          : ""}"
        style="z-index: ${zIndex}"
        @mouseenter="${this.handleMouseEnter}"
        @mouseleave="${this.handleMouseLeave}"
      >
        <!-- Define clipping path to restrict drawing to chart area -->
        <defs>
          <clipPath id="chart-area-clip-${this.trendLine.id}">
            <rect x="0" y="0" width="${this.width}" height="${this.height}" />
          </clipPath>
        </defs>

        <!-- Group with clipping applied -->
        <g clip-path="url(#chart-area-clip-${this.trendLine.id})">
          <!-- Invisible hit area for easier selection -->
          <line
            class="trend-line-hit-area"
            x1="${extendedStart.x}"
            y1="${extendedStart.y}"
            x2="${extendedEnd.x}"
            y2="${extendedEnd.y}"
            stroke="transparent"
            stroke-width="20"
            @mousedown="${this.handleLineMouseDown}"
            @touchstart="${this.handleLineTouchStart}"
          />
          <!-- Visible trend line -->
          <line
            class="trend-line ${lineStyle}"
            data-level-type="${this.trendLine.levelType || ''}"
            x1="${extendedStart.x}"
            y1="${extendedStart.y}"
            x2="${extendedEnd.x}"
            y2="${extendedEnd.y}"
            stroke="${lineColor}"
            stroke-opacity="${opacity}"
            style="stroke-width: ${lineWidth}px"
            pointer-events="none"
          />

          ${/* Render invisible markers along the line for marker placement */
          this.trendLine.markers?.enabled
            ? this.renderMarkers(extendedStart, extendedEnd)
            : ''}
        </g>

        <!-- Handles remain outside clipping so they're always visible when hovered/selected -->
        <circle
          class="handle handle-start"
          cx="${handleStart.x}"
          cy="${handleStart.y}"
          r="5"
          stroke="${lineColor}"
          opacity="${showHandles ? "1" : "0"}"
          style="pointer-events: ${showHandles ? "all" : "none"}"
          @mousedown="${(e: MouseEvent) => this.handleDragStart("start", e)}"
          @touchstart="${(e: TouchEvent) =>
            this.handleTouchDragStart("start", e)}"
        />
        <circle
          class="handle handle-end"
          cx="${handleEnd.x}"
          cy="${handleEnd.y}"
          r="5"
          stroke="${lineColor}"
          opacity="${showHandles ? "1" : "0"}"
          style="pointer-events: ${showHandles ? "all" : "none"}"
          @mousedown="${(e: MouseEvent) => this.handleDragStart("end", e)}"
          @touchstart="${(e: TouchEvent) =>
            this.handleTouchDragStart("end", e)}"
        />

        <!-- Trend line name -->
        ${this.trendLine.name && namePosition
          ? svg`
            <text
              class="trend-name"
              x="${namePosition.x}"
              y="${namePosition.y}"
              text-anchor="middle"
              dominant-baseline="middle"
              transform="rotate(${namePosition.angle} ${namePosition.x} ${namePosition.y})"
            >
              ${this.trendLine.name}
            </text>
          `
          : ""}
      </svg>

      <!-- Tooltip for description -->
      ${this.showTooltip && this.trendLine.description && namePosition
        ? html`
            <div
              class="tooltip ${!this.showTooltip ? "hidden" : ""}"
              style="
              left: ${Math.max(10, namePosition.x - 100)}px;
              top: ${namePosition.y + 15}px;
            "
            >
              ${this.trendLine.description}
            </div>
          `
        : ""}
    `;
  }
}
