import { css, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
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

  private isDragging = false;
  private lastY = 0;
  private startRange: ValueRange | null = null;
  private lastPinchDistance = 0;

  useResizeObserver(): boolean {
    return true;
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
    const numLabels = this.valueRange.range / 20;
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

  static styles = css`
    :host {
      display: block;
      width: var(--value-axis-width, 70px);
      height: 100%;
      background: var(--color-primary-dark, #131722);
    }

    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;
}
