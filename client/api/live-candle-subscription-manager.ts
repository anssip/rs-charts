import {
  Firestore,
  onSnapshot,
  doc,
  getDoc,
  DocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import { Granularity } from "../../server/services/price-data/price-history-model";
import { getLogger, LogLevel } from "../util/logger";
import { LiveCandle } from "./live-candle-subscription";

const logger = getLogger('live-candle-subscription-manager');
logger.setLoggerLevel('live-candle-subscription-manager', LogLevel.WARN);

type SubscriptionKey = `${string}/${Granularity}`;
type SubscriptionCallback = (candle: LiveCandle) => void;

interface Subscription {
  callbacks: Map<string, SubscriptionCallback>;
  unsubscribe: (() => void) | null;
  lastUpdateTime: number;
  reconnectAttempts: number;
  permissionDenied: boolean;
}

/**
 * Singleton manager for live candle subscriptions.
 * Ensures only one Firebase listener per symbol/granularity combination,
 * regardless of how many charts are subscribed to the same data.
 */
export class LiveCandleSubscriptionManager {
  private static instance: LiveCandleSubscriptionManager | null = null;
  private subscriptions = new Map<SubscriptionKey, Subscription>();
  private firestore: Firestore;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  private constructor(firestore: Firestore) {
    this.firestore = firestore;
    logger.info('LiveCandleSubscriptionManager initialized');
  }

  static getInstance(firestore: Firestore): LiveCandleSubscriptionManager {
    if (!LiveCandleSubscriptionManager.instance) {
      LiveCandleSubscriptionManager.instance = new LiveCandleSubscriptionManager(firestore);
    }
    return LiveCandleSubscriptionManager.instance;
  }

  /**
   * Subscribe to live candle updates.
   * Returns a unique subscription ID that must be used to unsubscribe.
   */
  async subscribe(
    symbol: string,
    granularity: Granularity,
    callback: SubscriptionCallback
  ): Promise<string> {
    const key: SubscriptionKey = `${symbol}/${granularity}`;
    const subscriptionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    logger.info(`[${subscriptionId}] Subscribing to ${key}`);

    let subscription = this.subscriptions.get(key);

    if (!subscription) {
      // Create new subscription
      subscription = {
        callbacks: new Map(),
        unsubscribe: null,
        lastUpdateTime: Date.now(),
        reconnectAttempts: 0,
        permissionDenied: false,
      };
      this.subscriptions.set(key, subscription);

      // Start Firebase listener
      await this.startFirebaseListener(symbol, granularity, subscription);
    } else {
      logger.debug(`[${subscriptionId}] Reusing existing subscription for ${key}`);
    }

    // Add callback to subscription
    subscription.callbacks.set(subscriptionId, callback);

    logger.info(`[${subscriptionId}] Subscription active. Total subscribers for ${key}: ${subscription.callbacks.size}`);

    return subscriptionId;
  }

  /**
   * Unsubscribe from live candle updates using the subscription ID
   */
  unsubscribe(subscriptionId: string, symbol: string, granularity: Granularity): void {
    const key: SubscriptionKey = `${symbol}/${granularity}`;
    const subscription = this.subscriptions.get(key);

    if (!subscription) {
      logger.warn(`[${subscriptionId}] No subscription found for ${key}`);
      return;
    }

    // Remove callback
    subscription.callbacks.delete(subscriptionId);
    logger.info(`[${subscriptionId}] Unsubscribed from ${key}. Remaining subscribers: ${subscription.callbacks.size}`);

    // If no more callbacks, clean up Firebase listener
    if (subscription.callbacks.size === 0) {
      if (subscription.unsubscribe) {
        logger.info(`[${subscriptionId}] Removing Firebase listener for ${key}`);
        subscription.unsubscribe();
      }
      this.subscriptions.delete(key);
    }
  }

  private async startFirebaseListener(
    symbol: string,
    granularity: Granularity,
    subscription: Subscription
  ): Promise<void> {
    if (subscription.permissionDenied) {
      logger.warn(`Skipping Firebase listener for ${symbol}/${granularity} due to previous permission denial`);
      return;
    }

    const docRef = doc(
      this.firestore,
      `exchanges/coinbase/products/${symbol}/intervals/${granularity}`
    );

    // First try a simple read to test permissions
    try {
      const testDoc = await getDoc(docRef);
      if (testDoc.exists()) {
        logger.debug(`Test read successful for ${symbol}/${granularity}, document exists`);
      } else {
        logger.debug(`Test read successful for ${symbol}/${granularity}, but document does not exist`);
      }
    } catch (testError: any) {
      logger.error(`Test read failed for ${symbol}/${granularity}:`, testError);
      if (testError?.code === 'permission-denied') {
        logger.error(`Cannot read from path due to permissions`);
        subscription.permissionDenied = true;
        return;
      }
    }

    try {
      subscription.unsubscribe = onSnapshot(
        docRef,
        (snapshot: DocumentSnapshot<DocumentData>) => {
          subscription.lastUpdateTime = Date.now();
          subscription.reconnectAttempts = 0; // Reset on successful update

          if (snapshot.exists()) {
            const data = snapshot.data() as LiveCandle;

            const candle: LiveCandle = {
              ...data,
              lastUpdate:
                data.lastUpdate instanceof Date
                  ? data.lastUpdate
                  : new Date(data.lastUpdate),
            };

            // Notify all subscribers
            subscription.callbacks.forEach((callback, id) => {
              try {
                callback(candle);
              } catch (error) {
                logger.error(`Error in callback ${id}:`, error);
              }
            });
          } else {
            logger.debug(`Document does not exist at path: exchanges/coinbase/products/${symbol}/intervals/${granularity}`);
          }
        },
        (error: any) => {
          // Log full error details for debugging
          logger.debug(`Full error object for ${symbol}/${granularity}:`, JSON.stringify(error));

          // Handle permission errors specifically
          if (error?.code === 'permission-denied') {
            logger.warn(`Permission denied for live candle subscription. Path: exchanges/coinbase/products/${symbol}/intervals/${granularity}`);
            logger.debug('This feature requires authentication or proper Firebase security rules configuration.');
            logger.debug('Error message:', error.message);
            subscription.permissionDenied = true;
            return;
          }

          logger.error(`Snapshot error for ${symbol}/${granularity}:`, error);

          // Attempt reconnection with exponential backoff
          if (subscription.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, subscription.reconnectAttempts), 30000);
            subscription.reconnectAttempts++;

            setTimeout(() => {
              if (subscription.callbacks.size > 0 && !subscription.permissionDenied) {
                logger.info(`Reconnecting for ${symbol}/${granularity}, attempt ${subscription.reconnectAttempts}`);
                this.startFirebaseListener(symbol, granularity, subscription);
              }
            }, delay);
          }
        }
      );
    } catch (setupError) {
      logger.error(`Failed to setup snapshot listener for ${symbol}/${granularity}:`, setupError);
      subscription.permissionDenied = true;
    }
  }

  /**
   * Dispose of all subscriptions and clean up resources
   */
  dispose(): void {
    logger.info('Disposing all live candle subscriptions');

    this.subscriptions.forEach((subscription, key) => {
      if (subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    });

    this.subscriptions.clear();
    LiveCandleSubscriptionManager.instance = null;
  }
}