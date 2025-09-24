import { CandleRenderer } from "./candle-renderer";
import { getLogger } from "../../util/logger";

const logger = getLogger("CandlePool");

/**
 * Object pool for CandleRenderer instances to avoid garbage collection pressure
 * during animation and frequent redraws.
 */
export class CandlePool {
  private readonly pool: CandleRenderer[] = [];
  private readonly activeCandles = new Map<number, CandleRenderer>();
  private readonly MAX_POOL_SIZE = 500; // Maximum pool size to prevent memory leaks

  constructor() {
    // Pre-populate pool with some renderers
    for (let i = 0; i < 50; i++) {
      this.pool.push(new CandleRenderer());
    }
    logger.debug(`Initialized candle pool with ${this.pool.length} renderers`);
  }

  /**
   * Get or create a CandleRenderer for the given timestamp
   */
  getCandle(timestamp: number): CandleRenderer {
    // Check if we already have an active renderer for this timestamp
    let renderer = this.activeCandles.get(timestamp);

    if (!renderer) {
      // Try to get one from the pool, or create new if pool is empty
      renderer = this.pool.pop();

      if (!renderer) {
        renderer = new CandleRenderer();
      }

      this.activeCandles.set(timestamp, renderer);
    }

    return renderer;
  }

  /**
   * Update all active candle renderers
   */
  updateAll(deltaTime: number) {
    this.activeCandles.forEach((renderer) => {
      renderer.update(deltaTime);
    });
  }

  /**
   * Reset the pool - return inactive candles to the pool
   * Called at the start of each frame to prepare for new drawing
   * MUST preserve highlight state for highlighted candles
   */
  reset() {
    // Return renderers to pool but keep them if they have highlights
    const highlightedRenderers = new Map<number, CandleRenderer>();

    this.activeCandles.forEach((renderer, timestamp) => {
      if (renderer.highlightPattern) {
        // Keep highlighted renderers active
        highlightedRenderers.set(timestamp, renderer);
      } else {
        // Return non-highlighted renderers to pool
        renderer.reset();
        if (this.pool.length < this.MAX_POOL_SIZE) {
          this.pool.push(renderer);
        }
      }
    });

    // Clear active candles and restore only highlighted ones
    this.activeCandles.clear();
    highlightedRenderers.forEach((renderer, timestamp) => {
      this.activeCandles.set(timestamp, renderer);
    });
  }

  /**
   * Get the number of active candles (for debugging)
   */
  getActiveCount(): number {
    return this.activeCandles.size;
  }

  /**
   * Get the pool size (for debugging)
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Clear the pool completely (for cleanup)
   */
  dispose() {
    this.activeCandles.clear();
    this.pool.length = 0;
    logger.debug("Candle pool disposed");
  }
}
