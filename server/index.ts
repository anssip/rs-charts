import { serve } from "bun";
import { CoinbasePriceDataService } from "./services/price-data-cb";
import dotenv from "dotenv";

dotenv.config();

const CB_API_KEY = process.env.COINBASE_API_KEY;
const CB_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;

if (!CB_API_KEY || !CB_PRIVATE_KEY) {
  throw new Error("Coinbase API credentials are required");
}

const priceService = new CoinbasePriceDataService(CB_API_KEY, CB_PRIVATE_KEY);

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

    if (filePath.startsWith("/api")) {
      if (filePath === "/api/candles") {
        try {
          const params = new URLSearchParams(url.search);
          const candles = await priceService.fetchCandles({
            symbol: params.get("symbol") || "BTC-USD",
            interval: (params.get("interval") || "1h") as "1h",
            limit: parseInt(params.get("limit") || "10"),
          });
          return new Response(JSON.stringify(candles), {
            headers: { "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch candles" }),
            {
              status: 500,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
      return new Response("Not Found", { status: 404 });
    }

    // Handle static files
    if (filePath === "/") {
      filePath = "/index.html";
    }

    try {
      // Serve all static files from dist/client
      const clientFile = Bun.file(`dist/client${filePath}`);
      if (await clientFile.exists()) {
        return new Response(clientFile);
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return new Response("Error", { status: 500 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
