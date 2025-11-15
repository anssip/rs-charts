/**
 * Core interfaces and types for the multi-layer interaction system.
 *
 * This system allows multiple interactive layers (annotations, price lines, trend lines, etc.)
 * to coexist on the chart with a clear priority system for handling user interactions.
 */

/**
 * Viewport transform information broadcast to all layers during pan/zoom operations.
 * Layers use this to recalculate positions and stay synchronized with the chart.
 */
export interface ViewportTransform {
  timeRange: { start: number; end: number };
  priceRange: { min: number; max: number };
  canvasWidth: number;
  canvasHeight: number;
  dpr: number;
}

/**
 * Result of a hit test indicating whether a layer should handle an interaction.
 */
export interface HitTestResult {
  /** The element or identifier that was hit */
  target: any;
  /** Type of interaction this hit supports */
  type: 'drag' | 'click' | 'hover';
  /** Optional cursor style to display when hovering over this element */
  cursor?: string;
  /** Optional metadata about the hit target */
  metadata?: any;
}

/**
 * Types of interaction events that layers can handle.
 */
export type InteractionEventType =
  | 'dragstart'
  | 'drag'
  | 'dragend'
  | 'click'
  | 'hover'
  | 'hoverend';

/**
 * Normalized interaction event passed to layers.
 */
export interface InteractionEvent {
  /** Type of interaction */
  type: InteractionEventType;
  /** Original browser event */
  originalEvent: MouseEvent | TouchEvent;
  /** Position in client coordinates */
  position: { x: number; y: number };
  /** Position in canvas coordinates (accounting for DPR) */
  canvasPosition?: { x: number; y: number };
  /** Keyboard modifiers */
  modifiers: {
    shift: boolean;
    ctrl: boolean;
    alt: boolean;
    meta: boolean;
  };
}

/**
 * Interface that all interactive layers must implement.
 *
 * Layers are registered with the ChartInteractionController and are queried
 * in priority order to determine which layer should handle each user interaction.
 */
export interface InteractionLayer {
  /** Unique identifier for this layer */
  readonly id: string;

  /**
   * Priority for hit testing (higher values checked first).
   * Suggested priorities:
   * - 100: Annotations
   * - 90: Price lines
   * - 80: Trend lines
   * - 70: Trade markers
   * - 60: Trade zones
   * - 50: Risk zones
   * - 40: Equity curves
   * - 10: Live candle display
   * - 0: Default chart interactions
   */
  readonly priority: number;

  /**
   * Test if this layer should handle the given event.
   *
   * @param event - The mouse or touch event to test
   * @returns HitTestResult if this layer should handle the event, null otherwise
   */
  hitTest(event: MouseEvent | TouchEvent): HitTestResult | null;

  /**
   * Handle an interaction event.
   *
   * This method is called for all events in a gesture once hitTest returns non-null.
   * The layer becomes the "active layer" for the entire drag/interaction session.
   *
   * @param event - The normalized interaction event
   * @returns true if the event was handled, false otherwise
   */
  handleInteraction(event: InteractionEvent): boolean;

  /**
   * Called when the viewport transform changes (pan/zoom).
   *
   * Layers should use this to update positions of their elements to stay
   * synchronized with the chart.
   *
   * @param transform - The new viewport transform
   */
  onTransform?(transform: ViewportTransform): void;

  /**
   * Called when the layer is being destroyed.
   * Layers should clean up any resources, event listeners, etc.
   */
  destroy?(): void;
}

/**
 * Base interaction state tracked by the controller.
 */
export interface InteractionState {
  /** Currently active layer handling the interaction */
  activeLayer: InteractionLayer | null;
  /** Type of interaction in progress */
  interactionType: 'drag' | 'zoom' | 'pan' | 'touch' | null;
  /** Whether an interaction is currently in progress */
  isActive: boolean;
  /** Last hovered layer (for cursor management) */
  hoveredLayer: InteractionLayer | null;
  /** Last hit test result (for cursor management) */
  lastHitResult: HitTestResult | null;
}
