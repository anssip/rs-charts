import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  Annotation,
  AnnotationClickedEvent,
  AnnotationHoveredEvent,
  AnnotationDraggedEvent,
} from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("annotations-layer");
logger.setLoggerLevel("annotations-layer", LogLevel.INFO);

/**
 * Layer component for rendering annotations (custom notes, alerts, milestones)
 * Handles rendering, events, and dragging
 */
@customElement("annotations-layer")
export class AnnotationsLayer extends LitElement {
  @property({ type: Array, attribute: false })
  annotations: Annotation[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  @state()
  private draggedAnnotationId: string | null = null;

  @state()
  private dragStartX: number = 0;

  @state()
  private dragStartY: number = 0;

  @state()
  private dragStartTimestamp: number = 0;

  @state()
  private dragStartPrice: number | undefined = undefined;

  @state()
  private currentDragTimestamp: number | null = null;

  @state()
  private currentDragPrice: number | undefined = undefined;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none; /* Allow events to pass through to layers below */
      z-index: 200; /* Higher than markers (100) */
      overflow: hidden;
    }

    .annotations-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none; /* Container doesn't capture events */
      overflow: hidden;
    }

    .annotation {
      position: absolute;
      pointer-events: auto;
      transition: transform 0.1s ease;
    }

    .annotation.draggable {
      cursor: move;
    }

    .annotation.dragging {
      opacity: 0.8;
      z-index: 1000;
    }

    .annotation:hover {
      transform: scale(1.05);
    }

    .annotation-box {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 4px;
      border: 1px solid;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      pointer-events: auto; /* Capture mouse events for the entire box */
      cursor: inherit; /* Inherit cursor from parent .annotation */
    }

    .annotation-icon {
      font-size: 16px;
      line-height: 1;
      flex-shrink: 0;
      pointer-events: auto; /* Capture events */
      cursor: inherit;
    }

    .annotation-text {
      line-height: 1.2;
      pointer-events: auto; /* Capture events */
      cursor: inherit;
    }

    .annotation-line {
      position: absolute;
      pointer-events: none;
    }

    .line-svg {
      position: absolute;
      overflow: visible;
    }

    /* Position variants */
    .annotation.above .annotation-box {
      transform: translate(-50%, -100%) translateY(-8px);
    }

    .annotation.below .annotation-box {
      transform: translate(-50%, 0) translateY(8px);
    }

    .annotation.left .annotation-box {
      transform: translate(-100%, -50%) translateX(-8px);
    }

    .annotation.right .annotation-box {
      transform: translate(0, -50%) translateX(8px);
    }

    /* Anchored to top/bottom (no price) */
    .annotation.anchored-top {
      top: 16px !important;
    }

    .annotation.anchored-bottom {
      bottom: 16px !important;
    }
  `;

  /**
   * Get visible annotations within the current time range
   */
  private getVisibleAnnotations(): Annotation[] {
    if (!this.state?.timeRange) return this.annotations;

    const { start, end } = this.state.timeRange;
    return this.annotations
      .filter(
        (annotation) =>
          annotation.timestamp >= start && annotation.timestamp <= end,
      )
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)); // Sort by z-index
  }

  /**
   * Convert timestamp to X pixel coordinate
   */
  private timestampToX(timestamp: number): number {
    if (!this.state?.timeRange || this.width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = (timestamp - start) / timeRange;
    return ratio * this.width;
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
   * Convert X pixel coordinate to timestamp
   */
  private xToTimestamp(x: number): number {
    if (!this.state?.timeRange || this.width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = x / this.width;
    return start + ratio * timeRange;
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
  private getStrokeDashArray(style: "solid" | "dashed" | "dotted"): string {
    switch (style) {
      case "dashed":
        return "8,4";
      case "dotted":
        return "2,3";
      case "solid":
      default:
        return "none";
    }
  }

  /**
   * Handle annotation click
   */
  private handleAnnotationClick(
    annotation: Annotation,
    event: MouseEvent,
  ): void {
    if (!annotation.interactive) return;

    event.stopPropagation();

    const clickEvent: AnnotationClickedEvent = {
      annotationId: annotation.id,
      annotation,
    };

    this.dispatchEvent(
      new CustomEvent("annotation-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      }),
    );

    logger.debug(`Annotation clicked: ${annotation.id}`);
  }

  /**
   * Handle annotation hover
   */
  private handleAnnotationHover(annotation: Annotation): void {
    if (!annotation.interactive) return;

    const hoverEvent: AnnotationHoveredEvent = {
      annotationId: annotation.id,
      annotation,
    };

    this.dispatchEvent(
      new CustomEvent("annotation-hovered", {
        detail: hoverEvent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Handle drag start
   */
  private handleDragStart(annotation: Annotation, event: MouseEvent): void {
    logger.debug(
      `Annotation mousedown handler called for: ${annotation.id}, draggable: ${annotation.draggable}`,
    );

    // Always stop propagation for annotation clicks to prevent chart panning
    // Use stopImmediatePropagation to prevent other handlers on the same element
    event.stopImmediatePropagation();
    event.stopPropagation();

    if (!annotation.draggable) {
      logger.debug(
        `Annotation ${annotation.id} is not draggable, stopping here`,
      );
      return;
    }

    event.preventDefault();

    this.draggedAnnotationId = annotation.id;
    this.dragStartX = event.clientX;
    this.dragStartY = event.clientY;
    this.dragStartTimestamp = annotation.timestamp;
    this.dragStartPrice = annotation.price;

    // Add global mouse move and up listeners
    document.addEventListener("mousemove", this.handleDragMove);
    document.addEventListener("mouseup", this.handleDragEnd);

    logger.debug(`Started dragging annotation: ${annotation.id}`);
  }

  /**
   * Handle drag move
   */
  private handleDragMove = (event: MouseEvent): void => {
    if (!this.draggedAnnotationId) return;

    const annotation = this.annotations.find(
      (a) => a.id === this.draggedAnnotationId,
    );
    if (!annotation) return;

    // Calculate new position based on mouse movement
    const deltaX = event.clientX - this.dragStartX;
    const deltaY = event.clientY - this.dragStartY;

    // Convert delta to time and price
    const currentX = this.timestampToX(this.dragStartTimestamp) + deltaX;
    const newTimestamp = this.xToTimestamp(currentX);

    let newPrice: number | undefined = this.dragStartPrice;
    if (this.dragStartPrice !== undefined) {
      const currentY = this.priceToY(this.dragStartPrice) + deltaY;
      newPrice = this.yToPrice(currentY);
    }

    // Store current drag position for visual feedback
    this.currentDragTimestamp = newTimestamp;
    this.currentDragPrice = newPrice;

    // Emit drag event
    const dragEvent: AnnotationDraggedEvent = {
      annotationId: annotation.id,
      oldTimestamp: annotation.timestamp,
      oldPrice: annotation.price,
      newTimestamp,
      newPrice,
      annotation,
    };

    this.dispatchEvent(
      new CustomEvent("annotation-dragged", {
        detail: dragEvent,
        bubbles: true,
        composed: true,
      }),
    );

    this.requestUpdate();
  };

  /**
   * Handle drag end
   */
  private handleDragEnd = (event: MouseEvent): void => {
    if (!this.draggedAnnotationId) return;

    const annotation = this.annotations.find(
      (a) => a.id === this.draggedAnnotationId,
    );

    if (annotation) {
      // Calculate final position based on mouse movement
      const deltaX = event.clientX - this.dragStartX;
      const deltaY = event.clientY - this.dragStartY;

      // Convert delta to time and price
      const currentX = this.timestampToX(this.dragStartTimestamp) + deltaX;
      const newTimestamp = this.xToTimestamp(currentX);

      let newPrice: number | undefined = this.dragStartPrice;
      if (this.dragStartPrice !== undefined) {
        const currentY = this.priceToY(this.dragStartPrice) + deltaY;
        newPrice = this.yToPrice(currentY);
      }

      // Update the annotation position via the chart container
      // Use getRootNode().host to access the shadow DOM host (chart-container)
      const root = this.getRootNode() as ShadowRoot;
      const container = root?.host as any;

      if (container && container.updateAnnotation) {
        // Merge new position with existing annotation properties
        const updatedAnnotation = {
          ...annotation,
          timestamp: newTimestamp,
          price: newPrice,
        };

        container.updateAnnotation(this.draggedAnnotationId, updatedAnnotation);
      }

      logger.debug(
        `Finished dragging annotation: ${this.draggedAnnotationId} to timestamp: ${newTimestamp}, price: ${newPrice}`,
      );
    }

    this.draggedAnnotationId = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTimestamp = 0;
    this.dragStartPrice = undefined;
    this.currentDragTimestamp = null;
    this.currentDragPrice = undefined;

    // Remove global listeners
    document.removeEventListener("mousemove", this.handleDragMove);
    document.removeEventListener("mouseup", this.handleDragEnd);

    this.requestUpdate();
  };

  /**
   * Render annotation icon
   */
  private renderIcon(annotation: Annotation): unknown {
    if (!annotation.icon) return null;

    // Check if it's an SVG path or emoji
    if (annotation.icon.startsWith("<svg") || annotation.icon.startsWith("M")) {
      // SVG icon
      return html`
        <div class="annotation-icon" innerHTML="${annotation.icon}"></div>
      `;
    } else {
      // Emoji or text icon
      return html`<div class="annotation-icon">${annotation.icon}</div>`;
    }
  }

  /**
   * Render connecting line from annotation to price level
   */
  private renderConnectingLine(
    annotation: Annotation,
    x: number,
    y: number,
  ): unknown {
    if (!annotation.showLine || annotation.price === undefined) return null;

    const lineColor = annotation.borderColor || annotation.color || "#8b5cf6";
    const lineStyle = annotation.lineStyle || "solid";

    // Calculate line endpoint (at price level)
    const priceY = this.priceToY(annotation.price);

    // Estimate annotation box dimensions for offset calculations
    const estimatedBoxHeight = 32; // Approximate height of annotation box
    const estimatedBoxWidth = 120; // Approximate width of annotation box
    const gap = 8; // Gap from CSS transforms (translateY/translateX)

    // Determine line start point based on position
    // The annotation div is positioned at (x, y) where y = priceY
    // CSS transforms move the box, so we need to adjust the line start accordingly
    let startX = x;
    let startY = y;
    let endX = x;
    let endY = priceY;

    // Adjust based on annotation position to account for CSS transforms
    switch (annotation.position) {
      case "above":
        // Box is moved up by 100% of height + gap
        // Line should start from bottom edge of box to exact price level
        startY = y - estimatedBoxHeight - gap;
        endY = priceY;
        break;
      case "below":
        // Box is moved down by gap
        // Line should start from top edge of box to exact price level
        startY = y + gap;
        endY = priceY;
        break;
      case "left":
        // Box is moved left by 100% of width + gap
        // Line should start from right edge of box to exact timestamp
        startX = x - gap;
        endX = x;
        startY = y; // Vertically centered
        endY = y; // Horizontal line
        break;
      case "right":
        // Box is moved right by gap
        // Line should start from left edge of box to exact timestamp
        startX = x + gap;
        endX = x;
        startY = y; // Vertically centered
        endY = y; // Horizontal line
        break;
    }

    // Calculate line length to exact price/time coordinates
    const lineLength = Math.sqrt(
      Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2),
    );

    // Only render if line has meaningful length
    if (lineLength < 2) return null;

    const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);

    return html`
      <div
        class="annotation-line"
        style="
          left: ${startX}px;
          top: ${startY}px;
          width: ${lineLength}px;
          transform: rotate(${angle}deg);
          transform-origin: 0 0;
        "
      >
        <svg class="line-svg" width="${lineLength}" height="10">
          <line
            x1="0"
            y1="5"
            x2="${lineLength}"
            y2="5"
            stroke="${lineColor}"
            stroke-width="2"
            stroke-dasharray="${this.getStrokeDashArray(lineStyle)}"
            vector-effect="non-scaling-stroke"
          />
          <circle
            cx="${lineLength}"
            cy="5"
            r="4"
            fill="${lineColor}"
            stroke="${lineColor}"
            stroke-width="1"
          />
        </svg>
      </div>
    `;
  }

  // Removed firstUpdated() - the @mousedown handler on annotation elements
  // already handles stopPropagation() properly

  disconnectedCallback() {
    super.disconnectedCallback();
    // Clean up drag listeners if component is removed while dragging
    document.removeEventListener("mousemove", this.handleDragMove);
    document.removeEventListener("mouseup", this.handleDragEnd);
  }

  render() {
    const visibleAnnotations = this.getVisibleAnnotations();

    return html`
      <div class="annotations-container">
        ${visibleAnnotations.map((annotation) => {
          const isDragging = this.draggedAnnotationId === annotation.id;

          // Use current drag position if dragging, otherwise use annotation position
          const displayTimestamp =
            isDragging && this.currentDragTimestamp !== null
              ? this.currentDragTimestamp
              : annotation.timestamp;
          const displayPrice =
            isDragging && this.currentDragPrice !== undefined
              ? this.currentDragPrice
              : annotation.price;

          const x = this.timestampToX(displayTimestamp);

          // Determine Y position
          let y: number;
          let isAnchored = false;
          let anchorClass = "";

          if (displayPrice !== undefined) {
            // Anchored to price level
            y = this.priceToY(displayPrice);
          } else {
            // Anchored to top or bottom
            isAnchored = true;
            anchorClass =
              annotation.position === "below"
                ? "anchored-bottom"
                : "anchored-top";
            y = annotation.position === "below" ? this.height - 16 : 16;
          }

          // Position class
          const positionClass = annotation.position || "above";

          // Colors
          const bgColor = annotation.backgroundColor || "#8b5cf6";
          const textColor = annotation.color || "#ffffff";
          const borderColor = annotation.borderColor || bgColor;
          const fontSize = annotation.fontSize || 12;

          return html`
            ${this.renderConnectingLine(annotation, x, y)}
            <div
              class="annotation ${positionClass} ${anchorClass} ${annotation.draggable
                ? "draggable"
                : ""} ${isDragging ? "dragging" : ""}"
              style="left: ${x}px; ${!isAnchored
                ? `top: ${y}px;`
                : ""} z-index: ${annotation.zIndex};"
              @click="${(e: MouseEvent) =>
                this.handleAnnotationClick(annotation, e)}"
              @mouseenter="${() => this.handleAnnotationHover(annotation)}"
              @mousedown="${(e: MouseEvent) =>
                this.handleDragStart(annotation, e)}"
            >
              <div
                class="annotation-box"
                style="
                  background-color: ${bgColor};
                  color: ${textColor};
                  border-color: ${borderColor};
                  font-size: ${fontSize}px;
                "
              >
                ${this.renderIcon(annotation)}
                <div class="annotation-text">${annotation.text}</div>
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}
