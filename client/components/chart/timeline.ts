import { customElement } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import {
  formatDate,
  formatTime,
  iterateTimeline,
  getTimelineMarks,
} from "../../util/chart-util";
import { xin } from "xinjs";
import { TimeRange } from "../../../server/services/price-data/price-history-model";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger('timeline');
logger.setLoggerLevel('timeline', LogLevel.ERROR);
import { ChartState } from "../..";
import { getLocalChartId, observeLocal } from "../../util/state-context";

const dpr = window.devicePixelRatio ?? 1;

@customElement("chart-timeline")
export class Timeline extends CanvasBase {
  private isDragging = false;
  private lastX = 0;
  private lastTouchDistance = 0;
  private isZooming = false;
  private timeRange: TimeRange = { start: 0, end: 0 };
  private animationFrameId: number | null = null;
  private _chartId: string = "state";

  override getId(): string {
    return "chart-timeline";
  }

  override useResizeObserver(): boolean {
    return true;
  }

  connectedCallback() {
    super.connectedCallback();

    // Initialize with safe defaults
    this.timeRange = { start: 0, end: 0 };
    
    // Defer state initialization until component is properly connected
    requestAnimationFrame(() => {
      this.initializeState();
    });
  }

  private initializeState() {
    // Get the local chart ID for this chart instance
    this._chartId = getLocalChartId(this);
    
    // Initialize timeRange with actual state data
    const stateData = xin[this._chartId] as ChartState;
    if (stateData?.timeRange) {
      this.timeRange = stateData.timeRange;
    }

    // Set up observers
    observeLocal(this, "state.timeRange", () => {
      const stateData = xin[this._chartId] as ChartState;
      if (stateData?.timeRange) {
        this.timeRange = stateData.timeRange;
        this.draw();
      }
    });
  }

  draw() {
    if (!this.canvas || !this.ctx || !this.timeRange) {
      return;
    }

    // Cancel any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.animationFrameId = requestAnimationFrame(() => {
      const viewportStartTimestamp = this.timeRange.start;
      const viewportEndTimestamp = this.timeRange.end;
      const canvasWidth = this.canvas!.width / dpr;

      const state = xin[this._chartId] as ChartState;
      if (!state) return;

      const ctx = this.ctx!;
      ctx.clearRect(0, 0, this.canvas!.width, this.canvas!.height);

      // Set text properties once
      const fontFamily = getComputedStyle(document.documentElement)
        .getPropertyValue("--font-primary")
        .trim();
      ctx.font = `${10}px ${fontFamily}`;
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-background-secondary")
        .trim();
      ctx.textAlign = "center";
      ctx.textBaseline = "top"; // Consistent text baseline

      iterateTimeline({
        callback: (x: number, timestamp: number) => {
          const date = new Date(timestamp);
          const { tickMark, dateChange } = getTimelineMarks(
            date,
            state.granularity
          );

          if (tickMark) {
            const timeLabel = formatTime(date);
            ctx.fillText(timeLabel, x, 3);
          }
          if (dateChange) {
            const dateLabel = formatDate(date);
            ctx.fillText(dateLabel, x, 17);
          }
        },
        granularity: state.granularity,
        viewportStartTimestamp,
        viewportEndTimestamp,
        canvasWidth,
      });
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  bindEventListeners(canvas: HTMLCanvasElement) {
    // Mouse events
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);

    // Touch events
    canvas.addEventListener("touchstart", this.handleTouchStart);
    canvas.addEventListener("touchmove", this.handleTouchMove);
    canvas.addEventListener("touchend", this.handleTouchEnd);
    canvas.addEventListener("touchcancel", this.handleTouchEnd);
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.lastX;
    this.dispatchZoom(deltaX, e.clientX, false);
    this.lastX = e.clientX;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault(); // Prevent page scrolling
    logger.debug("Wheel event", { deltaX: e.deltaX, deltaY: e.deltaY });
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;
    const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
    this.dispatchZoom(delta, e.clientX, isTrackpad);
  };

  private dispatchZoom(deltaX: number, clientX: number, isTrackpad: boolean) {
    logger.debug("Dispatching timeline-zoom event", {
      deltaX,
      clientX,
      isTrackpad,
      chartId: this._chartId
    });
    this.dispatchEvent(
      new CustomEvent("timeline-zoom", {
        detail: {
          deltaX,
          clientX,
          rect: this.getBoundingClientRect(),
          isTrackpad,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleTouchStart = (e: TouchEvent) => {
    e.preventDefault(); // Prevent scrolling while touching the timeline
    this.isDragging = true;

    if (e.touches.length === 2) {
      // Initialize pinch-to-zoom
      this.isZooming = true;
      this.lastTouchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      // Single touch for dragging
      this.lastX = e.touches[0].clientX;
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (!this.isDragging) return;

    if (e.touches.length === 2 && this.isZooming) {
      // Handle pinch-to-zoom
      const currentDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );

      const deltaDistance = currentDistance - this.lastTouchDistance;
      const zoomSensitivity = 0.5;

      // Use the midpoint of the two touches as the zoom center
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;

      // Apply zoom sensitivity to the delta and invert for natural pinch behavior
      const adjustedDelta = deltaDistance * zoomSensitivity;

      // Dispatch zoom event similar to mouse wheel zoom
      this.dispatchZoom(adjustedDelta, centerX, true);

      this.lastTouchDistance = currentDistance;
    } else if (e.touches.length === 1) {
      // Handle dragging
      const deltaX = e.touches[0].clientX - this.lastX;
      this.dispatchZoom(deltaX, e.touches[0].clientX, false);
      this.lastX = e.touches[0].clientX;
    }
  };

  private handleTouchEnd = () => {
    this.isDragging = false;
    this.isZooming = false;
  };
}
