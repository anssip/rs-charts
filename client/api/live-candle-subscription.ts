import {
  Firestore,
  onSnapshot,
  doc,
  DocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { Granularity } from "../../server/services/price-data/price-history-model";

export interface LiveCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  lastUpdate: Date;
  productId: string;
}

export class LiveCandleSubscription {
  private _unsubscribe: (() => void) | null = null;
  private _lastUpdateTime: number = Date.now();
  private _monitorInterval: ReturnType<typeof setInterval> | null = null;
  private _currentSymbol: string | null = null;
  private _currentGranularity: Granularity | null = null;
  private _currentCallback: ((candle: LiveCandle) => void) | null = null;
  private readonly TIMEOUT_MS = 30000; // 30 seconds
  private _lastCheckTime: number = Date.now();
  private _boundVisibilityHandler: (() => void) | null = null;

  constructor(private firestore: Firestore) {
    // Create a bound reference to the visibility handler for proper cleanup
    this._boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    
    // Add visibility change listener to detect when the page becomes visible again
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._boundVisibilityHandler);
    }
  }

  private handleVisibilityChange(): void {
    if (document.visibilityState === "visible") {
      const now = Date.now();
      const timeSinceLastCheck = now - this._lastCheckTime;
      this.reconnect();
    }
  }

  private checkConnection(): void {
    const timeSinceLastUpdate = Date.now() - this._lastUpdateTime;
    if (timeSinceLastUpdate > this.TIMEOUT_MS) {
      this.reconnect();
    }
    this._lastCheckTime = Date.now();
  }

  private startMonitoring(): void {
    this.stopMonitoring();
    this._lastCheckTime = Date.now();
    this._monitorInterval = setInterval(() => {
      this.checkConnection();
    }, 5000); // Check every 5 seconds
  }

  private stopMonitoring(): void {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }

  private reconnect(): void {
    if (
      this._currentSymbol &&
      this._currentGranularity &&
      this._currentCallback !== null
    ) {
      this.subscribe(
        this._currentSymbol,
        this._currentGranularity,
        this._currentCallback
      );
    }
  }

  subscribe(
    symbol: string,
    granularity: Granularity,
    onUpdate: (candle: LiveCandle) => void
  ): void {
    this.unsubscribe();

    this._currentSymbol = symbol;
    this._currentGranularity = granularity;
    this._currentCallback = onUpdate;
    this._lastUpdateTime = Date.now();

    const docRef = doc(
      this.firestore,
      `exchanges/coinbase/products/${symbol}/intervals/${granularity}`
    );

    this._unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        this._lastUpdateTime = Date.now();
        if (snapshot.exists()) {
          const data = snapshot.data() as LiveCandle;

          // TODO: Live candles do not include volume
          const candle: LiveCandle = {
            ...data,
            lastUpdate:
              data.lastUpdate instanceof Date
                ? data.lastUpdate
                : new Date(data.lastUpdate),
          };
          onUpdate(candle);
        }
      },
      (_) => {
        // Start reconnection process on error
        setTimeout(() => this.reconnect(), 1000);
      }
    );

    this.startMonitoring();
  }

  unsubscribe(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    this.stopMonitoring();
    
    // Reset current subscription state but keep it available for reconnection
    // this._currentSymbol = null;
    // this._currentGranularity = null;
    // this._currentCallback = null;
  }

  /**
   * Completely dispose of the subscription and clean up all resources.
   * Call this when the chart instance is being destroyed.
   */
  dispose(): void {
    // First unsubscribe from current subscription
    this.unsubscribe();
    
    // Clear all state to prevent reconnection
    this._currentSymbol = null;
    this._currentGranularity = null;
    this._currentCallback = null;

    // Remove visibility change listener using the bound reference
    if (typeof document !== "undefined" && this._boundVisibilityHandler) {
      document.removeEventListener("visibilitychange", this._boundVisibilityHandler);
      this._boundVisibilityHandler = null;
    }
  }
}
