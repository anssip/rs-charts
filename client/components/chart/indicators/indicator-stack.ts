import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../indicators/indicator-container";
import { IndicatorConfig } from "./indicator-types";

@customElement("indicator-stack")
export class IndicatorStack extends LitElement {
  @property({ type: Array })
  indicators: IndicatorConfig[] = [];

  @property({ type: Number })
  valueAxisWidth = 70;

  @property({ type: Number })
  valueAxisMobileWidth = 45;

  @property({ type: Boolean })
  allowResize = true;

  @property({ type: Object })
  state: any; // Use proper type from your ChartState

  @property({ type: Object })
  options: any; // Use proper type from your ChartOptions

  // Track resize state
  @state() private isResizing = false;
  @state() private resizingIndex = -1;
  @state() private startY = 0;
  @state() private itemHeights: number[] = [];
  @state() private manuallyResized = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column-reverse;
      width: 100%;
      min-height: 150px;
      background: var(--chart-background-color, #131722);
      position: relative;
      height: 100%;
      pointer-events: auto;
    }

    :host(.main-chart) {
      flex: 1;
      height: 100%;
      pointer-events: auto;
    }

    /* When we have chart and indicators stacked together */
    .stack-item {
      position: relative;
      border-bottom: 1px solid var(--chart-grid-line-color, #363c4e);
      pointer-events: auto;
    }

    /* Special handling for chart item - it should flex grow */
    .stack-item.chart-item {
      flex: 1;
      min-height: 200px;
      border-bottom: none;
      pointer-events: auto;
    }

    /* Fixed height for regular indicators */
    .stack-item:not(.chart-item) {
      flex: 0 0 auto;
      min-height: 30px;
      height: 150px;
      pointer-events: auto;
    }

    .indicator-name {
      position: absolute;
      top: 8px;
      left: 8px;
      font-size: 11px;
      color: var(--color-accent-2);
      font-family: var(--font-secondary);
      font-weight: 500;
      opacity: 0.7;
      z-index: 2;
      pointer-events: none;
    }

    indicator-container {
      width: 100%;
      height: 100%;
      display: flex;
      pointer-events: auto;
    }

    .resize-handle {
      position: absolute;
      height: 8px;
      left: 0;
      right: 0;
      bottom: -4px; /* Center on the border */
      cursor: ns-resize;
      z-index: 10;
      touch-action: none;
    }

    .resize-handle::after {
      content: "";
      position: absolute;
      left: 50%;
      top: 3px;
      transform: translateX(-50%);
      width: 40px;
      height: 2px;
      background-color: rgba(150, 150, 150, 0.6);
      border-radius: 2px;
    }

    .resize-handle:hover::after {
      background-color: rgba(150, 150, 150, 0.8);
    }

    .resize-handle:active::after,
    .resize-handle.resizing::after {
      background-color: rgba(30, 144, 255, 0.8);
    }

    .resize-handle:hover,
    .resize-handle:active,
    .resize-handle.resizing {
      background-color: rgba(100, 180, 255, 0.3);
    }

    @media (max-width: 767px) {
      .resize-handle {
        height: 14px; /* Bigger touch target for mobile */
        bottom: -7px; /* Adjust center point for bigger handle */
      }

      .resize-handle::after {
        width: 50px;
        height: 3px;
      }
    }
  `;

  // Handler for resize start
  private handleResizeStart(index: number, e: MouseEvent | TouchEvent) {
    if (!this.allowResize) return;

    e.preventDefault();

    // Store current item heights
    const stackItems = this.renderRoot.querySelectorAll(".stack-item");
    this.itemHeights = Array.from(stackItems).map((item) => item.clientHeight);

    this.isResizing = true;
    this.resizingIndex = index;

    // Get starting Y position
    if ("touches" in e) {
      this.startY = e.touches[0].clientY;
    } else {
      this.startY = e.clientY;
    }

    // Add window event listeners
    window.addEventListener("mousemove", this.handleResize);
    window.addEventListener("touchmove", this.handleResize, { passive: false });
    window.addEventListener("mouseup", this.handleResizeEnd);
    window.addEventListener("touchend", this.handleResizeEnd);

    // Mark the handle as resizing
    const handle = this.renderRoot.querySelector(
      `.resize-handle[data-index="${index}"]`
    );
    if (handle) {
      handle.classList.add("resizing");
    }
  }

  // Bound methods to ensure proper 'this' context
  private handleResize = (e: MouseEvent | TouchEvent) => {
    if (!this.isResizing || this.resizingIndex < 0) return;

    e.preventDefault();

    // Get current Y position
    let currentY: number;
    if ("touches" in e) {
      currentY = e.touches[0].clientY;
    } else {
      currentY = e.clientY;
    }

    const deltaY = currentY - this.startY;

    // Apply the resize with the delta
    this.applyResize(deltaY);

    // Update startY for next move to prevent cumulative effect
    this.startY = currentY;
  };

  private handleResizeEnd = () => {
    if (!this.isResizing) return;

    this.isResizing = false;

    // Remove the resizing class
    const handle = this.renderRoot.querySelector(
      `.resize-handle[data-index="${this.resizingIndex}"]`
    );
    if (handle) {
      handle.classList.remove("resizing");
    }

    // Clean up event listeners
    window.removeEventListener("mousemove", this.handleResize);
    window.removeEventListener("touchmove", this.handleResize);
    window.removeEventListener("mouseup", this.handleResizeEnd);
    window.removeEventListener("touchend", this.handleResizeEnd);

    // Mark that we've manually resized
    this.manuallyResized = true;

    // Store heights for future reference
    const stackItems = this.renderRoot.querySelectorAll(".stack-item");
    this.itemHeights = Array.from(stackItems).map((item) => {
      return (item as HTMLElement).offsetHeight;
    });

    // Reset resizing index
    this.resizingIndex = -1;
  };

  // Redraw all indicators to ensure proper rendering
  private redrawAllIndicators() {
    // Get all stack items
    const stackItems = this.renderRoot.querySelectorAll(".stack-item");

    // Trigger canvas resize for each item
    stackItems.forEach((item) => {
      this.triggerCanvasResize(item);
    });
  }

  private applyResize(deltaY: number) {
    if (this.resizingIndex < 0 || this.itemHeights.length < 2) return;

    // Get the items being resized (current and next)
    const stackItems = Array.from(
      this.renderRoot.querySelectorAll(".stack-item")
    );
    if (stackItems.length < 2) return;

    // In column-reverse layout, the DOM order is opposite to visual order
    const itemAbove = stackItems[this.resizingIndex] as HTMLElement;
    const itemBelow = stackItems[this.resizingIndex + 1] as HTMLElement;

    if (!itemAbove || !itemBelow) return;

    // Get the original heights
    const heightAbove = this.itemHeights[this.resizingIndex];
    const heightBelow = this.itemHeights[this.resizingIndex + 1];

    // Check if either item is a chart (should flex)
    const isChartAbove = itemAbove.classList.contains("chart-item");
    const isChartBelow = itemBelow.classList.contains("chart-item");

    // Calculate new heights with constraints
    const minHeight = 30; // Minimum height for indicators

    // Apply new heights based on what we're resizing
    if (isChartBelow) {
      // If chart is below, only adjust the item above
      const newHeightAbove = Math.max(minHeight, heightAbove + deltaY);
      itemAbove.style.height = `${newHeightAbove}px`;
      itemAbove.style.flexBasis = `${newHeightAbove}px`;

      // Update the height in our tracking array
      this.itemHeights[this.resizingIndex] = newHeightAbove;
    } else if (isChartAbove) {
      // If chart is above, only adjust the item below
      const newHeightBelow = Math.max(minHeight, heightBelow - deltaY);
      itemBelow.style.height = `${newHeightBelow}px`;
      itemBelow.style.flexBasis = `${newHeightBelow}px`;

      // Update the height in our tracking array
      this.itemHeights[this.resizingIndex + 1] = newHeightBelow;
    } else {
      // Regular case: two non-chart indicators
      const newHeightAbove = Math.max(minHeight, heightAbove + deltaY);
      const newHeightBelow = Math.max(minHeight, heightBelow - deltaY);

      itemAbove.style.height = `${newHeightAbove}px`;
      itemAbove.style.flexBasis = `${newHeightAbove}px`;

      itemBelow.style.height = `${newHeightBelow}px`;
      itemBelow.style.flexBasis = `${newHeightBelow}px`;

      // Update heights in our tracking array
      this.itemHeights[this.resizingIndex] = newHeightAbove;
      this.itemHeights[this.resizingIndex + 1] = newHeightBelow;
    }

    // Trigger resize on canvas elements
    this.triggerCanvasResize(itemAbove);
    this.triggerCanvasResize(itemBelow);
  }

  private triggerCanvasResize(item: Element) {
    const container = item.querySelector("indicator-container");
    if (!container) return;

    const slot = container.shadowRoot?.querySelector("slot");
    if (!slot) return;

    const elements = (slot as HTMLSlotElement).assignedElements();
    for (const element of elements) {
      // Handle both market indicators and candlestick chart
      if (
        element.tagName.toLowerCase() === "market-indicator" ||
        element.tagName.toLowerCase() === "candlestick-chart"
      ) {
        const indicator = element as HTMLElement;
        indicator.style.height = "100%";
        indicator.style.width = "100%";

        indicator.dispatchEvent(
          new CustomEvent("force-redraw", {
            bubbles: false,
            composed: true,
            detail: {
              width: container.clientWidth,
              height: container.clientHeight,
            },
          })
        );
      }
    }
  }

  // Initialize heights when component is first updated
  firstUpdated() {
    // Set initial heights equally distributed
    this.initializeHeights();
  }

  // Handle property changes
  updated(changedProps: Map<string, any>) {
    if (changedProps.has("indicators")) {
      // When indicators change, reset our manual resize flag
      this.manuallyResized = false;

      // Let CSS handle most of the layout but make sure canvases get resized
      setTimeout(() => {
        const stackItems = this.renderRoot.querySelectorAll(".stack-item");
        stackItems.forEach((item) => this.triggerCanvasResize(item));
      }, 100);
    }
  }

  // Initialize heights equally distributed
  private initializeHeights() {
    const stackItems = this.renderRoot.querySelectorAll(".stack-item");
    if (!stackItems.length) return;

    stackItems.forEach((item) => {
      // Store chart heights for resize operations
      if (!this.manuallyResized) {
        this.itemHeights = Array.from(stackItems).map((item) => {
          const computed = getComputedStyle(item);
          return parseFloat(computed.height);
        });
      }

      this.triggerCanvasResize(item);
    });
  }

  render() {
    return html`
      ${this.indicators.map(
        (indicator, index) => html`
          <div
            class="stack-item ${indicator.id === "chart" ? "chart-item" : ""}"
          >
            ${indicator.name
              ? html`<div class="indicator-name">${indicator.name}</div>`
              : ""}
            <indicator-container>
              ${new indicator.class({
                indicatorId: indicator.id,
                scale: indicator.scale,
                valueAxisWidth: this.valueAxisWidth,
                valueAxisMobileWidth: this.valueAxisMobileWidth,
                state: this.state,
                options: this.options,
              })}
            </indicator-container>

            ${
              /* Add resize handle except for the first item (visually bottom) */ ""
            }
            ${index < this.indicators.length - 1 && this.allowResize
              ? html`<div
                  class="resize-handle"
                  data-index="${index}"
                  @mousedown="${(e: MouseEvent) =>
                    this.handleResizeStart(index, e)}"
                  @touchstart="${(e: TouchEvent) =>
                    this.handleResizeStart(index, e)}"
                ></div>`
              : ""}
          </div>
        `
      )}
    `;
  }
}
