import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../indicators/indicator-container";
import { IndicatorConfig } from "./indicator-types";

@customElement("indicator-stack")
export class IndicatorStack extends LitElement {
  @property({ type: Array })
  indicators: IndicatorConfig[] = [];

  @property({ type: Number })
  valueAxisWidth = 70;

  @property({ type: Number })
  valueAxisMobileWidth = 45;

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

    .indicator-name {
      position: absolute;
      top: 8px;
      left: 8px;
      font-size: 11px;
      color: var(--color-accent-2);
      font-family: var(--font-secondary);
      font-weight: 500;
      opacity: 0.7;
      z-index: 2;
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
            ${indicator.name
              ? html`<div class="indicator-name">${indicator.name}</div>`
              : ""}
            <indicator-container>
              ${new indicator.class({
                indicatorId: indicator.id,
                scale: indicator.scale,
                valueAxisWidth: this.valueAxisWidth,
                valueAxisMobileWidth: this.valueAxisMobileWidth,
              })}
            </indicator-container>
          </div>
        `
      )}
    `;
  }
}
