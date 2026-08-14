// Build face: the embed (dist/embed/mnx-lab.js, IIFE + ESM) — one script tag
// registers the elements/ custom elements and nothing else. The workbench
// shell must never be reachable from here (the old embed was the app shell
// moonlighting as the component; that conflation is what this face unwinds).
//
// THE ARTIFACT LOCATES ITS OWN ASSETS
// (roadmap/proposed/core-viewer-embedded-app.md). The component needs two
// SMuFL metadata files and the Bravura face. Defaulting those to the HOST
// page's `/smufl` made "one script tag" untrue: an embed on a foreign origin
// fetched `example.com/smufl/glyphnames.json` (404) and asked the host to
// declare an @font-face it had no reason to know about. `embed.html` never
// caught it because it is served from the workbench's own origin, where
// `/smufl` happens to exist — a test that can only pass.
//
// So this face derives its asset base from ITS OWN script URL and registers
// the font itself. A host may still override with the `smufl-base` attribute
// on the script tag (assets mirrored elsewhere, or split to a CDN).
import { setSmuflBasePath } from '../engine/smufl/smufl.ts';
import '../elements/ScoreViewer.ts';

/** The directory this script was loaded from, or null outside a browser. */
function scriptDirectory(): string | null {
  // `document.currentScript` is set while a classic script executes (the IIFE
  // face); `import.meta.url` covers the ESM face.
  const current =
    typeof document !== 'undefined'
      ? (document.currentScript as HTMLScriptElement | null)
      : null;
  const href = current?.src || (typeof import.meta !== 'undefined' ? import.meta.url : '');
  if (!href) return null;
  try {
    const url = new URL(href, typeof location !== 'undefined' ? location.href : undefined);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/\/[^/]*$/, '');
    return url.href.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

/** An explicit `smufl-base` on the script tag wins over the derived default. */
function declaredBase(): string | null {
  if (typeof document === 'undefined') return null;
  const current = document.currentScript as HTMLScriptElement | null;
  const attr =
    current?.getAttribute('smufl-base') ??
    document.querySelector('script[smufl-base]')?.getAttribute('smufl-base');
  return attr ? attr.replace(/\/+$/, '') : null;
}

const base = declaredBase() ?? scriptDirectory();
if (base) {
  setSmuflBasePath(`${base}/smufl`);
  registerBravura(`${base}/smufl/Bravura.woff2`);
}

/**
 * Register the notation face with the DOCUMENT (fonts are document-scoped —
 * a @font-face inside our shadow root would not apply to the shadow text).
 * Idempotent: several viewers on a page, or a host that already declared
 * Bravura itself, must not stack duplicate faces.
 */
function registerBravura(url: string): void {
  if (typeof document === 'undefined' || typeof FontFace === 'undefined') return;
  for (const font of document.fonts) if (font.family === 'Bravura') return;
  try {
    const face = new FontFace('Bravura', `url(${url}) format('woff2')`, { display: 'block' });
    document.fonts.add(face);
    void face.load().catch(() => {
      // A host may serve the face itself, or the network may be down; the
      // renderer still lays out (metrics come from the JSON, not the font).
    });
  } catch {
    // FontFace construction can throw on a malformed URL — never fatal.
  }
}
