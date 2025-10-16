/**
 * Interaction layer for trend lines.
 *
 * Handles hit testing for trend line elements.
 * Trend lines have their own complex interaction logic (drawing, dragging, selecting),
 * so this layer primarily acts as a coordinator to ensure they get priority in the interaction system.
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import { getLogger, LogLevel } from "../../../../util/logger";

const logger = getLogger("TrendLinesInteractionLayer");
logger.setLoggerLevel("TrendLinesInteractionLayer", LogLevel.DEBUG);

export class TrendLinesInteractionLayer extends BaseInteractionLayer {
  readonly id = "trend-lines";
  readonly priority = 80; // Below annotations and price lines

  constructor(container: HTMLElement, state: ChartState) {
    super(container, state);
  }

  /**
   * Test if event hits a trend line element.
   * Trend lines handle their own interactions, so we just need to detect them.
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    // Check if the event originated from a trend line element
    // Use composedPath to check inside shadow DOM
    const path = event.composedPath();

    for (const element of path) {
      if (element instanceof HTMLElement) {
        const tagName = element.tagName?.toLowerCase();

        // Check if this is a trend-line element or inside one
        if (tagName === "trend-line" || element.classList.contains("trend-line")) {
          logger.debug("Hit test succeeded for trend line element");
          return {
            target: element,
            type: "drag",
            cursor: "move",
            metadata: { element },
          };
        }
      }
    }

    return null;
  }

  /**
   * Handle interaction events.
   * Trend lines handle their own events, so we just need to claim the interaction
   * to prevent chart panning.
   */
  handleInteraction(event: InteractionEvent): boolean {
    // By returning true, we prevent the chart from handling this as a pan
    // The trend-line element's own handlers will process the actual interaction
    return true;
  }

  /**
   * Handle viewport transform (pan/zoom)
   * Trend lines are automatically repositioned by the trend-line-layer component
   * based on state changes, so we don't need to do anything here.
   */
  onTransform(transform: ViewportTransform): void {
    // No action needed - the component handles its own positioning
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed
  }
}
