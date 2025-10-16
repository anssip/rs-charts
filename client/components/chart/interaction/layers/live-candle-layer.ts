/**
 * Interaction layer for live candle display (click to show candle info).
 *
 * Handles click detection on the chart to show/hide the live candle display.
 * Has low priority - only activates if no other layer claims the interaction.
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import { getLogger, LogLevel } from "../../../../util/logger";

const logger = getLogger("LiveCandleInteractionLayer");
logger.setLoggerLevel("LiveCandleInteractionLayer", LogLevel.DEBUG);

export class LiveCandleInteractionLayer extends BaseInteractionLayer {
  readonly id = "live-candle";
  readonly priority = 10; // Low priority - only when nothing else is clicked

  private clickStartX = 0;
  private clickStartY = 0;
  private readonly clickThreshold = 5; // pixels - max movement to consider it a click

  constructor(container: HTMLElement, state: ChartState) {
    super(container, state);
  }

  /**
   * Hit test always returns null - this layer doesn't claim dragstart events.
   * It only responds to click events (dragstart + dragend with minimal movement).
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    // This layer doesn't claim dragstart events
    // It will only activate on actual clicks (handled in handleInteraction)
    return null;
  }

  /**
   * Handle interaction events.
   * We only respond to click events (dragstart followed by dragend with minimal movement).
   */
  handleInteraction(event: InteractionEvent): boolean {
    switch (event.type) {
      case "dragstart":
        // Remember start position
        const position = this.getEventPosition(event.originalEvent);
        this.clickStartX = position.x;
        this.clickStartY = position.y;
        return false; // Don't claim the interaction

      case "dragend": {
        // Check if this was a click (minimal movement)
        const position = this.getEventPosition(event.originalEvent);
        const deltaX = position.x - this.clickStartX;
        const deltaY = position.y - this.clickStartY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance <= this.clickThreshold) {
          // This was a click! Show the live candle display
          logger.debug("Click detected - showing live candle display");
          this.handleClick(event);
          return true;
        }
        return false;
      }

      default:
        return false;
    }
  }

  /**
   * Handle click event - dispatch event for live candle display
   */
  private handleClick(event: InteractionEvent): void {
    const position = this.getEventPosition(event.originalEvent);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Dispatch click event
    this.container.dispatchEvent(
      new CustomEvent("chart-clicked", {
        detail: {
          clientX: position.x,
          clientY: position.y,
          containerX: containerPos.x,
          containerY: containerPos.y,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Handle viewport transform (pan/zoom)
   */
  onTransform(transform: ViewportTransform): void {
    // No action needed
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed
  }
}
