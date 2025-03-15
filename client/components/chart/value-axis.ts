import { css, PropertyValues, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { CanvasBase } from "./canvas-base";
import { formatPrice } from "../../util/price-util";

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
  scale: "price" | "percentage" | "volume" = "price";

  @property({ type: Number })
  width = 70;

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
    
    // Add document-level mouse event listeners
    document.addEventListener('mousemove', this.handleDocumentMouseMove);
    document.addEventListener('mouseout', this.handleDocumentMouseOut);
  }
  
  // Handle mouse movements at the document level
  private handleDocumentMouseMove = (e: MouseEvent) => {
    if (!this.isConnected) return;
    
    // Find the parent indicator container
    const parentIndicator = this.closest('.indicator-container') || this.parentElement;
    if (!parentIndicator) {
      console.log("ValueAxis: No parent indicator found");
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
      
      // Debug logging
      console.log("ValueAxis: Mouse in parent bounds", {
        clientY: e.clientY,
        parentTop: parentRect.top, 
        parentBottom: parentRect.bottom,
        relativeY,
        mouseY: this.mouseY,
        value: this.mouseValue
      });
      
      this.requestUpdate();
    } else {
      // Mouse is outside the vertical boundaries, hide the label
      if (this.mouseY !== -1) {
        this.mouseY = -1;
        console.log("ValueAxis: Mouse outside parent bounds", {
          clientY: e.clientY,
          parentTop: parentRect.top, 
          parentBottom: parentRect.bottom
        });
        this.requestUpdate();
      }
    }
  };
  
  private handleDocumentMouseOut = () => {
    this.mouseY = -1;
    this.requestUpdate();
  }
  
  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Remove document event listeners
    document.removeEventListener('mousemove', this.handleDocumentMouseMove);
    document.removeEventListener('mouseout', this.handleDocumentMouseOut);
  }

  override bindEventListeners(canvas: HTMLCanvasElement) {
    // Mouse events
    canvas.addEventListener("mousedown", this.handleDragStart);
    canvas.addEventListener("mousemove", this.handleDragMove);
    canvas.addEventListener("mouseup", this.handleDragEnd);
    canvas.addEventListener("mouseleave", this.handleDragEnd);
    canvas.addEventListener("wheel", this.handleWheel);

    // Touch events
    canvas.addEventListener("touchstart", this.handleTouchStart);
    canvas.addEventListener("touchmove", this.handleTouchMove);
    canvas.addEventListener("touchend", this.handleTouchEnd);
    canvas.addEventListener("touchcancel", this.handleTouchEnd);
  }

  updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    if (changedProperties.has("width")) {
      this.style.setProperty("--value-axis-width", `${this.width}px`);
    }
    if (changedProperties.has("valueRange")) {
      console.log("ValueAxis updated", {
        valueRange: this.valueRange,
      });
      this.draw();
    }
  }

  valueToY(value: number): number {
    const height = this.canvas?.height ?? 0;

    if (this.scale === "percentage") {
      return height - (value / 100) * height;
    }
    return (
      height - ((value - this.valueRange.min) / this.valueRange.range) * height
    );
  }
  
  // Convert a Y position to a value
  yToValue(y: number): number {
    if (!this.canvas) return 0;
    
    const height = this.canvas.clientHeight;
    const percentage = 1 - y / height;
    
    if (this.scale === "percentage") {
      return percentage * 100;
    }
    
    return this.valueRange.min + percentage * this.valueRange.range;
  }

  draw() {
    console.log("ValueAxis draw", this.valueRange);
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;

    this.canvas.width = this.canvas.offsetWidth * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Draw value labels
    const numLabels = 5;
    const step = this.valueRange.range / (numLabels - 1);
    ctx.font = "12px var(--font-primary)";

    for (let i = 0; i < numLabels; i++) {
      const value = this.valueRange.max - i * step;
      const y = this.valueToY(value) / dpr;
      const label =
        this.scale === "percentage"
          ? `${value.toFixed(0)}%`
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

  private handleDragStart = (e: MouseEvent) => {
    console.log("ValueAxis handleDragStart", e);
    this.isDragging = true;
    this.lastY = e.clientY;
    this.startRange = { ...this.valueRange };
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging || !this.startRange) return;

    const deltaY = e.clientY - this.lastY;
    const rangePerPixel = this.valueRange.range / (this.canvas?.height ?? 1);
    const deltaValue = deltaY * rangePerPixel;

    const newRange = {
      min: this.startRange.min + deltaValue,
      max: this.startRange.max + deltaValue,
      range: this.startRange.range,
    };

    this.dispatchEvent(
      new CustomEvent("value-range-change", {
        detail: newRange,
        bubbles: true,
        composed: true,
      })
    );
  };

  private handleDragEnd = () => {
    this.isDragging = false;
    this.startRange = null;
  };

  // Touch events
  private handleTouchStart = (e: TouchEvent) => {
    console.log("ValueAxis handleTouchStart", e);
    if (e.touches.length === 1) {
      e.preventDefault();
      this.isDragging = true;
      this.lastY = e.touches[0].clientY;
      this.startRange = { ...this.valueRange };
    }
  };

  private handleTouchMove = (e: TouchEvent) => {
    console.log("ValueAxis handleTouchMove", e);
    if (!this.isDragging || !this.startRange) return;
    e.preventDefault();

    const touch = e.touches[0];
    const deltaY = touch.clientY - this.lastY;
    const rangePerPixel = this.valueRange.range / (this.canvas?.height ?? 1);
    const deltaValue = deltaY * rangePerPixel;

    // For touch, we'll also support pinch-zoom
    if (e.touches.length === 2) {
      const touch2 = e.touches[1];
      const currentDistance = Math.abs(touch2.clientY - touch.clientY);
      const zoomFactor = 1 + (currentDistance - this.lastPinchDistance) * 0.01;

      const center = (this.valueRange.max + this.valueRange.min) / 2;
      const newRange = this.valueRange.range * zoomFactor;
      const halfRange = newRange / 2;

      const newValueRange = {
        min: center - halfRange,
        max: center + halfRange,
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
    } else {
      // Regular touch pan
      const newRange = {
        min: this.startRange.min + deltaValue,
        max: this.startRange.max + deltaValue,
        range: this.startRange.range,
      };

      this.dispatchEvent(
        new CustomEvent("value-range-change", {
          detail: newRange,
          bubbles: true,
          composed: true,
        })
      );
    }
  };

  private handleTouchEnd = () => {
    console.log("ValueAxis handleTouchEnd");
    this.isDragging = false;
    this.startRange = null;
    this.lastPinchDistance = 0;
  };

  private handleWheel = (e: WheelEvent) => {
    console.log("ValueAxis handleWheel", e);
    e.preventDefault();

    const zoomFactor = 1 - e.deltaY * 0.001;
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
        ${this.mouseY > 0 ? html`
          <div class="mouse-value-label"
               style="top: ${this.mouseY - 10}px; left: 0;">
            <div class="value">
              ${(() => {
                switch(this.scale) {
                  case "percentage":
                    return `${this.mouseValue.toFixed(2)}%`;
                  case "volume":
                    return formatPrice(this.mouseValue).replace('.', ',');
                  case "price":
                  default:
                    return formatPrice(this.mouseValue);
                }
              })()}
            </div>
          </div>
        ` : ''}
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
    }

    .container {
      position: relative;
      width: 100%;
      height: 100%;
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
    
    .mouse-value-label {
      position: absolute;
      width: 94%;
      height: 20px;
      background-color: #222;
      border: 2px solid var(--color-accent-2);
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
      box-shadow: 0 0 5px var(--color-accent-2);
    }
    
    .value {
      font-weight: bold;
    }
  `;
}
