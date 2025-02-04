import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { CanvasBase } from "../canvas-base";

@customElement("indicator-container")
export class IndicatorContainer extends LitElement {
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
      overflow: visible; /* Allow content to overflow */
    }

    .indicator-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: visible; /* Allow content to overflow */
    }

    ::slotted(*) {
      position: absolute;
      top: 0;
      left: 0;
      right: 0; /* Add right: 0 to ensure full width */
      width: 100%;
      height: 100%;
      overflow: visible; /* Allow content to overflow */
    }
  `;
}
