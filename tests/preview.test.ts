// Preview contact sheet for the visual-approval ("verified") workflow.
//
// Run with: npm run preview:scenarios   (PREVIEW_SCENARIOS=1 gates this file;
// it is a no-op under plain `npm test`.)
//
// Writes scenarios/.preview/index.html (gitignored): every not-yet-verified
// scenario rendered live through the real layout + SVG pipeline, side by side
// with the MNX spec's own reference engraving for spec/ scenarios. Tick the
// scenarios that look correct and the page assembles the matching
// `node scripts/verify-scenarios.mjs …` command to copy-paste.
//
// Set PREVIEW_ALL=1 to include already-verified scenarios (e.g. to re-audit).
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
// @ts-expect-error — plain .mjs module without type declarations
import { loadCorpus, createContext, checkScenario, ROOT } from '../scripts/check-scenarios.mjs';
import { computePrimitives, WIDTH_SP } from './helpers/corpusPrimitives.ts';
import { renderSvgToString } from './helpers/svgString.ts';
import { planHorizontal } from '../src/layout/spacing.ts';
import { fitPxPerSp } from '../src/render/svg.ts';
import { computeBoundsSp } from '../src/render/bounds.ts';

const ENABLED = process.env.PREVIEW_SCENARIOS === '1';
const INCLUDE_VERIFIED = process.env.PREVIEW_ALL === '1';
const PX_PER_SP = 8;
const CROP_PAD_SP = 1; // breathing room around the tight content bounds
const OUT_DIR = path.join(ROOT, 'scenarios', '.preview');
const SPEC_IMAGE_BASE = 'https://w3c-cg.github.io/mnx/docs/static/examples';

// The MNX docs don't follow a strict slug→filename convention; these examples'
// reference engravings live under a different name (audited 2026-06-12 by
// scraping each example page's <img src>). Some are renames, some underscore
// styles, and beams-secondary-beam-breaks-implied legitimately SHARES the
// explicit variant's engraving (the two encodings must engrave identically).
const SPEC_IMAGE_ALIASES: Record<string, string> = {
  'beams-secondary-beam-breaks-implied': 'beams-secondary-beam-breaks.png',
  'grace-notes-beamed': 'beams-grace-notes.png',
  'lyric-line-metadata': 'lyric_metadata.png',
  'lyrics-basic': 'lyrics_basic.png',
  'lyrics-multi-line': 'lyrics_multiline.png',
  'ottavas-8va': 'octave-shifts-8va.png',
  'single-note-tremolos': 'tremolos.png',
  'tempo-markings': 'tempo-marking.png',
  'tie-targets': 'tie-target-type.png',
  'tremolos-multi-note': 'tremolos-multinote.png'
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, ch =>
    ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : '&quot;'
  );
}

interface Card {
  id: string;
  group: string;
  html: string;
  approvable: boolean;
}

function buildCard(scenario: any, meta: any): Card {
  const group = scenario.category ?? 'spec';
  const id = scenario.id;
  const checkbox = (on: boolean) =>
    on
      ? `<label class="approve"><input type="checkbox" data-id="${esc(id)}"> approve</label>`
      : '';
  const head = (badge: string, approvable: boolean) => `
    <header>
      <div>
        <h3>${esc(meta.title)} <code>${esc(id)}</code></h3>
        <p>${esc(meta.description)}</p>
      </div>
      <div class="badges"><span class="badge">${esc(meta.status)}</span><span class="badge">${badge}</span>${checkbox(approvable)}</div>
    </header>`;
  const notesPath = path.join(scenario.dir, 'notes.md');
  const notes = fs.existsSync(notesPath)
    ? `<details><summary>notes.md</summary><pre>${esc(fs.readFileSync(notesPath, 'utf8'))}</pre></details>`
    : '';

  if (meta.expect.standard === 'invalid') {
    const errors = (meta.expect.errors ?? [])
      .map((e: string) => `<li><code>${esc(e)}</code></li>`)
      .join('');
    return {
      id,
      group,
      approvable: true,
      html: `<article class="card">
        ${head('invalid by design', true)}
        <div class="exhibit">
          <p>Nothing to render — this exhibit pins the validation errors below. Approve it when the
          pinned errors still tell the intended story.</p>
          <ul>${errors}</ul>
        </div>
        ${notes}
      </article>`
    };
  }

  // Spec scenarios always show the upstream reference engraving — even when our
  // render crashes, the reference is what tells you what the fix should produce.
  const specPane =
    scenario.ns === 'spec'
      ? (() => {
          const slug = scenario.segments[1];
          const file = SPEC_IMAGE_ALIASES[slug] ?? `${slug}.png`;
          return `<figure><figcaption>spec reference engraving</figcaption>
      <div class="paper"><img loading="lazy" src="${SPEC_IMAGE_BASE}/${esc(file)}" alt="spec reference for ${esc(slug)}"
        onerror="this.outerHTML='<p class=noref>no reference image upstream</p>'"></div></figure>`;
        })()
      : '';

  const doc = JSON.parse(fs.readFileSync(path.join(scenario.dir, 'score.mnx.json'), 'utf8'));
  let computed;
  try {
    computed = computePrimitives(doc);
  } catch (e) {
    return {
      id,
      group,
      approvable: false,
      html: `<article class="card blocked">
        ${head('does not render yet', false)}
        <pre class="crash">${esc((e as Error).message)}</pre>
        ${specPane ? `<div class="panes">${specPane}</div>` : ''}
        ${notes}
      </article>`
    };
  }

  // Same scale-to-fit as the app's renderers: short scores draw larger (up to
  // the cap in fitPxPerSp) so their apparent size matches the spec reference
  // engravings. Snapshots are untouched — this only changes px-per-sp.
  const usedWidthSp = planHorizontal(doc, WIDTH_SP).usedWidthSp;
  const pxPerSp = fitPxPerSp(WIDTH_SP * PX_PER_SP, usedWidthSp, PX_PER_SP);

  // Crop each pane to its drawn content (the layout rows reserve fixed
  // ledger/stem headroom that reads as dead whitespace in a contact sheet).
  const pane = (caption: string, system: { primitives: any; heightSp: number }) => {
    const viewBoxSp = computeBoundsSp(system.primitives, CROP_PAD_SP) ?? undefined;
    return `<figure><figcaption>${caption}</figcaption>
    <div class="paper">${renderSvgToString({ ...system, widthSp: usedWidthSp, pxPerSp, viewBoxSp })}</div></figure>`;
  };

  const panes: string[] = [];
  panes.push(pane('our render — notation', computed.notation));
  if (computed.tab) {
    panes.push(pane('our render — tab', computed.tab));
  }
  if (specPane) panes.push(specPane);
  return {
    id,
    group,
    approvable: true,
    html: `<article class="card">
      ${head(scenario.ns === 'spec' ? 'compare with spec' : 'lab scenario', true)}
      <div class="panes">${panes.join('')}</div>
      ${notes}
    </article>`
  };
}

function buildPage(cards: Card[], manifest: any, fontBase64: string): string {
  const groups = new Map<string, Card[]>();
  for (const c of cards) {
    if (!groups.has(c.group)) groups.set(c.group, []);
    groups.get(c.group)!.push(c);
  }
  const sections = [...groups.entries()]
    .map(([group, items]) => {
      const title =
        group === 'spec'
          ? 'spec — MNX Community Group worked examples'
          : `${group} — ${manifest.categories?.[group] ?? ''}`;
      return `<section><h2>${esc(title)} <small>(${items.length})</small></h2>${items
        .map(c => c.html)
        .join('\n')}</section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>MNX Lab — scenario verification</title>
<style>
@font-face {
  font-family: 'Bravura';
  src: url(data:font/woff2;base64,${fontBase64}) format('woff2');
}
:root { --font-family-sans: 'IBM Plex Sans', system-ui, sans-serif; }
body { font-family: var(--font-family-sans); margin: 0; background: #ece9e2; color: #1f1d1a; }
main { max-width: 1240px; margin: 0 auto; padding: 24px 24px 120px; }
h1 { font-size: 22px; } h2 { font-size: 16px; margin: 32px 0 12px; border-bottom: 1px solid #c9c4b8; padding-bottom: 6px; }
.card { background: #fff; border: 1px solid #d8d3c8; border-radius: 8px; padding: 16px 20px; margin: 14px 0; }
.card.blocked { background: #f7f3ea; }
.card header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
.card h3 { margin: 0 0 4px; font-size: 15px; } .card h3 code { font-weight: normal; color: #8a8273; font-size: 12px; }
.card p { margin: 0; font-size: 13px; color: #555; max-width: 70ch; }
.badges { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
.badge { font-size: 11px; background: #eee9dd; border-radius: 99px; padding: 3px 10px; white-space: nowrap; }
.approve { font-size: 13px; background: #e4efe4; border-radius: 99px; padding: 3px 12px; cursor: pointer; white-space: nowrap; }
.approve:has(input:checked) { background: #2e7d32; color: #fff; }
.panes { display: flex; gap: 16px; margin-top: 14px; }
/* Equal columns: our render and the spec reference share the row 50/50
   (three panes split evenly), so the comparison sits side by side. */
.panes figure { flex: 1 1 0; min-width: 0; }
figure { margin: 0; } figcaption { font-size: 11px; color: #8a8273; margin-bottom: 6px; text-transform: uppercase; letter-spacing: .06em; }
.paper { background: #fff; border: 1px solid #eee; padding: 8px; }
.paper img { width: 100%; height: auto; display: block; }
.paper svg { max-width: 100%; height: auto; display: block; }
.noref { font-size: 12px; color: #8a8273; margin: 0; padding: 8px; }
.exhibit { font-size: 13px; margin-top: 12px; } .exhibit li { margin: 4px 0; }
.crash { background: #fbeaea; color: #8b2020; padding: 10px; font-size: 12px; white-space: pre-wrap; }
details { margin-top: 10px; font-size: 12px; } details pre { white-space: pre-wrap; background: #faf8f3; padding: 10px; }
#bar { position: fixed; bottom: 0; left: 0; right: 0; background: #1f1d1a; color: #fff; padding: 12px 24px;
  display: flex; gap: 16px; align-items: center; font-size: 13px; }
#bar code { flex: 1; overflow-x: auto; white-space: nowrap; background: #353129; padding: 8px 12px; border-radius: 6px; }
#bar button { background: #e9b44c; border: 0; border-radius: 6px; padding: 8px 16px; cursor: pointer; font-weight: 600; }
</style>
</head>
<body>
<main>
<h1>Scenario verification — ${cards.length} in the queue</h1>
<p>Approve a scenario when its render is musically correct (right pitches, durations, accidentals,
beams, placement — and for tab: strings and frets). For spec scenarios, compare against the
reference engraving; layout differences are fine, content differences are not.</p>
${sections}
</main>
<div id="bar">
  <span id="count">0 selected</span>
  <code id="cmd">node scripts/verify-scenarios.mjs</code>
  <button id="copy">Copy command</button>
</div>
<script>
const boxes = [...document.querySelectorAll('input[type=checkbox][data-id]')];
const cmd = document.getElementById('cmd');
const count = document.getElementById('count');
function refresh() {
  const ids = boxes.filter(b => b.checked).map(b => b.dataset.id);
  count.textContent = ids.length + ' selected';
  cmd.textContent = 'node scripts/verify-scenarios.mjs' + (ids.length ? ' ' + ids.join(' ') : '');
}
boxes.forEach(b => b.addEventListener('change', refresh));
document.getElementById('copy').addEventListener('click', () => navigator.clipboard.writeText(cmd.textContent));
refresh();
</script>
</body>
</html>
`;
}

describe('scenario preview contact sheet', () => {
  if (!ENABLED) {
    it.skip('generator (run npm run preview:scenarios)', () => {});
    return;
  }

  it('writes scenarios/.preview/index.html', () => {
    const ctx = createContext();
    const cards: Card[] = [];
    let skippedVerified = 0;
    for (const scenario of loadCorpus()) {
      const { meta } = checkScenario(scenario, ctx);
      if (!meta) continue;
      if (meta.status === 'verified' && !INCLUDE_VERIFIED) {
        skippedVerified++;
        continue;
      }
      cards.push(buildCard(scenario, meta));
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios/manifest.json'), 'utf8'));
    const font = fs.readFileSync(path.join(ROOT, 'public/smufl/Bravura.woff2')).toString('base64');
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const outPath = path.join(OUT_DIR, 'index.html');
    fs.writeFileSync(outPath, buildPage(cards, manifest, font));
    console.warn(
      `Preview: ${cards.length} scenario(s) in the queue` +
        (skippedVerified ? ` (${skippedVerified} already verified, skipped — PREVIEW_ALL=1 to include)` : '') +
        `\nOpen: ${outPath}`
    );
    expect(cards.length).toBeGreaterThan(0);
  });
});
