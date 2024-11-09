import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { CandleDataByTimestamp } from "../../../server/services/price-data/price-history-model";
import "./chart";
import "./timeline";
import { Timeline } from "./timeline";
import { CandlestickChart } from "./chart";

@customElement("chart-container")
export class ChartContainer extends LitElement {
  private _data: CandleDataByTimestamp = new Map();

  constructor() {
    super();
    console.log("ChartContainer: Constructor called");
  }

  connectedCallback() {
    super.connectedCallback();
    console.log("ChartContainer: Connected to DOM");
  }

  firstUpdated() {
    console.log("ChartContainer: First update completed");

    // Forward chart-ready and chart-pan events from the candlestick chart
    const chart = this.renderRoot.querySelector("candlestick-chart");
    if (chart) {
      chart.addEventListener("chart-ready", (e: Event) => {
        console.log(
          "ChartContainer: Chart ready event received",
          (e as CustomEvent).detail
        );
        this.dispatchEvent(
          new CustomEvent("chart-ready", {
            detail: (e as CustomEvent).detail,
            bubbles: true,
            composed: true,
          })
        );
      });

      chart.addEventListener("chart-pan", (e: Event) => {
        console.log(
          "ChartContainer: Chart pan event received",
          (e as CustomEvent).detail
        );
        this.dispatchEvent(
          new CustomEvent("chart-pan", {
            detail: (e as CustomEvent).detail,
            bubbles: true,
            composed: true,
          })
        );
      });
    }
  }

  @property({ type: Object })
  get data(): CandleDataByTimestamp {
    return this._data;
  }

  set data(newData: CandleDataByTimestamp) {
    this._data = newData;

    console.log("ChartContainer: Setting new data:", {
      size: newData.size,
      firstKey: Array.from(newData.keys())[0],
      lastKey: Array.from(newData.keys())[newData.size - 1],
    });

    // Forward data to the candlestick chart and timeline
    const chart: CandlestickChart | null = this.renderRoot.querySelector("candlestick-chart");
    const timeline: Timeline | null = this.renderRoot.querySelector("chart-timeline");

    if (chart) {
      (chart as any).data = newData;
      if (timeline) {
        chart.timeline = timeline;
      } else {
        console.error("Timeline component not found");
      }
    }
    this.requestUpdate("data", newData);
  }

  render() {
    return html`
      <div class="container">
        <div class="toolbar-top"></div>
        <div class="toolbar-left"></div>
        <div class="toolbar-right"></div>
        <div class="chart">
          <candlestick-chart
            @viewport-change=${this.handleViewportChange}
          ></candlestick-chart>
        </div>
        <div class="timeline">
          <chart-timeline></chart-timeline>
        </div>
      </div>
    `;
  }

  private handleViewportChange(e: CustomEvent) {
    const timeline: Timeline | null =
      this.renderRoot.querySelector("chart-timeline");
    if (!timeline) {
      console.warn("Timeline component not found");
      return;
    }

    const { viewportStartTimestamp, viewportEndTimestamp, visibleTimestamps } =
      e.detail;

    // Validate timestamps
    if (!viewportStartTimestamp || !viewportEndTimestamp) {
      console.warn("Invalid viewport timestamps received:", {
        start: viewportStartTimestamp,
        end: viewportEndTimestamp,
      });
      return;
    }

    console.log("ChartContainer: Viewport change", {
      timestampsCount: visibleTimestamps.length,
      start: new Date(viewportStartTimestamp),
      end: new Date(viewportEndTimestamp),
      startTimestamp: viewportStartTimestamp,
      endTimestamp: viewportEndTimestamp,
    });

    const chart = this.renderRoot.querySelector("candlestick-chart");
    timeline.options = chart
      ? {
        candleWidth: (chart as any).options.candleWidth,
        candleGap: (chart as any).options.candleGap,
      }
      : {
        candleWidth: 5,
        candleGap: 1,
      };
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }
    .container {
      display: grid;
      width: 100%;
      height: 100%;
      grid-template-areas:
        "top-tb top-tb top-tb"
        "left-tb chart right-tb"
        "left-tb timeline right-tb";
      grid-template-columns: 50px 1fr 50px;
      grid-template-rows: 40px 1fr 80px;
      gap: 1px;
      background-color: #f5f5f5;
    }
    .toolbar-top {
      grid-area: top-tb;
      background: white;
    }
    .toolbar-left {
      grid-area: left-tb;
      background: white;
    }
    .toolbar-right {
      grid-area: right-tb;
      background: white;
    }
    .chart {
      grid-area: chart;
      background: white;
      overflow: hidden;
      position: relative;
      height: 100%;
      min-height: 600px;
    }
    .timeline {
      grid-area: timeline;
      background: white;
      overflow: hidden;
      position: relative;
    }
    candlestick-chart {
      display: block;
      width: 100%;
      height: 100%;
      position: absolute;
      top: 0;
      left: 0;
    }
    chart-timeline {
      display: block;
      width: 100%;
      height: 100%;
    }
  `;
}
