import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("spot-button")
export class Button extends LitElement {
  @property({ type: String })
  label = "";

  @property({ type: String })
  value = "";

  @property({ type: Boolean, reflect: true })
  compact = false;

  render() {
    const showLabel = !this.compact && this.label;

    return html`
      <button class="button ${this.compact ? "compact" : ""}" part="button">
        ${showLabel
          ? html`<span class="button-label" part="label">${this.label}</span>`
          : ""}
        <span class="button-value" part="value">${this.value}</span>
      </button>
    `;
  }

  static styles = css`
    .button {
      cursor: pointer;
      transition: all 0.2s ease;
      background: rgba(24, 26, 27, 0.9);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
      padding: 6px 0;
      font-size: 14px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      width: 100px;
      box-shadow: -1px -1px 2px rgba(0, 0, 0, 0.2),
        1px -1px 2px rgba(0, 0, 0, 0.2), -1px 1px 2px rgba(0, 0, 0, 0.2),
        1px 1px 2px rgba(0, 0, 0, 0.2),
        -1px -1px 1px var(--color-accent-1, rgba(255, 255, 255, 0.03)),
        1px -1px 1px var(--color-accent-1, rgba(255, 255, 255, 0.03)),
        -1px 1px 1px var(--color-accent-1, rgba(255, 255, 255, 0.03)),
        1px 1px 1px var(--color-accent-1, rgba(255, 255, 255, 0.03));
      backdrop-filter: blur(8px);
      outline: none;
    }

    .button:focus {
      border-color: var(--color-accent-1);
      box-shadow: -1px -1px 6px rgba(0, 0, 0, 0.4),
        1px -1px 6px rgba(0, 0, 0, 0.4), -1px 1px 6px rgba(0, 0, 0, 0.4),
        1px 1px 6px rgba(0, 0, 0, 0.4), -1px -1px 4px var(--color-accent-1),
        1px -1px 4px var(--color-accent-1), -1px 1px 4px var(--color-accent-1),
        1px 1px 4px var(--color-accent-1);
    }

    .button:hover {
      border-color: var(--color-accent-1);
      background: rgba(24, 26, 27, 0.95);
      box-shadow: -1px -1px 6px rgba(0, 0, 0, 0.4),
        1px -1px 6px rgba(0, 0, 0, 0.4), -1px 1px 6px rgba(0, 0, 0, 0.4),
        1px 1px 6px rgba(0, 0, 0, 0.4),
        -1px -1px 4px var(--color-accent-1, rgba(255, 255, 255, 0.1)),
        1px -1px 4px var(--color-accent-1, rgba(255, 255, 255, 0.1)),
        -1px 1px 4px var(--color-accent-1, rgba(255, 255, 255, 0.1)),
        1px 1px 4px var(--color-accent-1, rgba(255, 255, 255, 0.1));
    }

    .button.compact {
      flex-direction: row;
      padding: 4px 8px;
      width: auto;
      min-width: fit-content;
      gap: 6px;
      white-space: nowrap;
      width: 100%;
    }

    .button-label {
      font-size: 11px;
      color: var(--color-background-secondary);
      text-transform: uppercase;
    }

    .button-value {
      color: var(--color-accent-2);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .compact .button-value {
      font-size: 13px;
    }
  `;
}
