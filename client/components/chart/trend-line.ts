import { LitElement, html, css, svg } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TrendLine as TrendLineData, Point } from "../../types/trend-line";
import { TimeRange, PriceRange } from "../../../server/services/price-data/price-history-model";

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

  @property({ type: Boolean })
  selected = false;

  @state()
  private hovered = false;

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
    }

    .trend-line {
      stroke-width: 2;
      fill: none;
      pointer-events: stroke;
      cursor: pointer;
      transition: stroke-width 0.15s ease, opacity 0.15s ease;
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
    return ((timestamp - this.timeRange.start) / range) * this.width;
  }

  private priceToY(price: number): number {
    if (!this.priceRange || this.height === 0) return 0;
    const range = this.priceRange.max - this.priceRange.min;
    return this.height - ((price - this.priceRange.min) / range) * this.height;
  }

  private calculateExtendedPoints(): [Point, Point] {
    if (!this.trendLine || !this.timeRange || !this.priceRange) {
      return [{ x: 0, y: 0 }, { x: 0, y: 0 }];
    }

    const start = {
      x: this.timeToX(this.trendLine.startPoint.timestamp),
      y: this.priceToY(this.trendLine.startPoint.price)
    };

    const end = {
      x: this.timeToX(this.trendLine.endPoint.timestamp),
      y: this.priceToY(this.trendLine.endPoint.price)
    };

    let extendedStart = { ...start };
    let extendedEnd = { ...end };

    // Calculate slope
    const dx = end.x - start.x;
    const dy = end.y - start.y;

    if (dx !== 0) {
      const slope = dy / dx;

      // Extend left
      if (this.trendLine.extendLeft) {
        extendedStart.x = 0;
        extendedStart.y = start.y - slope * start.x;
      }

      // Extend right
      if (this.trendLine.extendRight) {
        extendedEnd.x = this.width;
        extendedEnd.y = end.y + slope * (this.width - end.x);
      }
    }

    return [extendedStart, extendedEnd];
  }

  private handleLineClick = (event: MouseEvent) => {
    console.log('[TrendLine] Line clicked:', this.trendLine.id);
    event.stopPropagation();
    event.preventDefault();
    this.dispatchEvent(new CustomEvent('trend-line-select', {
      detail: { trendLine: this.trendLine },
      bubbles: true,
      composed: true
    }));
  }

  private handleMouseEnter = () => {
    this.hovered = true;
    this.requestUpdate();
  }

  private handleMouseLeave = () => {
    this.hovered = false;
    this.requestUpdate();
  }

  private handleDragStart = (handle: 'start' | 'end', event: MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    const handleElement = event.target as SVGElement;
    handleElement.classList.add('dragging');
    
    const onMouseMove = (e: MouseEvent) => {
      this.handleDragMove(handle, e);
    };
    
    const onMouseUp = () => {
      handleElement.classList.remove('dragging');
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      this.handleDragEnd();
    };
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  private handleDragMove(handle: 'start' | 'end', event: MouseEvent) {
    const rect = this.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Convert pixel coordinates to price/time
    const timestamp = this.xToTime(x);
    const price = this.yToPrice(y);
    
    // Emit update event
    const updatedLine = { ...this.trendLine };
    if (handle === 'start') {
      updatedLine.startPoint = { timestamp, price };
    } else {
      updatedLine.endPoint = { timestamp, price };
    }
    
    this.dispatchEvent(new CustomEvent('trend-line-update', {
      detail: { trendLine: updatedLine },
      bubbles: true,
      composed: true
    }));
  }

  private handleDragEnd() {
    this.dispatchEvent(new CustomEvent('trend-line-update-complete', {
      detail: { trendLine: this.trendLine },
      bubbles: true,
      composed: true
    }));
  }

  private xToTime(x: number): number {
    if (!this.timeRange || this.width === 0) return 0;
    const range = this.timeRange.end - this.timeRange.start;
    return this.timeRange.start + (x / this.width) * range;
  }

  private yToPrice(y: number): number {
    if (!this.priceRange || this.height === 0) return 0;
    const range = this.priceRange.max - this.priceRange.min;
    return this.priceRange.min + ((this.height - y) / this.height) * range;
  }

  render() {
    if (!this.trendLine || !this.timeRange || !this.priceRange || this.width === 0 || this.height === 0) {
      return html``;
    }

    const [extendedStart, extendedEnd] = this.calculateExtendedPoints();
    const handleStart = {
      x: this.timeToX(this.trendLine.startPoint.timestamp),
      y: this.priceToY(this.trendLine.startPoint.price)
    };
    const handleEnd = {
      x: this.timeToX(this.trendLine.endPoint.timestamp),
      y: this.priceToY(this.trendLine.endPoint.price)
    };

    const lineColor = this.trendLine.color || '#2962ff';
    const lineStyle = this.trendLine.style || 'solid';
    const showHandles = this.hovered || this.selected;

    return html`
      <svg
        class="${this.hovered ? 'hovered' : ''} ${this.selected ? 'selected' : ''}"
        @mouseenter="${this.handleMouseEnter}"
        @mouseleave="${this.handleMouseLeave}"
      >
        <line
          class="trend-line ${lineStyle}"
          x1="${extendedStart.x}"
          y1="${extendedStart.y}"
          x2="${extendedEnd.x}"
          y2="${extendedEnd.y}"
          stroke="${lineColor}"
          stroke-width="${this.trendLine.lineWidth || 2}"
          @click="${this.handleLineClick}"
        />
        <circle
          class="handle handle-start"
          cx="${handleStart.x}"
          cy="${handleStart.y}"
          r="5"
          stroke="${lineColor}"
          opacity="${showHandles ? '1' : '0'}"
          style="pointer-events: ${showHandles ? 'all' : 'none'}"
          @mousedown="${(e: MouseEvent) => this.handleDragStart('start', e)}"
        />
        <circle
          class="handle handle-end"
          cx="${handleEnd.x}"
          cy="${handleEnd.y}"
          r="5"
          stroke="${lineColor}"
          opacity="${showHandles ? '1' : '0'}"
          style="pointer-events: ${showHandles ? 'all' : 'none'}"
          @mousedown="${(e: MouseEvent) => this.handleDragStart('end', e)}"
        />
      </svg>
    `;
  }
}