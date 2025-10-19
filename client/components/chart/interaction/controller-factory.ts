import type { ChartState, Layer } from "../../..";
import type { ChartContainer } from "../chart-container";
import { AnnotationsController } from "./annotations-controller";
import { TimeMarkersController } from "./time-markers-controller";
import { RiskZonesController } from "./risk-zones-controller";
import { EquityCurveController } from "./equity-curve-controller";
import { PositionOverlayController } from "./position-overlay-controller";
import { PatternHighlightsController } from "./pattern-highlights-controller";
import type { AnnotationsLayer } from "../annotations-layer";
import type { TimeMarkersLayer } from "../time-markers-layer";
import type { PatternLabelsLayer } from "../pattern-labels-layer";
import type { PositionOverlay as PositionOverlayComponent } from "../position-overlay";
import { logger } from "../../../util/logger";

/**
 * Context object containing all dependencies needed for controller initialization
 */
export interface ControllerFactoryContext {
  container: ChartContainer;
  renderRoot: Element | DocumentFragment;
  state: ChartState;
  updateLayer: (layer: Layer | undefined) => void;
  updateTimeMarkersLayer: () => void;
  updateRiskZonesCanvasLayer: () => void;
  updateEquityCurveCanvasLayer: () => void;
  updatePositionOverlay: () => void;
}

/**
 * Initialize all chart controllers
 * Centralizes controller initialization logic to keep ChartContainer lean
 */
export function initializeControllers(context: ControllerFactoryContext): void {
  initAnnotationsController(context);
  initTimeMarkersController(context);
  initRiskZonesController(context);
  initEquityCurveController(context);
  initPositionOverlayController(context);
  initPatternHighlightsController(context);
}

/**
 * Initialize annotations controller
 * Handles annotation rendering and drag interactions
 */
function initAnnotationsController(context: ControllerFactoryContext): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "annotations-layer",
  ) as AnnotationsLayer;

  if (layer) {
    logger.debug("ChartContainer: Found annotations layer");
    container.annotationsLayer = layer;
    container.annotationsController = new AnnotationsController({
      container: container,
      state: context.state,
      annotationsLayer: layer,
      onAnnotationDragged: (data) => {
        const { annotationId, newTimestamp, newPrice, annotation } = data;
        const updatedAnnotation = {
          ...annotation,
          timestamp: newTimestamp,
          price: newPrice,
        };
        container.annotationsController?.update(
          annotationId,
          updatedAnnotation,
        );
      },
    });
    logger.debug("ChartContainer: Initialized annotations controller");
    setTimeout(() => {
      context.updateLayer(layer);
    }, 100);
  }
}

/**
 * Initialize time markers controller
 * Handles vertical time marker lines with labels
 */
function initTimeMarkersController(context: ControllerFactoryContext): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "time-markers-layer",
  ) as TimeMarkersLayer;

  if (layer) {
    logger.debug("ChartContainer: Found time markers layer");
    container.timeMarkersLayer = layer;
    container.timeMarkersController = new TimeMarkersController({
      container: container,
      state: context.state,
      timeMarkersLayer: layer,
    });
    logger.debug("ChartContainer: Initialized time markers controller");
    setTimeout(() => context.updateTimeMarkersLayer(), 100);
  }
}

/**
 * Initialize risk zones controller
 * Handles risk zone highlighting with canvas rendering
 */
function initRiskZonesController(context: ControllerFactoryContext): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "risk-zones-canvas-layer",
  ) as any;

  if (layer) {
    logger.debug("ChartContainer: Found risk zones canvas layer");
    container.riskZonesCanvasLayer = layer;
    container.riskZonesController = new RiskZonesController({
      container: container,
      state: context.state,
      riskZonesCanvasLayer: layer,
    });
    logger.debug("ChartContainer: Initialized risk zones controller");
    setTimeout(() => context.updateRiskZonesCanvasLayer(), 100);
  }
}

/**
 * Initialize equity curve controller
 * Handles equity curve overlay for trading performance visualization
 */
function initEquityCurveController(context: ControllerFactoryContext): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "equity-curve-canvas-layer",
  ) as any;

  if (layer) {
    logger.debug("ChartContainer: Found equity curve canvas layer");
    container.equityCurveCanvasLayer = layer;
    container.equityCurveController = new EquityCurveController({
      container: container,
      state: context.state,
      equityCurveLayer: layer,
    });
    logger.debug("ChartContainer: Initialized equity curve controller");
    setTimeout(() => context.updateEquityCurveCanvasLayer(), 100);
  }
}

/**
 * Initialize position overlay controller
 * Manages two components: entry line layer and info box
 */
function initPositionOverlayController(
  context: ControllerFactoryContext,
): void {
  const container = context.container;
  const positionOverlays = context.renderRoot.querySelectorAll(
    "position-overlay",
  ) as NodeListOf<PositionOverlayComponent>;

  if (positionOverlays.length >= 2) {
    const entryLineComponent = positionOverlays[0];
    const infoBoxComponent = positionOverlays[1];

    logger.debug("ChartContainer: Found both position overlay components", {
      entryLineHideAttribute: entryLineComponent.hideEntryLine,
      infoBoxHideAttribute: infoBoxComponent.hideEntryLine,
    });

    container.positionOverlayController = new PositionOverlayController({
      container: container,
      state: context.state,
      entryLineComponent,
      infoBoxComponent,
    });
    logger.debug("ChartContainer: Initialized position overlay controller");
    setTimeout(() => context.updatePositionOverlay(), 100);
  } else {
    logger.warn(
      "ChartContainer: Could not find both position overlay components",
    );
  }
}

/**
 * Initialize pattern highlights controller
 * Handles pattern highlight overlays on candlesticks
 */
function initPatternHighlightsController(
  context: ControllerFactoryContext,
): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "pattern-labels-layer",
  ) as PatternLabelsLayer;

  if (layer) {
    logger.debug("ChartContainer: Found pattern labels layer");
    container.patternLabelsLayer = layer;
    container.patternHighlightsController = new PatternHighlightsController({
      container: container,
      state: context.state,
      patternLabelsLayer: layer,
    });
    logger.debug("ChartContainer: Initialized pattern highlights controller");
    setTimeout(() => {
      context.updateLayer(layer);
    }, 100);
  }
}
