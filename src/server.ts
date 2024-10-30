import { serve } from "bun";
import { PriceDataService } from "./services/price-data";
import dotenv from "dotenv";

const API_KEY = process.env.COINGECKO_API_KEY;
if (!API_KEY) {
  throw new Error("COINGECKO_API_KEY environment variable is required");
}

dotenv.config();

const priceService = new PriceDataService(API_KEY);

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
            symbol: params.get("symbol") || "bitcoin",
            interval: (params.get("interval") || "1h") as "1h",
            limit: parseInt(params.get("limit") || "168"),
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
      // For .js files, try dist directory first
      if (filePath.endsWith(".js")) {
        const distFile = Bun.file(`dist${filePath}`);
        if (await distFile.exists()) {
          return new Response(distFile);
        }
      }

      // Try src directory
      const srcFile = Bun.file(`src${filePath}`);
      if (await srcFile.exists()) {
        return new Response(srcFile);
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return new Response("Error", { status: 500 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
