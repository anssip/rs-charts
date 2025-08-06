import { css, PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { formatPrice } from "../../util/price-util";
import { GridStyle, OscillatorConfig } from "./indicators/indicator-types";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("value-axis");
logger.setLoggerLevel("value-axis", LogLevel.ERROR);

// For TypeScript to recognize the MarketIndicator element
declare global {
  interface HTMLElementTagNameMap {
    "market-indicator": HTMLElement & { oscillatorConfig?: OscillatorConfig };
  }
}

export interface ValueRange {
  min: number;
  max: number;
  range: number;
}

@customElement("value-axis")
export class ValueAxis extends CanvasBase {
  constructor() {
    super();
  }

  override getId(): string {
    return "value-axis";
  }

  @property({ type: Boolean })
  isMobile = false;

  @property({ type: Object })
  valueRange: ValueRange = { min: 0, max: 100, range: 100 };

  @property({ type: String })
  scale: "price" | "percentage" | "volume" | "value" = "price";

  @property({ type: Number })
  width = 70;

  @property({ type: String })
  gridStyle?: GridStyle;

  // Mouse tracking for the value label
  @state() private mouseY: number = -1;
  @state() private mouseValue: number = 0;

  private isDragging = false;
  private lastY = 0;
  private startRange: ValueRange | null = null;
  private lastPinchDistance = 0;

  useResizeObserver(): boolean {
    return true;
  }

  firstUpdated() {
    super.firstUpdated();

    // Get the container element and add event listeners
    const container = this.renderRoot.querySelector(".container");
    if (container) {
      // Mouse events with capture phase
      container.addEventListener(
        "mousedown",
        this.handleDragStart as EventListener,
        true
      );
      container.addEventListener(
        "mousemove",
        this.handleDragMove as EventListener,
        true
      );
      container.addEventListener(
        "mouseup",
        this.handleDragEnd as EventListener,
        true
      );
      container.addEventListener(
        "mouseleave",
        this.handleDragEnd as EventListener,
        true
      );
      container.addEventListener("wheel", this.handleWheel as EventListener, {
        capture: true,
        passive: false,
      });

      // Touch events with capture phase
      container.addEventListener(
        "touchstart",
        this.handleTouchStart as EventListener,
        { capture: true, passive: false }
      );
      container.addEventListener(
        "touchmove",
        this.handleTouchMove as EventListener,
        { capture: true, passive: false }
      );
      container.addEventListener(
        "touchend",
        this.handleTouchEnd as EventListener,
        true
      );
      container.addEventListener(
        "touchcancel",
        this.handleTouchEnd as EventListener,
        true
      );
    }

    // Add document-level mouse event listeners
    document.addEventListener("mousemove", this.handleDocumentMouseMove);
    document.addEventListener("mouseout", this.handleDocumentMouseOut);
  }

  // Handle mouse movements at the document level
  private handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.isConnected) return;

    // Find the parent indicator container
    const parentIndicator =
      this.closest(".indicator-container") || this.parentElement;
    if (!parentIndicator) {
      return;
    }

    // Get the parent indicator's position instead of just this component
    const parentRect = parentIndicator.getBoundingClientRect();
    const myRect = this.getBoundingClientRect();

    // Check if mouse is vertically within the parent indicator's boundaries
    if (e.clientY >= parentRect.top && e.clientY <= parentRect.bottom) {
      // Calculate relative Y position within our height
      // Use the same relative position within our component height
      const relativeY = (e.clientY - parentRect.top) / parentRect.height;
      this.mouseY = relativeY * myRect.height;

      // Convert Y position to value
      this.mouseValue = this.yToValue(this.mouseY);

      this.requestUpdate();
    } else {
      // Mouse is outside the vertical boundaries, hide the label
      if (this.mouseY !== -1) {
        this.mouseY = -1;
        this.requestUpdate();
      }
    }
  };

  private handleDocumentMouseOut = () => {
    this.mouseY = -1;
    this.requestUpdate();
  };

  disconnectedCallback() {
    super.disconnectedCallback();

    // Remove document event listeners
    document.removeEventListener("mousemove", this.handleDocumentMouseMove);
    document.removeEventListener("mouseout", this.handleDocumentMouseOut);
  }

  override bindEventListeners(canvas: HTMLCanvasElement) {
    // Mouse events with capture phase (true) to ensure they're handled before chart events
    canvas.addEventListener("mousedown", this.handleDragStart, true);
    canvas.addEventListener("mousemove", this.handleDragMove, true);
    canvas.addEventListener("mouseup", this.handleDragEnd, true);
    canvas.addEventListener("mouseleave", this.handleDragEnd, true);
    canvas.addEventListener("wheel", this.handleWheel, {
      capture: true,
      passive: false,
    });

    // Touch events with capture phase
    canvas.addEventListener("touchstart", this.handleTouchStart, {
      capture: true,
      passive: false,
    });
    canvas.addEventListener("touchmove", this.handleTouchMove, {
      capture: true,
      passive: false,
    });
    canvas.addEventListener("touchend", this.handleTouchEnd, true);
    canvas.addEventListener("touchcancel", this.handleTouchEnd, true);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("width")) {
      this.style.setProperty("--value-axis-width", `${this.width}px`);
    }
    if (changedProperties.has("valueRange")) {
      this.draw();
    }
  }

  valueToY(value: number): number {
    const height = this.canvas?.height ?? 0;

    // Always use valueRange regardless of scale
    return (
      height - ((value - this.valueRange.min) / this.valueRange.range) * height
    );
  }

  // Convert a Y position to a value
  yToValue(y: number): number {
    if (!this.canvas) return 0;

    const height = this.canvas.clientHeight;
    const percentage = 1 - y / height;

    // Always use valueRange regardless of scale
    return this.valueRange.min + percentage * this.valueRange.range;
  }

  draw() {
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;

    this.canvas.width = this.canvas.offsetWidth * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Use the gridStyle property to determine how to draw labels
    if (this.gridStyle === GridStyle.PercentageOscillator) {
      // Get the oscillator configuration from the closest indicator parent
      const indicator = this.closest("market-indicator");
      const oscillatorConfig = indicator?.oscillatorConfig || {
        levels: [0, 30, 50, 70, 100], // Default to RSI levels
        thresholds: [30, 70], // Default to RSI thresholds
        format: "%d%%", // Default format with percent sign
      };

      const levels = oscillatorConfig.levels;
      const thresholds = oscillatorConfig.thresholds;
      const format = oscillatorConfig.format || "%d%%";

      ctx.font = "12px var(--font-primary)";

      for (const value of levels) {
        // Skip label if it's outside current range
        if (value < this.valueRange.min || value > this.valueRange.max)
          continue;

        const y = this.valueToY(value) / dpr;

        // Format the label based on the configuration
        const label = format.replace(/%d/, value.toString());

        const labelHeight = 20 / dpr;

        // Draw background
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();
        ctx.fillRect(0, y - labelHeight / 2, this.width, labelHeight);

        const labelWidth = ctx.measureText(label).width;

        // Draw text
        const fontFamily = getComputedStyle(document.documentElement)
          .getPropertyValue("--font-primary")
          .trim();
        ctx.font = `${10}px ${fontFamily}`;

        // Use different color for overbought/oversold threshold levels
        if (thresholds.includes(value)) {
          const isUpperThreshold = value > 50;
          ctx.fillStyle = isUpperThreshold ? "#FF9800" : "#4CAF50"; // Orange for upper threshold, green for lower
        } else {
          ctx.fillStyle = "#666";
        }

        ctx.fillText(label, this.width / 2 - labelWidth / 2, y);
      }
    } else if (this.gridStyle === GridStyle.MACD) {
      // For MACD, use zero baseline with additional levels above/below

      // Use the actual visible range rather than the absolute values
      const visibleRange = this.valueRange.range;

      // Target having approximately 5-7 grid lines in the visible area
      const targetLines = 5;
      let step = visibleRange / targetLines;

      // Round the step to a nice number for readability
      if (step > 10) {
        step = Math.ceil(step / 10) * 10;
      } else if (step > 5) {
        step = Math.ceil(step / 5) * 5;
      } else if (step > 1) {
        step = Math.ceil(step);
      } else if (step > 0.5) {
        step = 0.5;
      } else if (step > 0.25) {
        step = 0.25;
      } else if (step > 0.1) {
        step = 0.1;
      } else {
        step = 0.05;
      }

      // Find the first grid line below the visible area
      const firstLevel = Math.floor(this.valueRange.min / step) * step;

      // Create array of grid levels within and slightly beyond the visible range
      let levels = [];

      // Add levels from bottom to top
      for (
        let level = firstLevel;
        level <= this.valueRange.max + step / 2;
        level += step
      ) {
        levels.push(level);
      }

      // Always include zero if it's reasonably close to the visible range
      if (
        !levels.includes(0) &&
        (Math.abs(this.valueRange.min) < visibleRange * 2 ||
          Math.abs(this.valueRange.max) < visibleRange * 2)
      ) {
        levels.push(0);
        // Sort levels to maintain proper order
        levels.sort((a, b) => a - b);
      }

      ctx.font = "12px var(--font-primary)";

      for (const value of levels) {
        // Skip label if it's outside current range
        if (
          value < this.valueRange.min - step / 2 ||
          value > this.valueRange.max + step / 2
        )
          continue;

        const y = this.valueToY(value) / dpr;

        // Format the label based on the step size
        let label;
        if (step >= 1) {
          label = value.toFixed(0);
        } else if (step >= 0.1) {
          label = value.toFixed(1);
        } else {
          label = value.toFixed(2);
        }

        const labelHeight = 20 / dpr;

        // Draw background
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();
        ctx.fillRect(0, y - labelHeight / 2, this.width, labelHeight);

        const labelWidth = ctx.measureText(label).width;

        // Draw text
        const fontFamily = getComputedStyle(document.documentElement)
          .getPropertyValue("--font-primary")
          .trim();
        ctx.font = `${10}px ${fontFamily}`;

        // Use special color for zero baseline
        if (Math.abs(value) < 0.0001) {
          // Check if value is essentially zero
          ctx.fillStyle = "#BB86FC"; // Accent color for zero line
          // Make zero label stand out with slightly larger font
          ctx.font = `bold ${10}px ${fontFamily}`;
        } else if (value > 0) {
          ctx.fillStyle = "#4CAF50"; // Green for positive values
        } else {
          ctx.fillStyle = "#F44336"; // Red for negative values
        }

        ctx.fillText(label, this.width / 2 - labelWidth / 2, y);
      }
    } else if (this.gridStyle === GridStyle.Value) {
      // For custom value indicators, create an adaptive grid with proper distribution

      // Use the actual visible range
      const visibleRange = this.valueRange.range;

      // Target having approximately 4-6 grid lines in the visible area
      const targetLines = 5;
      let step = visibleRange / targetLines;

      // Round the step to a nice number for readability
      if (step > 10) {
        step = Math.ceil(step / 10) * 10;
      } else if (step > 5) {
        step = Math.ceil(step / 5) * 5;
      } else if (step > 1) {
        step = Math.ceil(step);
      } else if (step > 0.5) {
        step = 0.5;
      } else if (step > 0.25) {
        step = 0.25;
      } else if (step > 0.1) {
        step = 0.1;
      } else {
        step = 0.05;
      }

      // Find the first grid line at or below the min visible value
      const firstLevel = Math.floor(this.valueRange.min / step) * step;

      // Create array of grid levels across the visible range
      let levels = [];

      // Add levels from bottom to top
      for (
        let level = firstLevel;
        level <= this.valueRange.max + step / 2;
        level += step
      ) {
        levels.push(level);
      }

      ctx.font = "12px var(--font-primary)";

      for (const value of levels) {
        // Skip label if it's outside current range
        if (
          value < this.valueRange.min - step / 2 ||
          value > this.valueRange.max + step / 2
        )
          continue;

        const y = this.valueToY(value) / dpr;

        // Format the label based on the step size
        let label;
        if (step >= 1) {
          label = value.toFixed(0);
        } else if (step >= 0.1) {
          label = value.toFixed(1);
        } else {
          label = value.toFixed(2);
        }

        const labelHeight = 20 / dpr;

        // Draw background
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();
        ctx.fillRect(0, y - labelHeight / 2, this.width, labelHeight);

        const labelWidth = ctx.measureText(label).width;

        // Draw text
        const fontFamily = getComputedStyle(document.documentElement)
          .getPropertyValue("--font-primary")
          .trim();
        ctx.font = `${10}px ${fontFamily}`;

        // Use a neutral color for value indicators (previously matched ATR's purple)
        ctx.fillStyle = "#64B5F6"; // Light blue that works well for most indicators
        ctx.fillText(label, this.width / 2 - labelWidth / 2, y);
      }
    } else {
      // For standard indicators, use evenly spaced labels
      const numLabels = 5;
      const step = this.valueRange.range / (numLabels - 1);
      ctx.font = "12px var(--font-primary)";

      for (let i = 0; i < numLabels; i++) {
        const value = this.valueRange.max - i * step;
        const y = this.valueToY(value) / dpr;
        const label =
          this.scale === "percentage"
            ? `${value.toFixed(2)}%`
            : formatPrice(value);

        const labelHeight = 20 / dpr;

        // Draw background
        ctx.fillStyle = getComputedStyle(document.documentElement)
          .getPropertyValue("--color-primary-dark")
          .trim();
        ctx.fillRect(0, y - labelHeight / 2, this.width, labelHeight);

        const labelWidth = ctx.measureText(label).width;

        // Draw text
        const fontFamily = getComputedStyle(document.documentElement)
          .getPropertyValue("--font-primary")
          .trim();
        ctx.font = `${10}px ${fontFamily}`;

        ctx.fillStyle = "#666";
        ctx.fillText(label, this.width / 2 - labelWidth / 2, y);
      }
    }
  }

  private handleDragStart = (e: MouseEvent) => {
    logger.debug("handleDragStart", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    this.isDragging = true;
    this.lastY = e.clientY;
    this.startRange = { ...this.valueRange };
  };

  private handleDragMove = (e: MouseEvent) => {
    logger.debug("handleDragMove", e);
    if (!this.isDragging || !this.startRange) return;

    e.stopPropagation(); // Stop propagation to prevent chart handling

    // Calculate delta movement and convert to value delta
    const deltaY = e.clientY - this.lastY;
    const rangePerPixel = this.valueRange.range / (this.canvas?.height ?? 1);
    const deltaValue = deltaY * rangePerPixel;

    // Pan by shifting both min and max by the same amount
    const newValueRange = {
      min: this.startRange.min + deltaValue,
      max: this.startRange.max + deltaValue,
      range: this.startRange.range,
    };

    logger.debug("panning to newValueRange", newValueRange);

    this.dispatchEvent(
      new CustomEvent("value-range-change", {
        detail: newValueRange,
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleDragEnd = (e: MouseEvent) => {
    logger.debug("handleDragEnd", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    this.isDragging = false;
    this.startRange = null;
  };

  // Touch events
  private handleTouchStart = (e: TouchEvent) => {
    logger.debug("handleTouchStart", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    e.preventDefault();

    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastY = e.touches[0].clientY;
      this.startRange = { ...this.valueRange };
    } else if (e.touches.length === 2) {
      // Initialize for pinch-to-zoom
      this.lastPinchDistance = Math.abs(
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    logger.debug("handleTouchMove", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    e.preventDefault();

    if (e.touches.length === 1 && this.isDragging && this.startRange) {
      // Handle panning
      const deltaY = e.touches[0].clientY - this.lastY;
      const rangePerPixel = this.valueRange.range / (this.canvas?.height ?? 1);
      const deltaValue = deltaY * rangePerPixel;

      // Pan by shifting both min and max by the same amount
      const newValueRange = {
        min: this.startRange.min + deltaValue,
        max: this.startRange.max + deltaValue,
        range: this.startRange.range,
      };

      this.dispatchEvent(
        new CustomEvent("value-range-change", {
          detail: newValueRange,
          bubbles: true,
          composed: true,
        })
      );
    } else if (e.touches.length === 2) {
      // Handle pinch zoom
      const currentDistance = Math.abs(
        e.touches[0].clientY - e.touches[1].clientY
      );
      const zoomFactor = 1 + (this.lastPinchDistance - currentDistance) * 0.01;

      // Calculate center point between fingers
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const rect = this.canvas?.getBoundingClientRect();
      if (!rect) return;

      // Convert center position to value
      const relativeY = (centerY - rect.top) / rect.height;
      const centerValue =
        this.valueRange.max - relativeY * this.valueRange.range;

      // Calculate new range around that center
      const newRange = this.valueRange.range * zoomFactor;
      const halfRange = newRange / 2;

      const newValueRange = {
        min:
          centerValue -
          (halfRange * (centerValue - this.valueRange.min)) /
            (this.valueRange.range / 2),
        max:
          centerValue +
          (halfRange * (this.valueRange.max - centerValue)) /
            (this.valueRange.range / 2),
        range: newRange,
      };

      this.dispatchEvent(
        new CustomEvent("value-range-change", {
          detail: newValueRange,
          bubbles: true,
          composed: true,
        })
      );

      this.lastPinchDistance = currentDistance;
    }
  };

  private handleTouchEnd = (e: TouchEvent) => {
    logger.debug("handleTouchEnd", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    this.isDragging = false;
    this.startRange = null;
    this.lastPinchDistance = 0;
  };

  private handleWheel = (e: WheelEvent) => {
    logger.debug("handleWheel", e);
    e.stopPropagation(); // Stop propagation to prevent chart handling
    e.preventDefault();

    // Detect if this is a trackpad gesture (presence of deltaX or small deltaY)
    const isTrackpad =
      Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < this.canvas!.width;

    // Use different sensitivity based on input type
    const sensitivity = isTrackpad ? 0.005 : 0.01;
    const zoomFactor = 1 - e.deltaY * sensitivity;

    const rect = this.canvas?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the value at mouse position
    const mouseY = e.clientY - rect.top;
    const valueAtMouse =
      this.valueRange.max - (mouseY / rect.height) * this.valueRange.range;

    // Calculate new range
    const newRange = this.valueRange.range * zoomFactor;

    // Calculate new min/max while keeping mouse position value constant
    const ratio = (valueAtMouse - this.valueRange.min) / this.valueRange.range;
    const newMin = valueAtMouse - ratio * newRange;
    const newMax = newMin + newRange;

    const newValueRange = {
      min: newMin,
      max: newMax,
      range: newRange,
    };

    logger.debug("newValueRange", newValueRange);

    this.dispatchEvent(
      new CustomEvent("value-range-change", {
        detail: newValueRange,
        bubbles: true,
        composed: true,
      })
    );
  };

  render() {
    return html`
      <div class="container">
        <canvas></canvas>

        <!-- Mouse value label -->
        ${this.mouseY > 0
          ? html`
              <div
                class="mouse-value-label"
                style="top: ${this.mouseY - 10}px; left: 0;"
              >
                <div class="value">
                  ${(() => {
                    switch (this.scale) {
                      case "percentage":
                        return `${this.mouseValue.toFixed(2)}%`;
                      case "volume":
                        return formatPrice(this.mouseValue).replace(".", ",");
                      case "value":
                        return this.mouseValue.toFixed(2);
                      case "price":
                      default:
                        return formatPrice(this.mouseValue);
                    }
                  })()}
                </div>
              </div>
            `
          : ""}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: var(--value-axis-width, 70px);
      height: 100%;
      background: var(--color-primary-dark, #131722);
      position: relative;
      z-index: 10; /* Ensure this is above other elements */
      pointer-events: auto; /* Explicitly enable pointer events */
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: auto; /* Ensure container receives events */
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
      pointer-events: auto; /* Ensure canvas receives events */
    }

    .mouse-value-label {
      position: absolute;
      width: 94%;
      height: 20px;
      background-color: #222;
      border: 1px solid var(--color-primary);
      border-radius: 4px;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      line-height: 1;
      margin-right: 2px;
      z-index: 1000;
      color: white;
      pointer-events: none;
      box-shadow: 0 0 5px var(--color-primary);
    }

    .value {
      font-weight: bold;
    }
  `;
}
