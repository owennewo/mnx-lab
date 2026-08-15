# Modernist: the type voice

> **Status: proposed 2026-08-15.** Item 3 of
> [core-campaign-modernist.md](core-campaign-modernist.md). Blocks on
> [core-modernist-tokens.md](core-modernist-tokens.md). Retires the *"Archivo loading"* open item
> recorded in [core-selection-tray-visuals.md](../complete/core-selection-tray-visuals.md).

## The problem

The tray asks for Archivo and doesn't get it. `SelectionTray.ts` sets
`font-family: Archivo, system-ui, sans-serif` throughout, the workbench bundles no
Archivo, so every tile label, tab and readout in the shipped tray renders in the system
sans. The visuals doc recorded this as an open item and shipped anyway, correctly — the
fallback was fine for a review stage.

Meanwhile `designTokens` names three IBM Plex faces, and the design's ruling is two
voices, strictly: **Archivo for anything a person wrote or reads as prose; monospace for
anything the machine owns** — paths, hashes, ids, op names, coordinates like `m2 0/1`,
JSON. *"Never mono for a whole sentence, never Archivo for an id."*

That rule is already how this codebase thinks. `--mono` carries every metadata surface
today (badges, panel tabs, HUD values, def chips, op rows) and `--sans` carries prose.
The type work is therefore mostly a **face swap plus one deletion**, not a re-think.

## Correcting the record: fonts *are* bundled

An early read of this codebase concluded no webfont was loaded — no `@font-face` for IBM
Plex anywhere, only Bravura in `src/entries/workbench.css`. That is wrong, and the
mistake is worth recording because it nearly produced a much larger proposal.

`src/entries/main.ts:3-10` imports eight `@fontsource/*` stylesheets, under a header that
says exactly what the policy is: *"Registers the shell and bundles the IBM Plex faces the
design tokens reference — **no font CDN**."* The faces land in the Vite build as hashed
woff2 assets. Bravura is separate and self-hosted at `public/smufl/Bravura.woff2` only
because SMuFL fonts aren't on fontsource.

**So Archivo is `npm i @fontsource/archivo` plus three import lines**, matching the
existing precedent exactly, honouring the no-CDN rule and the no-backend rule without
argument. There is no `@font-face` authoring, no `public/` asset, and no decision to
make about where document-level CSS lives.

## The decisions

**Archivo replaces IBM Plex Sans.** `--sans: 'Archivo', 'Helvetica Neue', Helvetica,
system-ui, sans-serif`. Weights 400/600 cover the design (its 800 heading weight is for
the design-system's own display type, not for interface chrome at 10–14px); import 400,
500 and 600 to match what the app already uses.

**Latin subset only** — `@fontsource/archivo/latin-{400,500,600}.css`. The unsuffixed
entrypoints pull latin-ext and Vietnamese too: nine woff2 files where three do. Browsers
fetch by `unicode-range` so the extras would rarely download, but they are still build
output being shipped and served for no reader this project has. **Measured: 3 files,
43KB.** Archivo is OFL (Omnibus-Type), so self-hosting is clean, and the `@font-face`
blocks come from fontsource — no hand-authored face, no `public/` asset.

**`--serif` is deleted.** Modernist has no serif — it is *"set entirely in Archivo"*.
It turned out to be used at **seven** sites, not two: headings in `QueueHome` (×2),
`ObjectsPage`, `ScenarioPage` (×2), `ScoreViewer`, and the shell's brand mark. All fold
into `--sans`. Drop the `@fontsource/ibm-plex-serif` dependency and its two imports.
A conformance assertion now fails if the token or a `var(--serif)` use site comes back —
a reintroduced serif means someone restored a voice the system does not have.

**Mono stays native, deliberately.** Retune `--mono` to a considered system stack —
`ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', monospace` — and drop
`@fontsource/ibm-plex-mono`. Reasoning: one webfont is a reasonable budget for a tool
that already ships Bravura and renders large SVGs; two is not, and the mono voice is
carrying ids and hashes where a native face costs the design nothing. This is a
*decision*, not an omission — record it in the token sheet so nobody "fixes" it later by
adding a face back.

**The embed keeps system stacks.** `viewerTokens` must not name Archivo. The embed face
registers `elements/` only and ships no document-level CSS, so it can never load the
font — and asking for a face the embed cannot have is the same dishonesty as today's
IBM Plex reference. Contract rule 3 covers this; state it at the token.

## The part that isn't mechanical: the tray changes appearance

**Bundling Archivo restyles an already-reviewed, shipped surface.** The tray's 66×64
tiles, its bottom-right corner chips, its 10px/600 letterspaced tabs and its 9px tab
padding were all reviewed hands-on — in the fallback face. Archivo's metrics differ:
different x-height, different advance widths, different optical weight at 8.5–10px. The
letterspaced uppercase labels are the most exposed, because that is where a face swap
shows up as reflow rather than as texture.

Two consequences:

- **This item carries a tray re-review**, not a spot check. Every rung's tab row, both
  tray widths (470 / 400), the corner chips at all four tile states, and the readout
  bar. The visuals doc's stage-4 findings (tab padding 9px, rows width 400px) were tuned
  against the fallback and may need retuning; if they move, **amend that doc's recorded
  deviations** rather than leaving them stale.
- **Sequencing — corrected at build time: this item goes BEFORE item 4, not after.**
  The first draft said the reverse ("de-hex onto tokens first, then swap the face once,
  and review once"). That is wrong, and the reason is that the tray hard-codes
  `Archivo, system-ui, sans-serif` in eight places. De-hexing to `var(--sans)` while
  `--sans` still named IBM Plex would have moved the tray's face system-fallback → IBM
  Plex → Archivo: two visible changes, the first of them *away* from the design. Landing
  Archivo first makes item 4's font substitution a genuine no-op — the tray already asks
  for Archivo and simply keeps getting it — so item 4's review is purely about colour
  fidelity and this item's is purely about type. One review each, cleanly separated,
  which is what the original ordering was reaching for and missed.

The same caution applies to the score panel, but with better timing: item 5 has not been
built yet, so it should be built in Archivo from the start rather than tuned twice.

## Not this

- **Not the emitter.** `src/engine/render/svg.ts:12` reads
  `FONT_FAMILY_BODY = 'var(--font-family-sans)'` — a **dangling** token name that has
  never resolved, baked into 68 committed `expected.svg` goldens. It is directly
  adjacent to this item's subject matter and it is **contract rule 4: untouchable**.
  Fixing it is a separate proposal with a deliberate 68-golden re-approval. A font pass
  is exactly when someone would "tidy" this; do not.
- **Not a type scale change.** Sizes, line heights and the small-caps eyebrow recipe
  stay as they are; only the faces change. (The eyebrow recipe is currently spelled out
  three times — `.side-cap`, `.cap`, `.cat`. Consolidating it into `sharedChrome` is
  welcome here, but as a tidy-up, not a redesign.)
- **Not variable-font axes.** Static 400/500/600 instances, as today.

## Verification

- Goldens unaffected — and here the assertion earns its keep rather than being a
  formality, because this is the one item whose subject matter *is* fonts. Run
  `npm run update:primitives` and confirm a clean `git diff -- scenarios/`. It passes
  because the emitter's font string is a frozen constant that never reads a token; if it
  ever fails, contract rule 4 was broken.
- `npm run build` — confirms the new dependency resolves and the removed ones aren't
  still imported.
- **Confirm the faces actually load**, which is the failure this whole item exists to
  fix: in the browser, `document.fonts.check('600 10px Archivo')` true, and no
  `--serif` / `ibm-plex` references surviving in `src/`.
- **Hands-on, headless Chrome over CDP**, zero console errors: the tray re-review above,
  plus the campaign's fixed scenario list for chrome reflow — the rail's group headers,
  the queue home, the objects coverage tiers, and the panel's tab strip, which is the
  place a wider face would first cause a wrap.
