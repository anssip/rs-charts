import { serve } from "bun";

const server = serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = url.pathname;

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

      // Try root directory
      const rootFile = Bun.file(`.${filePath}`);
      if (await rootFile.exists()) {
        return new Response(rootFile);
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return new Response("Error", { status: 500 });
    }
  },
});

console.log(`Listening on http://localhost:${server.port}`);
