import { touch } from "xinjs";
import type { ChartState } from "../../..";
import type { Annotation, AnnotationDraggedEvent } from "../../../types/trading-overlays";
import type { AnnotationsLayer } from "../annotations-layer";
import type { AnnotationsInteractionLayer } from "./layers/annotations-layer";
import { logger } from "../../../util/logger";

export interface AnnotationsControllerOptions {
  container: HTMLElement;
  state: ChartState;
  annotationsLayer?: AnnotationsLayer;
  annotationsInteractionLayer?: AnnotationsInteractionLayer;
  onAnnotationDragged?: (data: AnnotationDraggedEvent) => void;
}

/**
 * Controller for managing annotations in the chart.
 * Handles both rendering layer (AnnotationsLayer) and interaction layer (AnnotationsInteractionLayer).
 */
export class AnnotationsController {
  private container: HTMLElement;
  private state: ChartState;
  private renderingLayer?: AnnotationsLayer;
  private interactionLayer?: AnnotationsInteractionLayer;
  private onAnnotationDragged?: (data: AnnotationDraggedEvent) => void;

  constructor(options: AnnotationsControllerOptions) {
    this.container = options.container;
    this.state = options.state;
    this.renderingLayer = options.annotationsLayer;
    this.interactionLayer = options.annotationsInteractionLayer;
    this.onAnnotationDragged = options.onAnnotationDragged;

    logger.debug("AnnotationsController: Initialized");
  }

  /**
   * Add a new annotation to the chart
   */
  add(annotation: Annotation): void {
    logger.debug("AnnotationsController: Adding annotation", annotation);

    if (!this.state.annotations) {
      this.state.annotations = [];
    }

    // Ensure the annotation has an ID
    if (!annotation.id) {
      annotation.id = `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      logger.debug("AnnotationsController: Generated annotation ID", annotation.id);
    }

    // Check if annotation with this ID already exists
    const existingIndex = this.state.annotations.findIndex(
      (a: Annotation) => a.id === annotation.id,
    );
    if (existingIndex !== -1) {
      logger.warn(
        "AnnotationsController: Annotation with ID already exists, replacing",
        annotation.id,
      );
      this.state.annotations[existingIndex] = annotation;
    } else {
      this.state.annotations.push(annotation);
    }

    touch("state.annotations");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("annotation-added", { annotation });
  }

  /**
   * Remove an annotation from the chart
   */
  remove(annotationId: string): void {
    logger.debug("AnnotationsController: Removing annotation", annotationId);

    if (!this.state.annotations) {
      logger.warn("AnnotationsController: No annotations to remove");
      return;
    }

    const index = this.state.annotations.findIndex(
      (a: Annotation) => a.id === annotationId,
    );
    if (index === -1) {
      logger.warn("AnnotationsController: Annotation not found", annotationId);
      return;
    }

    const removedAnnotation = this.state.annotations[index];
    this.state.annotations.splice(index, 1);

    touch("state.annotations");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("annotation-removed", {
      annotationId,
      annotation: removedAnnotation,
    });
  }

  /**
   * Update an existing annotation
   * Creates a new array reference to trigger Lit's reactive update
   */
  update(annotationId: string, updates: Partial<Annotation>): void {
    logger.debug("AnnotationsController: Updating annotation", annotationId, updates);

    if (!this.state.annotations) {
      logger.warn("AnnotationsController: No annotations to update");
      return;
    }

    const index = this.state.annotations.findIndex(
      (a: Annotation) => a.id === annotationId,
    );
    if (index === -1) {
      logger.warn("AnnotationsController: Annotation not found", annotationId);
      return;
    }

    // Get the current annotation and apply updates
    const annotation = this.state.annotations[index];
    const updatedAnnotation: Annotation = {
      ...annotation,
      ...updates,
      id: annotationId, // Preserve ID
    };

    // Create new array reference to trigger Lit's reactive update
    this.state.annotations = [
      ...this.state.annotations.slice(0, index),
      updatedAnnotation,
      ...this.state.annotations.slice(index + 1),
    ];

    touch("state.annotations");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("annotation-updated", { annotationId, annotation: updatedAnnotation, updates });
  }

  /**
   * Clear all annotations
   */
  clear(): void {
    logger.debug("AnnotationsController: Clearing all annotations");

    if (!this.state.annotations || this.state.annotations.length === 0) {
      logger.debug("AnnotationsController: No annotations to clear");
      return;
    }

    this.state.annotations = [];
    touch("state.annotations");
    this.updateLayer();

    // Dispatch event
    this.dispatchEvent("annotations-cleared", {});
  }

  /**
   * Get all annotations
   */
  getAll(): Annotation[] {
    return this.state.annotations || [];
  }

  /**
   * Get a specific annotation by ID
   */
  get(annotationId: string): Annotation | null {
    if (!this.state.annotations) {
      return null;
    }

    return (
      this.state.annotations.find((a: Annotation) => a.id === annotationId) || null
    );
  }

  /**
   * Update the rendering layer
   */
  private updateLayer(): void {
    if (this.renderingLayer) {
      this.renderingLayer.annotations = this.state.annotations || [];
      this.renderingLayer.state = this.state;
      this.renderingLayer.requestUpdate();
      logger.debug("AnnotationsController: Updated rendering layer");
    }
  }

  /**
   * Set the interaction layer (called after layer is created)
   */
  setInteractionLayer(layer: AnnotationsInteractionLayer): void {
    this.interactionLayer = layer;
    logger.debug("AnnotationsController: Interaction layer set");
  }

  /**
   * Handle annotation dragged event (called from interaction layer)
   */
  handleAnnotationDragged(data: AnnotationDraggedEvent): void {
    logger.debug("AnnotationsController: Handling annotation dragged", data);

    if (this.onAnnotationDragged) {
      this.onAnnotationDragged(data);
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
    logger.debug("AnnotationsController: Destroying controller");
    this.renderingLayer = undefined;
    this.interactionLayer = undefined;
    this.onAnnotationDragged = undefined;
  }
}
