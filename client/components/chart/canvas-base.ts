import { LitElement, html } from "lit";

export abstract class CanvasBase extends LitElement {
  public canvas: HTMLCanvasElement | null = null;
  public ctx: CanvasRenderingContext2D | null = null;
  private resizeObserver: ResizeObserver | null = null;
  constructor() {
    super();
    this.id = this.getId();
  }

  abstract getId(): string;

  protected render() {
    return html`<canvas id="${this.id}"></canvas>`;
  }

  firstUpdated() {
    const bindListeners = (canvas: HTMLCanvasElement) => {
      this.bindEventListeners(canvas);
    };

    requestAnimationFrame(() => {
      this.canvas = this.renderRoot.querySelector("canvas");
      if (!this.canvas) {
        return;
      }
      this.ctx = this.canvas.getContext("2d");
      if (!this.ctx) {
        return;
      }
      const rect = this.getBoundingClientRect();
      const dpr = window.devicePixelRatio ?? 1;

      this.canvas.width = rect.width * dpr;
      this.canvas.height = rect.height * dpr;
      this.canvas.style.width = `${rect.width}px`;
      this.canvas.style.height = `${rect.height}px`;

      if (this.ctx) {
        this.ctx.scale(dpr, dpr);
      }

      bindListeners(this.canvas);
      this.draw();

      if (this.useResizeObserver()) {
        this.resizeObserver = new ResizeObserver((entries) => {
          for (let entry of entries) {
            if (entry.target === this) {
              const { width, height } = entry.contentRect;
              this.resize(width, height);
            }
          }
        });
        this.resizeObserver.observe(this);
      }
    });
  }

  useResizeObserver(): boolean {
    return false;
  }

  bindEventListeners(_: HTMLCanvasElement): void {
    // no default listeners
  }

  public resize(width: number, height: number) {
    if (width === 0 || height === 0) {
      return;
    }
    if (!this.canvas || !this.ctx) {
      return;
    }
    const dpr = window.devicePixelRatio ?? 1;

    this.canvas.style.width = `${width}px`;
    this.canvas.width = width * dpr;

    this.canvas.style.height = `${height}px`;
    this.canvas.height = height * dpr;

    // Reset any previous transforms
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);
    this.draw();
  }

  draw(): void {
    // should be implemented by subclasses
  }
}
