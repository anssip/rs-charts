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
      overflow: hidden; /* Clip content that extends beyond boundaries */
    }

    .trend-line-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden; /* Ensure trend lines are clipped to container */
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
    logger.debug(`TrendLineLayer: removeTrendLine called for ID: ${id}`);
    logger.debug(`TrendLineLayer: Current trend lines array:`, this.trendLines.map(l => String(l.id)));
    logger.debug(`TrendLineLayer: Array length: ${this.trendLines.length}`);
    
    // Convert Proxy IDs to strings for comparison
    const lineToRemove = this.trendLines.find((l) => String(l.id) === id);
    if (lineToRemove) {
      logger.debug(`TrendLineLayer: Found line to remove: ${String(lineToRemove.id)}`);
      // Don't mutate the local array - just emit the event and let the parent handle it
      this.emitEvent("remove", lineToRemove);
      logger.debug(`TrendLineLayer: Emitted remove event for line ${String(lineToRemove.id)}`);
    } else {
      logger.warn(`TrendLineLayer: Could not find trend line with ID: ${id} in local array`);
      logger.warn(`TrendLineLayer: Available IDs:`, this.trendLines.map(l => String(l.id)));
      
      // Even if we can't find it locally, emit the remove event with a minimal object
      // The parent chart-container should have the actual trend line
      logger.info(`TrendLineLayer: Emitting remove event anyway for ID: ${id}`);
      this.emitEvent("remove", { id } as TrendLine);
    }
  }

  updateTrendLine(id: string, updates: Partial<TrendLine>): void {
    logger.debug(`TrendLineLayer: updateTrendLine called for ID: ${id}`);
    logger.debug(`TrendLineLayer: Updates:`, updates);
    logger.debug(`TrendLineLayer: Current trend lines full objects:`, this.trendLines);
    logger.debug(`TrendLineLayer: Current trend lines IDs:`, this.trendLines.map(l => ({
      id: l.id,
      idType: typeof l.id,
      stringId: String(l.id),
      hasIdProp: 'id' in l
    })));
    
    // Try different comparison methods
    logger.debug(`TrendLineLayer: Looking for ID "${id}" (type: ${typeof id})`);
    this.trendLines.forEach((line, idx) => {
      logger.debug(`  Line ${idx}: id="${line.id}" (type: ${typeof line.id}), String(id)="${String(line.id)}", equals: ${String(line.id) === id}`);
    });
    
    // Convert Proxy IDs to strings for comparison
    const index = this.trendLines.findIndex((l) => String(l.id) === id);
    logger.debug(`TrendLineLayer: Found at index: ${index}`);
    
    if (index !== -1) {
      const previousState = this.trendLines[index];
      const updatedLine = { ...previousState, ...updates };
      logger.debug(`TrendLineLayer: Emitting update event with updated line:`, updatedLine);
      // Don't mutate the local array - just emit the event and let the parent handle it
      this.emitEvent("update", updatedLine, previousState);
    } else {
      logger.warn(`TrendLineLayer: Could not find trend line with ID: ${id} to update`);
      logger.warn(`TrendLineLayer: Available IDs:`, this.trendLines.map(l => String(l.id)));
    }
  }

  getVisibleTrendLines(): TrendLine[] {
    if (!this.state?.timeRange) return this.trendLines;

    // For now, return all trend lines
    // In the future, we can optimize to only return lines visible in viewport
    return this.trendLines;
  }

  clearTrendLines(): void {
    // Don't mutate the local array - this should be handled by the parent
    // Emit events for each trend line being cleared
    this.trendLines.forEach(line => {
      this.emitEvent("remove", line);
    });
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

    logger.debug(`TrendLineLayer: Dispatching event trend-line-${type}`, event);
    
    this.dispatchEvent(
      new CustomEvent(`trend-line-${type}`, {
        detail: event,
        bubbles: true,
        composed: true,
      }),
    );
    
    logger.debug(`TrendLineLayer: Event dispatched`);
  }

  private handleTrendLineUpdate(event: CustomEvent) {
    const updatedLine = event.detail.trendLine as TrendLine;
    const index = this.trendLines.findIndex((l) => l.id === updatedLine.id);
    if (index !== -1) {
      // Create a new array to trigger Lit's change detection
      // Direct mutation doesn't trigger re-render
      this.trendLines = [
        ...this.trendLines.slice(0, index),
        updatedLine,
        ...this.trendLines.slice(index + 1)
      ];
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
    // Ensure we store the ID as a string, not a Proxy
    const lineId = String(selectedLine.id);
    logger.debug("Selecting line:", lineId);
    this.selectedLineId = lineId;
    this.requestUpdate();
    
    // Emit selection event for external listeners
    // Convert ID to string to avoid passing Proxy object
    this.dispatchEvent(
      new CustomEvent("trend-line-selected", {
        detail: { 
          trendLineId: String(selectedLine.id),
          trendLine: selectedLine 
        },
        bubbles: true,
        composed: true,
      }),
    );
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
    let clickedOnChart = false;
    
    // Check if any element in the path is a trend line or part of the chart
    for (const element of path) {
      if (element instanceof HTMLElement) {
        const tagName = element.tagName?.toLowerCase();
        
        // Check if clicked on trend line
        if (tagName === 'trend-line' || element.closest?.('trend-line')) {
          clickedOnTrendLine = true;
        }
        
        // Check if clicked within chart-container or chart-related elements
        if (tagName === 'chart-container' || 
            tagName === 'chart' ||
            tagName === 'chart-canvas' ||
            tagName === 'market-indicator' ||
            tagName === 'indicator-container' ||
            tagName === 'trend-line-layer' ||
            tagName === 'live-decorators' ||
            element.closest?.('chart-container')) {
          clickedOnChart = true;
        }
      }
    }

    logger.debug("Clicked on trend line?", clickedOnTrendLine, "Clicked on chart?", clickedOnChart);

    // Only deselect if clicked on chart area but not on a trend line
    // Clicks outside the chart (like on settings panels) won't deselect
    if (!clickedOnTrendLine && clickedOnChart) {
      logger.debug("Deselecting due to click on chart area");
      this.deselectAll();
    }
  };

  private handleEscKey = (event: KeyboardEvent) => {
    logger.debug("Key pressed:", event.key);
    if (event.key === "Escape") {
      logger.debug("ESC pressed, deselecting");
      this.deselectAll();
    } else if ((event.key === "Backspace" || event.key === "Delete") && this.selectedLineId) {
      logger.debug("Backspace/Delete pressed with selection:", this.selectedLineId);
      
      // Prevent default browser behavior (e.g., navigating back)
      event.preventDefault();
      
      // Store the ID before removal (ensure it's a string)
      const deletedLineId = String(this.selectedLineId);
      
      // Remove the trend line
      this.removeTrendLine(deletedLineId);
      
      // Emit deletion event
      // ID is already a string here (deletedLineId = String(this.selectedLineId))
      this.dispatchEvent(
        new CustomEvent("trend-line-deleted", {
          detail: { 
            trendLineId: deletedLineId 
          },
          bubbles: true,
          composed: true,
        }),
      );
      
      // Clear selection
      this.selectedLineId = null;
      this.requestUpdate();
    }
  };

  public deselectAll() {
    logger.debug("deselectAll called, current selection:", this.selectedLineId);
    const previousSelection = this.selectedLineId ? String(this.selectedLineId) : null;
    this.selectedLineId = null;
    
    // Emit deselection event if there was a selection
    if (previousSelection) {
      this.dispatchEvent(
        new CustomEvent("trend-line-deselected", {
          detail: { 
            trendLineId: previousSelection 
          },
          bubbles: true,
          composed: true,
        }),
      );
    }
    
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
    // Ensure we store as string
    this.selectedLineId = String(lineId);
    this.requestUpdate();
  }

  connectedCallback() {
    super.connectedCallback();
    logger.debug("Connected, setting up event listeners");
    logger.debug("Initial trendLines:", this.trendLines?.length || 0, this.trendLines?.map(l => l.id));

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

  updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    
    if (changedProperties.has('trendLines')) {
      logger.debug('Trend lines updated:', {
        count: this.trendLines.length,
        trendLines: this.trendLines,
        previousValue: changedProperties.get('trendLines')
      });
    }
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
              .selected="${String(line.id) === this.selectedLineId}"
            ></trend-line>
          `,
        )}
      </div>
    `;
  }
}
