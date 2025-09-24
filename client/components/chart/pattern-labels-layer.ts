import { LitElement, html, css, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  PatternHighlight,
  PatternClickEvent,
  getPatternDefaultColor,
} from "../../types/markers";
import {
  TimeRange,
  PriceRange,
} from "../../../server/services/price-data/price-history-model";
import { ChartState } from "../..";
import { getDpr } from "../../util/chart-util";

@customElement("pattern-labels-layer")
export class PatternLabelsLayer extends LitElement {
  @property({ type: Object })
  state?: ChartState;

  @property({ type: Object })
  timeRange?: TimeRange;

  @property({ type: Object })
  priceRange?: PriceRange;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  @property({ type: Array })
  patterns: PatternHighlight[] = [];

  @state()
  private hoveredPatternId: string | null = null;

  @state()
  private selectedPatternId: string | null = null;

  @state()
  private showTooltip = false;

  @state()
  private tooltipPosition = { x: 0, y: 0 };

  @state()
  private tooltipContent = "";

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .tooltip {
      position: absolute;
      background: var(--color-background-3);
      border: 1px solid var(--color-border);
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 12px;
      color: #ffffff;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      max-width: 300px;
      z-index: 1000;
      pointer-events: none;
      white-space: pre-wrap;
    }

    .pattern-label {
      position: absolute;
      background: var(--color-background-2);
      border: 1px solid var(--color-border);
      border-radius: 3px;
      padding: 2px 6px;
      font-size: 11px;
      font-weight: 500;
      color: #ffffff;
      cursor: pointer;
      user-select: none;
      pointer-events: auto;
      white-space: nowrap;
      z-index: 10;
    }

    .pattern-label:hover {
      background: var(--color-background-3);
      z-index: 100;
    }
  `;

  render() {
    return html`
      ${this.renderPatternLabels()}
      ${this.showTooltip
        ? html`
            <div
              class="tooltip"
              style="left: ${this.tooltipPosition.x}px; top: ${this
                .tooltipPosition.y}px;"
            >
              ${this.tooltipContent}
            </div>
          `
        : ""}
    `;
  }

  private renderPatternLabels() {
    if (!this.state || !this.timeRange || !this.priceRange) return "";

    const labels: any[] = [];

    for (const pattern of this.patterns) {
      if (pattern.candleTimestamps.length === 0) continue;

      // Get the first candle's position for label placement
      const firstTimestamp = pattern.candleTimestamps[0];
      const x = this.timeToX(firstTimestamp);

      // Check if pattern is in viewport
      if (x < -50 || x > this.width + 50) continue;

      // Position label above the candle
      const candle = this.state.priceHistory.getCandle(firstTimestamp);
      if (!candle) continue;

      const y = this.priceToY(candle.high) - 20; // Place above high

      labels.push(html`
        <div
          class="pattern-label"
          style="left: ${x -
          30}px; top: ${y}px; border-color: ${pattern.color ||
          getPatternDefaultColor(pattern.patternType)};"
          @click="${() => this.handleLabelClick(pattern)}"
          @pointerenter="${() => this.handleLabelHover(pattern)}"
          @pointerleave="${() => this.handleLabelLeave()}"
        >
          ${pattern.name}
        </div>
      `);
    }

    return labels;
  }

  private timeToX(timestamp: number): number {
    if (!this.timeRange || !this.state) return 0;

    // Calculate position using the same logic as drawing-strategy
    const data = this.state.priceHistory;
    const viewportStartTimestamp = this.timeRange.start;
    const viewportEndTimestamp = this.timeRange.end;

    // Calculate candle dimensions
    const timeSpan = viewportEndTimestamp - viewportStartTimestamp;
    const candleCount = Math.ceil(timeSpan / data.granularityMs);
    const gapWidth = 6; // FIXED_GAP_WIDTH from drawing-strategy
    const numberOfGaps = Math.max(0, candleCount - 1);
    const totalGapWidth = numberOfGaps * gapWidth;
    const spaceForCandles = Math.max(0, this.width - totalGapWidth);
    let candleWidth = spaceForCandles / Math.max(1, candleCount);
    candleWidth = Math.max(5, Math.min(500, candleWidth)); // MIN/MAX constraints

    // Calculate x position
    const normalizedTimestamp =
      Math.floor(timestamp / data.granularityMs) * data.granularityMs;
    const timeSinceStart = normalizedTimestamp - viewportStartTimestamp;
    const candleIndex = Math.floor(timeSinceStart / data.granularityMs);
    const x = candleIndex * (candleWidth + gapWidth) + candleWidth / 2;

    return x;
  }

  private priceToY(price: number): number {
    if (!this.priceRange) return 0;
    const height = this.height;
    const ratio =
      (price - this.priceRange.min) /
      (this.priceRange.max - this.priceRange.min);
    return height - ratio * height;
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    // Request update when relevant properties change
    if (
      changedProperties.has("patterns") ||
      changedProperties.has("state") ||
      changedProperties.has("timeRange") ||
      changedProperties.has("priceRange") ||
      changedProperties.has("width") ||
      changedProperties.has("height")
    ) {
      this.requestUpdate();
    }
  }

  private handleLabelClick(pattern: PatternHighlight) {
    this.selectedPatternId = pattern.id;
    this.showPatternDescription(pattern);

    // Emit pattern click event
    this.dispatchEvent(
      new CustomEvent<PatternClickEvent>("pattern-click", {
        detail: {
          pattern,
          x: 0,
          y: 0,
        },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleLabelHover(pattern: PatternHighlight) {
    this.hoveredPatternId = pattern.id;
  }

  private handleLabelLeave() {
    this.hoveredPatternId = null;
  }

  private showPatternDescription(pattern: PatternHighlight) {
    this.tooltipContent = `${pattern.name}\n\n${pattern.description}\n\nSignificance: ${pattern.significance}`;

    // Position tooltip near the pattern
    const firstTimestamp = pattern.candleTimestamps[0];
    const x = this.timeToX(firstTimestamp);
    const candle = this.state?.priceHistory.getCandle(firstTimestamp);
    if (candle) {
      const y = this.priceToY(candle.high);
      this.tooltipPosition = { x: Math.min(x, this.width - 320), y: y - 60 };
    }

    this.showTooltip = true;

    // Hide tooltip after 3 seconds
    setTimeout(() => {
      this.showTooltip = false;
    }, 3000);
  }

  setPatterns(patterns: PatternHighlight[]) {
    this.patterns = patterns;
    this.requestUpdate();
  }

  clearPatterns() {
    this.patterns = [];
    this.selectedPatternId = null;
    this.hoveredPatternId = null;
    this.showTooltip = false;
    this.requestUpdate();
  }
}
