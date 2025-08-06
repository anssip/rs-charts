import { elements } from "xinjs";
import "./components/chart/chart-container";
import "./components/chart/chart";
import "./components/chart/timeline";
import "./components/chart/toolbar/product-select";
import "./components/common/symbol-manager";
import { ChartContainer } from "./components/chart/chart-container";
import {
  IndicatorConfig,
  DisplayType,
  ScaleType,
  GridStyle,
} from "./components/chart/indicators/indicator-types";
import { logger, setProductionLogging } from "./util/logger";
import { initChartWithApi } from "./init";
import { MarketIndicator } from "./components/chart/indicators/market-indicator";
import {
  PriceRange,
  PriceHistory,
  TimeRange,
  Granularity,
} from "../server/services/price-data/price-history-model";
import { LiveCandle } from "./api/live-candle-subscription";
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { StarredSymbolsService } from "./api/starred-symbols-service";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { SymbolManager } from "./components/common/symbol-manager";
import { ProductSelect } from "./components/chart/toolbar/product-select";
import { TrendLine } from "./types/trend-line";

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
  trendLines?: TrendLine[];
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
  apiKey: "AIzaSyDkDBUUnxUqV3YZBm9GOrkcULZjBT4azyc",
  authDomain: "spotcanvas-prod.firebaseapp.com",
  projectId: "spotcanvas-prod",
  storageBucket: "spotcanvas-prod.firebasestorage.app",
  messagingSenderId: "346028322665",
  appId: "1:346028322665:web:f278b8364243d165f8d7f8",
};

// Default indicators configuration
const defaultIndicators: IndicatorConfig[] = [
  {
    id: "rsi",
    name: "RSI",
    visible: true,
    params: { period: 14 },
    display: DisplayType.StackBottom,
    class: MarketIndicator,
    scale: ScaleType.Percentage,
    gridStyle: GridStyle.PercentageOscillator,
    oscillatorConfig: {
      levels: [0, 30, 50, 70, 100],
      thresholds: [30, 70],
    },
  },
  {
    id: "bollinger-bands",
    name: "Bollinger Bands",
    visible: true,
    params: { period: 20, stdDev: 2 },
    display: DisplayType.Overlay,
    class: MarketIndicator,
    scale: ScaleType.Price,
  },
];

window.addEventListener("DOMContentLoaded", () => {
  const chartContainer1 = document.querySelector("#chart-1") as HTMLElement;
  const chartContainer2 = document.querySelector("#chart-2") as HTMLElement;

  if (!chartContainer1) {
    logger.error("Chart container element (#chart-1) not found in the DOM.");
    return;
  }

  // Initialize first chart
  const chartContainerElement1: ChartContainer = elements.chartContainer();
  if (chartContainer1.hasAttribute("data-spotcanvas-require-activation")) {
    chartContainerElement1.setAttribute("require-activation", "");
  }
  chartContainer1.innerHTML = "";
  chartContainer1.append(chartContainerElement1);

  const firebaseApp = initializeApp(firebaseConfig);
  const firestore = getFirestore(firebaseApp);
  const auth = getAuth(firebaseApp);

  // Initialize starred symbols service
  let starredSymbolsService: StarredSymbolsService | null = null;
  let currentUserEmail = "demo@example.com"; // Default for demo

  // Initialize symbol management
  const symbolSelector = document.querySelector(
    "#symbol-selector",
  ) as ProductSelect;
  const symbolManager = document.querySelector(
    "#symbol-manager",
  ) as SymbolManager;

  if (symbolSelector && symbolManager) {
    // Initialize starred symbols service
    starredSymbolsService = new StarredSymbolsService(
      firestore,
      currentUserEmail,
    );

    // Load initial starred symbols
    starredSymbolsService.initializeDefaultSymbols().then(async () => {
      const starredSymbols = await starredSymbolsService!.getStarredSymbols();

      // Get all products from Firestore
      const { getAllProducts } = await import("./api/firestore-client");
      const allProducts = await getAllProducts(firestore);

      // Update components
      symbolSelector.products = allProducts;
      symbolSelector.starredSymbols = starredSymbols;

      symbolManager.allProducts = allProducts;
      symbolManager.starredSymbols = starredSymbols;
      symbolManager.userEmail = currentUserEmail;
    });

    // Handle product selection
    symbolSelector.addEventListener("product-changed", (e: Event) => {
      const { product } = (e as CustomEvent).detail;
      if (chart1Result?.api) {
        chart1Result.api.setSymbol(product);
      }
    });

    // Handle manage symbols button
    symbolSelector.addEventListener("manage-symbols", () => {
      symbolManager.open = true;
    });

    // Handle star toggling in symbol manager
    symbolManager.addEventListener("toggle-star", async (e: Event) => {
      const { symbol, starred } = (e as CustomEvent).detail;

      if (starred) {
        await starredSymbolsService!.addStarredSymbol(symbol);
      } else {
        await starredSymbolsService!.removeStarredSymbol(symbol);
      }

      // Update starred symbols in both components
      const updatedStarred = await starredSymbolsService!.getStarredSymbols();
      symbolSelector.starredSymbols = updatedStarred;
      symbolManager.starredSymbols = updatedStarred;
    });

    // Handle symbol manager close
    symbolManager.addEventListener("close", () => {
      symbolManager.open = false;
    });
  }

  // Initialize first chart
  logger.info("Initializing first chart with BTC-USD");
  const chart1Result = initChartWithApi(chartContainerElement1, firebaseApp, {
    symbol: "BTC-USD",
    indicators: defaultIndicators,
  });
  logger.info("First chart ID:", (chartContainerElement1 as any)._chartId);

  // Initialize second chart if it exists
  let chartContainerElement2: ChartContainer | null = null;
  let chart2Result: any = null;
  if (chartContainer2) {
    chartContainerElement2 = elements.chartContainer();
    if (chartContainer2.hasAttribute("data-spotcanvas-require-activation")) {
      chartContainerElement2!.setAttribute("require-activation", "");
    }
    chartContainer2.innerHTML = "";
    chartContainer2.append(chartContainerElement2!);
    logger.info("Initializing second chart with ETH-USD");
    chart2Result = initChartWithApi(chartContainerElement2!, firebaseApp, {
      symbol: "ETH-USD",
      indicators: defaultIndicators,
    });
    logger.info("Second chart ID:", (chartContainerElement2 as any)._chartId);
  }

  logger.info(
    `Chart ${chartContainer2 ? "containers" : "container"} created and ${chartContainer2 ? "applications" : "application"} started.`,
  );

  const updateChartHeight = (container: HTMLElement) => {
    const computedStyle = getComputedStyle(container);
    container.style.setProperty(
      "--spotcanvas-chart-height",
      computedStyle.height,
    );
  };

  updateChartHeight(chartContainer1);
  if (chartContainer2) {
    updateChartHeight(chartContainer2);
  }

  const resizeObserver = new ResizeObserver(() => {
    updateChartHeight(chartContainer1);
    if (chartContainer2) {
      updateChartHeight(chartContainer2);
    }
  });
  resizeObserver.observe(chartContainer1);
  if (chartContainer2) {
    resizeObserver.observe(chartContainer2);
  }

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

    // Listen for upgrade events from charts
    chartContainerElement1.addEventListener("spotcanvas-upgrade", () => {
      logger.debug(
        "Received spotcanvas-upgrade event from chart 1, showing popup.",
      );
      showPopup();
    });

    if (chartContainerElement2) {
      chartContainerElement2.addEventListener("spotcanvas-upgrade", () => {
        logger.debug(
          "Received spotcanvas-upgrade event from chart 2, showing popup.",
        );
        showPopup();
      });
    }

    // Make chart APIs globally accessible for debugging/external control
    if (typeof window !== "undefined") {
      (window as any).chartApi1 = chart1Result.api;
      if (chartContainerElement2) {
        (window as any).chartApi2 = chart2Result.api;
      }
    }

    backdrop.addEventListener("click", hidePopup);
    upgradeButton.addEventListener("click", () => {
      hidePopup();
      if (window.spotcanvas?.log) {
        window.spotcanvas.log("info", "Upgrade clicked");
      } else {
        logger.info("Upgrade clicked");
      }
    });
    logger.info("Upgrade popup listeners initialized.");
  } else {
    logger.error("Upgrade popup elements not found in the DOM.");
  }
});
