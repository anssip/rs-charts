import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { PositionOverlayConfig } from "../../../types/trading-overlays";
import type { PositionOverlay } from "../position-overlay";
import { logger } from "../../../util/logger";

export interface PositionOverlayControllerOptions {
  container: HTMLElement;
  state: ChartState;
  entryLineComponent?: PositionOverlay;
  infoBoxComponent?: PositionOverlay;
}

/**
 * Controller for managing position overlay in the chart.
 * Handles both position overlay components (entry line + info box).
 *
 * Note: Unlike other controllers, position overlay uses a single config object
 * rather than an array, and has no interaction layer. There are two component
 * instances: one for the entry line layer and one for the info box.
 */
export class PositionOverlayController {
  private container: HTMLElement;
  private state: ChartState;
  private entryLineComponent?: PositionOverlay;
  private infoBoxComponent?: PositionOverlay;

  constructor(options: PositionOverlayControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.entryLineComponent = options.entryLineComponent;
    this.infoBoxComponent = options.infoBoxComponent;

    logger.debug("PositionOverlayController: Initialized", {
      hasEntryLine: !!this.entryLineComponent,
      hasInfoBox: !!this.infoBoxComponent,
    });
  }

  /**
   * Set or clear the position overlay
   */
  set(config: PositionOverlayConfig | null): void {
    logger.debug("PositionOverlayController: Setting position overlay", config);

    this.state.positionOverlay = config;
    touch("state.positionOverlay");
    this.updateComponent();

    if (config) {
      // Dispatch set event
      this.dispatchEvent("position-overlay-set", { config });
      logger.debug(
        `PositionOverlayController: Set position overlay for ${config.symbol}`,
      );
    } else {
      // Dispatch cleared event
      this.dispatchEvent("position-overlay-cleared", {});
      logger.debug("PositionOverlayController: Cleared position overlay");
    }
  }

  /**
   * Get the current position overlay config
   */
  get(): PositionOverlayConfig | null {
    return this.state.positionOverlay || null;
  }

  /**
   * Update position overlay with partial changes
   */
  update(updates: Partial<PositionOverlayConfig>): void {
    logger.debug(
      "PositionOverlayController: Updating position overlay",
      updates,
    );

    if (!this.state.positionOverlay) {
      logger.warn("PositionOverlayController: No position overlay to update");
      return;
    }

    const updatedConfig: PositionOverlayConfig = {
      ...this.state.positionOverlay,
      ...updates,
    };

    this.state.positionOverlay = updatedConfig;
    touch("state.positionOverlay");
    this.updateComponent();

    // Dispatch updated event
    this.dispatchEvent("position-overlay-updated", {
      config: updatedConfig,
      updates,
    });
  }

  /**
   * Clear the position overlay (convenience method)
   */
  clear(): void {
    this.set(null);
  }

  /**
   * Update both rendering components (entry line + info box)
   */
  private updateComponent(): void {
    // Update entry line component
    if (this.entryLineComponent) {
      this.entryLineComponent.config = this.state.positionOverlay ?? null;
      this.entryLineComponent.state = this.state;
      this.entryLineComponent.requestUpdate();
      logger.debug("PositionOverlayController: Updated entry line component");
    }

    // Update info box component
    if (this.infoBoxComponent) {
      this.infoBoxComponent.config = this.state.positionOverlay ?? null;
      this.infoBoxComponent.state = this.state;
      this.infoBoxComponent.requestUpdate();
      logger.debug("PositionOverlayController: Updated info box component");
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
    logger.debug("PositionOverlayController: Destroying controller");
    this.entryLineComponent = undefined;
    this.infoBoxComponent = undefined;
  }
}
