import { html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Drawable, DrawingContext } from "./drawing-strategy";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";

@customElement("price-axis")
export class PriceAxis extends CanvasBase implements Drawable {
  private resizeObserver: ResizeObserver | null = null;

  override getId(): string {
    return "price-axis";
  }

  private isDragging = false;
  private lastY = 0;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener(
      "draw-chart",
      this.handleDrawChart as EventListener
    );
    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === this) {
          this.resize(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(
      "draw-chart",
      this.handleDrawChart as EventListener
    );
    if (this.resizeObserver) {
      this.resizeObserver.unobserve(this);
      this.resizeObserver = null;
    }
  }

  private handleDrawChart = (event: CustomEvent<DrawingContext>) => {
    this.draw(event.detail);
  };

  draw(context: DrawingContext): void {
    if (!this.canvas || !this.ctx) return;
    console.log("PriceAxis: draw");

    const {
      priceRange,
      axisMappings: { priceToY },
    } = context;
    const dpr = window.devicePixelRatio ?? 1;
    const ctx = this.ctx;

    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.font = `${6 * dpr}px Arial`;
    ctx.fillStyle = "#666";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.strokeStyle = "#ccc";

    const priceStep = getPriceStep(priceRange.range);
    const firstPriceGridLine =
      Math.floor(priceRange.min / priceStep) * priceStep;

    for (
      let price = firstPriceGridLine;
      price <= priceRange.max + priceStep;
      price += priceStep
    ) {
      const y = priceToY(price) / dpr;

      if (y >= 0 && y <= this.canvas.height / dpr) {
        ctx.fillText(formatPrice(price), this.canvas.width - 30 * dpr, y);
      }
    }
  }

  render() {
    return html`<canvas
      @mousedown=${this.handleDragStart}
      @mousemove=${this.handleDragMove}
      @mouseup=${this.handleDragEnd}
      @mouseleave=${this.handleDragEnd}
      @wheel=${this.handleWheel}
    ></canvas>`;
  }

  private handleDragStart = (e: MouseEvent) => {
    this.isDragging = true;
    this.lastY = e.clientY;
  };

  private handleDragMove = (e: MouseEvent) => {
    if (!this.isDragging) return;
    const deltaY = e.clientY - this.lastY;
    this.dispatchZoom(deltaY, e.clientY, false);
    this.lastY = e.clientY;
  };

  private handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;
    this.dispatchZoom(e.deltaY, e.clientY, isTrackpad);
  };

  private dispatchZoom(deltaY: number, clientY: number, isTrackpad: boolean) {
    this.dispatchEvent(
      new CustomEvent("price-axis-zoom", {
        detail: {
          deltaY,
          clientY,
          rect: this.getBoundingClientRect(),
          isTrackpad,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleDragEnd = () => {
    this.isDragging = false;
  };
}
