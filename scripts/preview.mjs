import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const assets = new Set(["customer.mjs", "money.mjs", "design-tokens.mjs", "receipt-image.mjs"]);
const pages = new Map([["/launch-demo", "launch"], ["/agent-demo", "agent"], ["/api-docs", "agent"], ["/admin-demo", "admin"], ["/", "landing"], ["/pricing", "pricing"], ["/contact", "contact"], ["/terms", "terms"], ["/privacy", "privacy"], ["/refunds", "refunds"]]);
const server = http.createServer(async (request, response) => {
  try {
    const route = new URL(request.url, "http://127.0.0.1").pathname;
    const asset = route.startsWith("/preview/") ? route.slice(9) : "";
    const page = pages.get(route);
    const source = route === "/offline.html" ? "../public/offline.html" : route === "/logo.svg" ? "../public/logo.svg" : page ? "../preview/" + page + ".html" : route === "/dashboard-demo" || route === "/index.html" ? "../preview/index.html" : assets.has(asset) ? "../preview/" + asset : null;
    if (!source) { response.writeHead(404); response.end("Not found"); return; }
    const data = await readFile(fileURLToPath(new URL(source, import.meta.url)));
    response.writeHead(200, { "Content-Type": route === "/logo.svg" ? "image/svg+xml" : assets.has(asset) ? "text/javascript; charset=utf-8" : "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(data);
  } catch { response.writeHead(500); response.end("Preview unavailable"); }
});
server.listen(3100, "127.0.0.1", () => console.log("Hotdata design preview: http://127.0.0.1:3100/"));
