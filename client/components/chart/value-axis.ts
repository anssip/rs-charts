import { css } from "lit";
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
  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

  constructor() {
    super();
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.draw();
  };

  override getId(): string {
    return "value-axis";
  }

  @property({ type: Object })
  valueRange: ValueRange = { min: 0, max: 100, range: 100 };

  @property({ type: String })
  scale: "price" | "percentage" | "volume" = "price";

  @property({ type: Number })
  width = 70;

  useResizeObserver(): boolean {
    return true;
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
    console.log("ValueAxis draw");
    if (!this.canvas || !this.ctx) return;

    const ctx = this.ctx;
    const dpr = window.devicePixelRatio ?? 1;

    this.canvas.width = this.canvas.offsetWidth * dpr;
    this.canvas.height = this.canvas.offsetHeight * dpr;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Draw value labels
    const numLabels = 6;
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
      ctx.fillStyle = "#666";
      ctx.fillText(label, this.width / 2 - labelWidth / 2, y);
    }
  }

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
