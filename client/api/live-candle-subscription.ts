import { Firestore } from "firebase/firestore";
import { Granularity } from "../../server/services/price-data/price-history-model";
import { getLogger, LogLevel } from "../util/logger";
import { LiveCandleSubscriptionManager } from "./live-candle-subscription-manager";

const logger = getLogger('live-candle-subscription');
// Set to WARN to avoid showing permission errors in production
logger.setLoggerLevel('live-candle-subscription', LogLevel.WARN);

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
  private _subscriptionManager: LiveCandleSubscriptionManager;
  private _currentSubscriptionId: string | null = null;
  private _currentSymbol: string | null = null;
  private _currentGranularity: Granularity | null = null;
  private _currentCallback: ((candle: LiveCandle) => void) | null = null;
  private _boundVisibilityHandler: (() => void) | null = null;
  private _isActive: boolean = true;
  private readonly instanceId: string;

  constructor(private firestore: Firestore) {
    // Get the singleton subscription manager
    this._subscriptionManager = LiveCandleSubscriptionManager.getInstance(firestore);

    // Create unique instance ID for debugging
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
      // Only reconnect if we have an active subscription
      if (this._currentSymbol && this._currentGranularity && this._currentCallback) {
        logger.info(`[${this.instanceId}] Page became visible, reconnecting if needed`);
        // Resubscribe to ensure we're getting updates
        this.subscribe(
          this._currentSymbol,
          this._currentGranularity,
          this._currentCallback
        );
      }
    }
  }

  async subscribe(
    symbol: string,
    granularity: Granularity,
    onUpdate: (candle: LiveCandle) => void
  ): Promise<void> {
    if (!this._isActive) {
      logger.warn(`[${this.instanceId}] Cannot subscribe - instance is not active`);
      return;
    }

    // Unsubscribe from previous subscription if any
    this.unsubscribe();

    this._currentSymbol = symbol;
    this._currentGranularity = granularity;
    this._currentCallback = onUpdate;

    logger.info(`[${this.instanceId}] Subscribing to ${symbol}/${granularity}`);

    try {
      // Use the subscription manager to handle the actual Firebase subscription
      this._currentSubscriptionId = await this._subscriptionManager.subscribe(
        symbol,
        granularity,
        onUpdate
      );

      logger.info(`[${this.instanceId}] Successfully subscribed with ID: ${this._currentSubscriptionId}`);
    } catch (error) {
      logger.error(`[${this.instanceId}] Failed to subscribe:`, error);
    }
  }

  unsubscribe(): void {
    if (this._currentSubscriptionId && this._currentSymbol && this._currentGranularity) {
      logger.info(`[${this.instanceId}] Unsubscribing from live candle updates`);
      this._subscriptionManager.unsubscribe(
        this._currentSubscriptionId,
        this._currentSymbol,
        this._currentGranularity
      );
      this._currentSubscriptionId = null;
    }
  }

  /**
   * Completely dispose of the subscription and clean up all resources.
   * Call this when the chart instance is being destroyed.
   */
  dispose(): void {
    logger.info(`[${this.instanceId}] Disposing live candle subscription`);

    // Mark as inactive to prevent any further operations
    this._isActive = false;

    // First unsubscribe from current subscription
    this.unsubscribe();

    // Clear all state
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
