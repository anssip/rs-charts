import {
  Firestore,
  getDocs,
  query,
  where,
  collectionGroup,
  collection,
  getDoc,
  doc,
} from "firebase/firestore";

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

  async getProducts(
    exchange: Exchange,
    status: ProductStatus
  ): Promise<CoinbaseProduct[]> {
    try {
      // Get the exchanges document which contains the products map
      const exchangesDoc = await getDoc(
        doc(this.firestore, "trading_pairs/exchanges")
      );
      if (!exchangesDoc.exists()) {
        console.error("Exchanges document not found");
        return [];
      }
      const data = exchangesDoc.data();
      const productsMap = data[exchange] || {};

      return (Object.entries(productsMap) as [string, DbProduct][])
        .filter(([_, product]) => product.status === status)
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
