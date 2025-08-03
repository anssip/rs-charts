import { Firestore, doc, getDoc } from "firebase/firestore";
import { getFirestore } from "firebase/firestore";

export type Exchange = "coinbase";

export type ProductStatus = "online" | "delisted";

export type CoinbaseProduct = {
  id: string;
  baseCurrency: string;
  quoteCurrency: string;
  status: ProductStatus;
  minSize: number;
  maxSize: number;
  lastUpdated: Date;
};

type DbProduct = CoinbaseProduct & {
  id: string;
  base_currency: string;
  quote_currency: string;
  min_size: string;
  max_size: string;
  last_updated: string;
};

export class FirestoreClient {
  constructor(private firestore: Firestore) {
    this.firestore = firestore;
  }

  async getMinimalProducts(): Promise<CoinbaseProduct[]> {
    return this.getProducts("coinbase", "online", [
      "BTC-USD",
      "ETH-USD",
      "ADA-USD",
      "DOGE-USD",
      "SOL-USD",
    ]);
  }

  async getAllProducts(): Promise<CoinbaseProduct[]> {
    return this.getProducts("coinbase", "online");
  }

  async getProducts(
    exchange: Exchange,
    status: ProductStatus,
    symbols: string[] = [],
  ): Promise<CoinbaseProduct[]> {
    try {
      const workingFirestore = getFirestore(this.firestore.app);
      const exchangesDoc = await getDoc(
        doc(workingFirestore, "trading_pairs/exchanges"),
      );
      if (!exchangesDoc.exists()) {
        return [];
      }
      const data = exchangesDoc.data();
      const productsMap = data[exchange] || {};

      return (Object.entries(productsMap) as [string, DbProduct][])
        .filter(([_, product]) => product.status === status)
        .filter(
          ([productId]) => symbols.length === 0 || symbols.includes(productId),
        )
        .map(([productId, product]) => ({
          id: productId,
          baseCurrency: product.base_currency,
          quoteCurrency: product.quote_currency,
          status: product.status,
          minSize: Number(product.min_size),
          maxSize: Number(product.max_size),
          lastUpdated: new Date(product.last_updated),
        }));
    } catch (error) {
      console.error("Error fetching products:", error);
      throw error;
    }
  }
}

// Standalone function for convenience
export async function getAllProducts(firestore: Firestore): Promise<CoinbaseProduct[]> {
  const client = new FirestoreClient(firestore);
  return client.getAllProducts();
}
