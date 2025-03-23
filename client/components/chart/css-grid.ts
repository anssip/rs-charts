import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("css-grid")
export class CssGrid extends LitElement {
  @property({ type: Number })
  horizontalLines: number = 5;

  @property({ type: Number })
  verticalLines: number = 5;

  @property({ type: String })
  lineColor: string = "rgba(54, 60, 78, 0.5)";

  @property({ type: String })
  lineStyle: "solid" | "dashed" | "dotted" = "solid";

  @property({ type: Number })
  lineWidth: number = 1;

  @property({ type: Boolean })
  dynamicGrid: boolean = true;

  /**
   * Generate an SVG data URL for creating dashed or dotted line patterns
   */
  private generateSvgPatternUrl(
    direction: "horizontal" | "vertical",
    style: "dashed" | "dotted" | "solid" = "solid"
  ): string {
    // For solid lines, we'll use regular linear-gradient
    if (style === "solid") return "";

    const encodedColor = encodeURIComponent(this.lineColor);
    const dashLength = style === "dashed" ? 5 : 1;
    const gapLength = style === "dashed" ? 3 : 2;

    let svg = "";
    if (direction === "horizontal") {
      // Horizontal line (width: 100%, height: 1px)
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${
        this.lineWidth
      }px">
        <line x1="0" y1="${this.lineWidth / 2}" x2="100%" y2="${
        this.lineWidth / 2
      }" stroke="${this.lineColor}" 
              stroke-width="${
                this.lineWidth
              }" stroke-dasharray="${dashLength},${gapLength}" />
      </svg>`;
    } else {
      // Vertical line (width: 1px, height: 100%)
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
        this.lineWidth
      }px" height="100%">
        <line x1="${this.lineWidth / 2}" y1="0" x2="${
        this.lineWidth / 2
      }" y2="100%" stroke="${this.lineColor}" 
              stroke-width="${
                this.lineWidth
              }" stroke-dasharray="${dashLength},${gapLength}" />
      </svg>`;
    }

    // Convert to data URL
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }

  render() {
    // Set CSS variables for dynamic grid
    this.style.setProperty("--h-grid-count", `${this.horizontalLines}`);
    this.style.setProperty("--v-grid-count", `${this.verticalLines}`);
    this.style.setProperty("--chart-grid-line-color", this.lineColor);
    this.style.setProperty("--line-width", `${this.lineWidth}px`);

    // For dashed or dotted lines, we need to use SVG patterns
    if (this.lineStyle !== "solid") {
      this.style.setProperty(
        "--h-grid-pattern",
        this.generateSvgPatternUrl("horizontal", this.lineStyle)
      );
      this.style.setProperty(
        "--v-grid-pattern",
        this.generateSvgPatternUrl("vertical", this.lineStyle)
      );

      return html`<div class="grid pattern-grid"></div>`;
    }

    return html`<div
      class="grid ${this.dynamicGrid ? "dynamic-grid" : ""}"
    ></div>`;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      --line-width: 1px;
    }

    .grid {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: -1;
      background: transparent !important;
    }

    .dynamic-grid {
      /* Use CSS variables from the host element */
      background-image: repeating-linear-gradient(
          to bottom,
          transparent 0,
          transparent calc((100% / var(--h-grid-count)) - var(--line-width)),
          var(--chart-grid-line-color)
            calc((100% / var(--h-grid-count)) - var(--line-width)),
          var(--chart-grid-line-color) calc(100% / var(--h-grid-count))
        ),
        repeating-linear-gradient(
          to right,
          transparent 0,
          transparent calc((100% / var(--v-grid-count)) - var(--line-width)),
          var(--chart-grid-line-color)
            calc((100% / var(--v-grid-count)) - var(--line-width)),
          var(--chart-grid-line-color) calc(100% / var(--v-grid-count))
        );
    }

    .pattern-grid {
      /* For dashed/dotted styles we use the SVG background pattern */
      background-image: none;
      background-size: 100% calc(100% / var(--h-grid-count)),
        calc(100% / var(--v-grid-count)) 100%;
      background-position: 0 0, 0 0;
      background-repeat: repeat-y, repeat-x;
    }

    /* Create dynamic positioning of the SVG background patterns */
    .pattern-grid::before,
    .pattern-grid::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: -1; /* Place behind everything */
    }

    .pattern-grid::before {
      /* Horizontal lines */
      background-image: var(--h-grid-pattern);
      background-size: 100% calc(100% / var(--h-grid-count));
      background-repeat: repeat-y;
    }

    .pattern-grid::after {
      /* Vertical lines */
      background-image: var(--v-grid-pattern);
      background-size: calc(100% / var(--v-grid-count)) 100%;
      background-repeat: repeat-x;
    }
  `;
}
