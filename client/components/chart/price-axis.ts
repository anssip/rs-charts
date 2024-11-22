import { TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { Drawable } from "./drawing-strategy";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { priceToY } from "../../util/chart-util";

@customElement("price-axis")
export class PriceAxis extends CanvasBase implements Drawable {
    private currentPrice: number = 0;
    private priceRange: PriceRange = new PriceRangeImpl(0, 0);

    override getId(): string {
        return "price-axis";
    }

    private isDragging = false;
    private lastY = 0;

    connectedCallback() {
        super.connectedCallback();
        observe("state.liveCandle", (path) => {
            console.log(
                "PriceAxis: liveCandle.close changed",
                (xin[path] as LiveCandle).close
            );
            this.currentPrice = (xin[path] as LiveCandle).close;
            this.requestUpdate();
        });
        observe("state.priceRange", (path) => {
            console.log("LiveDecorators: priceRange changed", xin[path]);
            this.priceRange = xin[path] as PriceRange;
            this.requestUpdate();
        });

    }

    useResizeObserver(): boolean {
        return true;
    }

    draw(): void {
        if (!this.canvas || !this.ctx) return;
        console.log("PriceAxis: draw");

        const dpr = window.devicePixelRatio ?? 1;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const priceY = priceToY(this.canvas.height, {
            start: this.priceRange.min,
            end: this.priceRange.max,
        });

        ctx.font = `${6 * dpr}px Arial`;
        ctx.fillStyle = "#666";
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#ccc";

        const priceStep = getPriceStep(this.priceRange.range);
        const firstPriceGridLine =
            Math.floor(this.priceRange.min / priceStep) * priceStep;

        for (
            let price = firstPriceGridLine;
            price <= this.priceRange.max + priceStep;
            price += priceStep
        ) {
            const y = priceY(price);

            if (y >= 0 && y <= this.canvas.height / dpr) {
                ctx.fillText(formatPrice(price), this.canvas.width - 30 * dpr, y);
            }
        }
        ctx.fillStyle = "#333";
        const price = formatPrice(this.currentPrice);
        const textMetrics = ctx.measureText(price);
        const padding = 4 * dpr;
        const rectWidth = textMetrics.width + padding * 2;
        const rectHeight = textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent + padding * 2;
        ctx.fillRect(
            this.canvas.width - 30 * dpr - rectWidth,
            priceY(this.currentPrice) - rectHeight / 2,
            rectWidth,
            rectHeight
        );
        // Draw text
        ctx.fillStyle = "#fff";
        ctx.fillText(price, this.canvas.width - 30 * dpr, priceY(this.currentPrice));
    }

    override bindEventListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener("mousedown", this.handleDragStart);
        canvas.addEventListener("mousemove", this.handleDragMove);
        canvas.addEventListener("mouseup", this.handleDragEnd);
        canvas.addEventListener("mouseleave", this.handleDragEnd);
        canvas.addEventListener("wheel", this.handleWheel);
    }

    protected override render(): TemplateResult<1> {
        this.draw();
        return super.render();
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

    override resize(width: number, height: number) {
        super.resize(width, height);
        this.draw();
    }
}
