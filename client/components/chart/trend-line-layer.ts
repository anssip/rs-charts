import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { TrendLine, TrendLineEvent } from "../../types/trend-line";
import { ChartState } from "../..";
import "./trend-line";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("trend-line-layer");
logger.setLoggerLevel("trend-line-layer", LogLevel.DEBUG);

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

  @state()
  private selectedLineId: string | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
    }

    .trend-line-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    trend-line {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
  `;

  addTrendLine(line: TrendLine): void {
    // Trend lines are managed by the parent component
    this.emitEvent("add", line);
  }

  removeTrendLine(id: string): void {
    const lineToRemove = this.trendLines.find((l) => l.id === id);
    if (lineToRemove) {
      this.trendLines = this.trendLines.filter((l) => l.id !== id);
      this.emitEvent("remove", lineToRemove);
    }
  }

  updateTrendLine(id: string, updates: Partial<TrendLine>): void {
    const index = this.trendLines.findIndex((l) => l.id === id);
    if (index !== -1) {
      const previousState = this.trendLines[index];
      const updatedLine = { ...previousState, ...updates };
      this.trendLines = [
        ...this.trendLines.slice(0, index),
        updatedLine,
        ...this.trendLines.slice(index + 1),
      ];
      this.emitEvent("update", updatedLine, previousState);
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

  private emitEvent(
    type: "add" | "update" | "remove",
    trendLine: TrendLine,
    previousState?: TrendLine,
  ): void {
    const event: TrendLineEvent = {
      type,
      trendLine,
      previousState,
    };

    this.dispatchEvent(
      new CustomEvent(`trend-line-${type}`, {
        detail: event,
        bubbles: true,
        composed: true,
      }),
    );
  }

  private handleTrendLineUpdate(event: CustomEvent) {
    const updatedLine = event.detail.trendLine as TrendLine;
    const index = this.trendLines.findIndex((l) => l.id === updatedLine.id);
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

  private handleTrendLineSelect(event: CustomEvent) {
    event.stopPropagation();
    const selectedLine = event.detail.trendLine as TrendLine;
    logger.debug("Selecting line:", selectedLine.id);
    this.selectedLineId = selectedLine.id;
    this.requestUpdate();
  }

  private handleDocumentClick = (event: MouseEvent) => {
    logger.debug(
      "Document click, selected:",
      this.selectedLineId,
      "target:",
      event.target,
    );

    // Check if we have a selection
    if (!this.selectedLineId) {
      logger.debug("No selection, ignoring click");
      return;
    }

    // Check if the click is inside a trend line using composedPath for shadow DOM
    const path = event.composedPath();
    let clickedOnTrendLine = false;
    
    // Check if any element in the path is a trend line or part of one
    for (const element of path) {
      if (element instanceof HTMLElement) {
        if (element.tagName?.toLowerCase() === 'trend-line' || 
            element.closest?.('trend-line')) {
          clickedOnTrendLine = true;
          break;
        }
      }
    }

    logger.debug("Clicked on trend line?", clickedOnTrendLine);

    // If not clicked on a trend line, deselect
    if (!clickedOnTrendLine) {
      logger.debug("Deselecting due to outside click");
      this.deselectAll();
    }
  };

  private handleEscKey = (event: KeyboardEvent) => {
    logger.debug("Key pressed:", event.key);
    if (event.key === "Escape") {
      logger.debug("ESC pressed, deselecting");
      this.deselectAll();
    }
  };

  public deselectAll() {
    logger.debug("deselectAll called, current selection:", this.selectedLineId);
    this.selectedLineId = null;
    // Force update and ensure trend-line components update their selected state
    this.requestUpdate();
    // Wait for the update to complete, then ensure child components are updated
    this.updateComplete.then(() => {
      if (this.shadowRoot) {
        const trendLines = this.shadowRoot.querySelectorAll('trend-line');
        trendLines.forEach((line: any) => {
          // Explicitly set selected to false and force update
          if (line.selected === true) {
            logger.debug(`Forcing deselect on trend-line:`, line.trendLine?.id);
            line.selected = false;
            line.requestUpdate('selected');
          }
        });
      }
    });
  }

  public selectLine(lineId: string) {
    this.selectedLineId = lineId;
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    logger.debug("Connected, setting up event listeners");

    this.addEventListener(
      "trend-line-update",
      this.handleTrendLineUpdate as EventListener,
    );
    this.addEventListener(
      "trend-line-update-complete",
      this.handleTrendLineUpdateComplete as EventListener,
    );
    this.addEventListener(
      "trend-line-select",
      this.handleTrendLineSelect as EventListener,
    );

    // Listen for clicks at the document level for better event capture
    // Use a slight delay to avoid capturing the same click that created a selection
    setTimeout(() => {
      logger.debug("Adding document click listener");
      document.addEventListener("click", this.handleDocumentClick);
    }, 100);

    // Listen for ESC key
    logger.debug("Adding ESC key listener");
    document.addEventListener("keydown", this.handleEscKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "trend-line-update",
      this.handleTrendLineUpdate as EventListener,
    );
    this.removeEventListener(
      "trend-line-update-complete",
      this.handleTrendLineUpdateComplete as EventListener,
    );
    this.removeEventListener(
      "trend-line-select",
      this.handleTrendLineSelect as EventListener,
    );

    // Remove document click listener
    document.removeEventListener("click", this.handleDocumentClick);

    document.removeEventListener("keydown", this.handleEscKey);
  }

  render() {
    const visibleLines = this.getVisibleTrendLines();

    // Use clientWidth/clientHeight if width/height are not set
    const actualWidth = this.width || this.clientWidth || 0;
    const actualHeight = this.height || this.clientHeight || 0;

    return html`
      <div class="trend-line-container">
        ${visibleLines.map(
          (line) => html`
            <trend-line
              .trendLine="${line}"
              .timeRange="${this.state?.timeRange}"
              .priceRange="${this.state?.priceRange}"
              .width="${actualWidth}"
              .height="${actualHeight}"
              .selected="${line.id === this.selectedLineId}"
            ></trend-line>
          `,
        )}
      </div>
    `;
  }
}
