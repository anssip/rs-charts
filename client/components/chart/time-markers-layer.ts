import { LitElement, html, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import {
  TimeMarker,
  TimeMarkerClickedEvent,
  TimeMarkerHoveredEvent,
} from "../../types/trading-overlays";
import { ChartState } from "../..";
import { getLogger, LogLevel } from "../../util/logger";

const logger = getLogger("time-markers-layer");
logger.setLoggerLevel("time-markers-layer", LogLevel.INFO);

/**
 * Layer component for rendering time markers (vertical event lines)
 * Handles rendering vertical lines at specific timestamps with optional labels
 */
@customElement("time-markers-layer")
export class TimeMarkersLayer extends LitElement {
  @property({ type: Array, attribute: false })
  markers: TimeMarker[] = [];

  @property({ type: Object })
  state!: ChartState;

  @property({ type: Number })
  width = 0;

  @property({ type: Number })
  height = 0;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 50; /* Above all chart content including indicators */
      overflow: hidden;
    }

    .markers-container {
      position: relative;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
    }

    .time-marker {
      position: absolute;
      top: 0;
      height: 100%;
      pointer-events: auto;
    }

    .time-marker.interactive {
      cursor: pointer;
    }

    .line-svg {
      position: absolute;
      top: 0;
      width: 1px;
      height: 100%;
      overflow: visible;
    }

    .time-label {
      position: absolute;
      left: 0;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
      pointer-events: none;
      z-index: 1;
      transform: translateX(-50%);
    }

    .time-label.top {
      top: 8px;
    }

    .time-label.bottom {
      bottom: 8px;
    }
  `;

  /**
   * Get visible time markers within the current time range
   */
  private getVisibleMarkers(): TimeMarker[] {
    if (!this.state?.timeRange) return this.markers;

    const { start, end } = this.state.timeRange;
    return this.markers
      .filter((marker) => marker.timestamp >= start && marker.timestamp <= end)
      .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
  }

  /**
   * Convert timestamp to X pixel coordinate
   */
  private timestampToX(timestamp: number): number {
    if (!this.state?.timeRange || this.width === 0) return 0;

    const { start, end } = this.state.timeRange;
    const timeRange = end - start;
    const ratio = (timestamp - start) / timeRange;
    return ratio * this.width;
  }

  /**
   * Get SVG stroke-dasharray for line style
   */
  private getStrokeDashArray(style: "solid" | "dashed" | "dotted"): string {
    switch (style) {
      case "dashed":
        return "8,4";
      case "dotted":
        return "2,3";
      case "solid":
      default:
        return "none";
    }
  }

  /**
   * Handle marker click
   */
  private handleMarkerClick(marker: TimeMarker, event: MouseEvent): void {
    event.stopPropagation();

    const clickEvent: TimeMarkerClickedEvent = {
      markerId: marker.id,
      marker,
    };

    this.dispatchEvent(
      new CustomEvent("time-marker-clicked", {
        detail: clickEvent,
        bubbles: true,
        composed: true,
      }),
    );

    logger.debug(`Time marker clicked: ${marker.id}`);
  }

  /**
   * Handle marker hover
   */
  private handleMarkerHover(marker: TimeMarker): void {
    const hoverEvent: TimeMarkerHoveredEvent = {
      markerId: marker.id,
      marker,
    };

    this.dispatchEvent(
      new CustomEvent("time-marker-hovered", {
        detail: hoverEvent,
        bubbles: true,
        composed: true,
      }),
    );
  }

  /**
   * Render marker label
   */
  private renderLabel(marker: TimeMarker): unknown {
    if (!marker.showLabel || !marker.label) return null;

    const position = marker.labelPosition || "top";

    return html` <div class="time-label ${position}">${marker.label}</div> `;
  }

  render() {
    const visibleMarkers = this.getVisibleMarkers();

    return html`
      <div class="markers-container">
        ${visibleMarkers.map((marker) => {
          const x = this.timestampToX(marker.timestamp);

          return html`
            <div
              class="time-marker ${marker.interactive ? "interactive" : ""}"
              style="left: ${x}px;"
              @click="${(e: MouseEvent) => this.handleMarkerClick(marker, e)}"
              @mouseenter="${() => this.handleMarkerHover(marker)}"
            >
              <svg class="line-svg" style="left: 0; height: ${this.height}px;">
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="${this.height}"
                  stroke="${marker.color}"
                  stroke-width="${marker.lineWidth}"
                  stroke-dasharray="${this.getStrokeDashArray(
                    marker.lineStyle,
                  )}"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              ${this.renderLabel(marker)}
            </div>
          `;
        })}
      </div>
    `;
  }
}
