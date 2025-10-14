import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  PriceLine,
  PriceLineDraggedEvent,
  PriceLineClickedEvent,
  PriceLineHoveredEvent,
} from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("price-lines-layer");
logger.setLoggerLevel("price-lines-layer", LogLevel.INFO);

/**
 * Layer component for rendering price lines (orders, stop losses, take profits)
 * Handles rendering, dragging, and events
 */
@customElement("price-lines-layer")
export class PriceLinesLayer extends LitElement {
  @property({ type: Array, attribute: false })
  lines: PriceLine[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  @state()
  private draggedLineId: string | null = null;

  @state()
  private dragStartY: number = 0;

  @state()
  private dragStartPrice: number = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50; /* Between chart and markers */
      overflow: hidden;
    }

    .lines-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .price-line {
      position: absolute;
      left: 0;
      width: 100%;
      pointer-events: auto;
    }

    .price-line.draggable {
      cursor: ns-resize;
    }

    .price-line.dragging {
      opacity: 0.7;
    }

    .line-svg {
      position: absolute;
      left: 0;
      width: 100%;
      height: 1px;
      overflow: visible;
    }

    .line-label {
      position: absolute;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1;
    }

    .line-label.right {
      right: 8px;
    }

    .line-label.left {
      left: 8px;
    }

    .price-label {
      position: absolute;
      right: 0;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 2px 6px;
      font-size: 10px;
      font-family: monospace;
      white-space: nowrap;
      pointer-events: none;
    }
  `;

  /**
   * Get visible price lines within the current price range
   */
  private getVisibleLines(): PriceLine[] {
    if (!this.state?.priceRange) return this.lines;

    const { min, max } = this.state.priceRange;
    return this.lines.filter(
      (line) => line.price >= min && line.price <= max
    ).sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }

  /**
   * Convert price to Y pixel coordinate
   */
  private priceToY(price: number): number {
    if (!this.state?.priceRange || this.height === 0) return 0;

    const { min, max } = this.state.priceRange;
    const priceRange = max - min;
    const ratio = (max - price) / priceRange;
    return ratio * this.height;
  }

  /**
   * Convert Y pixel coordinate to price
   */
  private yToPrice(y: number): number {
    if (!this.state?.priceRange || this.height === 0) return 0;

    const { min, max } = this.state.priceRange;
    const priceRange = max - min;
    const ratio = y / this.height;
    return max - ratio * priceRange;
  }

  /**
   * Get SVG stroke-dasharray for line style
   */
  private getStrokeDashArray(style: 'solid' | 'dashed' | 'dotted'): string {
    switch (style) {
      case 'dashed':
        return '8,4';
      case 'dotted':
        return '2,3';
      case 'solid':
      default:
        return 'none';
    }
  }

  /**
   * Handle line click
   */
  private handleLineClick(line: PriceLine, event: MouseEvent): void {
    if (!line.interactive) return;

    event.stopPropagation();

    const clickEvent: PriceLineClickedEvent = {
      lineId: line.id,
      line,
    };

    this.dispatchEvent(
      new CustomEvent("price-line-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      })
    );

    logger.debug(`Price line clicked: ${line.id}`);
  }

  /**
   * Handle line hover
   */
  private handleLineHover(line: PriceLine): void {
    if (!line.interactive) return;

    const hoverEvent: PriceLineHoveredEvent = {
      lineId: line.id,
      line,
    };

    this.dispatchEvent(
      new CustomEvent("price-line-hovered", {
        detail: hoverEvent,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Handle drag start
   */
  private handleDragStart(line: PriceLine, event: MouseEvent): void {
    if (!line.draggable) return;

    event.stopPropagation();
    event.preventDefault();

    this.draggedLineId = line.id;
    this.dragStartY = event.clientY;
    this.dragStartPrice = line.price;

    // Add global mouse move and up listeners
    document.addEventListener('mousemove', this.handleDragMove);
    document.addEventListener('mouseup', this.handleDragEnd);

    logger.debug(`Started dragging price line: ${line.id}`);
  }

  /**
   * Handle drag move
   */
  private handleDragMove = (event: MouseEvent): void => {
    if (!this.draggedLineId) return;

    const line = this.lines.find((l) => l.id === this.draggedLineId);
    if (!line) return;

    // Calculate new price based on mouse movement
    const deltaY = event.clientY - this.dragStartY;
    const containerRect = this.getBoundingClientRect();
    const relativeY = this.priceToY(this.dragStartPrice) + deltaY;
    const newPrice = this.yToPrice(relativeY);

    // Emit drag event
    const dragEvent: PriceLineDraggedEvent = {
      lineId: line.id,
      oldPrice: line.price,
      newPrice,
      line,
    };

    this.dispatchEvent(
      new CustomEvent("price-line-dragged", {
        detail: dragEvent,
        bubbles: true,
        composed: true,
      })
    );
  };

  /**
   * Handle drag end
   */
  private handleDragEnd = (event: MouseEvent): void => {
    if (!this.draggedLineId) return;

    logger.debug(`Finished dragging price line: ${this.draggedLineId}`);

    this.draggedLineId = null;
    this.dragStartY = 0;
    this.dragStartPrice = 0;

    // Remove global listeners
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);

    this.requestUpdate();
  };

  /**
   * Render line label
   */
  private renderLabel(line: PriceLine, y: number): unknown {
    if (!line.label) return null;

    const position = line.label.position || 'right';
    const bgColor = line.label.backgroundColor || 'rgba(0, 0, 0, 0.8)';
    const textColor = line.label.textColor || '#ffffff';
    const fontSize = line.label.fontSize || 11;

    return html`
      <div
        class="line-label ${position}"
        style="
          top: ${y - 12}px;
          background-color: ${bgColor};
          color: ${textColor};
          font-size: ${fontSize}px;
        "
      >
        ${line.label.text}
      </div>
    `;
  }

  /**
   * Render price label on Y-axis
   */
  private renderPriceLabel(line: PriceLine, y: number): unknown {
    if (!line.showPriceLabel) return null;

    return html`
      <div
        class="price-label"
        style="
          top: ${y - 10}px;
          background-color: ${line.color};
        "
      >
        ${line.price.toFixed(2)}
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up drag listeners if component is removed while dragging
    document.removeEventListener('mousemove', this.handleDragMove);
    document.removeEventListener('mouseup', this.handleDragEnd);
  }

  render() {
    const visibleLines = this.getVisibleLines();

    return html`
      <div class="lines-container">
        ${visibleLines.map((line) => {
          const y = this.priceToY(line.price);
          const isDragging = this.draggedLineId === line.id;

          // Calculate line width based on extend options
          const startX = line.extendLeft ? 0 : 50;
          const endX = line.extendRight ? this.width : this.width - 50;
          const lineWidth = endX - startX;

          return html`
            <div
              class="price-line ${line.draggable ? 'draggable' : ''} ${isDragging ? 'dragging' : ''}"
              style="top: ${y}px;"
              @click="${(e: MouseEvent) => this.handleLineClick(line, e)}"
              @mouseenter="${() => this.handleLineHover(line)}"
              @mousedown="${(e: MouseEvent) => this.handleDragStart(line, e)}"
            >
              <svg
                class="line-svg"
                style="left: ${startX}px; width: ${lineWidth}px;"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="${lineWidth}"
                  y2="0"
                  stroke="${line.color}"
                  stroke-width="${line.lineWidth}"
                  stroke-dasharray="${this.getStrokeDashArray(line.lineStyle)}"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              ${this.renderLabel(line, y)}
              ${this.renderPriceLabel(line, y)}
            </div>
          `;
        })}
      </div>
    `;
  }
}
