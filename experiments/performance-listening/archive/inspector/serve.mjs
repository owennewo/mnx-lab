import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { bench, readJSON } from "../evaluation/io.mjs";
const run = path.resolve(process.argv[2] ?? path.join(bench, "output/run-v1"));
const results = readJSON(path.join(run, "results.json"));
const audio = path.resolve(run, results.audioDirectory);
const server = http.createServer((req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (url.pathname === "/") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(fs.readFileSync(path.join(bench, "inspector/index.html")));
    } else if (url.pathname === "/results.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(results));
    } else if (url.pathname === "/audio") {
      const index = Number(url.searchParams.get("index"));
      if (
        !url.searchParams.has("index") ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= results.audioManifest.records.length
      )
        throw Error("Invalid recording");
      const record = results.audioManifest.records[index];
      const file = path.resolve(audio, record.file);
      if (!file.startsWith(audio + path.sep))
        throw Error("Invalid recording path");
      res.setHeader("Content-Type", "audio/wav");
      res.setHeader("Content-Length", fs.statSync(file).size);
      fs.createReadStream(file).pipe(res);
    } else {
      res.statusCode = 404;
      res.end("Not found");
    }
  } catch (error) {
    res.statusCode = 400;
    res.end(String(error));
  }
});
server.listen(Number(process.env.PORT ?? 0), "127.0.0.1", () =>
  console.log(`Listening inspector: http://127.0.0.1:${server.address().port}`),
);
