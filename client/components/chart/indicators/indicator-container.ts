import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { observe, xin } from "xinjs";
import { ChartState } from "../../..";
import { CanvasBase } from "../canvas-base";
import { LogLevel, getLogger } from "../../../util/logger";

const logger = getLogger("IndicatorContainer");
logger.setLoggerLevel("IndicatorContainer", LogLevel.INFO);

@customElement("indicator-container")
export class IndicatorContainer extends LitElement {
  @property({ type: String })
  name?: string;

  @state()
  private childIndicatorNames: string[] = [];

  private _state: ChartState | null = null;
  private resizeObserver: ResizeObserver | null = null;

  firstUpdated() {
    // Initialize state observation
    observe("state", () => {
      this._state = xin["state"] as ChartState;
      this.updateChildComponents();
    });

    // Set up resize observer to redraw when container size changes
    this.resizeObserver = new ResizeObserver(() => {
      this.updateChildComponents();
    });
    this.resizeObserver.observe(this);

    // Initial update of child components
    this.updateChildComponents();

    // Collect initial indicator names
    this.collectIndicatorNames();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
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

  private collectIndicatorNames() {
    const names: string[] = [];
    const slot = this.renderRoot.querySelector("slot");

    if (slot) {
      const elements = slot.assignedElements();
      logger.debug(`Found ${elements.length} slotted elements`);

      for (const element of elements) {
        // Check if the element is a market-indicator with a name property
        if (
          element.tagName.toLowerCase() === "market-indicator" &&
          "name" in element
        ) {
          const name = (element as any).name;
          if (name) {
            logger.debug(`Found indicator with name: ${name}`);
            names.push(name);
          }
        }
      }
    }

    this.childIndicatorNames = names;
    logger.debug("Collected indicator names:", this.childIndicatorNames);
    this.requestUpdate();
  }

  // Listen for slotchange events to update names when children change
  private handleSlotChange() {
    logger.debug("Slot content changed, collecting indicator names");
    this.collectIndicatorNames();
  }

  render() {
    logger.debug("Rendering IndicatorContainer with name:", this.name);
    return html`
      <div class="indicator-container">
        <div class="indicator-names">
          ${this.name
            ? html`<div class="indicator-name">${this.name}</div>`
            : ""}
          ${this.childIndicatorNames.map(
            (name) => html`<div class="indicator-name">${name}</div>`
          )}
        </div>
        <slot @slotchange=${this.handleSlotChange}></slot>
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
      z-index: 10;
    }

    .indicator-name {
      font-size: 11px;
      color: var(--color-accent-2);
      font-family: var(--font-secondary);
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
