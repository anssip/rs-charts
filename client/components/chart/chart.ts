import { customElement, property } from "lit/decorators.js";
import {
  Drawable,
  CandlestickStrategy,
  DrawingContext,
} from "./drawing-strategy";
import { CanvasBase } from "./canvas-base";
import { touch, xin } from "xinjs";
import { ChartState } from "../..";
import { TimeRange } from "../../candle-repository";
import { getCandleInterval, priceToY, timeToX } from "../../util/chart-util";

// We store data 5 times the visible range to allow for zooming and panning without fetching more data
export const BUFFER_MULTIPLIER = 5;

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ChartOptions {
  candleWidth: number;
  candleGap: number;
  minCandleWidth: number;
  maxCandleWidth: number;
}

@customElement("candlestick-chart")
export class CandlestickChart extends CanvasBase implements Drawable {
  private isDragging = false;
  private lastX = 0;
  private lastY = 0;
  private _state: ChartState | null = null;
  private _padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  } = { top: 0, right: 0, bottom: 0, left: 0 };

  @property({ type: Object })
  _options: ChartOptions = {
    candleWidth: 15,
    candleGap: 2,
    minCandleWidth: 2,
    maxCandleWidth: 100,
  };

  private drawingStrategy: Drawable = new CandlestickStrategy();
  override getId(): string {
    return "candlestick-chart";
  }

  @property({ type: Object })
  public set options(options: ChartOptions) {
    this._options = options;
  }

  @property({ type: Object })
  public set padding(padding: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  }) {
    this._padding = padding;
  }

  @property({ type: Object })
  public set state(state: ChartState) {
    console.log("CandlestickChart: Setting state", state);
    this._state = state;
  }

  bindEventListeners(canvas: HTMLCanvasElement): void {
    console.log("CandlestickChart: Binding event listeners");
    if (!canvas) {
      console.warn("No canvas found");
      return;
    }
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);
  }

  async firstUpdated() {
    super.firstUpdated();
    await new Promise((resolve) => setTimeout(resolve, 0));
    this.dispatchEvent(
      new CustomEvent("chart-ready", {
        bubbles: true,
        composed: true,
      })
    );
  }

  public drawWithContext(context: DrawingContext) {
    if (!this.ctx || !this.canvas) {
      console.warn("Cannot draw chart:", {
        hasContext: !!this.ctx,
        hasCanvas: !!this.canvas,
        dataSize: context.data.length,
      });
      return;
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawingStrategy.draw(context);
  }

  override draw() {
    if (!this._state) return;
    const context: DrawingContext = {
      ctx: this.ctx!,
      chartCanvas: this.canvas!,
      data: this._state!.priceHistory,
      options: this._options,
      viewportStartTimestamp: this._state!.timeRange.start,
      viewportEndTimestamp: this._state!.timeRange.end,
      priceRange: this._state!.priceRange,
      axisMappings: {
        timeToX: timeToX(this.canvas!.width, this._state!.timeRange),
        priceToY: priceToY(this.canvas!.height, {
          start: this._state!.priceRange.min,
          end: this._state.priceRange.max,
        }),
      },
    };
    this.drawWithContext(context);
  }

  override resize(width: number, height: number) {
    super.resize(width, height);

    xin["state.canvasWidth"] = width;
    xin["state.canvasHeight"] = height;
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;

    const deltaX = e.clientX - this.lastX;
    const deltaY = e.clientY - this.lastY;

    this.handlePan(deltaX);
    this.handleVerticalPan(deltaY);

    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handleDragEnd = () => {
    this.isDragging = false;
  };

  private handleWheel = (e: WheelEvent) => {
    console.log("CandlestickChart: Wheel event", e);
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;

    this.handlePan(e.deltaX, isTrackpad);
    this.handleVerticalPan(e.deltaY, isTrackpad);
  };

  private handlePan(deltaX: number, isTrackpad = false) {
    if (!this._state) return;
    const timeRange = this._state.timeRange.end - this._state.timeRange.start;
    const viewportWidth = this.canvas!.width / (window.devicePixelRatio ?? 1);
    const timePerPixel = timeRange / viewportWidth;

    const adjustedDelta = isTrackpad ? -deltaX : deltaX;
    const timeShift = Math.round(adjustedDelta * timePerPixel);

    if (timeShift === 0) return;

    const newStart = this._state.timeRange.start - timeShift;
    const newEnd = newStart + timeRange;

    this._state.timeRange = { start: newStart, end: newEnd };
    this.draw();

    // Check if we need more data
    const bufferTimeRange = timeRange * BUFFER_MULTIPLIER;
    const needMoreData =
      newStart < this._state.priceHistory.startTimestamp + bufferTimeRange ||
      newEnd > this._state.priceHistory.endTimestamp - bufferTimeRange;

    if (needMoreData) {
      this.dispatchRefetch(timeShift > 0 ? "backward" : "forward");
    }
  }

  private handleVerticalPan(deltaY: number, isTrackpad = false) {
    if (!this._state) return;

    const availableHeight =
      this.canvas!.height / (window.devicePixelRatio ?? 1);
    const pricePerPixel = this._state.priceRange.range / availableHeight;

    const sensitivity = 1.5;
    const adjustedDelta = (isTrackpad ? -deltaY : deltaY) * sensitivity;
    const priceShift = adjustedDelta * pricePerPixel;

    if (priceShift === 0) return;

    this._state.priceRange.shift(priceShift);
    touch("state.priceRange"); // trigger observers as shift() call does not cause it to happen

    this.draw();
  }

  public calculateVisibleCandles(): number {
    if (!this.canvas) return 0;
    const availableWidth =
      this.canvas!.width - this._padding.left - this._padding.right;

    const totalCandleWidth =
      this._options.candleWidth + this._options.candleGap;
    return Math.floor(
      availableWidth / (totalCandleWidth * window.devicePixelRatio)
    );
  }

  public dispatchRefetch(direction: "backward" | "forward") {
    if (!this._state) return;
    const FETCH_BATCH_SIZE = 200; // Number of candles to fetch at once

    const timeRange: TimeRange =
      direction === "backward"
        ? {
            start:
              this._state.priceHistory.startTimestamp -
              FETCH_BATCH_SIZE * getCandleInterval(this._state.granularity),
            end: this._state.priceHistory.startTimestamp,
          }
        : {
            start: this._state.priceHistory.endTimestamp,
            end:
              this._state.priceHistory.endTimestamp +
              FETCH_BATCH_SIZE * getCandleInterval(this._state.granularity),
          };
    console.log("Dispatching chart-pan event", {
      direction,
      timeRange,
      visibleCandles: this.calculateVisibleCandles(),
      needMoreData: true,
    });
    this.dispatchEvent(
      new CustomEvent("chart-pan", {
        detail: {
          direction,
          timeRange,
          visibleCandles: this.calculateVisibleCandles(),
          needMoreData: true,
          bubbles: true,
          composed: true,
        },
      })
    );
  }
}
