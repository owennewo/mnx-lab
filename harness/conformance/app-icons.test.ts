// The installable face of studio: the manifest, the icons it names, and the
// two facts about this deployment that are invisible in the files themselves.
//
// Both of those facts are about Cloudflare Access, which gates /studio at the
// edge (docs/library-access.md):
//
//   the MANIFEST is behind it, so the page must ask for it with credentials;
//   the ICONS must not be, because Chrome hands their URLs to Google's WebAPK
//   minting service, which fetches them server-side with no Access cookie.
//
// Neither has a symptom a developer would notice locally — the install just
// quietly falls back to a generated letter tile — so they are asserted here.
import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

const manifest = JSON.parse(fs.readFileSync(path.resolve('public/studio/manifest.webmanifest'), 'utf8'));
const html = fs.readFileSync(path.resolve('studio/index.html'), 'utf8');
const iconSvg = fs.readFileSync(path.resolve('public/app-icons/icon.svg'), 'utf8');

/** A PNG's IHDR carries its dimensions in bytes 16–24; no decoder needed. */
function pngSize(file: string): { width: number; height: number } {
  const bytes = fs.readFileSync(file);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

it('declares one identity for the installed app, scoped to studio', () => {
  expect(manifest.id).toBe('/studio/');
  expect(manifest.start_url).toBe('/studio/');
  expect(manifest.scope).toBe('/studio/');
  expect(manifest.display).toBe('standalone');
  expect(manifest.name).toBe('MNX Studio');
  // Android truncates a home-screen label past roughly a dozen characters.
  expect(manifest.short_name.length).toBeLessThanOrEqual(12);
});

it('paints the splash and the status bar in studio.css colours', () => {
  const css = fs.readFileSync(path.resolve('apps/studio/studio.css'), 'utf8');
  const theme = fs.readFileSync(path.resolve('apps/studio/src/theme.ts'), 'utf8');
  // The manifest can carry only ONE colour, so it takes the light ground; the
  // dark one is reachable only through the meta element theme.ts rewrites.
  expect(manifest.background_color).toBe('#f3f2f1');
  expect(manifest.theme_color).toBe('#f3f2f1');
  expect(theme).toContain("light: '#f3f2f1'");
  expect(theme).toContain("dark: '#141211'");
  // studio.css states those same two grounds in oklch(); if it is retuned, the
  // hexes here and in the manifest are what go stale.
  expect(css).toContain('light-dark(oklch(0.962 0.002 60), oklch(0.185 0.004 60))');
  expect(html).toContain('<meta name="theme-color"');
});

it('asks for the manifest with credentials, because Access gates /studio', () => {
  const link = /<link rel="manifest"[^>]*>/.exec(html)?.[0] ?? '';
  expect(link).toContain('href="/studio/manifest.webmanifest"');
  expect(link).toContain('crossorigin="use-credentials"');
});

it('serves every icon from outside the Access-gated paths', () => {
  const gated = [/^\/studio\//, /^\/api\//];
  const referenced = [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    ...[...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
  ];
  expect(referenced.length).toBeGreaterThanOrEqual(4);
  for (const src of referenced) {
    expect(src.startsWith('/'), `${src} must be an absolute path`).toBe(true);
    for (const rule of gated) expect(rule.test(src), `${src} is behind Access`).toBe(false);
    expect(fs.existsSync(path.resolve(`public${src}`)), `${src} is missing`).toBe(true);
  }
});

it('ships the icons at the sizes the manifest claims', () => {
  for (const icon of manifest.icons) {
    const { width, height } = pngSize(path.resolve(`public${icon.src}`));
    expect(`${width}x${height}`).toBe(icon.sizes);
    // Declared maskable, so the safe-zone assertion below has to hold for it.
    expect(icon.purpose).toBe('any maskable');
  }
  // iOS ignores the manifest and reads the link; it must also be square.
  const apple = pngSize(path.resolve('public/app-icons/apple-touch-icon-180.png'));
  expect(apple).toEqual({ width: 180, height: 180 });
});

it('keeps the mark inside the maskable safe circle, caps included', () => {
  // The whole point: a round cap reaches stroke-width/2 BEYOND its endpoint,
  // so the drawing is wider and taller than its coordinates say. Measuring the
  // endpoints alone is the mistake this test exists to catch — at full size the
  // chosen composition overflowed by 11px and had to be scaled to 0.92.
  const strokeWidth = Number(/<g stroke="[^"]+" stroke-width="(\d+)"/.exec(iconSvg)?.[1]);
  expect(strokeWidth).toBeGreaterThan(0);
  expect(iconSvg).toContain('stroke-linecap="round"');
  const cap = strokeWidth / 2;

  let dx = 0;
  let dy = 0;
  for (const [, x1, y1, x2, y2] of iconSvg.matchAll(
    /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"\/>/g,
  )) {
    for (const [x, y] of [[x1, y1], [x2, y2]] as const) {
      dx = Math.max(dx, Math.abs(Number(x) - 256) + cap);
      dy = Math.max(dy, Math.abs(Number(y) - 256) + cap);
    }
  }
  const ring = /<ellipse cx="256" cy="256" rx="([\d.]+)" ry="([\d.]+)"[^>]*stroke-width="([\d.]+)"/.exec(iconSvg);
  expect(ring).not.toBeNull();
  const [, rx, ry, ringWidth] = ring!;
  dx = Math.max(dx, Number(rx) + Number(ringWidth) / 2);
  dy = Math.max(dy, Number(ry) + Number(ringWidth) / 2);

  // The 80% circle, the worst case a launcher mask can be.
  expect(Math.hypot(dx, dy)).toBeLessThan(205);
  // The ground has to reach every edge, or a mask cuts into nothing.
  expect(iconSvg).toContain('<rect width="512" height="512" fill="#141211"/>');
});
