/**
 * SMuFL (Standard Music Font Layout) metadata lookup.
 *
 * Loads `glyphnames.json` (canonical name → Unicode codepoint) and
 * `bravura_metadata.json` (per-glyph bounding boxes and anchor points,
 * all in staff spaces) from public/smufl/ at runtime.
 *
 * Call loadSmufl() once at app startup. After that the sync getters
 * are safe to call from rendering code.
 */

interface GlyphnameEntry {
  codepoint: string;
  alternateCodepoint?: string;
  description?: string;
}

interface BBoxEntry {
  bBoxNE: [number, number];
  bBoxSW: [number, number];
}

interface BravuraMetadata {
  fontName?: string;
  fontVersion?: string;
  engravingDefaults?: Record<string, number>;
  glyphAdvanceWidths?: Record<string, number>;
  glyphBBoxes?: Record<string, BBoxEntry>;
  glyphsWithAnchors?: Record<string, Record<string, [number, number]>>;
}

let glyphnames: Record<string, GlyphnameEntry> | null = null;
let metadata: BravuraMetadata | null = null;
let loadPromise: Promise<void> | null = null;

export interface SmuflLoadOptions {
  basePath?: string;
}

export function loadSmufl(options: SmuflLoadOptions = {}): Promise<void> {
  if (loadPromise) return loadPromise;
  const base = options.basePath ?? '/smufl';
  loadPromise = Promise.all([
    fetch(`${base}/glyphnames.json`).then(r => r.json()),
    fetch(`${base}/bravura_metadata.json`).then(r => r.json())
  ]).then(([gn, md]) => {
    glyphnames = gn as Record<string, GlyphnameEntry>;
    metadata = md as BravuraMetadata;
  });
  return loadPromise;
}

export function isSmuflLoaded(): boolean {
  return glyphnames !== null && metadata !== null;
}

/**
 * Resolve a canonical SMuFL glyph name (e.g. "gClef", "6stringTabClef")
 * to the Unicode character to put inside a <text> element.
 *
 * Returns '' and logs a warning if the name is unknown or SMuFL is not loaded.
 */
export function glyphCodepoint(name: string): string {
  if (!glyphnames) {
    console.warn('SMuFL not loaded — call loadSmufl() before rendering');
    return '';
  }
  const entry = glyphnames[name];
  if (!entry) {
    console.warn(`SMuFL glyph not found: ${name}`);
    return '';
  }
  const hex = entry.codepoint.replace(/^U\+/, '');
  return String.fromCodePoint(parseInt(hex, 16));
}

/**
 * Anchor point in staff spaces (e.g. where a stem attaches to a notehead).
 * Returns null if the glyph or anchor is not defined.
 */
export function glyphAnchor(
  name: string,
  anchor: string
): { x: number; y: number } | null {
  const anchors = metadata?.glyphsWithAnchors?.[name];
  if (!anchors) return null;
  const a = anchors[anchor];
  if (!a) return null;
  return { x: a[0], y: a[1] };
}

/**
 * Glyph bounding box in staff spaces, with origin at the glyph's design origin.
 * x/y are the south-west corner; w/h are positive extents.
 */
export function glyphBBox(
  name: string
): { x: number; y: number; w: number; h: number } | null {
  const bb = metadata?.glyphBBoxes?.[name];
  if (!bb) return null;
  const [neX, neY] = bb.bBoxNE;
  const [swX, swY] = bb.bBoxSW;
  return {
    x: swX,
    y: swY,
    w: neX - swX,
    h: neY - swY
  };
}

/**
 * Default engraving values from the font (line thicknesses, etc.) in staff spaces.
 * Falls back to a SMuFL-recommended default if the key is missing.
 */
export function engravingDefault(key: string, fallback = 0): number {
  return metadata?.engravingDefaults?.[key] ?? fallback;
}
