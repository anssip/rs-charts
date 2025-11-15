/**
 * Interaction layer for time markers (vertical event lines).
 *
 * Handles hit testing and click events for time marker elements.
 * Works in conjunction with the time-markers-layer Lit component.
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import { TimeMarker, TimeMarkerClickedEvent } from "../../../../types/trading-overlays";
import { getLogger, LogLevel } from "../../../../util/logger";

const logger = getLogger("TimeMarkersInteractionLayer");
logger.setLoggerLevel("TimeMarkersInteractionLayer", LogLevel.DEBUG);

export class TimeMarkersInteractionLayer extends BaseInteractionLayer {
  readonly id = "time-markers";
  readonly priority = 40; // Medium priority - below price lines (90), above live candle (10)

  private timeMarkersGetter: () => TimeMarker[];

  constructor(
    container: HTMLElement,
    state: ChartState,
    timeMarkersGetter: () => TimeMarker[],
  ) {
    super(container, state);
    this.timeMarkersGetter = timeMarkersGetter;
  }

  /**
   * Convert timestamp to X pixel coordinate
   */
  private timestampToX(timestamp: number): number {
    if (!this.state?.timeRange) return 0;

    const containerRect = this.container.getBoundingClientRect();
    const width = containerRect.width;
    if (width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = (timestamp - start) / timeRange;
    return ratio * width;
  }

  /**
   * Convert X pixel coordinate to timestamp
   */
  private xToTimestamp(x: number): number {
    if (!this.state?.timeRange) return 0;

    const containerRect = this.container.getBoundingClientRect();
    const width = containerRect.width;
    if (width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = x / width;
    return start + ratio * timeRange;
  }

  /**
   * Get visible time markers within the current time range
   */
  private getVisibleMarkers(): TimeMarker[] {
    const markers = this.timeMarkersGetter();
    if (!this.state?.timeRange) return markers;

    const { start, end } = this.state.timeRange;
    return markers.filter(
      (marker) => marker.timestamp >= start && marker.timestamp <= end
    );
  }

  /**
   * Test if event hits a time marker
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    const visibleMarkers = this.getVisibleMarkers();
    const position = this.getEventPosition(event);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Hit test threshold (pixels left and right of the line)
    const hitThreshold = 5;

    // Check each visible marker (in reverse order to respect z-index)
    for (let i = visibleMarkers.length - 1; i >= 0; i--) {
      const marker = visibleMarkers[i];

      const markerX = this.timestampToX(marker.timestamp);
      const distance = Math.abs(containerPos.x - markerX);

      if (distance <= hitThreshold) {
        logger.debug(`Hit test succeeded for time marker: ${marker.id}`);
        return {
          target: marker,
          type: "click",
          cursor: "pointer",
          metadata: { marker },
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
      case "click":
        return this.handleClick(event);
      default:
        return false;
    }
  }

  /**
   * Handle click event
   */
  private handleClick(event: InteractionEvent): boolean {
    // Find which marker was clicked
    const hitResult = this.hitTest(event.originalEvent);
    if (!hitResult || !hitResult.metadata?.marker) {
      return false;
    }

    const marker = hitResult.metadata.marker;

    // Dispatch time-marker-clicked event
    const clickEvent: TimeMarkerClickedEvent = {
      markerId: marker.id,
      marker,
    };

    this.container.dispatchEvent(
      new CustomEvent("time-marker-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      }),
    );

    logger.debug(`Time marker clicked: ${marker.id}`);
    return true;
  }

  /**
   * Handle viewport transform (pan/zoom)
   * Time markers are automatically repositioned by the time-markers-layer component
   * based on state changes, so we don't need to do anything here.
   */
  onTransform(transform: ViewportTransform): void {
    // No action needed - the component handles its own positioning
    // based on state.timeRange which is already updated
  }

  /**
   * Cleanup
   */
  destroy(): void {
    // No cleanup needed
  }
}
