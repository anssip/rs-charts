import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { TrendLine, TrendLineDefaults } from "../../../types/trend-line";
import type { TrendLineLayer } from "../trend-line-layer";
import type { TrendLineDrawingLayer } from "./layers/trend-line-drawing-layer";
import { logger } from "../../../util/logger";

export interface TrendLineControllerOptions {
  container: HTMLElement;
  state: ChartState;
  trendLineLayer?: TrendLineLayer;
  trendLineDrawingLayer?: TrendLineDrawingLayer;
}

/**
 * Controller for managing trend lines in the chart.
 * Handles both rendering layer (TrendLineLayer) and interaction layer (TrendLineDrawingLayer).
 */
export class TrendLineController {
  private container: HTMLElement;
  private state: ChartState;
  private renderingLayer?: TrendLineLayer;
  private drawingLayer?: TrendLineDrawingLayer;
  private isDrawingToolActive = false;

  private defaults: TrendLineDefaults = {
    color: "#2962ff",
    lineWidth: 2,
    style: "solid",
    extendLeft: false,
    extendRight: false,
  };

  constructor(options: TrendLineControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.renderingLayer = options.trendLineLayer;
    this.drawingLayer = options.trendLineDrawingLayer;

    logger.debug("TrendLineController: Initialized");
  }

  /**
   * Set the drawing layer (called after layer is created and registered)
   */
  setDrawingLayer(layer: TrendLineDrawingLayer): void {
    this.drawingLayer = layer;
    logger.debug("TrendLineController: Drawing layer set");
  }

  /**
   * Set default properties for new trend lines
   */
  setDefaults(defaults: Partial<TrendLineDefaults>): void {
    this.defaults = { ...this.defaults, ...defaults };
    logger.debug("TrendLineController: Defaults updated", this.defaults);
  }

  /**
   * Get current defaults
   */
  getDefaults(): TrendLineDefaults {
    return { ...this.defaults };
  }

  /**
   * Activate the drawing tool
   */
  activateDrawingTool(): void {
    if (this.isDrawingToolActive) {
      logger.debug("TrendLineController: Drawing tool already active");
      return;
    }

    this.isDrawingToolActive = true;

    if (this.drawingLayer) {
      this.drawingLayer.activate(this.defaults);
    }

    // Dispatch activation event
    this.dispatchEvent("trend-line-tool-activated", {});

    logger.debug("TrendLineController: Drawing tool activated");
  }

  /**
   * Deactivate the drawing tool
   */
  deactivateDrawingTool(): void {
    if (!this.isDrawingToolActive) {
      logger.debug("TrendLineController: Drawing tool already inactive");
      return;
    }

    this.isDrawingToolActive = false;

    if (this.drawingLayer) {
      this.drawingLayer.deactivate();
    }

    // Dispatch deactivation event
    this.dispatchEvent("trend-line-tool-deactivated", {});

    logger.debug("TrendLineController: Drawing tool deactivated");
  }

  /**
   * Check if drawing tool is active
   */
  isToolActive(): boolean {
    return this.isDrawingToolActive;
  }

  /**
   * Add a new trend line to the chart
   */
  add(trendLine: TrendLine): void {
    logger.debug("TrendLineController: Adding trend line", trendLine);

    if (!this.state.trendLines) {
      this.state.trendLines = [];
    }

    // Ensure the trend line has an ID
    if (!trendLine.id) {
      trendLine.id = `trend-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logger.debug("TrendLineController: Generated trend line ID", trendLine.id);
    }

    // Check if trend line with this ID already exists
    const existingIndex = this.state.trendLines.findIndex(
      (t: TrendLine) => String(t.id) === String(trendLine.id),
    );
    if (existingIndex !== -1) {
      logger.warn(
        "TrendLineController: Trend line with ID already exists, replacing",
        trendLine.id,
      );
      this.state.trendLines[existingIndex] = trendLine;
    } else {
      this.state.trendLines.push(trendLine);
    }

    touch("state.trendLines");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("trend-line-added", { trendLine });
  }

  /**
   * Remove a trend line from the chart
   */
  remove(trendLineId: string): void {
    logger.debug("TrendLineController: Removing trend line", trendLineId);

    if (!this.state.trendLines) {
      logger.warn("TrendLineController: No trend lines to remove");
      return;
    }

    const index = this.state.trendLines.findIndex(
      (t: TrendLine) => String(t.id) === String(trendLineId),
    );
    if (index === -1) {
      logger.warn("TrendLineController: Trend line not found", trendLineId);
      return;
    }

    const removedTrendLine = this.state.trendLines[index];
    this.state.trendLines.splice(index, 1);

    touch("state.trendLines");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("trend-line-removed", {
      trendLineId,
      trendLine: removedTrendLine,
    });
  }

  /**
   * Update an existing trend line
   * Creates a new array reference to trigger Lit's reactive update
   */
  update(trendLineId: string, updates: Partial<TrendLine>): void {
    logger.debug("TrendLineController: Updating trend line", trendLineId, updates);

    if (!this.state.trendLines) {
      logger.warn("TrendLineController: No trend lines to update");
      return;
    }

    const index = this.state.trendLines.findIndex(
      (t: TrendLine) => String(t.id) === String(trendLineId),
    );
    if (index === -1) {
      logger.warn("TrendLineController: Trend line not found", trendLineId);
      return;
    }

    // Get the current trend line and apply updates
    const trendLine = this.state.trendLines[index];
    const updatedTrendLine: TrendLine = {
      ...trendLine,
      ...updates,
      id: trendLine.id, // Preserve ID
    };

    // Create new array reference to trigger Lit's reactive update
    this.state.trendLines = [
      ...this.state.trendLines.slice(0, index),
      updatedTrendLine,
      ...this.state.trendLines.slice(index + 1),
    ];

    touch("state.trendLines");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("trend-line-updated", {
      trendLineId,
      trendLine: updatedTrendLine,
      updates,
    });
  }

  /**
   * Clear all trend lines
   */
  clear(): void {
    logger.debug("TrendLineController: Clearing all trend lines");

    if (!this.state.trendLines || this.state.trendLines.length === 0) {
      logger.debug("TrendLineController: No trend lines to clear");
      return;
    }

    this.state.trendLines = [];
    touch("state.trendLines");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("trend-lines-cleared", {});
  }

  /**
   * Get all trend lines
   */
  getAll(): TrendLine[] {
    return this.state.trendLines || [];
  }

  /**
   * Get a specific trend line by ID
   */
  get(trendLineId: string): TrendLine | null {
    if (!this.state.trendLines) {
      return null;
    }

    return (
      this.state.trendLines.find(
        (t: TrendLine) => String(t.id) === String(trendLineId),
      ) || null
    );
  }

  /**
   * Update the rendering layer
   */
  private updateLayer(): void {
    if (this.renderingLayer) {
      this.renderingLayer.trendLines = this.state.trendLines || [];
      this.renderingLayer.state = this.state;
      this.renderingLayer.requestUpdate();
      logger.debug("TrendLineController: Updated rendering layer");
    }
  }

  /**
   * Handle trend line created event (called from drawing layer)
   */
  handleTrendLineCreated(trendLine: Omit<TrendLine, "id">): void {
    logger.debug("TrendLineController: Handling trend line created", trendLine);

    // Create a full trend line with an ID
    const newTrendLine: TrendLine = {
      id: `trend-line-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...trendLine,
    };

    this.add(newTrendLine);

    // Deactivate drawing tool after creating a line
    this.deactivateDrawingTool();
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
    logger.debug("TrendLineController: Destroying controller");
    this.renderingLayer = undefined;
    this.drawingLayer = undefined;
    this.isDrawingToolActive = false;
  }
}
