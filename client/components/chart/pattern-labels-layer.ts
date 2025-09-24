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

  private escapeKeyHandler?: (e: KeyboardEvent) => void;

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
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      padding: 12px 16px;
      padding-top: 32px;
      font-size: 12px;
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      max-width: 300px;
      z-index: 1000;
      pointer-events: auto;
    }

    .close-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      width: 24px;
      height: 24px;
      border: none;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      padding: 0;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.9);
    }

    .close-btn:active {
      transform: scale(0.95);
    }

    .tooltip-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .tooltip-description {
      margin-bottom: 12px;
      line-height: 1.4;
    }

    .tooltip-significance {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.9;
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
              ${this.renderTooltipContent()}
            </div>
          `
        : ""}
    `;
  }

  private renderTooltipContent() {
    const parts = this.tooltipContent.split("\n\n");
    const name = parts[0] || "";
    const description = parts[1] || "";
    const significance = parts[2] || "";

    return html`
      <button
        class="close-btn"
        @click="${() => this.hideTooltip()}"
        aria-label="Close"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M1 1L13 13M13 1L1 13"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
      <div class="tooltip-title">${name}</div>
      <div class="tooltip-description">${description}</div>
      <div class="tooltip-significance">${significance}</div>
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

    // Position tooltip above the pattern label
    const firstTimestamp = pattern.candleTimestamps[0];
    const x = this.timeToX(firstTimestamp);
    const candle = this.state?.priceHistory.getCandle(firstTimestamp);
    if (candle) {
      const labelY = this.priceToY(candle.high) - 20; // Label position

      // Estimate tooltip height based on content (padding: 12px*2, line height ~20px, 5 lines of text minimum)
      const estimatedTooltipHeight = 150; // Reasonable estimate for tooltip with title, description and significance
      const tooltipY = labelY - estimatedTooltipHeight - 10; // Position tooltip above label with gap

      // Center tooltip horizontally relative to label, constrain to viewport
      const tooltipX = Math.max(10, Math.min(x - 150, this.width - 320));
      this.tooltipPosition = { x: tooltipX, y: Math.max(10, tooltipY) };
    }

    this.showTooltip = true;
    this.addTooltipEventListeners();
  }

  private addTooltipEventListeners() {
    // Remove existing listeners if any
    this.removeTooltipEventListeners();

    // Add escape key listener
    this.escapeKeyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.hideTooltip();
      }
    };

    document.addEventListener("keydown", this.escapeKeyHandler);
  }

  private removeTooltipEventListeners() {
    if (this.escapeKeyHandler) {
      document.removeEventListener("keydown", this.escapeKeyHandler);
      this.escapeKeyHandler = undefined;
    }
  }

  private hideTooltip() {
    this.showTooltip = false;
    this.removeTooltipEventListeners();
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
    this.removeTooltipEventListeners();
    this.requestUpdate();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeTooltipEventListeners();
  }
}
