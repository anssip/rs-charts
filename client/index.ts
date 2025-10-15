import { elements } from "xinjs";
import "./components/chart/chart-container";
import "./components/chart/chart";
import "./components/chart/timeline";
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
import { getAuth } from "firebase/auth";
import { TrendLine } from "./types/trend-line";
import { PatternHighlight } from "./types/markers";

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
  patternHighlights?: PatternHighlight[]; // Store pattern highlights in state
  isTransitioning?: boolean; // Flag to prevent drawing during state transitions
  // Trading overlays for paper trading & backtesting
  tradeMarkers?: import("./types/trading-overlays").TradeMarker[];
  priceLines?: import("./types/trading-overlays").PriceLine[];
  tradeZones?: import("./types/trading-overlays").TradeZone[];
  annotations?: import("./types/trading-overlays").Annotation[];
  positionOverlay?: import("./types/trading-overlays").PositionOverlayConfig | null;
  clickToTrade?: import("./types/trading-overlays").ClickToTradeConfig | null;
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

  // Calculate timestamps for trend lines (using recent dates)
  const now = Date.now();
  const hourInMs = 60 * 60 * 1000;

  // Create initial trend lines for testing - using recent times and realistic BTC prices
  const initialTrendLines = [
    {
      id: "initial-trend-btc-1",
      startPoint: {
        timestamp: now - 24 * hourInMs, // 24 hours ago
        price: 98000,
      },
      endPoint: {
        timestamp: now - 6 * hourInMs, // 6 hours ago
        price: 102000,
      },
      color: "#2962ff",
      lineWidth: 3,
      style: "solid" as const,
      extendLeft: false,
      extendRight: true,
    },
    {
      id: "initial-trend-btc-2",
      startPoint: {
        timestamp: now - 18 * hourInMs, // 18 hours ago
        price: 103000,
      },
      endPoint: {
        timestamp: now - 3 * hourInMs, // 3 hours ago
        price: 99000,
      },
      color: "#ff6b6b",
      lineWidth: 2,
      style: "dashed" as const,
      extendLeft: true,
      extendRight: false,
    },
    {
      id: "initial-trend-btc-support",
      startPoint: {
        timestamp: now - 20 * hourInMs, // 20 hours ago
        price: 97500,
      },
      endPoint: {
        timestamp: now - 1 * hourInMs, // 1 hour ago
        price: 97500,
      },
      color: "#4ade80",
      lineWidth: 2,
      style: "dotted" as const,
      extendLeft: true,
      extendRight: true,
    },
  ];

  // Initialize first chart
  logger.info("Initializing first chart with BTC-USD and initial trend lines");
  const chart1Result = initChartWithApi(chartContainerElement1, firebaseApp, {
    symbol: "BTC-USD",
    indicators: defaultIndicators,
    trendLines: initialTrendLines,
  });
  logger.info("First chart ID:", (chartContainerElement1 as any)._chartId);

  // Add sample trade zones for testing after chart is ready
  chart1Result.api.on('ready', () => {
    logger.info("Chart 1 ready - adding sample trade zones");

    // Add a profitable long trade zone
    chart1Result.api.addTradeZone({
      startTimestamp: now - 15 * hourInMs,
      endTimestamp: now - 10 * hourInMs,
      entryPrice: 99000,
      exitPrice: 101000,
      metadata: {
        side: 'long',
        quantity: 0.1,
        pnl: 200,
        pnlPercent: 2.02
      }
    });

    // Add a losing short trade zone
    chart1Result.api.addTradeZone({
      startTimestamp: now - 8 * hourInMs,
      endTimestamp: now - 5 * hourInMs,
      entryPrice: 100000,
      exitPrice: 101500,
      metadata: {
        side: 'short',
        quantity: 0.05,
        pnl: -75,
        pnlPercent: -1.5
      }
    });

    logger.info("Sample trade zones added to chart 1");
  });

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

    // Create different trend lines for ETH chart with realistic prices
    const ethTrendLines = [
      {
        id: "initial-trend-eth-1",
        startPoint: {
          timestamp: now - 20 * hourInMs, // 20 hours ago
          price: 3600,
        },
        endPoint: {
          timestamp: now - 4 * hourInMs, // 4 hours ago
          price: 3850,
        },
        color: "#a855f7",
        lineWidth: 3,
        style: "solid" as const,
        extendLeft: false,
        extendRight: true,
      },
      {
        id: "initial-trend-eth-resistance",
        startPoint: {
          timestamp: now - 22 * hourInMs, // 22 hours ago
          price: 3900,
        },
        endPoint: {
          timestamp: now - 2 * hourInMs, // 2 hours ago
          price: 3900,
        },
        color: "#fbbf24",
        lineWidth: 2,
        style: "dashed" as const,
        extendLeft: true,
        extendRight: true,
      },
      {
        id: "initial-trend-eth-support",
        startPoint: {
          timestamp: now - 18 * hourInMs, // 18 hours ago
          price: 3700,
        },
        endPoint: {
          timestamp: now - 1 * hourInMs, // 1 hour ago
          price: 3650,
        },
        color: "#22d3ee",
        lineWidth: 2,
        style: "dotted" as const,
        extendLeft: false,
        extendRight: true,
      },
    ];

    logger.info(
      "Initializing second chart with ETH-USD and initial trend lines",
    );
    chart2Result = initChartWithApi(chartContainerElement2!, firebaseApp, {
      symbol: "ETH-USD",
      indicators: defaultIndicators,
      trendLines: ethTrendLines,
    });
    logger.info("Second chart ID:", (chartContainerElement2 as any)._chartId);

    // Add sample trade zones for testing after chart is ready
    chart2Result.api.on('ready', () => {
      logger.info("Chart 2 ready - adding sample trade zones");

      // Add a profitable short trade zone for ETH
      chart2Result.api.addTradeZone({
        startTimestamp: now - 12 * hourInMs,
        endTimestamp: now - 7 * hourInMs,
        entryPrice: 3800,
        exitPrice: 3700,
        metadata: {
          side: 'short',
          quantity: 2,
          pnl: 200,
          pnlPercent: 2.63
        }
      });

      // Add a losing long trade zone for ETH
      chart2Result.api.addTradeZone({
        startTimestamp: now - 5 * hourInMs,
        endTimestamp: now - 2 * hourInMs,
        entryPrice: 3750,
        exitPrice: 3700,
        metadata: {
          side: 'long',
          quantity: 1.5,
          pnl: -75,
          pnlPercent: -1.33
        }
      });

      logger.info("Sample trade zones added to chart 2");
    });
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
// trigger rebuild
