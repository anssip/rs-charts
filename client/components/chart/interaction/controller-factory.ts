import type { ChartState, Layer } from "../../..";
import type { ChartContainer } from "../chart-container";
import { AnnotationsController } from "./annotations-controller";
import { TimeMarkersController } from "./time-markers-controller";
import { RiskZonesController } from "./risk-zones-controller";
import { EquityCurveController } from "./equity-curve-controller";
import { PositionOverlayController } from "./position-overlay-controller";
import { PatternHighlightsController } from "./pattern-highlights-controller";
import { TrendLineController } from "./trend-line-controller";
import type { AnnotationsLayer } from "../annotations-layer";
import type { TimeMarkersLayer } from "../time-markers-layer";
import type { PatternLabelsLayer } from "../pattern-labels-layer";
import type { PositionOverlay as PositionOverlayComponent } from "../position-overlay";
import type { TrendLineLayer } from "../trend-line-layer";
import { logger } from "../../../util/logger";
import { ChartInteractionController } from "./chart-interaction-controller";
import { AnnotationsInteractionLayer } from "./layers/annotations-layer";
import { TrendLineDrawingLayer } from "./layers/trend-line-drawing-layer";
import { PriceLinesInteractionLayer } from "./layers/price-lines-layer";
import { TrendLinesInteractionLayer } from "./layers/trend-lines-layer";
import { TimeMarkersInteractionLayer } from "./layers/time-markers-layer";
import { RiskZonesLayer } from "../risk-zones-layer";
import { LiveCandleInteractionLayer } from "./layers/live-candle-layer";
import { touch } from "xinjs";

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
  initTrendLineController(context);
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

/**
 * Initialize trend line controller
 * Handles trend line drawing and management
 */
function initTrendLineController(context: ControllerFactoryContext): void {
  const container = context.container;
  const layer = context.renderRoot.querySelector(
    "trend-line-layer",
  ) as TrendLineLayer;

  if (layer) {
    logger.debug("ChartContainer: Found trend line layer");
    container.trendLineLayer = layer;
    container.trendLineController = new TrendLineController({
      container: container,
      state: context.state,
      trendLineLayer: layer,
    });
    logger.debug("ChartContainer: Initialized trend line controller");

    // Listen for trend line creation from drawing layer
    container.addEventListener(
      "trend-line-drawing-complete",
      (event: Event) => {
        const customEvent = event as CustomEvent;
        const trendLineData = customEvent.detail.trendLine;
        container.trendLineController?.handleTrendLineCreated(trendLineData);
      },
    );

    // Listen for drawing cancellation
    container.addEventListener("trend-line-drawing-cancelled", () => {
      container.trendLineController?.deactivateDrawingTool();
    });

    // Update the layer
    setTimeout(() => {
      if (layer && container.trendLineController) {
        layer.trendLines = context.state.trendLines || [];
        layer.state = context.state;
        layer.requestUpdate();
      }
    }, 100);
  }
}

/**
 * Context for initializing interaction layers
 */
export interface InteractionLayersContext {
  container: ChartContainer;
  chart: any; // CandlestickChart
  state: ChartState;
  priceAxisWidth: number;
  controllers: {
    annotationsController?: AnnotationsController;
    trendLineController?: TrendLineController;
    timeMarkersController?: TimeMarkersController;
    riskZonesController?: RiskZonesController;
  };
  callbacks: {
    onStateChange: (updates: Partial<ChartState>) => void;
    onNeedMoreData: (direction: "backward" | "forward") => void;
    onContextMenu: (position: { x: number; y: number }) => void;
    shouldSuppressChartClick: () => boolean;
  };
  config: {
    bufferMultiplier: number;
    zoomFactor: number;
    doubleTapDelay: number;
  };
}

/**
 * Initialize interaction controller and register all interaction layers
 * Extracted from ChartContainer to reduce complexity
 */
export function initializeInteractionLayers(
  context: InteractionLayersContext,
): ChartInteractionController {
  const {
    container,
    chart,
    state,
    priceAxisWidth,
    controllers,
    callbacks,
    config,
  } = context;

  // Create interaction controller
  const interactionController = new ChartInteractionController({
    chart,
    container: container as HTMLElement,
    state,
    onStateChange: (updates) => {
      callbacks.onStateChange(updates);
    },
    onNeedMoreData: (direction) => {
      callbacks.onNeedMoreData(direction);
    },
    onContextMenu: (position) => {
      callbacks.onContextMenu(position);
    },
    shouldSuppressChartClick: () => {
      return callbacks.shouldSuppressChartClick();
    },
    bufferMultiplier: config.bufferMultiplier,
    zoomFactor: config.zoomFactor,
    doubleTapDelay: config.doubleTapDelay,
  });

  interactionController.attach(true);

  // Register interaction layers (highest priority first)
  // Priority order: Annotations (100) > Trend Line Drawing (90) > Price Lines (90) > Trend Lines (80) > Time Markers (40) > Live Candle (10)

  // Annotations layer - highest priority (100)
  const annotationsLayer = new AnnotationsInteractionLayer(
    container as HTMLElement,
    state,
    () => state.annotations || [],
  );
  interactionController.registerLayer(annotationsLayer);

  // Set interaction layer on the controller
  if (controllers.annotationsController) {
    controllers.annotationsController.setInteractionLayer(annotationsLayer);
  }

  // Trend line drawing layer - priority 90 (when drawing tool is active)
  const trendLineDrawingLayer = new TrendLineDrawingLayer(
    container as HTMLElement,
    state,
    priceAxisWidth,
  );
  interactionController.registerLayer(trendLineDrawingLayer);

  // Set drawing layer on the controller
  if (controllers.trendLineController) {
    controllers.trendLineController.setDrawingLayer(trendLineDrawingLayer);
  }

  // Price lines layer - priority 90
  const priceLinesLayer = new PriceLinesInteractionLayer(
    container as HTMLElement,
    state,
    () => state.priceLines || [],
  );
  interactionController.registerLayer(priceLinesLayer);

  // Trend lines layer - priority 80
  const trendLinesLayer = new TrendLinesInteractionLayer(
    container as HTMLElement,
    state,
  );
  interactionController.registerLayer(trendLinesLayer);

  // Time markers layer - priority 40
  const timeMarkersLayer = new TimeMarkersInteractionLayer(
    container as HTMLElement,
    state,
    () => state.timeMarkers || [],
  );
  interactionController.registerLayer(timeMarkersLayer);

  // Set interaction layer on the controller
  if (controllers.timeMarkersController) {
    controllers.timeMarkersController.setInteractionLayer(timeMarkersLayer);
  }

  // Risk zones layer - priority 10 (canvas-based rendering)
  if (chart.canvas) {
    const riskZonesInteractionLayer = new RiskZonesLayer(chart.canvas);
    riskZonesInteractionLayer.setZones(state.riskZones || []);
    interactionController.registerLayer(riskZonesInteractionLayer);

    // Store reference on container for external access
    (container as any).riskZonesInteractionLayer = riskZonesInteractionLayer;

    // Set interaction layer on the controller
    if (controllers.riskZonesController) {
      controllers.riskZonesController.setInteractionLayer(
        riskZonesInteractionLayer,
      );
    }
  }

  // Live candle layer - lowest priority (10)
  const liveCandleLayer = new LiveCandleInteractionLayer(
    container as HTMLElement,
    state,
  );
  interactionController.registerLayer(liveCandleLayer);

  logger.debug("ChartContainer: All interaction layers registered");

  return interactionController;
}
