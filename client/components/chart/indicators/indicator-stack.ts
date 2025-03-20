import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../indicators/indicator-container";

@customElement("indicator-stack")
export class IndicatorStack extends LitElement {
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

    ::slotted(*) {
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
      top: -4px; /* Position at the top instead of bottom */
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
        top: -7px; /* Adjust center point for bigger handle */
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

    console.log(
      `IndicatorStack: Starting resize for handle with index ${index}`
    );

    // Store current item heights
    const stackItems = this.renderRoot.querySelectorAll(
      ".stack-item:not([style*='display: none'])"
    );
    console.log(
      `IndicatorStack: Found ${stackItems.length} visible stack items`
    );
    this.itemHeights = Array.from(stackItems).map((item) => item.clientHeight);

    // Log the heights for debugging
    this.itemHeights.forEach((height, i) => {
      console.log(`IndicatorStack: Item ${i} height: ${height}px`);
    });

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

    // Get only the visible stack items
    const stackItems = Array.from(
      this.renderRoot.querySelectorAll(
        ".stack-item:not([style*='display: none'])"
      )
    ) as HTMLElement[];

    if (stackItems.length < 2) return;

    console.log(`IndicatorStack: Applying resize, deltaY: ${deltaY}`);

    // Find the actual items to resize based on the handle's index
    // Each handle is at the top of an item, so it resizes that item and the one above it
    const currentIndex = this.resizingIndex + 1; // +1 because the first handle is actually for the second item
    const aboveIndex = this.resizingIndex; // The item above the handle (in DOM order)

    console.log(
      `IndicatorStack: Resizing items ${aboveIndex} and ${currentIndex}`
    );

    // Get the elements being resized
    const currentItem = stackItems[currentIndex];
    const aboveItem = stackItems[aboveIndex];

    if (!currentItem || !aboveItem) {
      console.warn(
        `IndicatorStack: Can't find items to resize: current=${!!currentItem}, above=${!!aboveItem}`
      );
      return;
    }

    console.log(
      `IndicatorStack: Resizing ${aboveItem.className} and ${currentItem.className}`
    );

    // Get the current heights
    const currentHeight = this.itemHeights[currentIndex];
    const aboveHeight = this.itemHeights[aboveIndex];

    // Check if either item is the chart
    const isCurrentChart = currentItem.classList.contains("chart-item");
    const isAboveChart = aboveItem.classList.contains("chart-item");

    console.log(
      `IndicatorStack: Current is chart: ${isCurrentChart}, Above is chart: ${isAboveChart}`
    );

    // Minimum height for items
    const minHeight = 30;

    if (isAboveChart) {
      // Don't resize the chart, only adjust the current item
      const newCurrentHeight = Math.max(minHeight, currentHeight - deltaY);
      console.log(
        `IndicatorStack: Setting current height to ${newCurrentHeight}px`
      );

      currentItem.style.height = `${newCurrentHeight}px`;
      currentItem.style.flexBasis = `${newCurrentHeight}px`;
      this.itemHeights[currentIndex] = newCurrentHeight;
    } else if (isCurrentChart) {
      // Don't resize the chart, only adjust the item above
      const newAboveHeight = Math.max(minHeight, aboveHeight + deltaY);
      console.log(
        `IndicatorStack: Setting above height to ${newAboveHeight}px`
      );

      aboveItem.style.height = `${newAboveHeight}px`;
      aboveItem.style.flexBasis = `${newAboveHeight}px`;
      this.itemHeights[aboveIndex] = newAboveHeight;
    } else {
      // Adjust both items
      const newCurrentHeight = Math.max(minHeight, currentHeight - deltaY);
      const newAboveHeight = Math.max(minHeight, aboveHeight + deltaY);

      console.log(
        `IndicatorStack: Setting current height to ${newCurrentHeight}px, above height to ${newAboveHeight}px`
      );

      currentItem.style.height = `${newCurrentHeight}px`;
      currentItem.style.flexBasis = `${newCurrentHeight}px`;
      aboveItem.style.height = `${newAboveHeight}px`;
      aboveItem.style.flexBasis = `${newAboveHeight}px`;

      this.itemHeights[currentIndex] = newCurrentHeight;
      this.itemHeights[aboveIndex] = newAboveHeight;
    }

    // Trigger resize on both elements
    this.triggerCanvasResize(currentItem);
    this.triggerCanvasResize(aboveItem);
  }

  private triggerCanvasResize(item: Element) {
    // Find all elements within the stack item
    const slot = item.querySelector("slot");
    if (!slot) {
      console.warn(
        "IndicatorStack: No slot found in item to resize:",
        item.className
      );
      return;
    }

    console.log(
      "IndicatorStack: Triggering canvas resize for slot:",
      (slot as HTMLSlotElement).name || "default",
      "width:",
      item.clientWidth,
      "height:",
      item.clientHeight
    );

    // Get assigned elements from slot
    const elements = (slot as HTMLSlotElement).assignedElements();
    console.log(
      `IndicatorStack: Slot has ${elements.length} assigned elements:`,
      elements.map((el) => el.tagName)
    );

    // Send resize event to each assigned element
    for (const element of elements) {
      if (element instanceof HTMLElement) {
        console.log(
          "IndicatorStack: Sending force-redraw to element:",
          element.tagName
        );
        element.dispatchEvent(
          new CustomEvent("force-redraw", {
            bubbles: true,
            composed: true,
            detail: {
              width: item.clientWidth,
              height: item.clientHeight,
            },
          })
        );
      }
    }
  }

  // Initialize heights when component is first updated
  firstUpdated() {
    console.log("IndicatorStack: firstUpdated called");

    // Create all slots initially to ensure they're available for assignments
    this.requestUpdate();

    // Add handler for force-redraw events
    // this.addEventListener("force-redraw", () => {
    //   console.log("IndicatorStack: Received force-redraw event");
    //   this.initializeHeights();
    // });

    // Add slot change handler after slots are created
    setTimeout(() => {
      // Log all slots in the shadow DOM
      const slots = this.shadowRoot?.querySelectorAll("slot");
      console.log(
        `IndicatorStack: Found ${slots?.length} slots in shadow DOM:`
      );
      slots?.forEach((slot) => {
        const name = slot.getAttribute("name") || "default";
        console.log(`  - Slot "${name}"`);

        // Check initial content
        const elements = (slot as HTMLSlotElement).assignedElements();
        console.log(
          `IndicatorStack: Initial slot "${name}" has ${elements.length} elements:`,
          elements.map((el) => el.tagName)
        );
      });

      // Monitor all slots for changes
      slots?.forEach((slot) => {
        slot.addEventListener("slotchange", (e) => {
          const slotName = (e.target as HTMLSlotElement).name || "default";
          const elements = (e.target as HTMLSlotElement).assignedElements();
          console.log(
            `IndicatorStack: Slot "${slotName}" changed, now has ${elements.length} elements:`,
            elements.map((el) => el.tagName)
          );

          // Force a re-render to update which slots are shown
          this.requestUpdate();

          // Initialize heights after slot content changes
          this.initializeHeights();

          // Dispatch rendered event
          this.dispatchEvent(
            new CustomEvent("rendered", {
              bubbles: true,
              composed: true,
              detail: {
                slot: slotName,
                elements: elements.map((el) => el.tagName),
              },
            })
          );
        });
      });

      // Set initial heights
      this.initializeHeights();

      // Dispatch rendered event
      console.log("IndicatorStack: Dispatching initial rendered event");
      this.dispatchEvent(
        new CustomEvent("rendered", {
          bubbles: true,
          composed: true,
        })
      );
    }, 10);
  }

  // Handle property changes
  updated(changedProps: Map<string, any>) {
    // Make sure canvases get resized when properties change
    setTimeout(() => {
      const stackItems = this.renderRoot.querySelectorAll(".stack-item");
      stackItems.forEach((item) => this.triggerCanvasResize(item));
    }, 100);
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

  // Get slotted elements
  private getSlottedElements(): HTMLElement[] {
    console.log("IndicatorStack: Getting slotted elements");
    const slot = this.shadowRoot?.querySelector("slot");
    if (!slot) {
      console.warn("IndicatorStack: No default slot found in shadow root");
      return [];
    }

    // First try to get elements assigned to named slots
    const namedSlots = Array.from(
      this.shadowRoot?.querySelectorAll("slot[name]") || []
    );
    console.log(
      "IndicatorStack: Found named slots:",
      namedSlots.map((s) => s.getAttribute("name"))
    );

    const assignedElements: HTMLElement[] = [];

    // Check named slots first
    namedSlots.forEach((namedSlot) => {
      const slottedElements = (namedSlot as HTMLSlotElement).assignedElements();
      console.log(
        `IndicatorStack: Slot "${namedSlot.getAttribute("name")}" has ${
          slottedElements.length
        } elements:`,
        slottedElements.map((el) => el.tagName)
      );
      if (slottedElements.length > 0) {
        assignedElements.push(slottedElements[0] as HTMLElement);
      }
    });

    // If we found elements in named slots, return them
    if (assignedElements.length > 0) {
      console.log(
        "IndicatorStack: Using named slots with elements:",
        assignedElements.map((el) => el.tagName)
      );
      return assignedElements;
    }

    // Otherwise return elements from the default slot
    const defaultElements = (
      slot as HTMLSlotElement
    ).assignedElements() as HTMLElement[];
    console.log(
      "IndicatorStack: Using default slot with elements:",
      defaultElements.map((el) => el.tagName)
    );
    return defaultElements;
  }

  render() {
    console.log("IndicatorStack: Rendering with default and named slots");

    // Create slots for chart and indicators
    return html`
      <!-- Main chart container -->
      <div class="stack-item chart-item">
        <slot name="chart"></slot>
      </div>

      <!-- Always include indicator slots, but hide them when not in use -->
      <div
        class="stack-item"
        style="${this.hasSlottedIndicator(1) ? "" : "display: none;"}"
      >
        <!-- Resize handle for indicator-1 - this is data-index="0" because it's the first handle -->
        ${this.allowResize
          ? html`<div
              class="resize-handle"
              data-index="0"
              @mousedown="${(e: MouseEvent) => this.handleResizeStart(0, e)}"
              @touchstart="${(e: TouchEvent) => this.handleResizeStart(0, e)}"
            ></div>`
          : ""}
        <slot name="indicator-1"></slot>
      </div>

      <div
        class="stack-item"
        style="${this.hasSlottedIndicator(2) ? "" : "display: none;"}"
      >
        <!-- Resize handle for indicator-2 - this is data-index="1" because it's the second handle -->
        ${this.allowResize
          ? html`<div
              class="resize-handle"
              data-index="1"
              @mousedown="${(e: MouseEvent) => this.handleResizeStart(1, e)}"
              @touchstart="${(e: TouchEvent) => this.handleResizeStart(1, e)}"
            ></div>`
          : ""}
        <slot name="indicator-2"></slot>
      </div>

      <!-- Default slot for backward compatibility -->
      <div class="stack-item" style="display: none;">
        <slot></slot>
      </div>
    `;
  }

  // Helper method to check if an indicator slot has content
  private hasSlottedIndicator(index: number): boolean {
    // First check if we can find the slot in shadowRoot
    const slot = this.shadowRoot?.querySelector(
      `slot[name="indicator-${index}"]`
    );
    if (!slot) return false;

    // Then check if any elements are assigned to this slot
    const assignedElements = (slot as HTMLSlotElement).assignedElements();
    console.log(
      `IndicatorStack: Checking slot indicator-${index}, has ${assignedElements.length} elements`
    );
    return assignedElements.length > 0;
  }
}
