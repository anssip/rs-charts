// client/init.ts
import { FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { App } from "./app";
import { ChartState } from "."; // Assuming ChartState is defined in index.ts or similar
import { xinProxy, xin } from "xinjs";
import { PriceRangeImpl } from "./util/price-range";
import { SimplePriceHistory } from "../server/services/price-data/price-history-model";
import { logger } from "./util/logger";
import { ChartContainer } from "./components/chart/chart-container"; // Import ChartContainer type

// Define a default initial state creation function or constant
const createInitialChartState = (): ChartState => ({
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
});

/**
 * Initializes the chart application with a Firebase app instance,
 * creates the application state proxy, instantiates the main App controller,
 * and returns the App instance.
 *
 * @param chartContainerElement The chart-container DOM element.
 * @param firebaseApp Firebase app instance.
 * @param initialState Optional initial state override.
 * @returns The initialized App instance.
 */
export function initChart(
  chartContainerElement: ChartContainer, // Add chart element parameter
  firebaseApp: FirebaseApp,
  initialState?: Partial<ChartState>,
  firestoreInstance?: Firestore,
): App {
  logger.info("Initializing SpotCanvas Chart App...");

  const firestore = firestoreInstance || getFirestore(firebaseApp);

  // Create a unique chart ID for this instance
  const chartId = `chart-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Create the reactive state with the chart ID as namespace
  const initialChartState = {
    ...createInitialChartState(),
    ...initialState, // Allow overriding parts of the initial state
  };

  // Use global state but namespace with chart ID
  const stateConfig = { [chartId]: initialChartState };
  const { [chartId]: state } = xinProxy(stateConfig, true);

  // Debug logging
  logger.info(`Created chart with ID: ${chartId}`);
  logger.info(`Initial state symbol: ${initialChartState.symbol}`);
  logger.info(`Initial state granularity: ${initialChartState.granularity}`);

  chartContainerElement.state = state;

  // Store the chart ID on the container for components to access
  (chartContainerElement as any)._chartId = chartId;
  chartContainerElement.setAttribute('data-chart-id', chartId);
  console.log(`initChart: Assigned chartId ${chartId} to chart container`);
  console.log(
    `initChart: Chart container tagName:`,
    chartContainerElement.tagName,
  );
  console.log(
    `initChart: Chart container _chartId:`,
    (chartContainerElement as any)._chartId,
  );
  console.log(`initChart: All xin keys:`, Object.keys(xin));
  console.log(`initChart: Chart state in xin[${chartId}]:`, xin[chartId]);

  // Make state globally accessible for potential debugging or integration
  if (typeof window !== "undefined") {
    // Store each chart state with a unique identifier to avoid conflicts
    if (!window.chartStates) {
      window.chartStates = new Map();
    }
    window.chartStates.set(chartId, state);
    // Store the chart ID on the element for debugging purposes
    chartContainerElement.setAttribute("data-chart-id", chartId);
  }

  // Instantiate the main application controller, passing the element
  const chartApp = new App(chartContainerElement, firestore, state);
  logger.info("Chart application controller initialized.");

  // Add event listeners for lifecycle management (optional, could be handled by consumer)
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      chartApp.cleanup();
      logger.debug("App cleanup triggered on page hide");
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        chartApp.cleanup();
        logger.debug("App cleanup triggered on visibility change to hidden");
      }
      if (document.visibilityState === "visible") {
        chartApp.fetchGaps();
        logger.debug("Fetching data gaps on visibility change to visible");
      }
    });
  }

  return chartApp;
}

// --- Global type declaration --- needed if window.chartStates is used
declare global {
  interface Window {
    chartStates?: Map<string, ChartState>; // Define the type for window.chartStates
  }
}
