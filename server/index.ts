import { serve } from "bun";
import { CoinbasePriceDataService } from "./services/price-data/coinbase";
import dotenv from "dotenv";
import { Granularity } from "./services/price-data/price-history-model";

dotenv.config();

const CB_API_KEY = process.env.COINBASE_API_KEY;
const CB_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;

if (!CB_API_KEY || !CB_PRIVATE_KEY) {
  throw new Error("Coinbase API credentials are required");
}

// Add debug logging (remove in production)
console.log("API Key:", CB_API_KEY);
console.log(
  "Private Key first/last chars:",
  CB_PRIVATE_KEY.substring(0, 10) +
    "..." +
    CB_PRIVATE_KEY.substring(CB_PRIVATE_KEY.length - 10)
);

const priceService = new CoinbasePriceDataService(CB_API_KEY, CB_PRIVATE_KEY);

const port = process.env.PORT || 8080;

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://spotcanvas.com",
  "https://chart-api.spotcanvas.com",
  "https://spot-ws.webflow.io",
];

const server = serve({
  port: port,
  async fetch(req) {
    const origin = req.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigins.includes(origin ?? "")
        ? origin
        : allowedOrigins[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: corsHeaders as HeadersInit,
      });
    }

    const url = new URL(req.url);
    let filePath = url.pathname;

    console.log("filePath", filePath);

    if (filePath.startsWith("/api")) {
      if (filePath === "/api/candles") {
        if (!url.searchParams.has("start") || !url.searchParams.has("end")) {
          return new Response(
            JSON.stringify({ error: "Start and end params are required" }),
            {
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              } as HeadersInit,
            }
          );
        }
        try {
          const params = new URLSearchParams(url.search);
          console.log("params", params);
          const candles = await priceService.fetchCandles({
            symbol: params.get("symbol") ?? "BTC-USD",
            granularity: (params.get("granularity") ??
              "ONE_HOUR") as Granularity,
            start: new Date(parseInt(params.get("start")!)),
            end: new Date(parseInt(params.get("end")!)),
          });
          console.log("Server: Fetched candles:", candles.size);
          return new Response(JSON.stringify(Object.fromEntries(candles)), {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            } as HeadersInit,
          });
        } catch (error) {
          return new Response(
            JSON.stringify({ error: "Failed to fetch candles" }),
            {
              status: 500,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
              } as HeadersInit,
            }
          );
        }
      }
      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders as HeadersInit,
      });
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
