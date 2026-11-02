import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { chromeBin } from '../verify/chromeBin.mjs';

function binDir(...names: string[]): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'chrome-bin-'));
  for (const name of names) writeFileSync(path.join(dir, name), '#!/bin/sh\n', { mode: 0o755 });
  return dir;
}

describe('chromeBin', () => {
  it('uses Chromium where Chrome is not installed', () => {
    const dir = binDir('chromium');
    expect(chromeBin({ PATH: dir })).toBe(path.join(dir, 'chromium'));
  });

  it('prefers Chrome when both are installed, even later on PATH', () => {
    const chromium = binDir('chromium'), chrome = binDir('google-chrome');
    expect(chromeBin({ PATH: [chromium, chrome].join(path.delimiter) })).toBe(path.join(chrome, 'google-chrome'));
  });

  it('skips a file that cannot be run', () => {
    const dir = binDir('chromium');
    writeFileSync(path.join(dir, 'google-chrome'), 'not a program', { mode: 0o644 });
    expect(chromeBin({ PATH: dir })).toBe(path.join(dir, 'chromium'));
  });

  it('honours CHROME_BIN, by path or by name, over anything installed', () => {
    const dir = binDir('google-chrome', 'my-browser');
    const mine = path.join(dir, 'my-browser');
    expect(chromeBin({ PATH: dir, CHROME_BIN: mine })).toBe(mine);
    expect(chromeBin({ PATH: dir, CHROME_BIN: 'my-browser' })).toBe(mine);
  });

  it('refuses a CHROME_BIN that does not run rather than falling back', () => {
    const dir = binDir('google-chrome');
    expect(() => chromeBin({ PATH: dir, CHROME_BIN: '/no/such/browser' })).toThrow(/CHROME_BIN/);
  });

  it('says what it looked for when nothing is installed', () => {
    const empty = mkdtempSync(path.join(tmpdir(), 'chrome-bin-'));
    if (process.platform !== 'darwin') expect(() => chromeBin({ PATH: empty })).toThrow(/google-chrome.*chromium/);
  });
});
