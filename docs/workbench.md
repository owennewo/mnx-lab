<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# The workbench (`src/workbench/`) — review-first, no backend

Home is the **attention queue** (blocked → stale → never-seen; current counted, not
shown), derived from committed provenance in `src/workbench/queue.ts`. Every scenario + view
has a stable deep link: `#/scenario/<id>?view=notation|tab|both` (unspecified ⇒ the
document's `tab.staffKind` hint); legacy `?view=compare|json` links are honored and
open the matching tab of the scenario page's **side panel** (description | ops | hud |
assist | compare | json — roadmap/complete/core-score-hud.md created it;
roadmap/complete/workbench-score-panel.md cut it down and gave every tab
the same five-band frame: tab strip, context bar, ONE scrolling body, footer), which holds
all page chrome including the selection HUD and the per-part instrument override
(the HUD's ensemble table → `<mnx-document-viewer>.partTabSetups`; the flat
`stringsOverride`/`capoOverride` pair remains for single-instrument embeds —
presentation only). Tab/both exist only when the strings are KNOWN — declared in
the document, or supplied through that override. No instrument is ever assumed.
The setup popovers are a **page-level overlay over the score**, not a tab: opening one
with the keyboard must not move the panel out from under what you were reading.
**Document focus** is transient workbench composition: `Ctrl+Alt+F` removes the app and
scenario-page chrome without changing remembered rail/panel preferences, while `F11`
remains browser-owned (the palette's separate browser-fullscreen action uses the Fullscreen
API when available). The zoom pad remains over the document surface and carries a permanent
focus/exit toggle, so the mode never hides both its control and its escape route. It is never
a property of `<mnx-document-viewer>`.
**Theming is `light-dark()`, never an attribute** — the shell resolves `auto|light|dark`
(remembered per browser, palette-switchable) onto `color-scheme`, and every token
follows because `color-scheme` is inherited and crosses shadow roots. An
attribute-selected theme block only reaches the host that carries it, so it would leave
every component that declares `designTokens` pinned to one theme —
roadmap/complete/core-modernist-dark.md.

**`#/objects`** is the coverage map — every non-plumbing `$def` against the scenarios
exercising it (`src/corpus/defIndex.ts`, inverting the spec's own `coversDefs` join),
tiered **never exercised → one example → covered**. Counts read *verified / total*, so an
object covered only by unapproved scenarios reads as exercised-but-not-evidence; the
header's coverage fraction links here, because a fraction is a scoreboard and the tiers
are a work queue. **`#/objects/<def>`** is both the per-object page and the rail filter:
it writes `def:<name>` into the rail's search box, so filtering is deep-linkable, visible
and clearable by the one control that already exists — there is no second filter mode.
A scenario page tags its `featureDefs` (plumbing stripped: median 5, vs 25 raw), capped
at nine with a `+N more`.

The rail groups by **topic**, not by authoring category — `src/corpus/groups.ts`, an
ordered name→regex table matched on the scenario id, **first match wins**. The spec has
no taxonomy to inherit (its own index is a flat alphabetical list of 52 "example
documents"), and most of our authoring categories held a single scenario, so both halves read badly;
topic groups interleave them instead. The grouping is OURS and display-only — never in
`scenarios/spec/` or a meta.json. Order is load-bearing, so
`harness/conformance/groups.test.ts` asserts nothing is ungrouped **and no group is
empty** — an empty group is the signature of a broad rule above stealing a narrow rule's
scenarios. A rail row carries two orthogonal signals: the **dot** is queue state via the
shared `classify()` (shape as well as colour, so *stale* stops looking like *never
seen*), and the **tags** are provenance — `spec` for mirrored (hand-edits forbidden),
`proposed` for schema probes. The
**compare** view shows our render beside the spec's reference engraving at
`/spec-media/<slug>.png` — read-only from the pinned `vendor/mnx` by Vite middleware in
dev, and copied into `dist/client/spec-media/` by the same plugin at build time. Built
without the submodule, the pane degrades to a note. The images are the CG's, shown with
attribution and never committed here. The scenario page distinguishes **loading** from
**failed** (the score is a lazy chunk — a dead dev server must not read as a render bug).

**The workbench has no backend — by rule.** It must stay fully functional from static
build output alone: the corpus is committed JSON, the only browser persistence is
localStorage UI preferences (document storage is a reserved seam —
`storage/cloudRepository.ts`), and every
verification write happens through harness scripts editing repo files — git is the
database and the audit trail. **Live AI edits are no longer the exception they used to
be** (core-assist-byok.md): with the user's own OpenRouter key, held in this origin's
localStorage and obtained by PKCE or paste, `src/assist/editLoop.ts` runs the whole
self-correcting loop *in the browser* and nothing about the edit reaches a server we run.
The Worker is *not* the backend and now says so — it is the demo for a visitor who has
connected no key, spending the deployment's, and every done frame it produces is stamped
`demoMode` (or `mockMode` with no key at all). `workbench/` may reach it only through
`assist/`. If browser-driven corpus authoring is ever wanted,
the pattern is a dev-only Vite middleware writing repo files — never a deployed API.
The real API layer (documents, auth, sync) belongs to **studio**
([apps/studio/README.md](../apps/studio/README.md)) on the reserved seams
(`worker/api/documents|auth` 501 stubs, `storage/cloudRepository.ts`).
