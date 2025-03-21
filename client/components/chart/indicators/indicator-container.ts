import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { CanvasBase } from "../canvas-base";
import { logger } from "../../../util/logger";

@customElement("indicator-container")
export class IndicatorContainer extends LitElement {
  @property({ type: String })
  name?: string;

  private _state: ChartState | null = null;
  private resizeObserver: ResizeObserver | null = null;

  firstUpdated() {
    // Initialize state observation
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.updateChildComponents();
    });

    // Initial update of child components
    this.updateChildComponents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  // private handleResize(width: number, height: number) {
  //   // Get all slotted canvas-based components
  //   const slot = this.renderRoot.querySelector("slot");
  //   if (!slot) return;

  //   const elements = slot.assignedElements();
  //   for (const element of elements) {
  //     if (element instanceof CanvasBase) {
  //       element.resize(width, height);
  //     }
  //   }
  // }

  private updateChildComponents() {
    if (!this._state) return;

    // Get all slotted canvas-based components
    const slot = this.renderRoot.querySelector("slot");
    if (!slot) return;

    const elements = slot.assignedElements();
    for (const element of elements) {
      if (element instanceof CanvasBase) {
        element.draw();
      }
    }
  }

  render() {
    return html`
      <div class="indicator-container">
        <div class="indicator-names">
          ${this.name
            ? html`<div class="indicator-name">${this.name}</div>`
            : ""}
        </div>
        <slot></slot>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
      overflow: visible;
    }

    .indicator-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: visible;
    }

    .indicator-names {
      position: absolute;
      top: 8px;
      left: 8px;
      display: flex;
      flex-direction: column;
      gap: 4px;
      z-index: 2;
    }

    .indicator-name {
      font-size: 11px;
      color: var(--color-accent-2);
      font-family: var(--font-secondary);
      font-weight: 500;
      opacity: 0.7;
      white-space: nowrap;
    }

    /* When multiple indicators are overlaid, stack names vertically */
    :host(.overlay-indicators) .indicator-name {
      position: static;
      margin: 4px 8px;
    }

    ::slotted(*) {
      position: absolute;
      top: 0;
      left: 0;
      right: 0; /* Add right: 0 to ensure full width */
      width: 100%;
      height: 100%;
      overflow: visible; /* Allow content to overflow */
      flex: 1 1 auto;
    }
  `;
}
