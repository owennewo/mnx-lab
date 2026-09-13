import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "vite";
import puppeteer from "puppeteer-core";
import {
  bench,
  root,
  hash,
  readJSON,
  writeJSON,
  wav,
  filesHash,
} from "../evaluation/io.mjs";
import { fusionHeldout } from "../fixtures/fusion-heldout.mjs";
import { cases, templateCases } from "../fixtures/cases.mjs";
const output = path.resolve(
  process.argv[2] ?? path.join(bench, "output/audio-v1"),
);
if (fs.existsSync(output))
  throw Error(
    `Refusing to overwrite ${output}; choose a new directory/version.`,
  );
const config = readJSON(path.join(bench, "experiments/baseline.json"));
const server = await createServer({
  root,
  configFile: false,
  server: { host: "127.0.0.1", port: 0 },
  plugins: [
    {
      name: "bench-render",
      configureServer(s) {
        s.middlewares.use("/listening.html", (_req, res) => {
          res.setHeader("Content-Type", "text/html");
          res.end("<!doctype html><title>Listening bench</title>");
        });
      },
    },
  ],
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_BIN ??
      execFileSync("which", ["google-chrome"], { encoding: "utf8" }).trim(),
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });
  const page = await browser.newPage();
  page.on("pageerror", (error) => console.error(error));
  await page.goto(
    `http://127.0.0.1:${server.httpServer.address().port}/listening.html`,
  );
  await page.evaluate(async () => {
    globalThis.adapter = await import(
      "/experiments/performance-listening/rendering/browser.mjs"
    );
  });
  const mnx = await page.evaluate(() => globalThis.adapter.compiledFixture());
  // Independent check of the simple 120 BPM score, not copied from compiler output.
  if (
    JSON.stringify(mnx.actual.map((n) => [n.pitch, n.start, n.end])) !==
    JSON.stringify([
      [60, 0.25, 0.75],
      [64, 0.75, 1.25],
    ])
  )
    throw Error("MNX adapter disagrees with independent schedule");
  const heldout = process.argv.includes("--fusion-heldout");
  const fixtures = heldout ? fusionHeldout() : [...cases(), mnx];
  const records = [];
  for (const preset of config.presets) {
    const work = [
      ...fixtures,
      ...(!heldout && preset === config.templatePreset
        ? templateCases(config)
        : []),
    ];
    for (const fixture of work) {
      const rendered = await page.evaluate(
        (f, p, s) => globalThis.adapter.render(f, p, s),
        fixture,
        preset,
        config.sampleRate,
      );
      const bytes = wav(rendered.samples, config.sampleRate),
        file = `${preset}/${fixture.id}.wav`;
      fs.mkdirSync(path.join(output, preset), { recursive: true });
      fs.writeFileSync(path.join(output, file), bytes);
      const peak = Math.max(...rendered.samples.map(Math.abs));
      if (!Number.isFinite(peak) || peak >= 1)
        throw Error("Invalid or clipped fixture: " + file);
      if (fixture.actual.length && peak < 1e-5)
        throw Error("Silent nonempty fixture: " + file);
      if (!fixture.actual.length && peak !== 0)
        throw Error("Nonzero silence fixture: " + file);
      records.push({
        preset,
        ...fixture,
        file,
        audioHash: hash(bytes),
        fixtureHash: hash(JSON.stringify(fixture)),
        peak,
        sources: rendered.sources,
      });
    }
    console.log(`Rendered ${preset}: ${work.length} fixtures`);
  }
  const packs = Object.fromEntries(
    config.presets.map((id) => {
      const dir = {
        guitar: "shinyguitar-v1",
        guitar2: "spanish-guitar-v1",
        piano: "upright-piano-v1",
      }[id];
      const base = path.join(root, "public/samples", dir);
      return [
        id,
        {
          directory: dir,
          manifest: readJSON(path.join(base, "manifest.json")),
          hashes: filesHash(base),
        },
      ];
    }),
  );
  writeJSON(path.join(output, "manifest.json"), {
    version: 1,
    config,
    revision: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).trim(),
    rendererSourceHashes: filesHash(path.join(root, "src/audio")),
    browser: await browser.version(),
    sampleRate: config.sampleRate,
    masterVolume: 0.5,
    preRoll: 0.25,
    releaseTail: 0.4,
    packs,
    records,
  });
  console.log(`Saved immutable audio set: ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
