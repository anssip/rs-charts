import { Firestore, onSnapshot, doc } from 'firebase/firestore';

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

    constructor(private firestore: Firestore) { }

    subscribe(productId: string, onUpdate: (candle: LiveCandle) => void): void {
        // Unsubscribe from any existing subscription
        this.unsubscribe?.();

        console.log(`Subscribing to live_candles/${productId}`); // Add this log

        // Create a reference to the live candle document
        const docRef = doc(this.firestore, 'live_candles', productId);

        // Subscribe to updates
        this._unsubscribe = onSnapshot(docRef,
            (snapshot) => {
                console.log('Received snapshot:', snapshot.exists(), snapshot.id); // Add this log
                if (snapshot.exists()) {
                    const data = snapshot.data() as LiveCandle;
                    // Convert Firestore Timestamp to Date if needed
                    const candle: LiveCandle = {
                        ...data,
                        lastUpdate: data.lastUpdate instanceof Date
                            ? data.lastUpdate
                            : new Date(data.lastUpdate)
                    };
                    onUpdate(candle);
                } else {
                    console.log(`Document live_candles/${productId} does not exist`); // Add this log
                }
            },
            (error) => {
                console.error('Error in live candle subscription:', error.code, error.message); // Enhanced error logging
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
