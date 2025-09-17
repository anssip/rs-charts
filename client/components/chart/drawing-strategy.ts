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
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("CandlestickStrategy");
logger.setLoggerLevel("CandlestickStrategy", LogLevel.ERROR);

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
}

export interface Drawable {
  draw(context: DrawingContext): void;
}

export interface AxisMappings {
  timeToX(timestamp: number): number;
  priceToY(price: number): number;
}

export class CandlestickStrategy implements Drawable {
  private grid: HairlineGrid = new HairlineGrid();
  private readonly FIXED_GAP_WIDTH = 6; // pixels
  private readonly MIN_CANDLE_WIDTH = 5; // pixels
  private readonly MAX_CANDLE_WIDTH = 500; // pixels
  private animationFrameId: number | null = null;
  private liveCandle: LiveCandle | null = null;
  private chartId: string | null = null;
  private isInitialized: boolean = false;
  private lastDrawnLiveTimestamp: number = 0;
  private redrawCallback: (() => void) | null = null;
  private visibilityChangeHandler: (() => void) | null = null;
  private lastLoggedState: {
    isInViewport: boolean;
    isRecent: boolean;
    timestamp: number;
  } | null = null;
  private lastLogTime: number = 0;
  private lastPositionLogTime: number = 0;
  private lastBoundsLogTime: number = 0;
  private lastDrawLogTime: number = 0;
  private readonly LOG_THROTTLE_MS = 5000; // Only log every 5 seconds

  // Store candle positions for hit detection
  private candlePositions: Map<number, {
    x: number;
    y: number;
    width: number;
    height: number;
    candle: any;
  }> = new Map();

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

    // 2. Draw the grid first (it will be in the background)
    this.drawGrid(context);

    // 3. Save the canvas state before drawing candles
    ctx.save();

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
    candleWidth = Math.max(this.MIN_CANDLE_WIDTH, Math.min(this.MAX_CANDLE_WIDTH, candleWidth));

    // 4. Draw historical candles
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

        this.drawSingleCandle(
          ctx,
          candle,
          x,
          candleWidth,
          priceToY,
          isLiveCandle,
        );
      },
      granularity: data.getGranularity(),
      viewportStartTimestamp,
      viewportEndTimestamp,
      canvasWidth: canvas.width / dpr,
      interval: data.granularityMs,
      alignToLocalTime: false,
    });

    // 5. Draw live candle if it's beyond the current timeline (most recent)
    this.drawLiveCandleIfNeeded(context, candleWidth, dpr);

    // 6. Restore the canvas state
    ctx.restore();
  }

  private drawSingleCandle(
    ctx: CanvasRenderingContext2D,
    candle: any,
    x: number,
    candleWidth: number,
    priceToY: (price: number) => number,
    isLiveCandle: boolean = false,
  ): void {
    // Calculate x position for candle
    const candleX = x - candleWidth / 2;

    // Validate candle data
    if (
      typeof candle.open !== "number" ||
      typeof candle.close !== "number" ||
      typeof candle.high !== "number" ||
      typeof candle.low !== "number"
    ) {
      logger.warn(`Invalid candle data`, candle);
      return;
    }

    // Ensure high/low are consistent
    const actualHigh = Math.max(candle.high, candle.open, candle.close);
    const actualLow = Math.min(candle.low, candle.open, candle.close);

    // Determine colors
    const isGreen = candle.close > candle.open;
    const wickColor = isGreen
      ? getComputedStyle(document.documentElement)
          .getPropertyValue("--color-accent-1")
          .trim()
      : getComputedStyle(document.documentElement)
          .getPropertyValue("--color-error")
          .trim();

    // Draw wick first (full high-low range)
    ctx.beginPath();
    ctx.strokeStyle = wickColor;
    ctx.setLineDash(isLiveCandle ? [2, 2] : []); // Dashed for live candles
    ctx.lineWidth = isLiveCandle ? 1.5 : 1; // Slightly thicker for live candles

    const highY = priceToY(actualHigh);
    const lowY = priceToY(actualLow);
    const wickX = candleX + candleWidth / 2;

    // Only draw wick if there's a meaningful range
    if (Math.abs(highY - lowY) > 0.5) {
      ctx.moveTo(wickX, highY);
      ctx.lineTo(wickX, lowY);
      ctx.stroke();
    }

    // Draw body (open-close range)
    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const bodyHeight = Math.abs(closeY - openY);
    const bodyTop = Math.min(closeY, openY);

    ctx.fillStyle = wickColor;

    // Add slight transparency for live candles to differentiate them
    if (isLiveCandle) {
      ctx.globalAlpha = 0.9;
    }

    // Ensure minimum body height for visibility
    const minBodyHeight = Math.max(bodyHeight, 1);
    ctx.fillRect(candleX, bodyTop, candleWidth, minBodyHeight);

    // Reset alpha
    if (isLiveCandle) {
      ctx.globalAlpha = 1.0;
    }

    // Reset line dash
    ctx.setLineDash([]);

    // Store candle position for hit detection
    this.candlePositions.set(candle.timestamp, {
      x: candleX,
      y: Math.min(highY, lowY),
      width: candleWidth,
      height: Math.abs(highY - lowY),
      candle: {
        timestamp: candle.timestamp,
        open: candle.open,
        high: actualHigh,
        low: actualLow,
        close: candle.close,
        volume: candle.volume
      }
    });

    // Debug log for live candles
    if (isLiveCandle) {
      logger.debug(
        `Drew live candle at X=${candleX} with body from ${bodyTop} to ${bodyTop + minBodyHeight} (OHLC: ${candle.open}, ${actualHigh}, ${actualLow}, ${candle.close})`,
      );
    }
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

    if (currentTime - this.lastDrawLogTime > this.LOG_THROTTLE_MS) {
      logger.debug(
        `Drawing live candle at X=${x} with OHLC: O=${liveCandle.open}, H=${liveCandle.high}, L=${liveCandle.low}, C=${liveCandle.close}`,
      );
      this.lastDrawLogTime = currentTime;
    }

    this.drawSingleCandle(ctx, liveCandle, x, candleWidth, priceToY, true);
    this.lastDrawnLiveTimestamp = this.liveCandle.timestamp;
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

  public destroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // Clean up state
    this.liveCandle = null;
    this.chartId = null;
    this.isInitialized = false;
    this.redrawCallback = null;
    this.lastDrawnLiveTimestamp = 0;

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
    for (const [_, position] of this.candlePositions) {
      // Check if click is within candle bounds (with some padding for easier clicking)
      const padding = 2; // Add some padding to make candles easier to click
      if (
        x >= position.x - padding &&
        x <= position.x + position.width + padding &&
        y >= position.y - padding &&
        y <= position.y + position.height + padding
      ) {
        return position.candle;
      }
    }
    return null;
  }
}
