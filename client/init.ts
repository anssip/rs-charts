// client/init.ts
import { FirebaseApp, initializeApp, FirebaseOptions } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";
import { App } from "./app";
import { ChartState } from "."; // Assuming ChartState is defined in index.ts or similar
import { xinProxy, xin } from "xinjs";
import { PriceRangeImpl } from "./util/price-range";
import { SimplePriceHistory } from "../server/services/price-data/price-history-model";
import { logger } from "./util/logger";
import { ChartContainer } from "./components/chart/chart-container"; // Import ChartContainer type
import { ChartApi, createChartApi } from "./api/chart-api";

// Type for Firebase config or app
export type FirebaseConfigOrApp = FirebaseOptions | FirebaseApp;

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
 * Result object returned by initChartWithApi function
 */
export interface InitChartResult {
  app: App;
  api: ChartApi;
}

/**
 * Initializes the chart application with a Firebase app instance,
 * creates the application state proxy, instantiates the main App controller,
 * and returns the App instance for backward compatibility.
 *
 * @param chartContainerElement The chart-container DOM element.
 * @param firebaseApp Firebase app instance.
 * @param initialState Optional initial state override.
 * @returns The initialized App instance.
 * @deprecated Use initChartWithApi for full API access
 */
export function initChart(
  chartContainerElement: ChartContainer,
  firebaseConfigOrApp: FirebaseConfigOrApp,
  initialState?: Partial<ChartState>,
  firestoreInstance?: Firestore,
): App {
  try {
    const result = initChartWithApi(chartContainerElement, firebaseConfigOrApp, initialState, firestoreInstance);
    return result.app;
  } catch (error) {
    logger.error("Failed to initialize chart:", error);
    throw error;
  }
}

/**
 * Initializes the chart application with a Firebase app instance,
 * creates the application state proxy, instantiates the main App controller,
 * and returns both the App instance and ChartApi for external control.
 *
 * @param chartContainerElement The chart-container DOM element.
 * @param firebaseApp Firebase app instance.
 * @param initialState Optional initial state override.
 * @returns Object containing the initialized App instance and ChartApi.
 */
export function initChartWithApi(
  chartContainerElement: ChartContainer, // Add chart element parameter
  firebaseConfigOrApp: FirebaseConfigOrApp,
  initialState?: Partial<ChartState>,
  firestoreInstance?: Firestore,
): InitChartResult {
  logger.info("Initializing SpotCanvas Chart App...");

  // Validate Firebase config or app instance
  if (!firebaseConfigOrApp) {
    throw new Error("Firebase config or app instance is required but not provided");
  }

  // Determine if we have a config object or Firebase app instance
  let firebaseApp: FirebaseApp;
  
  // Type guard to check if it's a Firebase app instance
  function isFirebaseApp(obj: any): obj is FirebaseApp {
    return obj && typeof obj === 'object' && 'name' in obj && 'options' in obj;
  }
  
  // Type guard to check if it's a Firebase config object
  function isFirebaseConfig(obj: any): obj is FirebaseOptions {
    return obj && typeof obj === 'object' && 'projectId' in obj;
  }
  
  if (isFirebaseApp(firebaseConfigOrApp)) {
    // This is already a Firebase app instance
    firebaseApp = firebaseConfigOrApp;
    logger.info("Using provided Firebase app instance");
  } else if (isFirebaseConfig(firebaseConfigOrApp)) {
    // This is a Firebase config object, initialize the app
    try {
      firebaseApp = initializeApp(firebaseConfigOrApp);
      logger.info("Initialized Firebase app from config");
    } catch (error) {
      logger.error("Failed to initialize Firebase app from config:", error);
      throw new Error(`Failed to initialize Firebase app: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    logger.error("Invalid Firebase config or app instance:", firebaseConfigOrApp);
    throw new Error("Invalid Firebase config or app instance - must be either a Firebase config object with projectId or initialized Firebase app");
  }

  let firestore: Firestore;
  try {
    firestore = firestoreInstance || getFirestore(firebaseApp);
    logger.info("Firestore initialized successfully");
  } catch (error) {
    logger.error("Failed to initialize Firestore:", error);
    throw new Error(`Failed to initialize Firestore: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

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

  // Create the Chart API for external control
  const chartApi = createChartApi(chartContainerElement, chartApp);
  logger.info("Chart API initialized.");

  // Add event listeners for lifecycle management (optional, could be handled by consumer)
  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => {
      chartApp.cleanup();
      chartApi.dispose();
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

  return { app: chartApp, api: chartApi };
}

// --- Global type declaration --- needed if window.chartStates is used
declare global {
  interface Window {
    chartStates?: Map<string, ChartState>; // Define the type for window.chartStates
  }
}
