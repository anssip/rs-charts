/**
 * Interaction layer for annotations (notes, alerts, milestones).
 *
 * Handles hit testing and dragging for annotation elements.
 * Works in conjunction with the annotations-layer Lit component.
 */

import { BaseInteractionLayer } from "./base-layer";
import {
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";
import {
  Annotation,
  AnnotationDraggedEvent,
} from "../../../../types/trading-overlays";
import { getLogger, LogLevel } from "../../../../util/logger";

const logger = getLogger("AnnotationsInteractionLayer");
logger.setLoggerLevel("AnnotationsInteractionLayer", LogLevel.DEBUG);

export class AnnotationsInteractionLayer extends BaseInteractionLayer {
  readonly id = "annotations";
  readonly priority = 100; // Highest priority - annotations on top

  private draggedAnnotation: Annotation | null = null;
  private dragStartX: number = 0;
  private dragStartY: number = 0;
  private dragStartTimestamp: number = 0;
  private dragStartPrice: number | undefined = undefined;
  private annotationsGetter: () => Annotation[];

  constructor(
    container: HTMLElement,
    state: ChartState,
    annotationsGetter: () => Annotation[],
  ) {
    super(container, state);
    this.annotationsGetter = annotationsGetter;
  }

  /**
   * Get visible annotations within the current time range
   */
  private getVisibleAnnotations(): Annotation[] {
    const annotations = this.annotationsGetter();
    if (!this.state?.timeRange) return annotations;

    const { start, end } = this.state.timeRange;
    return annotations.filter(
      (annotation) =>
        annotation.timestamp >= start && annotation.timestamp <= end,
    );
  }

  /**
   * Test if event hits a draggable annotation
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null {
    const visibleAnnotations = this.getVisibleAnnotations();
    const position = this.getEventPosition(event);
    const containerPos = this.clientToContainer(position.x, position.y);

    const containerRect = this.container.getBoundingClientRect();
    const canvasWidth = containerRect.width;
    const canvasHeight = containerRect.height;

    // Check each visible annotation (in reverse order to respect z-index)
    for (let i = visibleAnnotations.length - 1; i >= 0; i--) {
      const annotation = visibleAnnotations[i];

      // Only check draggable annotations
      if (!annotation.draggable) continue;

      // Calculate annotation position
      const x = this.timestampToCanvasX(
        annotation.timestamp,
        canvasWidth,
        this.state.timeRange,
      );

      let y: number;
      if (annotation.price !== undefined) {
        y = this.priceToCanvasY(
          annotation.price,
          canvasHeight,
          this.state.priceRange,
        );
      } else {
        // Anchored to top or bottom
        y = annotation.position === "below" ? canvasHeight - 16 : 16;
      }

      // Approximate hit area (adjust based on annotation size)
      // This is a simplified box check - could be improved with actual element bounds
      const hitWidth = 100; // Approximate annotation width
      const hitHeight = 30; // Approximate annotation height
      const hitThreshold = 10; // Extra pixels around annotation

      const hitBox = {
        x: x - hitWidth / 2 - hitThreshold,
        y: y - hitHeight / 2 - hitThreshold,
        width: hitWidth + hitThreshold * 2,
        height: hitHeight + hitThreshold * 2,
      };

      if (this.isPointInRect(containerPos, hitBox)) {
        logger.debug(`Hit test succeeded for annotation: ${annotation.id}`);
        return {
          target: annotation,
          type: "drag",
          cursor: "move",
          metadata: { annotation },
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
        return this.handleDragStart(event);
      case "drag":
        return this.handleDrag(event);
      case "dragend":
        return this.handleDragEnd(event);
      default:
        return false;
    }
  }

  /**
   * Handle drag start
   */
  private handleDragStart(event: InteractionEvent): boolean {
    const position = this.getEventPosition(event.originalEvent);
    const containerPos = this.clientToContainer(position.x, position.y);

    // Find which annotation was clicked
    const hitResult = this.hitTest(event.originalEvent);
    if (!hitResult || !hitResult.metadata?.annotation) {
      return false;
    }

    const annotation = hitResult.metadata.annotation;
    this.draggedAnnotation = annotation;
    this.dragStartX = containerPos.x;
    this.dragStartY = containerPos.y;
    this.dragStartTimestamp = annotation.timestamp;
    this.dragStartPrice = annotation.price;

    logger.debug(`Drag start on annotation: ${annotation.id}`);
    return true;
  }

  /**
   * Handle drag move
   */
  private handleDrag(event: InteractionEvent): boolean {
    if (!this.draggedAnnotation) return false;

    const position = this.getEventPosition(event.originalEvent);
    const containerPos = this.clientToContainer(position.x, position.y);

    const containerRect = this.container.getBoundingClientRect();
    const canvasWidth = containerRect.width;
    const canvasHeight = containerRect.height;

    // Calculate new position based on mouse movement
    const deltaX = containerPos.x - this.dragStartX;
    const deltaY = containerPos.y - this.dragStartY;

    // Convert delta to time and price
    const startX = this.timestampToCanvasX(
      this.dragStartTimestamp,
      canvasWidth,
      this.state.timeRange,
    );
    const newX = startX + deltaX;
    const newTimestamp = this.canvasXToTimestamp(
      newX,
      canvasWidth,
      this.state.timeRange,
    );

    let newPrice: number | undefined = this.dragStartPrice;
    if (this.dragStartPrice !== undefined) {
      const startY = this.priceToCanvasY(
        this.dragStartPrice,
        canvasHeight,
        this.state.priceRange,
      );
      const newY = startY + deltaY;
      newPrice = this.canvasYToPrice(newY, canvasHeight, this.state.priceRange);
    }

    // Dispatch annotation-dragged event
    const dragEvent: AnnotationDraggedEvent = {
      annotationId: this.draggedAnnotation.id,
      oldTimestamp: this.draggedAnnotation.timestamp,
      oldPrice: this.draggedAnnotation.price,
      newTimestamp,
      newPrice,
      annotation: this.draggedAnnotation,
    };

    this.container.dispatchEvent(
      new CustomEvent("annotation-dragged", {
        detail: dragEvent,
        bubbles: true,
        composed: true,
      }),
    );

    return true;
  }

  /**
   * Handle drag end
   */
  private handleDragEnd(event: InteractionEvent): boolean {
    if (!this.draggedAnnotation) return false;

    logger.debug(`Drag end on annotation: ${this.draggedAnnotation.id}`);

    this.draggedAnnotation = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.dragStartTimestamp = 0;
    this.dragStartPrice = undefined;

    return true;
  }

  /**
   * Handle viewport transform (pan/zoom)
   * Annotations are automatically repositioned by the annotations-layer component
   * based on state changes, so we don't need to do anything here.
   */
  onTransform(transform: ViewportTransform): void {
    // No action needed - the component handles its own positioning
    // based on state.timeRange and state.priceRange which are already updated
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.draggedAnnotation = null;
  }
}
