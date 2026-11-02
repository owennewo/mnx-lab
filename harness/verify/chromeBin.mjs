// Which browser the smokes and renderers drive: CHROME_BIN if set, otherwise the first
// Chrome-family browser installed. They only speak the DevTools protocol and headless flags,
// so a machine with Chromium and no Chrome needs no configuration.
import { accessSync, constants } from 'node:fs';
import path from 'node:path';

const ON_PATH = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge', 'brave-browser', 'brave'];
const APPLICATIONS = ['Google Chrome.app/Contents/MacOS/Google Chrome', 'Chromium.app/Contents/MacOS/Chromium'].map(app => `/Applications/${app}`);

const runnable = file => {
  try { accessSync(file, constants.X_OK); return true; } catch { return false; }
};

/** The browser to launch as a full path, or an error naming what was looked for. Takes `env` so it can be tested. */
export function chromeBin(env = process.env) {
  const dirs = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  const onPath = name => dirs.map(dir => path.join(dir, name)).find(runnable);
  if (env.CHROME_BIN) {
    const named = env.CHROME_BIN.includes(path.sep) ? env.CHROME_BIN : onPath(env.CHROME_BIN);
    if (named && runnable(named)) return path.resolve(named);
    throw new Error(`CHROME_BIN is ${env.CHROME_BIN}, which is not a runnable browser.`);
  }
  for (const name of ON_PATH) {
    const file = onPath(name);
    if (file) return file;
  }
  const app = APPLICATIONS.find(runnable);
  if (app) return app;
  throw new Error(`No Chrome-family browser found: looked for ${ON_PATH.join(', ')} on PATH. Install one, or set CHROME_BIN.`);
}
