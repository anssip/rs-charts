import { customElement, property } from "lit/decorators.js";
import { CanvasBase } from "../canvas-base";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { iterateTimeline, priceToY } from "../../../util/chart-util";

@customElement("market-indicator")
export class MarketIndicator extends CanvasBase {
  @property({ type: String })
  indicatorId?: string;

  private _state: ChartState | null = null;

  constructor(props?: { indicatorId?: string }) {
    super();
    if (props?.indicatorId) {
      this.indicatorId = props.indicatorId;
    }
  }

  override getId(): string {
    return "market-indicator";
  }

  firstUpdated() {
    super.firstUpdated();
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.draw();
    });
    observe("state.timeRange", () => {
      this.draw();
    });
    observe("state.priceRange", () => {
      this.draw();
    });
  }

  useResizeObserver(): boolean {
    return true;
  }

  private drawLine(
    ctx: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    style: {
      color?: string;
      lineWidth?: number;
      opacity?: number;
      dashArray?: number[];
    }
  ) {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.strokeStyle = style.color || "#ffffff";
    ctx.lineWidth = style.lineWidth || 1;
    ctx.globalAlpha = style.opacity || 1;

    if (style.dashArray) {
      ctx.setLineDash(style.dashArray);
    }

    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }

    ctx.stroke();
    ctx.setLineDash([]); // Reset dash array
    ctx.globalAlpha = 1; // Reset opacity
  }

  private drawBand(
    ctx: CanvasRenderingContext2D,
    upperPoints: { x: number; y: number }[],
    lowerPoints: { x: number; y: number }[],
    style: {
      color?: string;
      lineWidth?: number;
      opacity?: number;
      fillColor?: string;
      fillOpacity?: number;
    }
  ) {
    if (upperPoints.length < 2 || lowerPoints.length < 2) return;

    // Draw the filled area between bands
    ctx.beginPath();
    ctx.moveTo(upperPoints[0].x, upperPoints[0].y);

    // Draw upper band
    for (let i = 1; i < upperPoints.length; i++) {
      ctx.lineTo(upperPoints[i].x, upperPoints[i].y);
    }

    // Draw lower band in reverse
    for (let i = lowerPoints.length - 1; i >= 0; i--) {
      ctx.lineTo(lowerPoints[i].x, lowerPoints[i].y);
    }

    ctx.closePath();

    // Fill the area
    if (style.fillColor) {
      ctx.fillStyle = style.fillColor;
      ctx.globalAlpha = style.fillOpacity || 0.1;
      ctx.fill();
    }

    // Draw the band borders
    ctx.strokeStyle = style.color || "#ffffff";
    ctx.lineWidth = style.lineWidth || 1;
    ctx.globalAlpha = style.opacity || 1;
    ctx.stroke();

    ctx.globalAlpha = 1; // Reset opacity
  }

  draw() {
    if (!this.canvas || !this.ctx || !this._state || !this.indicatorId) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw border for debugging
    ctx.strokeStyle = "red";
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, this.canvas.width, this.canvas.height);

    // Get visible candles
    const candles = this._state.priceHistory.getCandlesInRange(
      this._state.timeRange.start,
      this._state.timeRange.end
    );

    // Find the indicator data
    const evaluation = candles[0]?.[1]?.evaluations?.find(
      (e) => e.id === this.indicatorId
    );
    if (!evaluation) return;

    // Create a map to store points for each plot
    const plotPoints: { [key: string]: { x: number; y: number }[] } = {};
    const candleWidth = this.canvas.width / dpr / candles.length;

    const getY = priceToY(this.canvas.height, {
      start: this._state.priceRange.min,
      end: this._state.priceRange.max,
    });

    // Collect points for each plot
    iterateTimeline({
      callback: (x: number, timestamp: number) => {
        const candle = this._state!.priceHistory.getCandle(timestamp);
        if (!candle) return;

        const indicator = candle.evaluations.find(
          (e) => e.id === this.indicatorId
        );
        if (!indicator) return;

        indicator.values.forEach((value) => {
          if (!plotPoints[value.plot_ref]) {
            plotPoints[value.plot_ref] = [];
          }

          const candleX = x + candleWidth / 2;
          plotPoints[value.plot_ref].push({
            x: candleX,
            y: getY(value.value),
          });
        });
      },
      granularity: this._state.priceHistory.getGranularity(),
      viewportStartTimestamp: this._state.timeRange.start,
      viewportEndTimestamp: this._state.timeRange.end,
      canvasWidth: this.canvas.width / dpr,
      interval: this._state.priceHistory.granularityMs,
      alignToLocalTime: false,
    });

    // Draw each plot using its style from plot_styles
    Object.entries(evaluation.plot_styles).forEach(([plotRef, plotStyle]) => {
      if (plotStyle.type === "line") {
        this.drawLine(ctx, plotPoints[plotRef], plotStyle.style);
      } else if (plotStyle.type === "band") {
        // For bands (like Bollinger Bands), we need both upper and lower points
        const upperPoints: { x: number; y: number }[] = [];
        const lowerPoints: { x: number; y: number }[] = [];

        // Sort points into upper and lower bands
        plotPoints[plotRef].forEach((point, index) => {
          if (index % 2 === 0) {
            upperPoints.push(point);
          } else {
            lowerPoints.push(point);
          }
        });

        this.drawBand(ctx, upperPoints, lowerPoints, plotStyle.style);
      }
    });
  }
}
