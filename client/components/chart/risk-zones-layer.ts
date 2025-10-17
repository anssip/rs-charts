import {
  InteractionLayer,
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "./interaction/interaction-layer";
import { RiskZone } from "../../types/trading-overlays";
import { RiskZonesRenderer } from "./risk-zones-renderer";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("RiskZonesLayer");
logger.setLoggerLevel("RiskZonesLayer", LogLevel.DEBUG);

/**
 * Interaction layer for risk zones
 * Handles rendering, hit testing, and interaction events for risk zone overlays
 */
export class RiskZonesLayer implements InteractionLayer {
  readonly id = "risk-zones";
  readonly priority = 50; // Risk zones priority (see InteractionLayer documentation)

  private zones: RiskZone[] = [];
  private visibleZones: RiskZone[] = [];
  private renderer: RiskZonesRenderer;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private transform: ViewportTransform | null = null;
  private hoveredZone: RiskZone | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get 2D context from canvas");
    }
    this.ctx = ctx;
    this.renderer = new RiskZonesRenderer();
    logger.debug("RiskZonesLayer initialized");
  }

  /**
   * Set the risk zones to be managed by this layer
   */
  setZones(zones: RiskZone[]): void {
    this.zones = zones;
    this.updateVisibleZones();
    logger.debug(`Set ${zones.length} risk zones`);
  }

  /**
   * Get all zones
   */
  getZones(): RiskZone[] {
    return this.zones;
  }

  /**
   * Hit test to determine if an event hits a risk zone
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    if (!this.transform || this.visibleZones.length === 0) {
      return null;
    }

    const { x, y } = this.getEventPosition(event);
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = (x - rect.left) * this.transform.dpr;
    const canvasY = (y - rect.top) * this.transform.dpr;

    // Check zones in reverse order (highest z-index first)
    for (let i = this.visibleZones.length - 1; i >= 0; i--) {
      const zone = this.visibleZones[i];

      if (this.renderer.isPointInZone(canvasX, canvasY, zone, this.transform)) {
        logger.debug(`Hit detected on zone: ${zone.id}`);
        return {
          target: zone,
          type: "click",
          cursor: "pointer",
          metadata: { zone, zoneId: zone.id },
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
      case "click":
        this.handleClick(event);
        return true;
      case "drag":
        this.handleHover(event);
        return true;
      case "dragend":
        // Reset hover state
        this.hoveredZone = null;
        return true;
    }
    return false;
  }

  /**
   * Handle click events
   */
  private handleClick(event: InteractionEvent): void {
    if (!this.transform || !event.canvasPosition) return;

    const canvasX = event.canvasPosition.x;
    const canvasY = event.canvasPosition.y;

    // Find clicked zone
    for (let i = this.visibleZones.length - 1; i >= 0; i--) {
      const zone = this.visibleZones[i];

      if (this.renderer.isPointInZone(canvasX, canvasY, zone, this.transform)) {
        logger.debug(`Zone clicked: ${zone.id}`);

        // Emit click event
        this.emitEvent("risk-zone-clicked", {
          zoneId: zone.id,
          zone: zone,
        });
        break;
      }
    }
  }

  /**
   * Handle hover events
   */
  private handleHover(event: InteractionEvent): void {
    if (!this.transform || !event.canvasPosition) return;

    const canvasX = event.canvasPosition.x;
    const canvasY = event.canvasPosition.y;

    // Find hovered zone
    let newHoveredZone: RiskZone | null = null;
    for (let i = this.visibleZones.length - 1; i >= 0; i--) {
      const zone = this.visibleZones[i];

      if (this.renderer.isPointInZone(canvasX, canvasY, zone, this.transform)) {
        newHoveredZone = zone;
        break;
      }
    }

    // Emit hover event if zone changed
    if (newHoveredZone && newHoveredZone !== this.hoveredZone) {
      logger.debug(`Zone hovered: ${newHoveredZone.id}`);
      this.hoveredZone = newHoveredZone;

      this.emitEvent("risk-zone-hovered", {
        zoneId: newHoveredZone.id,
        zone: newHoveredZone,
      });
    } else if (!newHoveredZone && this.hoveredZone) {
      // Mouse left all zones
      this.hoveredZone = null;
    }
  }

  /**
   * Handle viewport transform updates (pan/zoom)
   */
  onTransform(transform: ViewportTransform): void {
    this.transform = transform;
    this.updateVisibleZones();
    logger.debug(`Transform updated, ${this.visibleZones.length} visible zones`);
  }

  /**
   * Update the list of visible zones based on current transform
   */
  private updateVisibleZones(): void {
    if (!this.transform) {
      this.visibleZones = [];
      return;
    }

    this.visibleZones = this.renderer.getVisibleZones(this.zones, this.transform);
  }

  /**
   * Draw all visible risk zones
   */
  draw(): void {
    if (!this.transform || this.visibleZones.length === 0) {
      return;
    }

    // Draw each visible zone
    for (const zone of this.visibleZones) {
      this.renderer.drawRiskZone(this.ctx, zone, this.transform);
    }

    logger.debug(`Drew ${this.visibleZones.length} risk zones`);
  }

  /**
   * Extract position from mouse or touch event
   */
  private getEventPosition(event: MouseEvent | TouchEvent): { x: number; y: number } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: 0, y: 0 };
  }

  /**
   * Emit custom events
   */
  private emitEvent(eventName: string, detail: any): void {
    const event = new CustomEvent(eventName, {
      detail,
      bubbles: true,
      composed: true,
    });
    this.canvas.dispatchEvent(event);
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.zones = [];
    this.visibleZones = [];
    this.hoveredZone = null;
    this.transform = null;
    this.renderer.clearCache();
    logger.debug("RiskZonesLayer destroyed");
  }
}
