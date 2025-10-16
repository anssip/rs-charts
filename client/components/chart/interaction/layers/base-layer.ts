/**
 * Base class for interaction layers providing common utilities.
 *
 * Layers can extend this class to inherit useful methods for:
 * - Hit testing (point-in-rect, distance calculations)
 * - Coordinate transformations (screen to canvas, canvas to price/time)
 * - Event utilities (extracting position, modifiers)
 */

import {
  InteractionLayer,
  InteractionEvent,
  HitTestResult,
  ViewportTransform,
} from "../interaction-layer";
import { ChartState } from "../../../..";

export abstract class BaseInteractionLayer implements InteractionLayer {
  abstract readonly id: string;
  abstract readonly priority: number;

  constructor(
    protected container: HTMLElement,
    protected state: ChartState,
  ) {}

  abstract hitTest(event: MouseEvent | TouchEvent): HitTestResult | null;
  abstract handleInteraction(event: InteractionEvent): boolean;

  /**
   * Extract position from mouse or touch event.
   */
  protected getEventPosition(
    event: MouseEvent | TouchEvent,
  ): { x: number; y: number } {
    if (event instanceof MouseEvent) {
      return { x: event.clientX, y: event.clientY };
    } else if (event instanceof TouchEvent && event.touches.length > 0) {
      return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }
    return { x: 0, y: 0 };
  }

  /**
   * Convert client coordinates to container-relative coordinates.
   */
  protected clientToContainer(
    clientX: number,
    clientY: number,
  ): { x: number; y: number } {
    const rect = this.container.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  /**
   * Convert container coordinates to canvas coordinates (accounting for DPR).
   */
  protected containerToCanvas(
    containerX: number,
    containerY: number,
    dpr: number = window.devicePixelRatio || 1,
  ): { x: number; y: number } {
    return {
      x: containerX * dpr,
      y: containerY * dpr,
    };
  }

  /**
   * Convert canvas X coordinate to timestamp.
   */
  protected canvasXToTimestamp(
    canvasX: number,
    canvasWidth: number,
    timeRange: { start: number; end: number },
  ): number {
    const timePerPixel = (timeRange.end - timeRange.start) / canvasWidth;
    return timeRange.start + canvasX * timePerPixel;
  }

  /**
   * Convert timestamp to canvas X coordinate.
   */
  protected timestampToCanvasX(
    timestamp: number,
    canvasWidth: number,
    timeRange: { start: number; end: number },
  ): number {
    const timeRange_span = timeRange.end - timeRange.start;
    const timeOffset = timestamp - timeRange.start;
    return (timeOffset / timeRange_span) * canvasWidth;
  }

  /**
   * Convert canvas Y coordinate to price.
   */
  protected canvasYToPrice(
    canvasY: number,
    canvasHeight: number,
    priceRange: { min: number; max: number },
  ): number {
    const pricePerPixel = (priceRange.max - priceRange.min) / canvasHeight;
    return priceRange.max - canvasY * pricePerPixel;
  }

  /**
   * Convert price to canvas Y coordinate.
   */
  protected priceToCanvasY(
    price: number,
    canvasHeight: number,
    priceRange: { min: number; max: number },
  ): number {
    const priceRange_span = priceRange.max - priceRange.min;
    const priceOffset = priceRange.max - price;
    return (priceOffset / priceRange_span) * canvasHeight;
  }

  /**
   * Check if a point is inside a rectangle.
   */
  protected isPointInRect(
    point: { x: number; y: number },
    rect: { x: number; y: number; width: number; height: number },
  ): boolean {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  /**
   * Calculate distance between two points.
   */
  protected distance(
    p1: { x: number; y: number },
    p2: { x: number; y: number },
  ): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  /**
   * Check if a point is near a line segment (within threshold pixels).
   */
  protected isPointNearLine(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
    threshold: number = 5,
  ): boolean {
    const distance = this.distanceToLineSegment(point, lineStart, lineEnd);
    return distance <= threshold;
  }

  /**
   * Calculate perpendicular distance from point to line segment.
   */
  protected distanceToLineSegment(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number },
  ): number {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx: number, yy: number;

    if (param < 0) {
      xx = lineStart.x;
      yy = lineStart.y;
    } else if (param > 1) {
      xx = lineEnd.x;
      yy = lineEnd.y;
    } else {
      xx = lineStart.x + param * C;
      yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Extract keyboard modifiers from event.
   */
  protected getModifiers(event: MouseEvent | TouchEvent): {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  } {
    return {
      shift: event.shiftKey,
      ctrl: event.ctrlKey,
      alt: event.altKey,
      meta: event.metaKey,
    };
  }

  /**
   * Create a normalized interaction event from a browser event.
   */
  protected createInteractionEvent(
    type: InteractionEvent["type"],
    event: MouseEvent | TouchEvent,
  ): InteractionEvent {
    const position = this.getEventPosition(event);
    const containerPos = this.clientToContainer(position.x, position.y);
    const dpr = window.devicePixelRatio || 1;
    const canvasPosition = this.containerToCanvas(
      containerPos.x,
      containerPos.y,
      dpr,
    );

    return {
      type,
      originalEvent: event,
      position,
      canvasPosition,
      modifiers: this.getModifiers(event),
    };
  }

  /**
   * Default transform handler (no-op).
   * Subclasses should override if they need to respond to viewport changes.
   */
  onTransform?(transform: ViewportTransform): void;

  /**
   * Default destroy handler (no-op).
   * Subclasses should override if they need cleanup.
   */
  destroy?(): void;
}
