import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { PatternHighlight } from "../../../types/markers";
import type { PatternLabelsLayer } from "../pattern-labels-layer";
import { logger } from "../../../util/logger";

export interface PatternHighlightsControllerOptions {
  container: HTMLElement;
  state: ChartState;
  patternLabelsLayer?: PatternLabelsLayer;
}

/**
 * Controller for managing pattern highlights in the chart.
 * Handles the pattern labels layer (rendering only, no interaction layer needed).
 * The layer itself handles pattern clicks and tooltip interactions.
 */
export class PatternHighlightsController {
  private container: HTMLElement;
  private state: ChartState;
  private layer?: PatternLabelsLayer;

  constructor(options: PatternHighlightsControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.layer = options.patternLabelsLayer;

    logger.debug("PatternHighlightsController: Initialized");
  }

  /**
   * Set pattern highlights to be displayed on the chart
   */
  set(patterns: PatternHighlight[]): void {
    logger.debug("PatternHighlightsController: Setting pattern highlights", {
      count: patterns.length,
    });

    // Store in state
    this.state.patternHighlights = patterns;
    touch("state.patternHighlights");

    // Update layer
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("patterns-highlighted", { patterns });
    logger.debug(
      `PatternHighlightsController: Set ${patterns.length} pattern highlights`,
    );
  }

  /**
   * Get current pattern highlights
   */
  get(): PatternHighlight[] {
    return this.state.patternHighlights || [];
  }

  /**
   * Clear all pattern highlights
   */
  clear(): void {
    logger.debug("PatternHighlightsController: Clearing pattern highlights");

    // Clear state
    this.state.patternHighlights = [];
    touch("state.patternHighlights");

    // Clear layer
    if (this.layer) {
      this.layer.clearPatterns();
      logger.debug("PatternHighlightsController: Cleared layer patterns");
    }

    // Dispatch event
    this.dispatchEvent("patterns-cleared", {});
    logger.debug("PatternHighlightsController: Cleared all pattern highlights");
  }

  /**
   * Update the rendering layer
   */
  private updateLayer(): void {
    if (this.layer) {
      const patterns = this.state.patternHighlights || [];
      this.layer.setPatterns(patterns);
      logger.debug("PatternHighlightsController: Updated layer", {
        patternCount: patterns.length,
      });
    }
  }

  /**
   * Dispatch custom events from the controller
   */
  private dispatchEvent(eventName: string, detail: any): void {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true,
    });
    this.container.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    logger.debug("PatternHighlightsController: Destroying controller");
    this.layer = undefined;
  }
}
