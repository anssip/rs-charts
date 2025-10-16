/**
 * Interaction layer for price lines (orders, stop losses, take profits).
 *
 * Handles hit testing and dragging for price line elements.
 * Works in conjunction with the price-lines-layer Lit component.
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import { PriceLine, PriceLineDraggedEvent } from "../../../../types/trading-overlays";
import { getLogger, LogLevel } from "../../../../util/logger";

const logger = getLogger("PriceLinesInteractionLayer");
logger.setLoggerLevel("PriceLinesInteractionLayer", LogLevel.DEBUG);

export class PriceLinesInteractionLayer extends BaseInteractionLayer {
  readonly id = "price-lines";
  readonly priority = 90; // High priority - above trend lines, below annotations

  private draggedLine: PriceLine | null = null;
  private dragStartY: number = 0;
  private dragStartPrice: number = 0;
  private priceLinesGetter: () => PriceLine[];

  constructor(
    container: HTMLElement,
    state: ChartState,
    priceLinesGetter: () => PriceLine[],
  ) {
    super(container, state);
    this.priceLinesGetter = priceLinesGetter;
  }

  /**
   * Convert price to Y pixel coordinate
   */
  private priceToY(price: number): number {
    if (!this.state?.priceRange) return 0;

    const containerRect = this.container.getBoundingClientRect();
    const height = containerRect.height;
    if (height === 0) return 0;

    const { min, max } = this.state.priceRange;
    const priceRange = max - min;
    const ratio = (max - price) / priceRange;
    return ratio * height;
  }

  /**
   * Convert Y pixel coordinate to price
   */
  private yToPrice(y: number): number {
    if (!this.state?.priceRange) return 0;

    const containerRect = this.container.getBoundingClientRect();
    const height = containerRect.height;
    if (height === 0) return 0;

    const { min, max } = this.state.priceRange;
    const priceRange = max - min;
    const ratio = y / height;
    return max - ratio * priceRange;
  }

  /**
   * Get visible price lines within the current price range
   */
  private getVisibleLines(): PriceLine[] {
    const lines = this.priceLinesGetter();
    if (!this.state?.priceRange) return lines;

    const { min, max } = this.state.priceRange;
    return lines.filter((line) => line.price >= min && line.price <= max);
  }

  /**
   * Test if event hits a draggable price line
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    const visibleLines = this.getVisibleLines();
    const position = this.getEventPosition(event);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Hit test threshold (pixels above and below the line)
    const hitThreshold = 5;

    // Check each visible line (in reverse order to respect z-index)
    for (let i = visibleLines.length - 1; i >= 0; i--) {
      const line = visibleLines[i];

      // Only check draggable lines
      if (!line.draggable) continue;

      const lineY = this.priceToY(line.price);
      const distance = Math.abs(containerPos.y - lineY);

      if (distance <= hitThreshold) {
        logger.debug(`Hit test succeeded for price line: ${line.id}`);
        return {
          target: line,
          type: "drag",
          cursor: "ns-resize",
          metadata: { line },
        };
      }
    }

    return null;
  }

  /**
   * Handle interaction events
   */
  handleInteraction(event: InteractionEvent): boolean {
    switch (event.type) {
      case "dragstart":
        return this.handleDragStart(event);
      case "drag":
        return this.handleDrag(event);
      case "dragend":
        return this.handleDragEnd(event);
      default:
        return false;
    }
  }

  /**
   * Handle drag start
   */
  private handleDragStart(event: InteractionEvent): boolean {
    const position = this.getEventPosition(event.originalEvent);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Find which line was clicked
    const hitResult = this.hitTest(event.originalEvent);
    if (!hitResult || !hitResult.metadata?.line) {
      return false;
    }

    const line = hitResult.metadata.line;
    this.draggedLine = line;
    this.dragStartY = containerPos.y;
    this.dragStartPrice = line.price;

    logger.debug(`Drag start on price line: ${line.id}`);
    return true;
  }

  /**
   * Handle drag move
   */
  private handleDrag(event: InteractionEvent): boolean {
    if (!this.draggedLine) return false;

    const position = this.getEventPosition(event.originalEvent);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Calculate new price based on mouse movement
    const deltaY = containerPos.y - this.dragStartY;
    const startLineY = this.priceToY(this.dragStartPrice);
    const newLineY = startLineY + deltaY;
    const newPrice = this.yToPrice(newLineY);

    // Dispatch price-line-dragged event
    const dragEvent: PriceLineDraggedEvent = {
      lineId: this.draggedLine.id,
      oldPrice: this.draggedLine.price,
      newPrice,
      line: this.draggedLine,
    };

    this.container.dispatchEvent(
      new CustomEvent("price-line-dragged", {
        detail: dragEvent,
        bubbles: true,
        composed: true,
      }),
    );

    return true;
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(event: InteractionEvent): boolean {
    if (!this.draggedLine) return false;

    logger.debug(`Drag end on price line: ${this.draggedLine.id}`);

    this.draggedLine = null;
    this.dragStartY = 0;
    this.dragStartPrice = 0;

    return true;
  }

  /**
   * Handle viewport transform (pan/zoom)
   * Price lines are automatically repositioned by the price-lines-layer component
   * based on state changes, so we don't need to do anything here.
   */
  onTransform(transform: ViewportTransform): void {
    // No action needed - the component handles its own positioning
    // based on state.priceRange which is already updated
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.draggedLine = null;
  }
}
