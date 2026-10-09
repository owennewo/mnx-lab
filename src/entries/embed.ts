// Build face: the embed (dist/embed/mnx-lab.js, IIFE + ESM) — one script tag
// registers the elements/ custom elements and nothing else. The workbench
// shell must never be reachable from here (the old embed was the app shell
// moonlighting as the component; that conflation is what this face unwinds).
//
// THE ARTIFACT LOCATES ITS OWN ASSETS
// (roadmap/complete/core-viewer-embedded-app.md). The component needs two
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
//
// THE SYNTH TOO (roadmap/complete/core-campaign-synth.md, option A). The player plays
// on the synth's instrument host, whose runtime (host code, AudioWorklet, DSP) the build
// copies to `synth/` beside this script (vite.embed.config.ts). Only a page with a player
// loads it. On a page of another origin the artifact's server must send CORS headers for
// `synth/` (the worklet and modules load in cors mode), and a page CSP must admit the
// artifact's origin and 'wasm-unsafe-eval'. A `synth-base` attribute overrides the location.
import { setSynthBase } from '../audio/native/hostPort.ts';
import { setSmuflBasePath } from '../engine/smufl/smufl.ts';
import '../elements/DocumentViewer.ts';

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

/** An explicit `smufl-base` (or `synth-base`) on the script tag wins over the derived default. */
function declaredBase(name: 'smufl-base' | 'synth-base'): string | null {
  if (typeof document === 'undefined') return null;
  const current = document.currentScript as HTMLScriptElement | null;
  const attr =
    current?.getAttribute(name) ??
    document.querySelector(`script[${name}]`)?.getAttribute(name);
  return attr ? attr.replace(/\/+$/, '') : null;
}

const directory = scriptDirectory();
const base = declaredBase('smufl-base') ?? directory;
if (base) {
  setSmuflBasePath(`${base}/smufl`);
  registerBravura(`${base}/smufl/Bravura.woff2`);
}
const synth = declaredBase('synth-base') ?? (directory && `${directory}/synth`);
if (synth) setSynthBase(synth);

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

export { Player } from '../elements/Player.ts';
export { bindPlayback } from '../elements/playbackHost.ts';

export type { AudioRecordingSource, YouTubeRecordingSource, RecordingSource, ScorePosition, ScoreLoop, PlaybackCapabilities } from '../audio/playbackBackend.ts';
export type { PlaybackSnapshot } from '../audio/playbackSession.ts';

export { ScoreFrame } from '../elements/ScoreFrame.ts';
