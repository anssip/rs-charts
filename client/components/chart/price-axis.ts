import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Drawable, DrawingContext } from './drawing-strategy';

@customElement('price-axis')
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
        window.addEventListener('draw-chart', this.handleDrawChart as EventListener);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener('draw-chart', this.handleDrawChart as EventListener);
    }

    private handleDrawChart = (event: CustomEvent<DrawingContext>) => {
        this.draw(event.detail);
    };

    draw(context: DrawingContext): void {
        if (!this.canvas || !this.ctx) return;

        const { priceRange, axisMappings: { priceToY } } = context;
        const dpr = window.devicePixelRatio ?? 1;
        const ctx = this.ctx;

        // Clear the canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Set text style
        ctx.font = `${12 * dpr}px monospace`;
        ctx.fillStyle = '#666';
        ctx.textAlign = 'right';

        const priceStep = priceRange.range / 10;
        const firstPriceGridLine = Math.floor(priceRange.min / priceStep) * priceStep;

        for (
            let price = firstPriceGridLine;
            price <= priceRange.max + priceStep;
            price += priceStep
        ) {
            const y = priceToY(price);
            if (y >= 0 && y <= this.canvas.height) {
                // Draw tick mark
                ctx.beginPath();
                ctx.strokeStyle = '#ccc';
                ctx.moveTo(this.canvas.width - 8 * dpr, y);
                ctx.lineTo(this.canvas.width, y);
                ctx.stroke();

                // Draw price label
                ctx.fillText(
                    price.toFixed(2),
                    this.canvas.width - 12 * dpr,
                    y + 4 * dpr
                );
            }
        }
    }

    render() {
        return html`<canvas></canvas>`;
    }

    firstUpdated() {
        requestAnimationFrame(() => {
            this.canvas = this.renderRoot.querySelector('canvas');
            this.ctx = this.canvas?.getContext('2d') || null;
            this.setupCanvas();
        });
    }

    private setupCanvas() {
        if (!this.canvas) return;

        const rect = this.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            console.warn('PriceAxis: Invalid dimensions', rect);
            requestAnimationFrame(() => this.setupCanvas());
            return;
        }

        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        if (this.ctx) {
            this.ctx.scale(dpr, dpr);
        }
    }

    public resize(width: number, height: number) {
        this.setupCanvas();
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'price-axis': PriceAxis;
    }
} 