import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import "../context-menu";
import { MenuItem } from "../context-menu";
import { config } from "../../../config";
import { ChartContainer } from "../chart-container";

@customElement("chart-toolbar")
export class ChartToolbar extends LitElement {
  @property({ type: Boolean })
  isFullscreen = false;

  @property({ type: Boolean })
  isFullWindow = false;

  @property({ type: Boolean })
  showVolume = false;

  @property({ type: Object })
  container?: ChartContainer;

  @state()
  private activeIndicators: Set<string> = new Set();

  @state()
  private showIndicatorsMenu = false;

  @state()
  private indicatorsMenuPosition = { x: 0, y: 0 };

  private mobileMediaQuery = window.matchMedia("(max-width: 767px)");
  private isMobile = this.mobileMediaQuery.matches;

  constructor() {
    super();
    this.isMobile = this.mobileMediaQuery.matches;
    this.mobileMediaQuery.addEventListener("change", this.handleMobileChange);
  }

  private handleMobileChange = (e: MediaQueryListEvent) => {
    this.isMobile = e.matches;
    this.requestUpdate();
  };

  // Store the event listener so we can remove it properly
  private toggleIndicatorListener = () => {
    // Give a small delay to let the container update
    setTimeout(() => this.updateActiveIndicators(), 50);
  };

  connectedCallback() {
    super.connectedCallback();

    // Listen for toggle-indicator events to update our state
    document.addEventListener("toggle-indicator", this.toggleIndicatorListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mobileMediaQuery.removeEventListener(
      "change",
      this.handleMobileChange
    );

    // Remove event listener using the same function reference
    document.removeEventListener(
      "toggle-indicator",
      this.toggleIndicatorListener
    );
  }

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
    const eventName =
      type === "fullscreen" ? "toggle-fullscreen" : "toggle-fullwindow";
    this.dispatchEvent(
      new CustomEvent(eventName, {
        bubbles: true,
        composed: true,
        detail: { type },
        cancelable: true,
      })
    );
  }

  private handleIndicatorsClick(e: MouseEvent) {
    e.stopPropagation();

    if (this.showIndicatorsMenu) {
      this.showIndicatorsMenu = false;
      document.removeEventListener("click", this.closeMenuHandler);
      return;
    }

    // Update active indicators before showing the menu
    this.updateActiveIndicators();

    const button = e.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const toolbarRect = this.renderRoot
      .querySelector(".toolbar")
      ?.getBoundingClientRect();

    // Position the menu below the button, accounting for toolbar's position
    this.indicatorsMenuPosition = {
      x: rect.left - (toolbarRect?.left || 0),
      y: rect.height + 4,
    };

    this.showIndicatorsMenu = true;

    document.removeEventListener("click", this.closeMenuHandler);
    setTimeout(() => {
      document.addEventListener("click", this.closeMenuHandler);
    }, 0);
  }

  private hideTooltips() {
    const tooltips = this.renderRoot.querySelectorAll(".tooltip");
    tooltips.forEach((tooltip) => {
      (tooltip as HTMLElement).style.opacity = "0";
    });
  }

  updated(changedProperties: Map<string, unknown>) {
    super.updated?.(changedProperties);

    if (
      changedProperties.has("container") ||
      changedProperties.has("showVolume")
    ) {
      this.updateActiveIndicators();
    }
  }

  private updateActiveIndicators() {
    if (!this.container) return;

    // Clear and rebuild the set
    this.activeIndicators.clear();

    // Add all visible indicators from the container
    const builtInIndicators = config.getBuiltInIndicators(this.container);
    builtInIndicators.forEach((item) => {
      if (item.separator || item.isHeader) return;

      const indicatorId = item.label.toLowerCase().replace(/\s+/g, "-");
      if (this.container?.isIndicatorVisible(indicatorId)) {
        this.activeIndicators.add(indicatorId);
      }
    });

    // Volume indicator is special - use the container's isIndicatorVisible method
    this.showVolume = this.container.isIndicatorVisible("volume");
  }

  render() {
    if (!this.container) {
      console.warn("ChartToolbar: No container provided");
      return html``;
    }

    // Update active indicators on each render
    this.updateActiveIndicators();

    const indicatorMenuItems: MenuItem[] = [
      {
        isHeader: true,
        label: "Indicators",
      },
      // Transform the built-in indicators to have active state
      ...config.getBuiltInIndicators(this.container).map((item) => {
        // Skip separators and headers
        if (item.separator || item.isHeader) {
          return item;
        }

        // For Volume indicator, check showVolume property
        if (item.label === "Volume") {
          // Clone the original action instead of replacing it
          const isActive = this.showVolume;
          return {
            ...item,
            active: isActive,
          };
        }

        // For other indicators, check our local activeIndicators set
        const indicatorId = item.label.toLowerCase().replace(/\s+/g, "-");
        const isActive = this.activeIndicators.has(indicatorId);

        return {
          ...item,
          active: isActive,
        };
      }),
    ];

    return html`
      <div class="toolbar">
        <div class="tooltip-wrapper">
          <button
            class="toolbar-button ${this.isFullWindow ? "active" : ""}"
            @click=${(e: Event) => {
              e.stopPropagation();
              e.preventDefault();
              this.hideTooltips();
              this.dispatchToggle("fullwindow");
            }}
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

        ${!this.isMobile
          ? html`
              <div class="tooltip-wrapper">
                <button
                  class="toolbar-button ${this.isFullscreen ? "active" : ""}"
                  @click=${(e: Event) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this.hideTooltips();
                    this.dispatchToggle("fullscreen");
                  }}
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
                    >${this.isFullscreen
                      ? "Exit Fullscreen"
                      : "Fullscreen"}</span
                  >
                </button>
              </div>
            `
          : ""}

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
      </div>

      <chart-context-menu
        .show=${this.showIndicatorsMenu}
        .position=${this.indicatorsMenuPosition}
        .items=${indicatorMenuItems}
        @menu-close=${() => {
          this.showIndicatorsMenu = false;
          document.removeEventListener("click", this.closeMenuHandler);

          // Update indicators after the menu closes (for toggles)
          setTimeout(() => this.updateActiveIndicators(), 50);
        }}
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
      outline: none;
    }

    .toolbar-button:hover {
      background: rgba(143, 143, 143, 0.1);
      transform: scale(1.05);
    }

    .toolbar-button:focus {
      background: rgba(143, 143, 143, 0.1);
      box-shadow: -1px -1px 6px rgba(0, 0, 0, 0.4),
        1px -1px 6px rgba(0, 0, 0, 0.4), -1px 1px 6px rgba(0, 0, 0, 0.4),
        1px 1px 6px rgba(0, 0, 0, 0.4), -1px -1px 4px var(--color-accent-1),
        1px -1px 4px var(--color-accent-1), -1px 1px 4px var(--color-accent-1),
        1px 1px 4px var(--color-accent-1);
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
