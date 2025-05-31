// client/init.ts
import { FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { App } from "./app";
import { ChartState } from "."; // Assuming ChartState is defined in index.ts or similar
import { xinProxy } from "xinjs";
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
): App {
  logger.info("Initializing SpotCanvas Chart App...");

  const firestore = getFirestore(firebaseApp);
  logger.debug("Firebase firestore initialized.");

  // Create the reactive state
  const initialChartState = {
    ...createInitialChartState(),
    ...initialState, // Allow overriding parts of the initial state
  };
  const { state } = xinProxy({ state: initialChartState }, true);
  chartContainerElement.state = state;

  // Make state globally accessible for potential debugging or integration
  // Consider if this is truly needed for the library use case
  if (typeof window !== "undefined") {
    window.app = state;
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

// --- Global type declaration --- needed if window.app is used
declare global {
  interface Window {
    app: ChartState; // Define the type for window.app
  }
}
