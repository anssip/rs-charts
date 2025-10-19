import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { RiskZone } from "../../../types/trading-overlays";
import type { RiskZonesLayer } from "../risk-zones-layer";
import type { RiskZonesCanvasLayer } from "../risk-zones-canvas-layer";
import { logger } from "../../../util/logger";

export interface RiskZonesControllerOptions {
  container: HTMLElement;
  state: ChartState;
  riskZonesCanvasLayer?: RiskZonesCanvasLayer;
  riskZonesInteractionLayer?: RiskZonesLayer;
}

/**
 * Controller for managing risk zones in the chart.
 * Handles both canvas layer (rendering) and interaction layer (hit testing/dragging).
 */
export class RiskZonesController {
  private container: HTMLElement;
  private state: ChartState;
  private canvasLayer?: RiskZonesCanvasLayer;
  private interactionLayer?: RiskZonesLayer;

  constructor(options: RiskZonesControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.canvasLayer = options.riskZonesCanvasLayer;
    this.interactionLayer = options.riskZonesInteractionLayer;

    logger.debug("RiskZonesController: Initialized");
  }

  /**
   * Add a new risk zone to the chart
   */
  add(zone: RiskZone): void {
    logger.debug("RiskZonesController: Adding risk zone", zone);

    if (!this.state.riskZones) {
      this.state.riskZones = [];
    }

    // Ensure the zone has an ID
    if (!zone.id) {
      zone.id = `zone-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logger.debug("RiskZonesController: Generated zone ID", zone.id);
    }

    // Check if zone with this ID already exists
    const existingIndex = this.state.riskZones.findIndex(
      (z: RiskZone) => z.id === zone.id,
    );
    if (existingIndex !== -1) {
      logger.warn(
        "RiskZonesController: Zone with ID already exists, replacing",
        zone.id,
      );
      this.state.riskZones[existingIndex] = zone;
    } else {
      this.state.riskZones.push(zone);
    }

    touch("state.riskZones");
    this.updateLayers();

    // Dispatch event
    this.dispatchEvent("risk-zone-added", { zone });
  }

  /**
   * Remove a risk zone from the chart
   */
  remove(zoneId: string): void {
    logger.debug("RiskZonesController: Removing risk zone", zoneId);

    if (!this.state.riskZones) {
      logger.warn("RiskZonesController: No risk zones to remove");
      return;
    }

    const index = this.state.riskZones.findIndex(
      (z: RiskZone) => z.id === zoneId,
    );
    if (index === -1) {
      logger.warn("RiskZonesController: Zone not found", zoneId);
      return;
    }

    const removedZone = this.state.riskZones[index];
    this.state.riskZones.splice(index, 1);

    touch("state.riskZones");
    this.updateLayers();

    // Dispatch event
    this.dispatchEvent("risk-zone-removed", { zoneId, zone: removedZone });
  }

  /**
   * Update an existing risk zone
   */
  update(zoneId: string, updates: Partial<RiskZone>): void {
    logger.debug("RiskZonesController: Updating risk zone", zoneId, updates);

    if (!this.state.riskZones) {
      logger.warn("RiskZonesController: No risk zones to update");
      return;
    }

    const zone = this.state.riskZones.find((z: RiskZone) => z.id === zoneId);
    if (!zone) {
      logger.warn("RiskZonesController: Zone not found", zoneId);
      return;
    }

    // Apply updates
    Object.assign(zone, updates);

    touch("state.riskZones");
    this.updateLayers();

    // Dispatch event
    this.dispatchEvent("risk-zone-updated", { zoneId, zone, updates });
  }

  /**
   * Clear all risk zones
   */
  clear(): void {
    logger.debug("RiskZonesController: Clearing all risk zones");

    if (!this.state.riskZones || this.state.riskZones.length === 0) {
      logger.debug("RiskZonesController: No risk zones to clear");
      return;
    }

    this.state.riskZones = [];
    touch("state.riskZones");
    this.updateLayers();

    // Dispatch event
    this.dispatchEvent("risk-zones-cleared", {});
  }

  /**
   * Get all risk zones
   */
  getAll(): RiskZone[] {
    return this.state.riskZones || [];
  }

  /**
   * Get a specific risk zone by ID
   */
  get(zoneId: string): RiskZone | null {
    if (!this.state.riskZones) {
      return null;
    }

    return this.state.riskZones.find((z: RiskZone) => z.id === zoneId) || null;
  }

  /**
   * Update both canvas and interaction layers
   */
  private updateLayers(): void {
    // Update canvas layer (rendering)
    if (this.canvasLayer) {
      this.canvasLayer.zones = this.state.riskZones || [];
      this.canvasLayer.requestUpdate();
      logger.debug("RiskZonesController: Updated canvas layer");
    }

    // Update interaction layer (hit testing)
    if (this.interactionLayer) {
      this.interactionLayer.setZones(this.state.riskZones || []);
      logger.debug("RiskZonesController: Updated interaction layer");
    }
  }

  /**
   * Set the interaction layer (called after layer is created)
   */
  setInteractionLayer(layer: RiskZonesLayer): void {
    this.interactionLayer = layer;
    logger.debug("RiskZonesController: Interaction layer set");
    this.updateLayers();
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
    logger.debug("RiskZonesController: Destroying controller");
    this.canvasLayer = undefined;
    this.interactionLayer = undefined;
  }
}
