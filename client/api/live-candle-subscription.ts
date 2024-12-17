import {
  Firestore,
  onSnapshot,
  doc,
  DocumentSnapshot,
  DocumentData,
} from "firebase/firestore";
import {
  Granularity,
  granularityLabel,
} from "../../server/services/price-data/price-history-model";

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

  constructor(private firestore: Firestore) {}

  subscribe(
    symbol: string,
    granularity: Granularity,
    onUpdate: (candle: LiveCandle) => void
  ): void {
    this.unsubscribe?.();

    console.log(
      `Live: subscribing to exchanges/coinbase/products/${symbol}/intervals/${granularity}`
    );
    const docRef = doc(
      this.firestore,
      `exchanges/coinbase/products/${symbol}/intervals/${granularity}`
    );

    this._unsubscribe = onSnapshot(
      docRef,
      (snapshot: DocumentSnapshot<DocumentData>) => {
        console.log("Live: Received snapshot:", snapshot.exists(), snapshot.id); // Add this log
        if (snapshot.exists()) {
          const data = snapshot.data() as LiveCandle;
          const candle: LiveCandle = {
            ...data,
            lastUpdate:
              data.lastUpdate instanceof Date
                ? data.lastUpdate
                : new Date(data.lastUpdate),
          };
          onUpdate(candle);
        } else {
          console.log(
            `Live: Document exchanges/coinbase/products/${symbol}/intervals/${granularity} does not exist`
          );
        }
      },
      (error) => {
        console.error(
          "Live: Error in live candle subscription:",
          error.code,
          error.message
        );
      }
    );
  }

  unsubscribe(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  }
}
