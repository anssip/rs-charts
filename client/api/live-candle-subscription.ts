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
  private _isActive: boolean = true;
  private _reconnectAttempts: number = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private _reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly instanceId: string;

  constructor(private firestore: Firestore) {
    // Create unique instance ID for debugging multiple subscriptions
    this.instanceId = `live-candle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a bound reference to the visibility handler for proper cleanup
    this._boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    
    // Add visibility change listener to detect when the page becomes visible again
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this._boundVisibilityHandler);
    }
  }

  private handleVisibilityChange(): void {
    if (!this._isActive) return;
    
    if (document.visibilityState === "visible") {
      const now = Date.now();
      const timeSinceLastCheck = now - this._lastCheckTime;
      
      // Only reconnect if we have an active subscription and it's been a while
      if (this._currentSymbol && this._currentGranularity && timeSinceLastCheck > 10000) {
        console.log(`[${this.instanceId}] Reconnecting after visibility change`);
        this.reconnect();
      }
    }
  }

  private checkConnection(): void {
    if (!this._isActive) return;
    
    const timeSinceLastUpdate = Date.now() - this._lastUpdateTime;
    if (timeSinceLastUpdate > this.TIMEOUT_MS) {
      console.log(`[${this.instanceId}] Connection timeout detected, reconnecting...`);
      this.reconnect();
    }
    this._lastCheckTime = Date.now();
  }

  private startMonitoring(): void {
    this.stopMonitoring();
    this._lastCheckTime = Date.now();
    
    if (this._isActive) {
      this._monitorInterval = setInterval(() => {
        this.checkConnection();
      }, 5000); // Check every 5 seconds
    }
  }

  private stopMonitoring(): void {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
    }
  }

  private reconnect(): void {
    if (!this._isActive) return;
    
    if (
      this._currentSymbol &&
      this._currentGranularity &&
      this._currentCallback !== null
    ) {
      // Implement exponential backoff for reconnection attempts
      if (this._reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
        console.warn(`[${this.instanceId}] Max reconnection attempts reached, stopping...`);
        return;
      }
      
      const delay = Math.min(1000 * Math.pow(2, this._reconnectAttempts), 30000);
      this._reconnectAttempts++;
      
      console.log(`[${this.instanceId}] Reconnecting attempt ${this._reconnectAttempts}, delay: ${delay}ms`);
      
      if (this._reconnectTimeout) {
        clearTimeout(this._reconnectTimeout);
      }
      
      this._reconnectTimeout = setTimeout(() => {
        if (this._isActive) {
          this.subscribe(
            this._currentSymbol!,
            this._currentGranularity!,
            this._currentCallback!
          );
        }
      }, delay);
    }
  }

  subscribe(
    symbol: string,
    granularity: Granularity,
    onUpdate: (candle: LiveCandle) => void
  ): void {
    if (!this._isActive) {
      console.warn(`[${this.instanceId}] Cannot subscribe - instance is not active`);
      return;
    }
    
    this.unsubscribe();

    this._currentSymbol = symbol;
    this._currentGranularity = granularity;
    this._currentCallback = onUpdate;
    this._lastUpdateTime = Date.now();
    this._reconnectAttempts = 0; // Reset reconnection attempts on new subscription

    console.log(`[${this.instanceId}] Subscribing to ${symbol}/${granularity}`);

    const docRef = doc(
      this.firestore,
      `exchanges/coinbase/products/${symbol}/intervals/${granularity}`
    );

    this._unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        if (!this._isActive) return;
        
        this._lastUpdateTime = Date.now();
        this._reconnectAttempts = 0; // Reset on successful update
        
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
          
          // Ensure callback is still valid before calling
          if (this._currentCallback && this._isActive) {
            onUpdate(candle);
          }
        }
      },
      (error) => {
        if (!this._isActive) return;
        
        console.error(`[${this.instanceId}] Snapshot error:`, error);
        // Start reconnection process on error with delay
        const delay = Math.min(1000 * (this._reconnectAttempts + 1), 5000);
        setTimeout(() => {
          if (this._isActive) {
            this.reconnect();
          }
        }, delay);
      }
    );

    this.startMonitoring();
  }

  unsubscribe(): void {
    if (this._unsubscribe) {
      console.log(`[${this.instanceId}] Unsubscribing from live candle updates`);
      this._unsubscribe();
      this._unsubscribe = null;
    }
    
    this.stopMonitoring();
    
    // Clear reconnection timeout
    if (this._reconnectTimeout) {
      clearTimeout(this._reconnectTimeout);
      this._reconnectTimeout = null;
    }
    
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
    console.log(`[${this.instanceId}] Disposing live candle subscription`);
    
    // Mark as inactive to prevent any further operations
    this._isActive = false;
    
    // First unsubscribe from current subscription
    this.unsubscribe();
    
    // Clear all state to prevent reconnection
    this._currentSymbol = null;
    this._currentGranularity = null;
    this._currentCallback = null;
    this._reconnectAttempts = 0;

    // Remove visibility change listener using the bound reference
    if (typeof document !== "undefined" && this._boundVisibilityHandler) {
      document.removeEventListener("visibilitychange", this._boundVisibilityHandler);
      this._boundVisibilityHandler = null;
    }
  }
}
