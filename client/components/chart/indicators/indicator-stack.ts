import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { IndicatorState } from "../chart-container";
import "../indicators/indicator-container";

@customElement("indicator-stack")
export class IndicatorStack extends LitElement {
  @property({ type: Array })
  indicators: IndicatorState[] = [];

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      min-height: 150px;
      background: var(--chart-background-color, #131722);
    }

    .stack-item {
      flex: 1;
      min-height: 150px;
      position: relative;
      border-top: 1px solid var(--chart-grid-line-color, #363c4e);
    }

    .stack-item:first-child {
      border-top: none;
    }

    indicator-container {
      width: 100%;
      height: 100%;
    }
  `;

  render() {
    console.log("Rendering indicator stack with indicators:", this.indicators);
    return html`
      ${this.indicators.map(
        (indicator) => html`
          <div class="stack-item">
            <indicator-container>
              ${new indicator.class({
                indicatorId: indicator.id,
              })}
            </indicator-container>
          </div>
        `
      )}
    `;
  }
}
