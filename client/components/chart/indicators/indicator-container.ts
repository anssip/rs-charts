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

    // Set up resize observer
    this.resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === this) {
          const { width, height } = entry.contentRect;
          this.handleResize(width, height);
        }
      }
    });
    this.resizeObserver.observe(this);

    // Initial update of child components
    this.updateChildComponents();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }

  private handleResize(width: number, height: number) {
    // Get all slotted canvas-based components
    const slot = this.renderRoot.querySelector("slot");
    if (!slot) return;

    const elements = slot.assignedElements();
    for (const element of elements) {
      if (element instanceof CanvasBase) {
        element.resize(width, height);
      }
    }
  }

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
    }

    .indicator-container {
      width: 100%;
      height: 100%;
      position: relative;
    }

    ::slotted(*) {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
  `;
}
