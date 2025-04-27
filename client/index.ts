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
import { IndicatorConfig } from "./components/chart/indicators/indicator-types";
import { logger, setProductionLogging } from "./util/logger";

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
  indicators?: IndicatorConfig[];
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
  indicators: [],
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
    spotcanvas?: {
      setProductionMode: (isProduction: boolean) => void;
      log: (level: string, message: string, ...args: any[]) => void;
    };
  }
}

// Initialize logger settings
if (process.env.NODE_ENV === "production") {
  setProductionLogging();
  logger.info("Running in production mode - minimal logging enabled");
} else {
  logger.info("Running in development mode - verbose logging enabled");
}

// Make logger settings available globally
window.spotcanvas = {
  setProductionMode: (isProduction) => {
    if (isProduction) {
      setProductionLogging();
      logger.info("Switched to production logging mode");
    } else {
      logger.info("Switched to development logging mode");
    }
  },
  log: (level, message, ...args) => {
    switch (level) {
      case "debug":
        logger.debug(message, ...args);
        break;
      case "info":
        logger.info(message, ...args);
        break;
      case "warn":
        logger.warn(message, ...args);
        break;
      case "error":
        logger.error(message, ...args);
        break;
      default:
        logger.info(message, ...args);
    }
  },
};

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
  logger.info("Chart application initialized");

  window.addEventListener("pagehide", () => {
    chartApp.cleanup();
    logger.debug("Application cleanup triggered on page hide");
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      chartApp.cleanup();
      logger.debug(
        "Application cleanup triggered on visibility change to hidden"
      );
    }
    if (document.visibilityState === "visible") {
      chartApp.fetchGaps();
      logger.debug("Fetching data gaps on visibility change to visible");
    }
  });
});

const container = document.querySelector(".chart-container") as HTMLElement;
const existingChart = container?.querySelector(
  "chart-container"
) as ChartContainer;

if (container) {
  // Set chart height from computed style and observe changes
  const updateChartHeight = () => {
    const computedStyle = getComputedStyle(container);
    container.style.setProperty(
      "--spotcanvas-chart-height",
      computedStyle.height
    );
  };

  // Initial height set
  updateChartHeight();

  // Observe container size changes
  const resizeObserver = new ResizeObserver(updateChartHeight);
  resizeObserver.observe(container);

  if (!existingChart) {
    const chartContainerElement: ChartContainer = elements.chartContainer();
    if (container.hasAttribute("data-spotcanvas-require-activation")) {
      chartContainerElement.setAttribute("require-activation", "");
    }
    chartContainerElement.state = state;
    container.append(chartContainerElement);
    logger.info("New chart container created and appended");
  } else {
    if (container.hasAttribute("data-spotcanvas-require-activation")) {
      existingChart.setAttribute("require-activation", "");
    }
    existingChart.state = state;
    logger.info("Using existing chart container");
  }
}
