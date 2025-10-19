import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { TimeMarker } from "../../../types/trading-overlays";
import type { TimeMarkersLayer } from "../time-markers-layer";
import type { TimeMarkersInteractionLayer } from "./layers/time-markers-layer";
import { logger } from "../../../util/logger";

export interface TimeMarkersControllerOptions {
  container: HTMLElement;
  state: ChartState;
  timeMarkersLayer?: TimeMarkersLayer;
  timeMarkersInteractionLayer?: TimeMarkersInteractionLayer;
}

/**
 * Controller for managing time markers in the chart.
 * Handles both rendering layer (TimeMarkersLayer) and interaction layer (TimeMarkersInteractionLayer).
 */
export class TimeMarkersController {
  private container: HTMLElement;
  private state: ChartState;
  private renderingLayer?: TimeMarkersLayer;
  private interactionLayer?: TimeMarkersInteractionLayer;

  constructor(options: TimeMarkersControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.renderingLayer = options.timeMarkersLayer;
    this.interactionLayer = options.timeMarkersInteractionLayer;

    logger.debug("TimeMarkersController: Initialized");
  }

  /**
   * Add a new time marker to the chart
   */
  add(marker: TimeMarker): void {
    logger.debug("TimeMarkersController: Adding time marker", marker);

    if (!this.state.timeMarkers) {
      this.state.timeMarkers = [];
    }

    // Ensure the marker has an ID
    if (!marker.id) {
      marker.id = `marker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logger.debug("TimeMarkersController: Generated marker ID", marker.id);
    }

    // Check if marker with this ID already exists
    const existingIndex = this.state.timeMarkers.findIndex(
      (m: TimeMarker) => m.id === marker.id,
    );
    if (existingIndex !== -1) {
      logger.warn(
        "TimeMarkersController: Marker with ID already exists, replacing",
        marker.id,
      );
      this.state.timeMarkers[existingIndex] = marker;
    } else {
      this.state.timeMarkers.push(marker);
    }

    touch("state.timeMarkers");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("time-marker-added", { marker });
  }

  /**
   * Remove a time marker from the chart
   */
  remove(markerId: string): void {
    logger.debug("TimeMarkersController: Removing time marker", markerId);

    if (!this.state.timeMarkers) {
      logger.warn("TimeMarkersController: No time markers to remove");
      return;
    }

    const index = this.state.timeMarkers.findIndex(
      (m: TimeMarker) => m.id === markerId,
    );
    if (index === -1) {
      logger.warn("TimeMarkersController: Marker not found", markerId);
      return;
    }

    const removedMarker = this.state.timeMarkers[index];
    this.state.timeMarkers.splice(index, 1);

    touch("state.timeMarkers");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("time-marker-removed", {
      markerId,
      marker: removedMarker,
    });
  }

  /**
   * Update an existing time marker
   */
  update(markerId: string, updates: Partial<TimeMarker>): void {
    logger.debug("TimeMarkersController: Updating time marker", markerId, updates);

    if (!this.state.timeMarkers) {
      logger.warn("TimeMarkersController: No time markers to update");
      return;
    }

    const marker = this.state.timeMarkers.find(
      (m: TimeMarker) => m.id === markerId,
    );
    if (!marker) {
      logger.warn("TimeMarkersController: Marker not found", markerId);
      return;
    }

    // Apply updates
    Object.assign(marker, updates);

    touch("state.timeMarkers");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("time-marker-updated", { markerId, marker, updates });
  }

  /**
   * Clear all time markers
   */
  clear(): void {
    logger.debug("TimeMarkersController: Clearing all time markers");

    if (!this.state.timeMarkers || this.state.timeMarkers.length === 0) {
      logger.debug("TimeMarkersController: No time markers to clear");
      return;
    }

    this.state.timeMarkers = [];
    touch("state.timeMarkers");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("time-markers-cleared", {});
  }

  /**
   * Get all time markers
   */
  getAll(): TimeMarker[] {
    return this.state.timeMarkers || [];
  }

  /**
   * Get a specific time marker by ID
   */
  get(markerId: string): TimeMarker | null {
    if (!this.state.timeMarkers) {
      return null;
    }

    return (
      this.state.timeMarkers.find((m: TimeMarker) => m.id === markerId) || null
    );
  }

  /**
   * Update the rendering layer
   */
  private updateLayer(): void {
    if (this.renderingLayer) {
      this.renderingLayer.markers = this.state.timeMarkers || [];
      this.renderingLayer.state = this.state;
      this.renderingLayer.requestUpdate();
      logger.debug("TimeMarkersController: Updated rendering layer");
    }
  }

  /**
   * Set the interaction layer (called after layer is created)
   */
  setInteractionLayer(layer: TimeMarkersInteractionLayer): void {
    this.interactionLayer = layer;
    logger.debug("TimeMarkersController: Interaction layer set");
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
    logger.debug("TimeMarkersController: Destroying controller");
    this.renderingLayer = undefined;
    this.interactionLayer = undefined;
  }
}
