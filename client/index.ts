import { elements } from "xinjs";
import "./components/chart/chart-container";
import "./components/chart/chart";
import "./components/chart/timeline";
import { ChartContainer } from "./components/chart/chart-container";
import { IndicatorConfig } from "./components/chart/indicators/indicator-types";
import { logger, setProductionLogging } from "./util/logger";
import { initChart } from "./init";
import {
  PriceRange,
  PriceHistory,
  TimeRange,
  Granularity,
} from "../server/services/price-data/price-history-model";
import { LiveCandle } from "./api/live-candle-subscription";
import { initializeApp } from "firebase/app";

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

declare global {
  interface Window {
    spotcanvas?: {
      setProductionMode: (isProduction: boolean) => void;
      log: (level: string, message: string, ...args: any[]) => void;
    };
  }
}

if (process.env.NODE_ENV === "production") {
  setProductionLogging();
  logger.info("Running in production mode - minimal logging enabled");
} else {
  logger.info("Running in development mode - verbose logging enabled");
}

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

const firebaseConfig = {
  projectId: "spotcanvas-prod",
  apiKey: "YOUR_API_KEY",
  authDomain: "spotcanvas-prod.firebaseapp.com",
};

window.addEventListener("DOMContentLoaded", () => {
  const parentContainer = document.querySelector(
    ".chart-container",
  ) as HTMLElement;
  if (!parentContainer) {
    logger.error(
      "Chart container parent element (.chart-container) not found in the DOM.",
    );
    return;
  }

  const chartContainerElement: ChartContainer = elements.chartContainer();

  if (parentContainer.hasAttribute("data-spotcanvas-require-activation")) {
    chartContainerElement.setAttribute("require-activation", "");
  }

  parentContainer.innerHTML = "";
  parentContainer.append(chartContainerElement);
  logger.info("Chart container element created and appended.");

  const firebaseApp = initializeApp(firebaseConfig);
  initChart(chartContainerElement, firebaseApp);
  logger.info("Chart application started via initChart.");

  const updateChartHeight = () => {
    const computedStyle = getComputedStyle(parentContainer);
    parentContainer.style.setProperty(
      "--spotcanvas-chart-height",
      computedStyle.height,
    );
  };
  updateChartHeight();
  const resizeObserver = new ResizeObserver(updateChartHeight);
  resizeObserver.observe(parentContainer);

  const popup = document.querySelector(".upgrade-popup") as HTMLElement | null;
  const backdrop = document.querySelector(
    ".upgrade-backdrop",
  ) as HTMLElement | null;
  const upgradeButton = document.querySelector(
    ".upgrade-button",
  ) as HTMLElement | null;

  if (popup && backdrop && upgradeButton) {
    const hidePopup = () => {
      popup.classList.remove("show");
      backdrop.classList.remove("show");
    };
    const showPopup = () => {
      popup.classList.add("show");
      backdrop.classList.add("show");
    };

    chartContainerElement.addEventListener("spotcanvas-upgrade", () => {
      logger.debug("Received spotcanvas-upgrade event, showing popup.");
      showPopup();
    });

    backdrop.addEventListener("click", hidePopup);
    upgradeButton.addEventListener("click", () => {
      hidePopup();
      if (window.spotcanvas?.log) {
        window.spotcanvas.log("info", "Upgrade clicked");
      } else {
        console.log("Upgrade clicked");
      }
    });
    logger.info("Upgrade popup listeners initialized.");
  } else {
    logger.error("Upgrade popup elements not found in the DOM.");
  }
});
