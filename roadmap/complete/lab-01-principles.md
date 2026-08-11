# 01 — Principles

> **Stability: settled-ish.** These are the rules the build must not violate. Most are
> inherited from hard constraints of the current project and the two locked decisions.
> Changing one is a deliberate act, recorded as an ADR in `decisions/`.

Each principle is a **rule**, a one-line **why**, and how an implementing agent should
**apply** it.

### P1 — The MNX document is the single source of truth
Renderers, players, exporters, and the AI loop are **pure functions of the document**. No
capability keeps its own shadow copy of musical state.
*Why:* one model means every view stays consistent and any feature can be added without
re-syncing state.
*Apply:* a function takes a document in and returns output; mutations produce a new
document that everything re-derives from.

### P2 — Every capability is a package behind a contract
The repo is a monorepo of packages. A package may only import packages that
`../superseded/lab-02-architecture.md` explicitly permits.
*Why:* this is the mechanism that makes the pieces reusable and independently testable.
*Apply:* if you need something from another package that isn't in its public contract,
the fix is to extend that contract deliberately — never to reach into its internals.

### P3 — The renderer is document-agnostic at the layout boundary
The **layout engine** consumes the document and emits **primitive shapes** (lines, glyphs,
beams, positions). The **SVG renderer** consumes primitives and knows nothing about music.
*Why:* this is the project's best existing idea (see `../../SVG_RENDERING_ENGING.md` and
`core-musicxml.md` §9). It lets the same layout feed SVG today, canvas/PDF later, and lets the
renderer be tested without any musical knowledge.
*Apply:* the `Primitive[]` type *is* the contract between layout and render. Nothing
music-aware crosses into the renderer.

### P4 — Embeddable by default
Ship one custom element that isolates itself via Shadow DOM, leaks no global CSS, and
requires no server for the read-only path.
*Why:* "drop it in any page with one script tag" is the distribution model.
*Apply:* no styles on `document`, no globals, no assumptions about the host page; assets
(fonts/SMuFL) resolved relative to the component.

### P5 — No framework lock-in
Lit + web standards only. No React, Vue, Angular, or global state libraries (Redux/MobX/etc).
*Why:* the bundle must embed anywhere; frameworks fight the embeddability story.
*Apply:* state lives in controllers/plain objects; cross-component talk via DOM events and
`@lit/context`.

### P6 — Offline-first; the server is optional
The viewer, storage, playback, and conversion all work with no backend. The server exists
**only** to proxy AI calls (it holds the API key).
*Why:* keeps the core embeddable and demoable; isolates the one piece that needs secrets.
*Apply:* never make core packages depend on the server being up.

### P7 — Standard MNX is sacred; editor data lives under `_x`
Anything not in the W3C MNX schema (guitar fret/string, editor hints) goes under the `_x`
vendor extension, formalized by its own schema.
*Why:* the official validator must accept our documents; drift is the enemy.
*Apply:* extend `_x.*`, never add fields at standard MNX levels. AI tool schemas mirror
this.

### P8 — Do a small bit well
No package or module spec exists before its contract. Every rollout phase ships something
usable. We finish the beachhead before broadening.
*Why:* the stated goal — depth over breadth, momentum over big-bang.
*Apply:* resist scaffolding all six packages at once; build core+render to "genuinely good"
first.

### P9 — Test the contract, not the implementation
Every package ships with tests against its public contract. The renderer gets snapshot
tests; core gets invariant/validation tests; convert gets round-trip tests.
*Why:* the current frontend has zero tests — this rebuild does not repeat that.
*Apply:* a contract change must come with a test change.

### P10 — Tooling baseline
TypeScript strict; `.ts` import extensions (`moduleResolution: bundler`); Lit decorators
with `experimentalDecorators`/`emitDecoratorMetadata`; Vite build; Vitest. The built `dist/`
is an artifact, never source.
