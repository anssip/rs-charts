import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../context-menu";
import { MenuItem } from "../context-menu";

@customElement("chart-toolbar")
export class ChartToolbar extends LitElement {
  @property({ type: Boolean })
  isFullscreen = false;

  @property({ type: Boolean })
  isFullWindow = false;

  @property({ type: Boolean })
  showVolume = false;

  @state()
  private showIndicatorsMenu = false;

  @state()
  private indicatorsMenuPosition = { x: 0, y: 0 };

  private closeMenuHandler = (e: MouseEvent) => {
    // Don't close if clicking inside the menu
    const path = e.composedPath();
    const isClickInsideMenu = path.some(
      (element) =>
        element instanceof HTMLElement &&
        element.tagName.toLowerCase() === "chart-context-menu"
    );

    if (!isClickInsideMenu) {
      this.showIndicatorsMenu = false;
      document.removeEventListener("click", this.closeMenuHandler);
    }
  };

  private dispatchToggle(type: "fullscreen" | "fullwindow") {
    this.dispatchEvent(
      new CustomEvent(`toggle-${type}`, {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleIndicatorsClick(e: MouseEvent) {
    e.stopPropagation(); // Prevent the click from immediately triggering the document click handler

    // Toggle menu state
    if (this.showIndicatorsMenu) {
      this.showIndicatorsMenu = false;
      document.removeEventListener("click", this.closeMenuHandler);
      return;
    }

    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();

    // Position the menu below the button using viewport coordinates
    this.indicatorsMenuPosition = {
      x: rect.left,
      y: rect.bottom + 4,
    };

    this.showIndicatorsMenu = true;

    // Remove any existing click listener
    document.removeEventListener("click", this.closeMenuHandler);

    // Add the click listener on the next tick
    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 0);
  }

  private toggleVolume() {
    this.showVolume = !this.showVolume;
    this.dispatchEvent(
      new CustomEvent("toggle-volume", {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const indicatorMenuItems: MenuItem[] = [
      {
        isHeader: true,
        label: "Indicators",
      },
      {
        label: "Volume",
        action: () => this.toggleVolume(),
      },
      {
        label: "separator",
        separator: true,
      },
      {
        label: "Add... (Pro)",
        action: () =>
          this.dispatchEvent(
            new CustomEvent("spotcanvas-upgrade", {
              bubbles: true,
              composed: true,
            })
          ),
      },
    ];

    return html`
      <div class="toolbar">
        <div class="tooltip-wrapper">
          <button
            class="toolbar-button ${this.isFullWindow ? "active" : ""}"
            @click=${() => this.dispatchToggle("fullwindow")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 8V4H8M4 16V20H8M16 4H20V8M16 20H20V16"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <span class="tooltip"
              >${this.isFullWindow ? "Exit Full Window" : "Full Window"}</span
            >
          </button>
        </div>

        <div class="tooltip-wrapper">
          <button
            class="toolbar-button ${this.isFullscreen ? "active" : ""}"
            @click=${() => this.dispatchToggle("fullscreen")}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 7V2H7M22 7V2H17M2 17V22H7M22 17V22H17"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <span class="tooltip"
              >${this.isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span
            >
          </button>
        </div>

        <div class="tooltip-wrapper">
          <button
            class="toolbar-button ${this.showIndicatorsMenu ? "active" : ""}"
            @click=${this.handleIndicatorsClick}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 18V7M12 18V11M16 18V15"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            <span class="tooltip">Indicators</span>
          </button>
        </div>

        <div class="tooltip-wrapper">
          <button
            class="toolbar-button"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("spotcanvas-upgrade", {
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM21.41 6.34l-3.75-3.75-2.53 2.54 3.75 3.75 2.53-2.54z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="tooltip">Drawing Tools (Pro)</span>
          </button>
        </div>

        <div class="tooltip-wrapper">
          <button
            class="toolbar-button"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("spotcanvas-upgrade", {
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="tooltip">Assets (Pro)</span>
          </button>
        </div>

        <div class="tooltip-wrapper">
          <button
            class="toolbar-button"
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent("spotcanvas-upgrade", {
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="3"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="tooltip">Chart Settings (Pro)</span>
          </button>
        </div>
      </div>

      <chart-context-menu
        .show=${this.showIndicatorsMenu}
        .position=${this.indicatorsMenuPosition}
        .items=${indicatorMenuItems}
      ></chart-context-menu>
    `;
  }

  static styles = css`
    :host {
      position: relative;
    }

    .toolbar {
      display: flex;
      gap: 8px;
      padding: 2px 8px;
      background: rgba(24, 24, 24, 0.3);
      backdrop-filter: blur(8px);
      border-radius: 8px;
      border: 1px solid rgba(143, 143, 143, 0.2);
      position: relative;
    }

    chart-context-menu {
      position: fixed;
      z-index: 1000;
    }

    .tooltip-wrapper {
      position: relative;
    }

    .tooltip {
      position: absolute;
      bottom: -32px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 8px;
      background: rgba(24, 24, 24, 0.7);
      color: var(--color-accent-2);
      border-radius: 4px;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease;
      border: 1px solid rgba(143, 143, 143, 0.2);
      backdrop-filter: blur(8px);
    }

    .tooltip::before {
      content: "";
      position: absolute;
      top: -4px;
      left: 50%;
      transform: translateX(-50%) rotate(45deg);
      width: 8px;
      height: 8px;
      background: rgba(24, 24, 24, 0.9);
      border-left: 1px solid rgba(143, 143, 143, 0.2);
      border-top: 1px solid rgba(143, 143, 143, 0.2);
    }

    .toolbar-button {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      background: none;
      color: var(--color-accent-2);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
      transition: all 0.2s ease;
      position: relative;
    }

    .toolbar-button:hover {
      background: rgba(143, 143, 143, 0.1);
      transform: scale(1.05);
    }

    .toolbar-button:hover .tooltip {
      opacity: 1;
    }

    .toolbar-button.active {
      color: var(--color-primary);
      background: rgba(93, 91, 237, 0.1);
    }

    .toolbar-button svg {
      width: 20px;
      height: 20px;
    }
  `;
}
