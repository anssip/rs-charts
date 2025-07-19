import { serve } from "bun";
import { CoinbasePriceDataService } from "./services/price-data/coinbase";
import dotenv from "dotenv";
import { Granularity } from "./services/price-data/price-history-model";

// MIME type mapping
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'mjs':
      return 'text/javascript';
    case 'ts':
      return 'text/typescript';
    case 'html':
      return 'text/html';
    case 'css':
      return 'text/css';
    case 'json':
      return 'application/json';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'svg':
      return 'image/svg+xml';
    case 'ico':
      return 'image/x-icon';
    default:
      return 'text/plain';
  }
}

dotenv.config();

const CB_API_KEY = process.env.COINBASE_API_KEY;
const CB_PRIVATE_KEY = process.env.COINBASE_PRIVATE_KEY;

if (!CB_API_KEY || !CB_PRIVATE_KEY) {
  throw new Error("Coinbase API credentials are required");
}

const priceService = new CoinbasePriceDataService(CB_API_KEY, CB_PRIVATE_KEY);
const port = process.env.PORT || 8080;

const allowedOrigins = [
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "https://spotcanvas.com",
  "https://www.spotcanvas.com",
  "https://chart-api.spotcanvas.com",
  "https://spot-ws.webflow.io",
];

const server = serve({
  port: port,
  async fetch(req) {
    const origin = req.headers.get("Origin");
    const corsHeaders = {
      "Access-Control-Allow-Origin":
        origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Cache-Control, Pragma, User-Agent, Accept, Origin, Referer, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Expose-Headers": "*",
      Vary: "Origin",
    };

    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders as HeadersInit,
      });
    }

    const url = new URL(req.url);
    let filePath = url.pathname;
    console.log(`filePath: ${filePath}`);

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
            },
          );
        }
        try {
          const params = new URLSearchParams(url.search);
          const candles = await priceService.fetchCandles({
            symbol: params.get("symbol") ?? "BTC-USD",
            granularity: (params.get("granularity") ??
              "ONE_HOUR") as Granularity,
            start: new Date(parseInt(params.get("start")!)),
            end: new Date(parseInt(params.get("end")!)),
          });
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
            },
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
      // Try client files first
      let clientFile = Bun.file(`dist/client${filePath}`);
      if (await clientFile.exists()) {
        const mimeType = getMimeType(filePath);
        return new Response(clientFile, {
          headers: {
            ...corsHeaders,
            'Content-Type': mimeType,
          } as HeadersInit,
        });
      }

      // Try lib files for the API demo
      if (filePath.startsWith('/client/lib.js') || filePath === '/client/lib.js') {
        clientFile = Bun.file(`dist/lib/lib.js`);
        if (await clientFile.exists()) {
          return new Response(clientFile, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/javascript',
            } as HeadersInit,
          });
        }
      }

      // Try root client files (for demo-api.html imports)
      if (filePath.startsWith('/client/')) {
        const rootPath = filePath.replace('/client/', '/');
        clientFile = Bun.file(`dist/client${rootPath}`);
        if (await clientFile.exists()) {
          const mimeType = getMimeType(rootPath);
          return new Response(clientFile, {
            headers: {
              ...corsHeaders,
              'Content-Type': mimeType,
            } as HeadersInit,
          });
        }
      }

      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders as HeadersInit,
      });
    } catch (e) {
      return new Response("Error", {
        status: 500,
        headers: corsHeaders as HeadersInit,
      });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
