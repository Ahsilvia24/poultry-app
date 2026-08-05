/**
 * Proxy Expo web with COOP/COEP so expo-sqlite's SharedArrayBuffer works.
 * Usage: node scripts/expo-web-proxy.mjs
 *   → http://localhost:8082  →  http://localhost:8081
 */
import http from "http";
import https from "https";

const TARGET = process.env.EXPO_TARGET || "http://127.0.0.1:8081";
const PORT = Number(process.env.PROXY_PORT || 8082);

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", TARGET);
  const opts = {
    protocol: url.protocol,
    hostname: url.hostname,
    port: url.port,
    path: url.pathname + url.search,
    method: req.method,
    headers: { ...req.headers, host: url.host },
  };
  const lib = url.protocol === "https:" ? https : http;
  const upstream = lib.request(opts, (up) => {
    const headers = {
      ...up.headers,
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "cross-origin",
    };
    // COEP requires CORP on all subresources; ensure wasm/js are embeddable
    res.writeHead(up.statusCode || 502, headers);
    up.pipe(res);
  });
  upstream.on("error", (err) => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end(`Proxy error: ${err.message}`);
  });
  req.pipe(upstream);
});

server.listen(PORT, () => {
  console.log(`Expo COOP/COEP proxy http://localhost:${PORT} → ${TARGET}`);
});
