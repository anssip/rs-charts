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
    // Schedule canvas initialization to ensure DOM is ready
    this.initializeCanvas();
  }

  // Separate method to initialize the canvas - can be called multiple times if needed
  public initializeCanvas() {
    // Use requestAnimationFrame to ensure DOM updates have completed
    requestAnimationFrame(() => {
      try {
        // Find canvas element
        this.canvas = this.renderRoot.querySelector("canvas");
        if (!this.canvas) {
          console.warn(
            `${this.getId()}: No canvas element found, creating one`
          );
          // If no canvas exists, create one and append it to the render root
          const canvasElement = document.createElement("canvas");
          canvasElement.id = this.id;
          this.renderRoot.appendChild(canvasElement);
          this.canvas = canvasElement;
        }

        // Get 2D context
        this.ctx = this.canvas.getContext("2d");
        if (!this.ctx) {
          console.warn(`${this.getId()}: Could not get 2D context`);
          return;
        }

        // Get dimensions and set up canvas
        const rect = this.getBoundingClientRect();

        const dpr = window.devicePixelRatio ?? 1;

        // Set dimensions, ensure they're at least 1 pixel
        this.canvas.width = Math.max(1, rect.width * dpr);
        this.canvas.height = Math.max(1, rect.height * dpr);
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        // Set up context scaling
        if (this.ctx) {
          this.ctx.resetTransform();
          this.ctx.scale(dpr, dpr);
        }

        // Bind event listeners
        this.bindEventListeners(this.canvas);

        // Initial draw - only if we have valid dimensions
        if (rect.width > 0 && rect.height > 0) {
          this.draw();
        }

        // Set up resize observer if needed
        if (this.useResizeObserver() && !this.resizeObserver) {
          this.resizeObserver = new ResizeObserver((entries) => {
            for (let entry of entries) {
              if (entry.target === this) {
                const { width, height } = entry.contentRect;
                if (width > 0 && height > 0) {
                  this.resize(width, height);
                }
              }
            }
          });
          this.resizeObserver.observe(this);
        }

        // Schedule multiple extra draw calls with increasing delays
        // This helps with complex timing issues in component initialization
        [50, 100, 500].forEach((delay) => {
          setTimeout(() => {
            if (this.canvas && this.ctx) {
              this.draw();
            }
          }, delay);
        });
      } catch (err) {
        console.error(`${this.getId()}: Error initializing canvas`, err);
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

    // First update style dimensions (CSS pixels)
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;

    // Then update actual canvas dimensions (device pixels)
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;

    // Reset any previous transforms
    this.ctx.resetTransform();
    this.ctx.scale(dpr, dpr);

    // Clear the canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw the content
    this.draw();

    // Schedule another redraw with a slight delay
    // This helps with timing issues in complex layout changes
    requestAnimationFrame(() => {
      if (this.canvas && this.ctx) {
        this.draw();
      }
    });
  }

  draw(): void {
    // should be implemented by subclasses
  }
}
