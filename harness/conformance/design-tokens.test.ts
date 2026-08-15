// The token sheet's contract (roadmap/proposed/core-modernist-tokens.md).
//
// CSS is untyped, and a `var(--typo)` does not fail loudly — it computes to
// nothing. That is not hypothetical here: `tokens.ts` records the viewer once
// shipping with every chrome token undefined on a host page, where
// `stroke: var(--paper-line)` resolved to `none` and **the staff lines were not
// drawn at all**. Nothing in the build catches that class of bug, so it is
// caught here.
//
// Three rules, each guarding a different way the sheet rots:
//
//  1. THE EMBED IS SELF-SUFFICIENT. Every `var(--x)` the viewer's own styles
//     cite must be declared in `viewerTokens` (or be a public `--mnx-*`
//     override, which by definition may be absent). This is the assertion that
//     would have caught the historical bug outright, and it is what lets the
//     Modernist campaign move tokens around without re-testing the embed by
//     hand every time.
//
//  2. THE PUBLIC OVERRIDES SURVIVE. `--mnx-*` is the contract a host page
//     styles us through; renaming one is a breaking change for someone we
//     cannot see.
//
//  3. RADIUS IS A TOKEN DECISION. Use sites cite `--radius-*`; the values live
//     in one block. Circles and the gap diamond are deliberately exempt —
//     they are shapes that carry meaning, not corner treatments (see the
//     `radiusTokens` comment).
//
// EVERYTHING here is read as TEXT, and the token sheet is no exception —
// `.dependency-cruiser.cjs`'s `harness-not-into-shells` forbids
// `harness/ → src/elements/` outright ("the harness exercises machinery
// headlessly, never the app shells"). That ban is about layering, not about
// whether the import would technically resolve, so `tokens.ts` is parsed from
// source rather than imported for its `.cssText`. Components could not be
// imported anyway: `@customElement` needs a DOM and this suite runs in Node.
// `viewer-surface.test.ts` is the precedent for reading source with `fs`;
// `groups.test.ts` for asserting a display invariant from the harness.
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const SRC = path.join(import.meta.dirname, '../../src');

const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const TOKENS_SRC = read('elements/tokens.ts');

/**
 * The body of `export const <name> = css\`…\``, with any `${other}`
 * composition expanded — which is how `viewerTokens` picks up `scoreTokens`
 * and `radiusTokens`. Without the expansion every composed token would read
 * as undeclared.
 */
function block(name: string, seen = new Set<string>()): string {
  if (seen.has(name)) return '';
  seen.add(name);
  const m = new RegExp(String.raw`export const ${name} = css\`([\s\S]*?)\`;`).exec(TOKENS_SRC);
  if (!m) throw new Error(`no css block exported as ${name} in tokens.ts`);
  return stripComments(m[1].replace(/\$\{(\w+)\}/g, (_, ref: string) => block(ref, seen)));
}

/**
 * Comments are prose about tokens and routinely NAME them — "there is no
 * --serif:", "keep this in step with --bg". Left in, every such mention reads
 * as a declaration and the assertions invert. Strip before parsing.
 */
function stripComments(css: string): string {
  return (
    css
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Whole-line `//` comments too: these files are TypeScript, and the
      // tray's header comment explains at length why it does NOT declare
      // designTokens — which the assertion below would otherwise read as the
      // declaration itself. Anchored to line start so `https://` survives.
      .replace(/^[ \t]*\/\/.*$/gm, '')
  );
}

/** Every `var(--name)` cited in a stylesheet or component source. */
function referenced(source: string): Set<string> {
  return new Set([...source.matchAll(/var\(\s*(--[\w-]+)/g)].map(m => m[1]));
}

/** Every `--name:` declared in a stylesheet. */
function declared(cssText: string): Set<string> {
  return new Set([...cssText.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
}

const viewerTokens = block('viewerTokens');
const designTokens = block('designTokens');
const radiusTokens = block('radiusTokens');

// Components that carry their own token block and can be checked in isolation.
// SelectionTray is deliberately absent: it ships self-contained literal styles
// (core-selection-tray-visuals.md), and campaign item 4 is what folds it in.
const VIEWER = 'elements/ScoreViewer.ts';

describe('design tokens', () => {
  describe('the embed is self-sufficient', () => {
    it('declares every token the viewer cites', () => {
      // The viewer's styles are `[viewerTokens, sharedChrome, scrollbars, …]`,
      // so the shared blocks' references count as the viewer's too.
      const cites = new Set([
        ...referenced(read(VIEWER)),
        ...referenced(read('elements/tokens.ts')),
      ]);
      const has = declared(viewerTokens);

      const missing = [...cites].filter(
        name =>
          !has.has(name) &&
          // Public overrides are *meant* to be undefined until a host sets one;
          // they always appear as the first arg of a var() with a fallback.
          !name.startsWith('--mnx-') &&
          // Declared by the app host for chrome-only surfaces, never cited by
          // the viewer itself.
          !declared(designTokens).has(name)
      );

      expect(missing, `undeclared in viewerTokens: ${missing.join(', ')}`).toEqual([]);
    });

    it('resolves the score tokens that the staff lines depend on', () => {
      // The exact four that were undefined in the historical embed bug.
      const has = declared(viewerTokens);
      for (const name of ['--accent', '--paper', '--paper-ink', '--paper-line']) {
        expect(has.has(name), `${name} must be declared on the viewer's own host`).toBe(true);
      }
    });
  });

  describe('the public override surface', () => {
    it('keeps every --mnx-* hook the viewer advertises', () => {
      // Renaming or dropping one silently breaks a host page's styling.
      const hooks = [...viewerTokens.matchAll(/var\(\s*(--mnx-[\w-]+)/g)].map(m => m[1]);
      expect(new Set(hooks)).toEqual(
        new Set([
          '--mnx-accent',
          '--mnx-paper',
          '--mnx-paper-ink',
          '--mnx-paper-line',
          '--mnx-bg',
          '--mnx-surface',
          '--mnx-line',
          '--mnx-ink',
          '--mnx-focus-ring',
        ])
      );
    });
  });

  describe('the two blocks agree on light', () => {
    // tokens.ts states this as a contract: "The light values are IDENTICAL to
    // designTokens' — inside the workbench these definitions win (a closer host
    // beats an inherited value), so any drift would silently restyle the app."
    // Nothing enforced it, and the Modernist re-cut had to hand-maintain both
    // copies twice. Drift here is invisible until someone notices the score
    // card is a different white from the panel beside it.
    const lightHalf = (decl: string) => {
      const ld = /^light-dark\(\s*([\s\S]*?)\s*,\s*[\s\S]*\)$/.exec(decl.trim());
      return (ld ? ld[1] : decl).trim();
    };
    /**
     * `--name: <value>;` pairs from the LIGHT rule only, with any
     * `var(--mnx-x, …)` wrapper peeled. Scoping to the bare `:host` selector
     * matters: `designTokens` also carries `:host([resolved-theme='dark'])`,
     * whose declarations come later and would otherwise win — comparing the
     * app's dark ink against the viewer's light ink reports drift on every
     * token at once, which is a parser bug wearing a finding's clothes.
     */
    const pairs = (cssText: string) => {
      const out = new Map<string, string>();
      const light = [...cssText.matchAll(/:host\s*\{([^}]*)\}/g)].map(m => m[1]).join('\n');
      for (const m of light.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        let v = m[2].trim();
        const hook = /^var\(\s*--mnx-[\w-]+,\s*([\s\S]*)\)$/.exec(v);
        if (hook) v = hook[1].trim();
        out.set(m[1], lightHalf(v).replace(/\s+/g, ' '));
      }
      return out;
    };

    /**
     * Substitute `var(--x)` with x's own value where the block declares it.
     * The two blocks may reach the same colour by different routes — the
     * viewer factors `--shadow` through `--shadow-near`/`--shadow-far` because
     * `light-dark()` takes colours, not whole shadow lists, while the app
     * inlines them. That is a structural difference, not a visual one, and the
     * contract is about what RESOLVES.
     */
    const resolve = (map: Map<string, string>) =>
      new Map(
        [...map].map(([k, v]) => [
          k,
          v.replace(/var\((--[\w-]+)\)/g, (whole, ref: string) => map.get(ref) ?? whole),
        ])
      );

    it('declares the same light value for every shared token', () => {
      const viewer = resolve(pairs(viewerTokens));
      const app = resolve(pairs(designTokens));
      // Compare only what both declare; each legitimately carries extras
      // (the app has the rail and the queue ramp, the viewer has shadow parts).
      const drift = [...viewer]
        .filter(([name]) => app.has(name))
        .filter(([name, v]) => app.get(name) !== v)
        .map(([name, v]) => `${name}: viewer "${v}" vs app "${app.get(name)}"`);
      expect(drift, `light values drifted:\n  ${drift.join('\n  ')}`).toEqual([]);
    });

    it('has retired --serif', () => {
      // Modernist is set entirely in Archivo. A reintroduced serif token means
      // someone restored a voice the system does not have.
      expect(declared(viewerTokens).has('--serif')).toBe(false);
      expect(declared(designTokens).has('--serif')).toBe(false);
      expect(/var\(--serif\)/.test(read('workbench/WorkbenchApp.ts'))).toBe(false);
    });
  });

  describe('the selection tray consumes the system', () => {
    const TRAY = 'workbench/SelectionTray.ts';

    it('carries no colour literals', () => {
      // The tray shipped ahead of the system, hard-coding the design's palette
      // (core-selection-tray-visuals.md's recorded, deliberately temporary
      // ruling). Campaign item 4 ended that. A literal creeping back means the
      // component is drifting out of the system again — which is exactly how
      // it got its own dialect the first time.
      const css = stripComments(read(TRAY));
      const literals = [
        ...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g),
        ...css.matchAll(/\brgba?\([^)]*\)/g),
      ].map(m => m[0]);
      expect(literals, `colour literals in the tray: ${literals.join(', ')}`).toEqual([]);
    });

    it('inherits the palette instead of re-declaring it', () => {
      // Load-bearing, and for a subtler reason than "don't duplicate": tokens
      // reach the tray by INHERITANCE from <mnx-workbench>'s host, and the dark
      // half is selected by a `resolved-theme` attribute on THAT host. A
      // designTokens block here would plant a light-only `:host` between the
      // app and the tray and pin it light forever — the theme switch would
      // visibly skip this one component.
      expect(/\bdesignTokens\b/.test(stripComments(read(TRAY)))).toBe(false);
    });
  });

  describe('the anti-flash ground', () => {
    it('matches --bg exactly', () => {
      // `workbench.css` paints the body before the component mounts. If it
      // drifts from --bg the page flashes the OLD palette on every load — a
      // bug that is invisible to every other check here, and precisely the
      // kind a restyle introduces.
      const body = /background:\s*(oklch\([^)]*\));/.exec(read('entries/workbench.css'));
      const bg = /--bg:\s*var\(--mnx-bg,\s*(oklch\([^)]*\))\)/.exec(designTokens);
      expect(body, 'no oklch background in workbench.css').toBeTruthy();
      expect(bg, 'no --bg in designTokens').toBeTruthy();
      expect(body![1]).toBe(bg![1]);
    });
  });

  describe('radius is a token decision', () => {
    it('is composed into both token blocks, so the embed cannot drift', () => {
      const scale = declared(radiusTokens);
      expect(scale.size).toBeGreaterThan(0);
      for (const name of scale) {
        expect(declared(viewerTokens).has(name), `${name} missing from viewer`).toBe(true);
        expect(declared(designTokens).has(name), `${name} missing from app`).toBe(true);
      }
    });

    it('leaves no corner literal at a use site', () => {
      // Circles (`50%`) and the gap diamond's 1px softening are shapes that
      // carry meaning — the rail's dots vary shape as well as colour so
      // *stale* cannot read as *never seen*. Corners are the only thing the
      // scale governs.
      const files = [
        'elements/tokens.ts',
        VIEWER,
        'workbench/WorkbenchApp.ts',
        'workbench/ScenarioPage.ts',
        'workbench/ScoreHud.ts',
        'workbench/QueueHome.ts',
        'workbench/ObjectsPage.ts',
        'workbench/CommandPalette.ts',
      ];
      const offenders: string[] = [];
      for (const rel of files) {
        for (const line of read(rel).split('\n')) {
          const m = /border-radius:\s*([^;]+);/.exec(line);
          if (!m) continue;
          const value = m[1].trim();
          if (value.includes('var(--radius-')) continue;
          if (value === '50%' || value === '1px') continue; // shapes, not corners
          offenders.push(`${rel}: ${value}`);
        }
      }
      expect(offenders, `literal corner radius: ${offenders.join(' | ')}`).toEqual([]);
    });
  });
});
