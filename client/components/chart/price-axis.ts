import { customElement } from "lit/decorators.js";
import { formatPrice, getPriceStep } from "../../util/price-util";
import { CanvasBase } from "./canvas-base";
import { observe, xin } from "xinjs";
import { LiveCandle } from "../../live-candle-subscription";
import { PriceRange } from "../../../server/services/price-data/price-history-model";
import { PriceRangeImpl } from "../../util/price-range";
import { drawPriceLabel, priceToY } from "../../util/chart-util";

@customElement("price-axis")
export class PriceAxis extends CanvasBase {
    private currentPrice: number = 0;
    private priceRange: PriceRange = new PriceRangeImpl(0, 0);
    private isDragging = false;
    private lastY = 0;

    override getId(): string {
        return "price-axis";
    }

    firstUpdated() {
        super.firstUpdated();

        this.priceRange = xin["state.priceRange"] as PriceRange;
        console.log("PriceAxis: priceRange", this.priceRange);

        observe("state.liveCandle", (path) => {
            console.log(
                "PriceAxis: liveCandle.close changed",
                (xin[path] as LiveCandle).close
            );
            this.currentPrice = (xin[path] as LiveCandle).close;
            this.draw();
        });
        observe("state.priceRange", (path) => {
            console.log("PriceAxis: priceRange changed", xin[path]);
            this.priceRange = xin[path] as PriceRange;
            this.draw();
        });

    }

    useResizeObserver(): boolean {
        return true;
    }

    override draw(): void {
        if (!this.canvas || !this.ctx) return;
        console.log("PriceAxis: priceRange", {
            width: this.canvas.width,
            height: this.canvas.height,
            priceRange: { min: this.priceRange.min, max: this.priceRange.max }
        });

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

        drawPriceLabel(
            ctx,
            this.currentPrice,
            0,
            priceY(this.currentPrice),
            "#333",
            "#fff",
            this.canvas.width / dpr - 2 * dpr
        );
    }

    override bindEventListeners(canvas: HTMLCanvasElement) {
        canvas.addEventListener("mousedown", this.handleDragStart);
        canvas.addEventListener("mousemove", this.handleDragMove);
        canvas.addEventListener("mouseup", this.handleDragEnd);
        canvas.addEventListener("mouseleave", this.handleDragEnd);
        canvas.addEventListener("wheel", this.handleWheel);
    }

    private handleDragStart = (e: MouseEvent) => {
        this.isDragging = true;
        this.lastY = e.clientY;
    };

    private handleDragMove = (e: MouseEvent) => {
        if (!this.isDragging) return;
        const deltaY = e.clientY - this.lastY;
        this.dispatchZoom(-deltaY, false);
        this.lastY = e.clientY;
    };

    private handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const isTrackpad = Math.abs(e.deltaX) !== 0 || Math.abs(e.deltaY) < 50;
        this.dispatchZoom(e.deltaY, isTrackpad);
    };

    private dispatchZoom(deltaY: number, isTrackpad: boolean) {
        this.dispatchEvent(
            new CustomEvent("price-axis-zoom", {
                detail: {
                    deltaY,
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
