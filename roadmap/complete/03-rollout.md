# 03 — Rollout

> **Stability: provisional.** The library is the spine: every early phase is "grow the
> corpus + make more of it render correctly." Playback and editing hang off a renderer that
> already works; **AI is explicitly last.** Each phase ships one usable thing and names what
> is *not yet*. The discipline (P8): finish a phase to "genuinely good" before the next.

---

## Phase 0 — Skeleton + document model + first scenarios
**Ship:** the document model exists (`MnxDocument` types, MNX + `_x.tab` schemas,
`validate()`); the `scenarios/` corpus seeded with the **`spec/` mirror** (the CG's ~49
worked examples, via `sync-spec-examples.mjs`) plus `lab/` categories **00–02 + 20–21 + 24**
(document/pitches/durations, tab part & positions, and the invalid-by-design spec-gap
exhibits).
**Done when:** `check-scenarios.mjs` passes — every scenario's actual verdicts (standard +
extension) match its declared `expect`, in both directions.
**Not yet:** any rendering in the gallery, any UI.

## Phase 1 — The gallery (browse + validate), no rendering yet
**Ship:** the `gallery` app enumerates `mnx-scenarios`, shows the category tree, and for each
scenario shows title, description, pretty-printed JSON, and **validation status**. Rendered
output reads "pending."
**Done when:** you can browse the seeded library in the browser and see what's valid.
**Not yet:** rendering — but the app is already useful as a corpus browser.

## Phase 2 — Beachhead: rendering ⭐
**Ship:** the render pipeline (layout → `Primitive[]` → SVG) wired into the gallery so every
scenario shows a **live render**; `expected.primitives.json` committed per renderable
scenario; snapshot tests over the library. The seeded `lab/` categories reach `verified`;
the `spec/` mirror reports its honest render rate ("N of 49 of the spec's own examples").
**Done when:** the seeded scenarios render correctly (notation + tab where relevant), snapshots
pass, and the gallery shows the coverage dashboard (counts per status per category, plus the
`$defs` coverage report).
*This is the milestone the whole plan is organized around. If only one phase ever ships, it's this.*

## Phase 3 — Broaden spec coverage
**Ship:** grow the library through categories **04–14** (time/clefs/keys, chords/voices,
staves, spanners & cross-refs, articulations, dynamics, barlines/navigation, lyrics, grace),
each driven to `verified`. The renderer grows only as the corpus demands.
**Done when:** the common-practice spec is covered and rendering cleanly; the id-referencing
scenarios (category 09 + the `idRefs` facet) all pass.
**Not yet:** guitar specifics, audio, editing.

## Phase 4 — Guitar (the proving ground)
**Ship:** categories **20–24** — tab part config (tunings/capo/`staffKind` views),
positions, fingerings, techniques, and the spec-gap exhibits — to `verified` (the
invalid-by-design ones are "verified" when their pinned errors match). Tab rendering matures
here: technique glyphs (bends, slides, hammer-ons), rhythm on the tab view.
**Done when:** notation + tab render correctly across the tab scenarios, and category 24
is presentable enough to anchor the w3c-cg/mnx#63 post.

## Phase 5 — Playback
**Ship:** `mnx-audio` (C3) + a minimal transport in the gallery; playhead highlighting driven
by document coordinates. Still no editing.
**Done when:** play/pause/seek works and the playhead tracks the rendered score.

## Phase 6 — Editing
**Ship:** `editor-app` — the editing shell, `DocumentRepository` (IndexedDB) persistence,
view-mode switching, raw-JSON editing. Editing starts from the document, not drag-the-notehead.
**Done when:** you can open, edit (via JSON/structured ops), persist, and re-render a score.
**Not yet:** AI.

## Phase 7 — AI chat-to-edit (last)
**Ship:** `mnx-ai` (C5) + server proxy + chat panel; the self-correcting NDJSON loop mutates
the document and re-renders, with a mock fallback when no API key.
**Done when:** a typed instruction yields a validated document change that re-renders;
validation failures self-correct within the attempt budget.
**Not yet:** voice/transcription (a later add on top).

## Anytime, standalone — `mnx-convert`
MusicXML ⇄ MNX (C4) can be hardened independently whenever useful — notably as a way to
*source library material* by importing real scores and reducing them to minimal scenarios.

---

### Sequencing notes
- The hard spine is **0 → 1 → 2 → 3**. Guitar (4), playback (5), editing (6) are reorderable
  once rendering is solid — they only share `mnx-core`.
- **AI (7) stays last** regardless. It presupposes a trustworthy model, renderer, and editor.
- Each phase that introduces a package triggers its `module-specs.md` entry (just-in-time) and an
  ADR if it embodies a real choice.
