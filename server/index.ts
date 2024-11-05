import { serve } from "bun";
import { CoinbasePriceDataService } from "./services/price-data/coinbase";
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
    const origin = req.headers.get("Origin");
    const allowedOrigins = ["http://localhost:3000", "http://127.0.0.1:3000"];

    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin ?? "")
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders,
      });
    }

    const url = new URL(req.url);
    let filePath = url.pathname;

    if (filePath.startsWith("/api")) {
      if (filePath === "/api/candles") {
        if (!url.searchParams.has("start") || !url.searchParams.has("end")) {
          return new Response(
            JSON.stringify({ error: "Start and end params are required" }),
            {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        try {
          const params = new URLSearchParams(url.search);
          console.log("params", params);
          const candles = await priceService.fetchCandles({
            symbol: params.get("symbol") || "BTC-USD",
            interval: (params.get("interval") || "1h") as "1h",
            start: new Date(parseInt(params.get("start")!)),
            end: new Date(parseInt(params.get("end")!)),
          });
          console.log("Server: Fetched candles:", candles.size);
          return new Response(JSON.stringify(Object.fromEntries(candles)), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch candles" }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      }
      return new Response("Not Found", { status: 404, headers: corsHeaders });
    }

    if (filePath === "/") {
      filePath = "/index.html";
    }

    try {
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
