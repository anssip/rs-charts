import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TrendLine, TrendLineEvent } from "../../types/trend-line";
import { ChartState } from "../..";
import "./trend-line";

@customElement("trend-line-layer")
export class TrendLineLayer extends LitElement {
  @property({ type: Array, attribute: false })
  trendLines: TrendLine[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: calc(100% - var(--price-axis-width, 70px));
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }

    .trend-line-container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    trend-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  `;

  addTrendLine(line: TrendLine): void {
    // Trend lines are managed by the parent component
    this.emitEvent('add', line);
  }

  removeTrendLine(id: string): void {
    const lineToRemove = this.trendLines.find(l => l.id === id);
    if (lineToRemove) {
      this.trendLines = this.trendLines.filter(l => l.id !== id);
      this.emitEvent('remove', lineToRemove);
    }
  }

  updateTrendLine(id: string, updates: Partial<TrendLine>): void {
    const index = this.trendLines.findIndex(l => l.id === id);
    if (index !== -1) {
      const previousState = this.trendLines[index];
      const updatedLine = { ...previousState, ...updates };
      this.trendLines = [
        ...this.trendLines.slice(0, index),
        updatedLine,
        ...this.trendLines.slice(index + 1)
      ];
      this.emitEvent('update', updatedLine, previousState);
    }
  }

  getVisibleTrendLines(): TrendLine[] {
    if (!this.state?.timeRange) return this.trendLines;

    // For now, return all trend lines
    // In the future, we can optimize to only return lines visible in viewport
    return this.trendLines;
  }

  clearTrendLines(): void {
    this.trendLines = [];
  }

  private emitEvent(type: 'add' | 'update' | 'remove', trendLine: TrendLine, previousState?: TrendLine): void {
    const event: TrendLineEvent = {
      type,
      trendLine,
      previousState
    };

    this.dispatchEvent(new CustomEvent(`trend-line-${type}`, {
      detail: event,
      bubbles: true,
      composed: true
    }));
  }

  private handleTrendLineUpdate(event: CustomEvent) {
    const updatedLine = event.detail.trendLine as TrendLine;
    const index = this.trendLines.findIndex(l => l.id === updatedLine.id);
    if (index !== -1) {
      // Update the trend line without triggering a full re-render
      this.trendLines[index] = updatedLine;
      this.requestUpdate();
    }
  }

  private handleTrendLineUpdateComplete(event: CustomEvent) {
    const updatedLine = event.detail.trendLine as TrendLine;
    this.updateTrendLine(updatedLine.id, updatedLine);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('trend-line-update', this.handleTrendLineUpdate as EventListener);
    this.addEventListener('trend-line-update-complete', this.handleTrendLineUpdateComplete as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('trend-line-update', this.handleTrendLineUpdate as EventListener);
    this.removeEventListener('trend-line-update-complete', this.handleTrendLineUpdateComplete as EventListener);
  }

  render() {
    const visibleLines = this.getVisibleTrendLines();

    return html`
      <div class="trend-line-container">
        ${visibleLines.map(line => html`
          <trend-line
            .trendLine="${line}"
            .timeRange="${this.state?.timeRange}"
            .priceRange="${this.state?.priceRange}"
            .width="${this.width}"
            .height="${this.height}"
          ></trend-line>
        `)}
      </div>
    `;
  }
}