import { ChartOptions } from "./chart";
import {
  PriceHistory,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { HairlineGrid } from "./grid";
import { xin } from "xinjs";
import { iterateTimeline, getDpr } from "../../util/chart-util";
import { GridStyle, OscillatorConfig } from "./indicators/indicator-types";
import { LiveCandle } from "../../api/live-candle-subscription";
import { getLocalChartId, observeLocal } from "../../util/state-context";
import { getLogger, LogLevel } from "../../util/logger";
import { PatternHighlight } from "../../types/markers";
import { CandleData } from "./candle-renderer";
import { CandlePool } from "./candle-pool";

const logger = getLogger("CandlestickStrategy");
logger.setLoggerLevel("CandlestickStrategy", LogLevel.INFO);

export interface DrawingContext {
  ctx: CanvasRenderingContext2D;
  chartCanvas: HTMLCanvasElement;
  data: PriceHistory;
  options: ChartOptions;
  viewportStartTimestamp: number;
  viewportEndTimestamp: number;
  priceRange: PriceRange;
  axisMappings: AxisMappings;
  gridStyle?: GridStyle;
  oscillatorConfig?: OscillatorConfig; // Configuration for oscillator indicators
  patternHighlights?: PatternHighlight[]; // Pattern highlights to draw
}

export interface Drawable {
  draw(context: DrawingContext): void;
}

export interface AxisMappings {
  timeToX(timestamp: number): number;
  priceToY(price: number): number;
}

export class CandlestickStrategy implements Drawable {
  private drawCallCount = 0;
  private grid: HairlineGrid = new HairlineGrid();
  private readonly FIXED_GAP_WIDTH = 6; // pixels
  private readonly MIN_CANDLE_WIDTH = 5; // pixels
  private readonly MAX_CANDLE_WIDTH = 500; // pixels
  private animationFrameId: number | null = null;
  private liveCandle: LiveCandle | null = null;
  private chartId: string | null = null;
  private isInitialized: boolean = false;
  private redrawCallback: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private enableAnimations = true; // Can be disabled for better performance
  private lastLoggedState: {
    isInViewport: boolean;
    isRecent: boolean;
    timestamp: number;
  } | null = null;
  private lastLogTime: number = 0;
  private lastPositionLogTime: number = 0;
  private lastBoundsLogTime: number = 0;
  private readonly LOG_THROTTLE_MS = 5000; // Only log every 5 seconds

  // Candle rendering system
  private candlePool = new CandlePool();
  private pulseAnimationId: number | null = null;
  private lastAnimationTime = 0;
  private isAnimating = false;
  private currentHighlights: PatternHighlight[] = [];
  private isInteracting = false;
  private interactionEndTimeout: number | null = null;

  // Store candle positions for hit detection
  private candlePositions: Map<
    number,
    {
      x: number;
      y: number;
      width: number;
      height: number;
      candle: any;
    }
  > = new Map();

  drawGrid(context: DrawingContext): void {
    this.grid.draw(context);
  }

  draw(context: DrawingContext): void {
    this.initializeIfNeeded(context);
    this.drawCandles(context);
  }

  setRedrawCallback(callback: () => void): void {
    this.redrawCallback = callback;
  }

  private initializeIfNeeded(context: DrawingContext): void {
    if (this.isInitialized) return;

    // Try to get chart ID from the canvas element or context
    const canvas = context.chartCanvas;
    let chartElement = canvas.parentElement;

    // Walk up the DOM to find the chart container with a chart ID
    while (chartElement && !this.chartId) {
      if (
        chartElement.hasAttribute &&
        chartElement.hasAttribute("data-chart-id")
      ) {
        this.chartId = chartElement.getAttribute("data-chart-id");
      } else if ((chartElement as any).chartId) {
        this.chartId = (chartElement as any).chartId;
      } else {
        // Try to get chart ID using the same method as LiveDecorators
        try {
          this.chartId = getLocalChartId(chartElement as any);
        } catch (e) {
          // Continue searching up the DOM
        }
      }
      chartElement = chartElement.parentElement;
    }

    // Fallback to default chart ID
    if (!this.chartId) {
      this.chartId = "state";
    }

    this.setupLiveCandleObserver(canvas);
    this.isInitialized = true;
  }

  private setupLiveCandleObserver(canvasElement?: HTMLCanvasElement): void {
    if (!this.chartId || !canvasElement) return;

    // Observe live candle changes using the canvas element
    observeLocal(canvasElement, `${this.chartId}.liveCandle`, () => {
      const newLiveCandle = xin[`${this.chartId}.liveCandle`] as LiveCandle;

      // Only update if we have a new candle or significant change
      if (
        newLiveCandle &&
        (!this.liveCandle ||
          newLiveCandle.timestamp !== this.liveCandle.timestamp ||
          newLiveCandle.close !== this.liveCandle.close ||
          newLiveCandle.high !== this.liveCandle.high ||
          newLiveCandle.low !== this.liveCandle.low)
      ) {
        this.liveCandle = newLiveCandle;
        this.requestRedraw();
      }
    });

    // Initialize with current live candle if available
    const currentLiveCandle = xin[`${this.chartId}.liveCandle`] as LiveCandle;
    if (currentLiveCandle) {
      this.liveCandle = currentLiveCandle;
    }

    // Listen for visibility changes to immediately update when chart becomes visible
    this.visibilityChangeHandler = this.handleVisibilityChange.bind(this);
    document.addEventListener("visibilitychange", this.visibilityChangeHandler);

    // Listen for interaction events to pause animations during pan/zoom
    if (canvasElement?.parentElement) {
      const container = canvasElement.parentElement;

      container.addEventListener("interaction-start", () => {
        this.handleInteractionStart();
      });

      container.addEventListener("interaction-end", () => {
        this.handleInteractionEnd();
      });
    }
  }

  private requestRedraw(): void {
    if (this.redrawCallback) {
      // Use requestAnimationFrame to avoid excessive redraws
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }

      this.animationFrameId = requestAnimationFrame(() => {
        this.animationFrameId = null;
        if (this.redrawCallback) {
          this.redrawCallback();
        }
      });
    }
  }

  private drawCandles(context: DrawingContext): void {
    const {
      ctx,
      chartCanvas: canvas,
      data,
      axisMappings: { priceToY },
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;
    const dpr = getDpr(); // Use fixed DPR

    // 1. Clear the entire canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Clear candle positions for new render
    this.candlePositions.clear();

    // Track draw calls and timing
    this.drawCallCount++;

    // 1. Build highlight map FIRST before resetting pool - optimized with Set for O(1) lookup
    const highlightMap = new Map<number, PatternHighlight>();
    const highlightTimestamps = new Set<number>();

    if (context.patternHighlights && context.patternHighlights.length > 0) {
      // Store current highlights for animation
      this.currentHighlights = context.patternHighlights;

      // Build map with normalized timestamps - more efficient lookup
      for (const pattern of context.patternHighlights) {
        for (const timestamp of pattern.candleTimestamps) {
          const normalizedTimestamp =
            Math.floor(timestamp / data.granularityMs) * data.granularityMs;
          highlightMap.set(normalizedTimestamp, pattern);
          highlightTimestamps.add(normalizedTimestamp);
        }
      }

      // Pass highlight count to pool for optimization
      this.candlePool.setHighlightCount(highlightTimestamps.size);

      // Start animation if not already running
      // Only animate if we have a reasonable number of patterns (performance optimization)
      const patternCount = context.patternHighlights.length;

      // Disable animations if too many patterns for performance
      if (patternCount > 10) {
        this.enableAnimations = false;
      } else {
        this.enableAnimations = true;
      }

      if (
        !this.isAnimating &&
        this.enableAnimations &&
        patternCount <= 20 &&
        !this.isInteracting
      ) {
        this.startPulseAnimation();
      } else if (
        this.isAnimating &&
        (!this.enableAnimations || patternCount > 20)
      ) {
        // Stop animation if too many patterns for performance
        this.stopPulseAnimation();
        if (patternCount > 10) {
          logger.debug(
            "Stopped animation due to high pattern count:",
            patternCount,
          );
        }
      }
    } else {
      // Stop animation if no highlights
      if (this.isAnimating) {
        this.stopPulseAnimation();
      }
      this.currentHighlights = [];
    }

    // 2. Now reset candle pool (it will preserve highlighted renderers)
    this.candlePool.reset();

    // 3. Draw the grid first (it will be in the background)
    this.drawGrid(context);

    // 4. COMMENTED OUT - Save the canvas state before drawing candles
    // ctx.save();

    // Calculate candle width
    const timeSpan = viewportEndTimestamp - viewportStartTimestamp;
    const candleCount = Math.ceil(timeSpan / data.granularityMs);
    const availableWidth = canvas.width / dpr;

    // Calculate total gap width based on number of gaps (one less than candle count)
    const numberOfGaps = Math.max(0, candleCount - 1);
    const totalGapWidth = numberOfGaps * this.FIXED_GAP_WIDTH;

    // Calculate space available for candle bodies after accounting for gaps
    const spaceForCandles = Math.max(0, availableWidth - totalGapWidth);

    // Calculate candle width ensuring MIN_CANDLE_WIDTH is respected
    let candleWidth = spaceForCandles / Math.max(1, candleCount);

    // Enforce MIN and MAX candle width constraints
    candleWidth = Math.max(
      this.MIN_CANDLE_WIDTH,
      Math.min(this.MAX_CANDLE_WIDTH, candleWidth),
    );

    // 5. Draw historical candles
    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        // Check if this timestamp should be replaced by live candle
        let candle = data.getCandle(timestamp);
        let isLiveCandle = false;

        // Use live candle if it matches this timestamp and is more recent
        // Convert live candle timestamp to milliseconds for comparison if needed
        let liveCandleTimestampMs = this.liveCandle?.timestamp || 0;
        if (this.liveCandle && this.liveCandle.timestamp < 2000000000) {
          // Before year 2033 in seconds
          liveCandleTimestampMs = this.liveCandle.timestamp * 1000;
        }

        if (
          this.liveCandle &&
          liveCandleTimestampMs === timestamp &&
          this.liveCandle.lastUpdate &&
          Date.now() - this.liveCandle.lastUpdate.getTime() < 60000
        ) {
          // Live data is less than 1 minute old

          logger.debug(
            `Replacing historical candle with live candle at timestamp ${timestamp}, x=${x}`,
          );

          candle = {
            timestamp: this.liveCandle.timestamp,
            open: this.liveCandle.open,
            high: this.liveCandle.high,
            low: this.liveCandle.low,
            close: this.liveCandle.close,
            volume: this.liveCandle.volume,
            granularity: data.getGranularity(),
            live: true,
            evaluations: [],
          };
          isLiveCandle = true;
        }

        if (!candle) return;

        if (`${candle.granularity}` !== `${data.getGranularity()}`) {
          throw new Error(
            `CandlestickStrategy: Candle granularity does not match state granularity: ${
              candle.granularity
            } !== ${data.getGranularity()}`,
          );
        }

        // Get renderer for this candle
        const renderer = this.candlePool.getCandle(timestamp);

        // Quick check using Set before doing Map lookup (O(1) check)
        const normalizedTimestamp =
          Math.floor(timestamp / data.granularityMs) * data.granularityMs;

        // Only do Map lookup if timestamp is in highlight set
        let highlight: PatternHighlight | null = null;
        if (highlightTimestamps.has(normalizedTimestamp)) {
          highlight = highlightMap.get(normalizedTimestamp) || null;
          renderer.setHighlight(highlight);
        } else {
          // No highlight for this timestamp
          renderer.setHighlight(null);
        }

        // Convert to CandleData format
        const candleData: CandleData = {
          timestamp: candle.timestamp,
          open: candle.open,
          high: candle.high,
          low: candle.low,
          close: candle.close,
          volume: candle.volume,
          live: isLiveCandle,
        };

        // Draw using renderer with shared pulse optimization for many highlights
        const useSharedPulse = highlightTimestamps.size > 10;
        const sharedPulse = useSharedPulse
          ? this.candlePool.getSharedPulse()
          : undefined;

        renderer.draw(
          ctx,
          candleData,
          x,
          candleWidth,
          priceToY,
          !this.enableAnimations || this.isInteracting,
          sharedPulse,
          useSharedPulse,
        );

        // Immediately verify if highlight was drawn
        if (highlight) {
          const imageData = ctx.getImageData(
            Math.floor(x - candleWidth / 2),
            Math.floor(
              priceToY(Math.max(candle.high, candle.open, candle.close)),
            ),
            Math.ceil(candleWidth),
            2,
          );

          const data = imageData.data;
          let hasWhite = false;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 250 && data[i + 1] > 250 && data[i + 2] > 250) {
              hasWhite = true;
              break;
            }
          }
        }

        // Store position for hit detection
        // Use the same x position that was used for drawing
        this.candlePositions.set(timestamp, {
          x: x - candleWidth / 2,
          y: Math.min(priceToY(candle.high), priceToY(candle.low)),
          width: candleWidth,
          height: Math.abs(priceToY(candle.high) - priceToY(candle.low)),
          candle: candleData,
        });
      },
      granularity: data.getGranularity(),
      viewportStartTimestamp,
      viewportEndTimestamp,
      canvasWidth: canvas.width / dpr,
      interval: data.granularityMs,
      alignToLocalTime: false,
    });

    // 6. Draw live candle if it's beyond the current timeline (most recent)
    this.drawLiveCandleIfNeeded(context, candleWidth, dpr);

    // Final verification - check if any white pixels still exist on canvas
    if (highlightMap.size > 0) {
      const fullImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const fullData = fullImageData.data;
      let whitePixelCount = 0;
      for (let i = 0; i < fullData.length; i += 4) {
        if (
          fullData[i] > 250 &&
          fullData[i + 1] > 250 &&
          fullData[i + 2] > 250
        ) {
          whitePixelCount++;
        }
      }
    }

    // 7. COMMENTED OUT - Restore the canvas state
    // ctx.restore();
  }

  private drawLiveCandleIfNeeded(
    context: DrawingContext,
    candleWidth: number,
    dpr: number,
  ): void {
    if (!this.liveCandle) return;

    const {
      ctx,
      chartCanvas: canvas,
      data,
      axisMappings: { timeToX, priceToY },
      viewportStartTimestamp,
      viewportEndTimestamp,
    } = context;

    // Check if live candle is in the current viewport or should be positioned at the end
    // Live candles often represent the current incomplete candle, so they should be visible
    // even if slightly outside the viewport end
    const viewportBuffer =
      (viewportEndTimestamp - viewportStartTimestamp) * 0.1; // 10% buffer

    // Convert live candle timestamp to milliseconds if needed for viewport comparison
    let liveCandleTimestampMs = this.liveCandle.timestamp;
    if (this.liveCandle.timestamp < 2000000000) {
      // Before year 2033 in seconds
      liveCandleTimestampMs = this.liveCandle.timestamp * 1000;
    }

    const isInViewport =
      liveCandleTimestampMs >= viewportStartTimestamp - viewportBuffer &&
      liveCandleTimestampMs <= viewportEndTimestamp + viewportBuffer;

    // Check if live candle is recent - be more generous with timing
    const now = Date.now();
    const candleAge = this.liveCandle.lastUpdate
      ? now - this.liveCandle.lastUpdate.getTime()
      : now - this.liveCandle.timestamp * 1000; // Convert seconds to milliseconds if needed

    const isRecent = candleAge < 300000; // 5 minutes instead of 1 minute

    // Throttle logging to prevent spam - only log when state changes or after throttle period
    const currentTime = Date.now();
    const stateChanged =
      !this.lastLoggedState ||
      this.lastLoggedState.isInViewport !== isInViewport ||
      this.lastLoggedState.isRecent !== isRecent ||
      this.lastLoggedState.timestamp !== this.liveCandle.timestamp;

    const shouldLog =
      (!isInViewport || !isRecent) &&
      (stateChanged || currentTime - this.lastLogTime > this.LOG_THROTTLE_MS);

    if (shouldLog) {
      logger.debug(
        `Live candle check - inViewport: ${isInViewport}, isRecent: ${isRecent}, timestamp: ${this.liveCandle.timestamp} (${liveCandleTimestampMs}ms), viewport: ${viewportStartTimestamp}-${viewportEndTimestamp}`,
      );
      this.lastLoggedState = {
        isInViewport,
        isRecent,
        timestamp: this.liveCandle.timestamp,
      };
      this.lastLogTime = currentTime;
    }

    if (!isInViewport || !isRecent) return;

    // Check if this live candle timestamp already exists in historical data
    // Use the milliseconds version for consistency with historical data
    const historicalCandle = data.getCandle(liveCandleTimestampMs);
    if (historicalCandle) {
      // Already drawn in the main loop with live data
      logger.debug(
        `Live candle already drawn in main loop at timestamp ${this.liveCandle.timestamp} (${liveCandleTimestampMs}ms)`,
      );
      return;
    }

    // For live candles that don't match the timeline, we need to find the correct position
    // This usually happens when the live candle represents a new, incomplete candle

    // Smart positioning: if live candle doesn't have historical data, position it appropriately
    const granularityMs = data.granularityMs;

    // Check if this live candle should connect to the most recent historical candle
    // by looking for the expected next candle slot based on granularity
    const timestamps = data.getTimestampsSorted();
    let targetTimestamp = liveCandleTimestampMs;

    if (timestamps.length > 0) {
      const lastHistoricalTimestamp = timestamps[timestamps.length - 1];
      const expectedNextCandleTimestamp =
        lastHistoricalTimestamp + granularityMs;

      // If live candle is close to the expected next candle time, position it there
      const timeDiff = Math.abs(
        liveCandleTimestampMs - expectedNextCandleTimestamp,
      );
      if (timeDiff < granularityMs * 0.5) {
        // Within 50% of granularity
        targetTimestamp = expectedNextCandleTimestamp;
        logger.debug(
          `Aligning live candle to expected timeline position - lastHistorical: ${lastHistoricalTimestamp}, expected: ${expectedNextCandleTimestamp}, original: ${liveCandleTimestampMs}`,
        );
      }
    }

    let x = timeToX(targetTimestamp);

    logger.debug(
      `Live candle positioning - originalTs: ${this.liveCandle.timestamp}, convertedTs: ${liveCandleTimestampMs}, targetTs: ${targetTimestamp}, granularityMs: ${granularityMs}`,
    );

    // If the live candle is beyond the viewport, position it at the end
    if (targetTimestamp > viewportEndTimestamp) {
      // Position at the next expected candle slot after the viewport end
      const nextCandleTime =
        Math.ceil(viewportEndTimestamp / granularityMs) * granularityMs;
      x = timeToX(nextCandleTime);
      if (currentTime - this.lastPositionLogTime > this.LOG_THROTTLE_MS) {
        logger.debug(
          `Positioning live candle at next slot: ${nextCandleTime}, X: ${x}`,
        );
        this.lastPositionLogTime = currentTime;
      }
    } else {
      // Use the candle's actual timestamp
      x = timeToX(targetTimestamp);
      if (currentTime - this.lastPositionLogTime > this.LOG_THROTTLE_MS) {
        logger.debug(
          `Using live candle actual timestamp: ${targetTimestamp}, X: ${x}`,
        );
        this.lastPositionLogTime = currentTime;
      }
    }

    // Only draw if x position is within canvas bounds
    if (x < 0 || x > canvas.width / dpr) {
      if (currentTime - this.lastBoundsLogTime > this.LOG_THROTTLE_MS) {
        logger.debug(
          `Live candle X position ${x} outside canvas bounds (0 to ${canvas.width / dpr})`,
        );
        this.lastBoundsLogTime = currentTime;
      }
      return;
    }

    const liveCandle = {
      timestamp: this.liveCandle.timestamp,
      open: this.liveCandle.open,
      high: this.liveCandle.high,
      low: this.liveCandle.low,
      close: this.liveCandle.close,
      volume: this.liveCandle.volume,
      granularity: data.getGranularity(),
      live: true,
      evaluations: [],
    };

    // Get renderer for live candle
    const renderer = this.candlePool.getCandle(targetTimestamp);

    // Check if live candle should be highlighted
    let highlight: PatternHighlight | null = null;
    if (this.currentHighlights.length > 0) {
      const normalizedTimestamp =
        Math.floor(targetTimestamp / data.granularityMs) * data.granularityMs;
      for (const pattern of this.currentHighlights) {
        if (
          pattern.candleTimestamps.includes(normalizedTimestamp) ||
          pattern.candleTimestamps.includes(targetTimestamp)
        ) {
          highlight = pattern;
          break;
        }
      }
    }

    renderer.setHighlight(highlight);

    // Convert to CandleData format
    const candleData: CandleData = {
      timestamp: targetTimestamp,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
      volume: liveCandle.volume,
      live: true,
    };

    // Draw using renderer with shared pulse optimization if many highlights exist
    // Check total highlight count from current highlights
    let totalHighlightedCandles = 0;
    if (this.currentHighlights.length > 0) {
      const uniqueTimestamps = new Set<number>();
      for (const pattern of this.currentHighlights) {
        pattern.candleTimestamps.forEach((ts) => uniqueTimestamps.add(ts));
      }
      totalHighlightedCandles = uniqueTimestamps.size;
    }

    const useSharedPulse = totalHighlightedCandles > 10;
    const sharedPulse = useSharedPulse
      ? this.candlePool.getSharedPulse()
      : undefined;

    renderer.draw(
      ctx,
      candleData,
      x,
      candleWidth,
      priceToY,
      !this.enableAnimations || this.isInteracting,
      sharedPulse,
      useSharedPulse,
    );

    // Store position for hit detection
    this.candlePositions.set(targetTimestamp, {
      x: x - candleWidth / 2,
      y: Math.min(priceToY(liveCandle.high), priceToY(liveCandle.low)),
      width: candleWidth,
      height: Math.abs(priceToY(liveCandle.high) - priceToY(liveCandle.low)),
      candle: candleData,
    });
  }

  private handleVisibilityChange = () => {
    if (
      document.visibilityState === "visible" &&
      this.isInitialized &&
      this.chartId
    ) {
      logger.debug(`Page became visible, updating live candle immediately`);

      // Force immediate update of live candle data when page becomes visible
      const newLiveCandle = xin[`${this.chartId}.liveCandle`] as LiveCandle;
      if (newLiveCandle) {
        // Update live candle data even if it seems the same (might have been updated while hidden)
        const oldTimestamp = this.liveCandle?.timestamp || 0;
        this.liveCandle = newLiveCandle;

        logger.debug(`Updated live candle on visibility change`, {
          oldTimestamp,
          newTimestamp: newLiveCandle.timestamp,
          price: newLiveCandle.close,
        });

        // Force immediate redraw - try multiple approaches to ensure it works
        if (this.redrawCallback) {
          logger.debug(`Triggering redraw via callback`);
          this.requestRedraw();
        } else {
          logger.warn(
            `No redraw callback available, trying alternative redraw methods`,
          );

          // Try to find and trigger chart container redraw directly
          try {
            const chartContainers =
              document.querySelectorAll("chart-container");
            chartContainers.forEach((container) => {
              const containerChartId = container.getAttribute("data-chart-id");
              if (
                containerChartId === this.chartId &&
                typeof (container as any).draw === "function"
              ) {
                logger.debug(`Triggering direct container redraw`);
                (container as any).draw();
              }
            });
          } catch (error) {
            logger.error(`Failed to trigger direct redraw:`, error);
          }
        }
      } else {
        logger.debug(`No live candle available on visibility change`);
      }
    }
  };

  private handleInteractionStart() {
    this.isInteracting = true;

    // Clear any pending resume timeout
    if (this.interactionEndTimeout) {
      clearTimeout(this.interactionEndTimeout);
      this.interactionEndTimeout = null;
    }

    // Stop animation if running
    if (this.isAnimating) {
      this.stopPulseAnimation();
    }
  }

  private handleInteractionEnd() {
    // Debounce animation resume to avoid flicker during rapid interactions
    if (this.interactionEndTimeout) {
      clearTimeout(this.interactionEndTimeout);
    }

    this.interactionEndTimeout = setTimeout(() => {
      this.isInteracting = false;
      this.interactionEndTimeout = null;

      // Resume animation if we have highlights and animations are enabled
      if (this.currentHighlights.length > 0 && this.enableAnimations) {
        const patternCount = this.currentHighlights.reduce(
          (count, pattern) => count + (pattern.candleTimestamps?.length || 0),
          0,
        );

        // Only animate if pattern count is reasonable
        if (patternCount <= 20) {
          this.startPulseAnimation();
        }
      }
    }, 100) as unknown as number; // 100ms debounce
  }

  private startPulseAnimation() {
    if (this.isAnimating || this.isInteracting) return;

    this.isAnimating = true;
    this.lastAnimationTime = performance.now();

    // Target 30 FPS instead of 60 FPS for better performance
    const TARGET_FPS = 30;
    const FRAME_TIME = 1000 / TARGET_FPS;
    let lastFrameTime = 0;

    const animate = (currentTime: number) => {
      if (!this.isAnimating) return;

      // Throttle to target FPS
      if (currentTime - lastFrameTime < FRAME_TIME) {
        this.pulseAnimationId = requestAnimationFrame(animate);
        return;
      }
      lastFrameTime = currentTime;

      // Calculate delta time
      const deltaTime = currentTime - this.lastAnimationTime;
      this.lastAnimationTime = currentTime;

      // Update all active candle renderers
      // Only redraw if there were significant visual changes
      const hasChanges = this.candlePool.updateAll(deltaTime);

      // Trigger redraw only if needed
      if (hasChanges && this.redrawCallback) {
        this.redrawCallback();
      }

      this.pulseAnimationId = requestAnimationFrame(animate);
    };

    this.pulseAnimationId = requestAnimationFrame(animate);
    logger.debug("Started pulse animation at 30 FPS");
  }

  private stopPulseAnimation() {
    if (!this.isAnimating) return;

    this.isAnimating = false;

    if (this.pulseAnimationId !== null) {
      cancelAnimationFrame(this.pulseAnimationId);
      this.pulseAnimationId = null;
    }

    logger.debug("Stopped pulse animation");
  }

  public destroy(): void {
    // Stop pulse animation
    this.stopPulseAnimation();

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up candle pool
    this.candlePool.dispose();

    // Clean up state
    this.liveCandle = null;
    this.chartId = null;
    this.isInitialized = false;
    this.redrawCallback = null;

    // Clean up visibility change listener
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler,
      );
      this.visibilityChangeHandler = null;
    }

    this.grid.destroy();
  }

  // Find candle at the given coordinates
  getCandleAtPosition(x: number, y: number): any | null {
    logger.debug(`getCandleAtPosition called with x: ${x}, y: ${y}`);
    logger.debug(
      `Number of candle positions stored: ${this.candlePositions.size}`,
    );

    // Find the candle based only on X coordinate
    // This makes clicking much more reliable since we don't need precise vertical targeting
    for (const [timestamp, position] of this.candlePositions) {
      // Check if click is within candle's horizontal bounds
      // Use generous padding to make candles easier to click
      const xPadding = 4; // Increased padding for easier clicking

      if (
        x >= position.x - xPadding &&
        x <= position.x + position.width + xPadding
      ) {
        logger.debug(
          `Found candle at timestamp ${timestamp}:`,
          position.candle,
        );
        logger.debug(
          `Candle x range: ${position.x - xPadding} to ${position.x + position.width + xPadding}`,
        );
        return position.candle;
      }
    }

    // If no exact match, find the closest candle
    let closestCandle = null;
    let closestDistance = Infinity;

    for (const [timestamp, position] of this.candlePositions) {
      const candleCenterX = position.x + position.width / 2;
      const distance = Math.abs(x - candleCenterX);

      if (distance < closestDistance && distance < 20) {
        // Within 20 pixels
        closestDistance = distance;
        closestCandle = position.candle;
      }
    }

    if (closestCandle) {
      logger.debug("Found closest candle within 20px:", closestCandle);
      return closestCandle;
    }

    logger.debug("No candle found at position");
    return null;
  }
}
