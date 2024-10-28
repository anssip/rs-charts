import { serve } from "bun";

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

    if (filePath === "/") {
      filePath = "/index.html";
    }

    // Try root directory first, then src
    try {
      // Try root directory
      let file = Bun.file(`.${filePath}`);
      if (await file.exists()) {
        return new Response(file);
      }

      // Try src directory
      file = Bun.file(`src${filePath}`);
      if (await file.exists()) {
        return new Response(file);
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return new Response("Error", { status: 500 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
