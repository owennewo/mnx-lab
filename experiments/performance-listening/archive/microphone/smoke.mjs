// Real browser capture path, using Chrome's fake microphone only. No human mic access.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import puppeteer from "puppeteer-core";
import { createServer } from "vite";
import { bench, wav } from "../evaluation/io.mjs";
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "listening-mic-"));
const input = path.join(scratch, "a4.wav");
fs.writeFileSync(
  input,
  wav(
    Float32Array.from(
      { length: 44100 * 6 },
      (_, i) =>
        0.002 * Math.sin((2 * Math.PI * 110 * i) / 44100) +
        (i < 44100 * 2.5 ? 0 : 0.2 * Math.sin((2 * Math.PI * 440 * i) / 44100)),
    ),
    44100,
  ),
);
const server = await createServer({
  root: bench,
  configFile: false,
  server: { host: "127.0.0.1", port: 0 },
});
let browser;
try {
  await server.listen();
  browser = await puppeteer.launch({
    executablePath:
      process.env.CHROME_BIN ??
      execFileSync("which", ["google-chrome"], { encoding: "utf8" }).trim(),
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${input}`,
    ],
  });
  const page = await browser.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewport({ width: 1100, height: 1050 });
  const url = `http://127.0.0.1:${server.httpServer.address().port}/microphone/`;
  await page.goto(url);
  await page.click("#record");
  await page.waitForFunction(
    () => document.querySelector("#stream").textContent.includes("A4"),
    { timeout: 20000 },
  );
  await page.waitForFunction(() =>
    document.querySelector("#active").textContent.includes("A4"),
  );
  await page.screenshot({ path: path.join(scratch, "live.png") });
  await page.click("#stop");
  await page.waitForFunction(
    () => !document.querySelector("#notesDownload").hidden,
  );
  const result = await page.evaluate(async () => {
    const notes = await (
      await fetch(document.querySelector("#notesDownload").href)
    ).json();
    const audio = await (
      await fetch(document.querySelector("#audioDownload").href)
    ).arrayBuffer();
    return {
      notes,
      bytes: audio.byteLength,
      rate: new DataView(audio).getUint32(24, true),
    };
  });
  assert.equal(result.notes.recipe, "F-006");
  assert.equal(result.notes.microphonePolicy.calibrated, true);
  assert.equal(result.notes.microphonePolicy.marginDb, 12);
  assert.equal(result.notes.config.minFrames, 8);
  assert.ok(result.notes.microphonePolicy.thresholdRms > 0.001);
  assert.ok(result.notes.events.every((e) => e.decisionSample / 22050 > 2));
  assert.equal(result.rate, 22050);
  assert.ok(result.notes.events.some((e) => e.pitch === 69));
  assert.equal(
    result.bytes,
    44 + Math.round(result.notes.duration * 22050) * 2,
  );
  assert.equal(await page.$eval("#record", (el) => el.disabled), false);
  await page.select("#recipe", "F-003");
  await page.select("#noise", "0");
  await page.select("#confirmation", "0");
  await page.click("#record");
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.startsWith("Recording —"),
  );
  await page.waitForFunction(() =>
    document.querySelector("#stream").textContent.includes("A4"),
  );
  await page.click("#stop");
  await page.waitForFunction(
    () => !document.querySelector("#notesDownload").hidden,
  );
  assert.equal(
    await page.evaluate(
      async () =>
        (
          await (
            await fetch(document.querySelector("#notesDownload").href)
          ).json()
        ).recipe,
    ),
    "F-003",
  );
  // Permission denial must recover the controls.
  await page.reload();
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.click("#record");
  await page.waitForFunction(() =>
    document.querySelector("#status").textContent.includes("denied"),
  );
  assert.equal(await page.$eval("#record", (el) => el.disabled), false);
  // Stop while permission is pending; a late stream must be released.
  await page.reload();
  await page.evaluate(() => {
    const get = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices,
    );
    navigator.mediaDevices.getUserMedia = async (c) => {
      const s = await get(c);
      window.testTracks = s.getTracks();
      await new Promise((r) => setTimeout(r, 500));
      return s;
    };
  });
  await page.click("#record");
  await page.waitForFunction(() => window.testTracks?.length);
  await page.click("#stop");
  await page.waitForFunction(() =>
    window.testTracks.every((t) => t.readyState === "ended"),
  );
  assert.equal(await page.$eval("#record", (el) => el.disabled), false);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: capture → worklet → detector worker → live A4, both recipes, WAV/JSON exports, restart, denial, pending cancellation.",
  );
  console.log(`Screenshot: ${scratch}/live.png`);
} finally {
  await browser?.close();
  await server.close();
}
