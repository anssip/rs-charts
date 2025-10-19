import { ChartState } from "../../..";
import { getLogger, LogLevel } from "../../../util/logger";
import {
  EquityPoint,
  EquityCurveConfig,
} from "../../../types/trading-overlays";
import { EquityCurveCanvasLayer } from "../equity-curve-canvas-layer";
import { touch } from "xinjs";

const logger = getLogger("EquityCurveController");
logger.setLoggerLevel("EquityCurveController", LogLevel.INFO);

interface EquityCurveControllerOptions {
  container: HTMLElement;
  state: ChartState;
  equityCurveLayer: EquityCurveCanvasLayer;
}

/**
 * Controller for managing equity curve overlay functionality
 * Coordinates state management and layer updates for equity curve visualization
 */
export class EquityCurveController {
  private config: EquityCurveConfig | null = null;
  private readonly options: EquityCurveControllerOptions;
  private readonly container: HTMLElement;
  private readonly state: ChartState;
  private readonly layer: EquityCurveCanvasLayer;

  constructor(options: EquityCurveControllerOptions) {
    this.options = options;
    this.container = options.container;
    this.state = options.state;
    this.layer = options.equityCurveLayer;

    logger.debug("EquityCurveController initialized");
  }

  /**
   * Show equity curve overlay with the provided data
   * @param data Array of equity points (timestamp, equity value pairs)
   * @param config Optional configuration for styling and display
   */
  show(data: EquityPoint[], config?: Partial<EquityCurveConfig>): void {
    this.config = {
      data,
      color: config?.color,
      lineWidth: config?.lineWidth,
      lineStyle: config?.lineStyle,
      showArea: config?.showArea,
      areaColor: config?.areaColor,
      opacity: config?.opacity,
      yAxisPosition: config?.yAxisPosition,
    };

    // Update state
    this.state.equityCurve = this.config;
    touch("state.equityCurve");

    // Update layer
    this.updateLayer();

    logger.info(
      `EquityCurveController: Showing equity curve with ${data.length} points`,
    );

    // Emit API event
    this.dispatchEvent("equity-curve-shown", {
      config: this.config,
    });
  }

  /**
   * Hide equity curve overlay
   */
  hide(): void {
    this.config = null;

    // Update state
    this.state.equityCurve = null;
    touch("state.equityCurve");

    // Update layer (will clear the canvas)
    this.updateLayer();

    logger.info("EquityCurveController: Hiding equity curve");

    // Emit API event
    this.dispatchEvent("equity-curve-hidden", {});
  }

  /**
   * Update equity curve data
   * @param data New array of equity points
   */
  update(data: EquityPoint[]): void {
    if (!this.config) {
      logger.warn(
        "EquityCurveController: Cannot update equity curve - not currently shown",
      );
      return;
    }

    this.config = {
      ...this.config,
      data,
    };

    // Update state
    this.state.equityCurve = this.config;
    touch("state.equityCurve");

    // Update layer
    this.updateLayer();

    logger.debug(
      `EquityCurveController: Updated equity curve with ${data.length} points`,
    );

    // Emit API event
    this.dispatchEvent("equity-curve-updated", {
      data,
    });
  }

  /**
   * Check if equity curve is currently visible
   */
  isVisible(): boolean {
    return this.config !== null && this.config.data.length > 0;
  }

  /**
   * Get current equity curve configuration
   */
  getConfig(): EquityCurveConfig | null {
    return this.config;
  }

  /**
   * Update the canvas layer with current state and viewport
   * Called when viewport changes (pan/zoom) or when data updates
   */
  updateLayer(): void {
    if (!this.layer) {
      logger.warn("EquityCurveController: Layer not available");
      return;
    }

    // Update layer properties
    this.layer.config = this.config;
    this.layer.data = this.config?.data || [];
    this.layer.state = this.state;
    this.layer.timeRange = this.state.timeRange;
    this.layer.priceRange = this.state.priceRange;

    // Trigger layer update
    this.layer.requestUpdate();

    logger.debug("EquityCurveController: Updated canvas layer");
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.config = null;
    logger.debug("EquityCurveController: Destroyed");
  }

  /**
   * Dispatch custom event on container
   */
  private dispatchEvent(eventName: string, detail: any): void {
    this.container.dispatchEvent(
      new CustomEvent(eventName, {
        detail,
        bubbles: true,
        composed: true,
      }),
    );
  }
}
