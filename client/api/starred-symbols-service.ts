import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  Firestore
} from "firebase/firestore";
import { getLogger } from "../util/logger";

const logger = getLogger("StarredSymbolsService");

export interface StarredSymbolsData {
  symbols: string[];
  lastUpdated: any; // Firestore timestamp
}

export class StarredSymbolsService {
  private firestore: Firestore;
  private userEmail: string;
  private cachePath: string;
  private cache: string[] | null = null;

  constructor(firestore: Firestore, userEmail: string) {
    this.firestore = firestore;
    this.userEmail = userEmail;
    this.cachePath = `settings/${userEmail}/symbols`;
  }

  /**
   * Get the user's starred symbols from Firestore
   */
  async getStarredSymbols(): Promise<string[]> {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const docRef = doc(this.firestore, "settings", this.userEmail, "symbols", "starred");
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as StarredSymbolsData;
        this.cache = data.symbols || [];
        logger.debug(`Loaded ${this.cache.length} starred symbols for ${this.userEmail}`);
        return this.cache;
      } else {
        logger.debug(`No starred symbols found for ${this.userEmail}, returning empty array`);
        this.cache = [];
        return [];
      }
    } catch (error) {
      logger.error("Error loading starred symbols:", error);
      return [];
    }
  }

  /**
   * Add a symbol to the user's starred list
   */
  async addStarredSymbol(symbol: string): Promise<boolean> {
    try {
      const currentSymbols = await this.getStarredSymbols();

      if (currentSymbols.includes(symbol)) {
        logger.debug(`Symbol ${symbol} already starred`);
        return true;
      }

      const updatedSymbols = [...currentSymbols, symbol];
      await this.updateStarredSymbols(updatedSymbols);

      this.cache = updatedSymbols;
      logger.debug(`Added ${symbol} to starred symbols`);
      return true;
    } catch (error) {
      logger.error(`Error adding starred symbol ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Remove a symbol from the user's starred list
   */
  async removeStarredSymbol(symbol: string): Promise<boolean> {
    try {
      const currentSymbols = await this.getStarredSymbols();

      if (!currentSymbols.includes(symbol)) {
        logger.debug(`Symbol ${symbol} not in starred list`);
        return true;
      }

      const updatedSymbols = currentSymbols.filter(s => s !== symbol);
      await this.updateStarredSymbols(updatedSymbols);

      this.cache = updatedSymbols;
      logger.debug(`Removed ${symbol} from starred symbols`);
      return true;
    } catch (error) {
      logger.error(`Error removing starred symbol ${symbol}:`, error);
      return false;
    }
  }

  /**
   * Toggle a symbol's starred status
   */
  async toggleStarredSymbol(symbol: string): Promise<{ starred: boolean }> {
    const currentSymbols = await this.getStarredSymbols();
    const isStarred = currentSymbols.includes(symbol);

    if (isStarred) {
      await this.removeStarredSymbol(symbol);
      return { starred: false };
    } else {
      await this.addStarredSymbol(symbol);
      return { starred: true };
    }
  }

  /**
   * Update the entire starred symbols list
   */
  private async updateStarredSymbols(symbols: string[]): Promise<void> {
    const docRef = doc(this.firestore, "settings", this.userEmail, "symbols", "starred");

    const data: StarredSymbolsData = {
      symbols,
      lastUpdated: serverTimestamp()
    };

    await setDoc(docRef, data, { merge: true });
  }

  /**
   * Clear the cache (useful when user changes)
   */
  clearCache(): void {
    this.cache = null;
  }

  /**
   * Check if a symbol is starred
   */
  async isSymbolStarred(symbol: string): Promise<boolean> {
    const starredSymbols = await this.getStarredSymbols();
    return starredSymbols.includes(symbol);
  }

  /**
   * Get default symbols for new users
   */
  static getDefaultSymbols(): string[] {
    return ["BTC-USD", "ETH-USD", "SOL-USD"];
  }

  /**
   * Initialize default symbols for a new user
   */
  async initializeDefaultSymbols(): Promise<void> {
    const currentSymbols = await this.getStarredSymbols();

    if (currentSymbols.length === 0) {
      const defaultSymbols = StarredSymbolsService.getDefaultSymbols();
      await this.updateStarredSymbols(defaultSymbols);
      this.cache = defaultSymbols;
      logger.debug(`Initialized default symbols for ${this.userEmail}`);
    }
  }
}
