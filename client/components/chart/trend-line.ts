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
    if (changedProperties.has('selected')) {
      logger.debug(`Trend line ${this.trendLine?.id} selected state changed to:`, this.selected);
    }
    if (changedProperties.has('trendLine')) {
      const oldValue = changedProperties.get('trendLine');
      logger.debug(`Trend line ${this.trendLine?.id} data updated:`, {
        old: oldValue,
        new: this.trendLine,
        lineWidth: this.trendLine?.lineWidth,
        color: this.trendLine?.color,
        style: this.trendLine?.style
      });
    }
  }

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
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
        opacity 0.15s ease;
    }
    
    .trend-line-hit-area {
      stroke: transparent;
      fill: none;
      pointer-events: stroke;
      cursor: pointer;
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
    const y = this.height - ((price - this.priceRange.min) / range) * this.height;
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
    if (!isFinite(start.x) || !isFinite(start.y) || !isFinite(end.x) || !isFinite(end.y)) {
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

    if (Math.abs(dx) > 0.001) {  // Avoid division by very small numbers
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

  private handleMouseEnter = () => {
    this.hovered = true;
  };

  private handleMouseLeave = () => {
    this.hovered = false;
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
    const price = this.priceRange.min + ((this.height - y) / this.height) * range;
    return isFinite(price) ? price : this.priceRange.min;
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
    const showHandles = this.hovered || this.selected;

    return html`
      <svg
        class="${this.hovered ? "hovered" : ""} ${this.selected
          ? "selected"
          : ""}"
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
            stroke-width="15"
            @click="${this.handleLineClick}"
          />
          <!-- Visible trend line -->
          <line
            class="trend-line ${lineStyle}"
            x1="${extendedStart.x}"
            y1="${extendedStart.y}"
            x2="${extendedEnd.x}"
            y2="${extendedEnd.y}"
            stroke="${lineColor}"
            style="stroke-width: ${this.trendLine.lineWidth || 2}px"
            pointer-events="none"
          />
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
        />
      </svg>
    `;
  }
}
