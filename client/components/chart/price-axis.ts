import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { Drawable, DrawingContext } from "./drawing-strategy";
import { formatPrice, getPriceStep } from "../../util";
@customElement("price-axis")
export class PriceAxis extends LitElement implements Drawable {
    private canvas: HTMLCanvasElement | null = null;
    private ctx: CanvasRenderingContext2D | null = null;

    static styles = css`
    :host {
      display: block;
      position: relative;
      width: 80px;
      height: 100%;
      border-left: 1px solid #ddd;
      background: white;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
    }
  `;

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener(
            "draw-chart",
            this.handleDrawChart as EventListener
        );
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener(
            "draw-chart",
            this.handleDrawChart as EventListener
        );
    }

    private handleDrawChart = (event: CustomEvent<DrawingContext>) => {
        this.draw(event.detail);
    };

    draw(context: DrawingContext): void {
        if (!this.canvas || !this.ctx) return;

        const {
            priceRange,
            axisMappings: { priceToY },
        } = context;
        const dpr = window.devicePixelRatio ?? 1;
        const ctx = this.ctx;

        // Clear the canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Set text style
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
            // Match the grid's Y coordinate calculation exactly
            const y = priceToY(price) / dpr;

            // Only draw if within visible area
            if (y >= 0 && y <= this.canvas.height / dpr) {
                // Draw tick mark
                // ctx.beginPath();
                // ctx.moveTo(2 * dpr, y * dpr);
                // ctx.lineTo(7 * dpr, y * dpr);
                // ctx.stroke();

                // Draw price label
                ctx.fillText(formatPrice(price), this.canvas.width - 30 * dpr, y * dpr);
            }
        }
    }

    render() {
        return html`<canvas></canvas>`;
    }

    firstUpdated() {
        console.log("First updated called");
        requestAnimationFrame(() => {
            this.canvas = this.renderRoot.querySelector("canvas");
            if (!this.canvas) {
                console.error("No canvas found in renderRoot");
                return;
            }

            this.ctx = this.canvas.getContext("2d");
            if (!this.ctx) {
                console.error("Failed to get 2d context");
                return;
            }

            // Set up the canvas with proper DPR scaling
            const rect = this.getBoundingClientRect();
            const dpr = window.devicePixelRatio ?? 1;

            console.log("Setting up canvas with:", {
                rect,
                dpr,
                width: rect.width * dpr,
                height: rect.height * dpr,
            });

            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.canvas.style.width = `${rect.width}px`;
            this.canvas.style.height = `${rect.height}px`;

            if (this.ctx) {
                this.ctx.scale(dpr, dpr);
            }
        });
    }

    public resize(width: number, height: number) {
        if (width === 0 || height === 0) {
            console.warn("Invalid dimensions received:", width, height);
            return;
        }
        if (!this.canvas || !this.ctx) {
            console.warn("Canvas or context not found");
            return;
        }
        const dpr = window.devicePixelRatio ?? 1;

        // Set the canvas buffer size (actual pixels)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Set the canvas display size (CSS pixels)
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Reset any previous transforms and apply DPR scaling once
        this.ctx.resetTransform();
        this.ctx.scale(dpr, dpr);
    }

}

declare global {
    interface HTMLElementTagNameMap {
        "price-axis": PriceAxis;
    }
}
