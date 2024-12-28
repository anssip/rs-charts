import { elements, xinProxy } from "xinjs";
import "./components/chart/chart-container";
import "./components/chart/chart";
import "./components/chart/timeline";
import { App } from "./app";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { PriceRangeImpl } from "./util/price-range";
import {
  Granularity,
  PriceHistory,
  PriceRange,
  SimplePriceHistory,
  TimeRange,
} from "../server/services/price-data/price-history-model";
import { LiveCandle } from "./api/live-candle-subscription";
import { ChartContainer } from "./components/chart/chart-container";

export type ChartState = {
  priceRange: PriceRange;
  priceHistory: PriceHistory;
  timeRange: TimeRange;
  liveCandle: LiveCandle | null;
  canvasWidth: number;
  canvasHeight: number;
  symbol: string;
  granularity: Granularity;
  loading?: boolean;
};

const chartState: ChartState = {
  priceRange: new PriceRangeImpl(0, 100),
  priceHistory: new SimplePriceHistory("ONE_HOUR", new Map()),
  timeRange: { start: 0, end: 0 },
  liveCandle: null,
  canvasWidth: 0,
  canvasHeight: 0,
  symbol: "BTC-USD",
  granularity: "ONE_HOUR",
  loading: false,
};

const { state } = xinProxy(
  {
    state: chartState,
  },
  true
);

declare global {
  interface Window {
    app: typeof chartState;
  }
}

window.app = state;

const firebaseConfig = {
  projectId: "spotcanvas-prod",
  apiKey: "AIzaSyB6H5Fy06K_iiOjpJdU9xaR57Kia31ribM",
  authDomain: "spotcanvas-prod.firebaseapp.com",
};

const firebaseApp = initializeApp(firebaseConfig);
const firestore = getFirestore(firebaseApp);

window.addEventListener("DOMContentLoaded", () => {
  const chartApp = new App(firestore, state);

  window.addEventListener("pagehide", () => {
    chartApp.cleanup();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      chartApp.cleanup();
    }
    if (document.visibilityState === "visible") {
      chartApp.fetchGaps();
    }
  });
});

const container = document.querySelector(".chart-container");
if (container) {
  const chartContainerElement: ChartContainer = elements.chartContainer();

  chartContainerElement.state = state;

  container.append(chartContainerElement);
}
