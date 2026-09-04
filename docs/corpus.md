<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# The corpus: goldens and provenance

The two axes, the hand-edit bans and the crown-jewels rule live in CLAUDE.md. This is
the long form: how statuses move, and what each golden actually pins.

## Verification is a human assertion with provenance

**Verification is a human assertion with provenance.** `status: verified` and the
`verification: {at, primitivesHash, renderHash, bothHash}` record are written **only** by
`harness/verify/verify-scenarios.mjs`; the record is *kept through demotion*, so the
attention queue distinguishes **stale** (approved once, output changed) from **never
seen** (no record). `npm run update:primitives` keeps statuses honest: a successful
snapshot write promotes `valid`→`rendered`, a changed snapshot demotes
`verified`→`rendered`, a layout crash demotes to `valid` (removing the snapshots). A
golden appearing for the **first** time is never a change — that is how a new golden is
introduced without mass-demoting the corpus. `renderHash` and `bothHash` are **optional**
in a record for the same reason: approvals predating a golden were real assertions made
on the evidence that existed, so their absence is not staleness; `--backfill-render`
stamps the former (what that asserts is spelled out at the flag), and `bothHash` has
**no backfill** — the combined system earns its hash only through a real approval.
`renderHash`'s file set is **frozen** at the two standalone SVGs; `expected.both.svg`
hashes separately, or adding it would have moved every committed digest at once. The
approval flow is the conversational **`/verify` skill** (`.claude/skills/verify/`) —
queue → one stable review page → verdicts in sentences; there is no human-facing CLI and
no checkbox page. The initial 57/57 sweep is recorded in
[roadmap/complete/lab-spec-approval.md](../roadmap/complete/lab-spec-approval.md), still the recipe
for verifying renderer features. **Verification debt is decoupled from the work that
caused it**: an item may reach `complete/` owing approvals, provided the batch is
registered in the standing ledger
[roadmap/inprogress/lab-verify.md](../roadmap/inprogress/lab-verify.md) with its cause and what
a reviewer should look for. The ledger is not a copy of the queue — the queue is derived
and always current (`npm run verify:scenarios -- --list`); the ledger holds the *why*,
which provenance cannot record.

**The goldens are the crown jewels.** Any move or refactor of `model/`/`engine/` must
reproduce them byte-identically (`npm run update:primitives` then a clean
`git diff -- scenarios/`); a mismatch stops the line — diff against `pre-rebuild`, never

## The goldens per scenario cover different code

The goldens per scenario cover different code.
`expected.primitives.json` pins layout, and stops at staff-space coordinates and SMuFL
glyph *names*. `expected.svg` puts those primitives through the real emitter
(`harness/helpers/corpusSvg.ts` → `src/engine/render/svg.ts`), pinning what
`expected.primitives.json` structurally cannot see: the glyph name→codepoint lookup, the
five emit branches, sp→px, the viewBox. Map `gClef` to the wrong codepoint and the
primitives hash does not move. `expected.both.svg` (tab-opting scenarios) pins the
combined notation+tab system — vertical composition, spanning barlines, interleaved
wrap — which the standalone projections structurally cannot see; it is deliberately
**not** a third `RenderedSystem` in the primitives file, so introducing it rewrote no
committed golden. It is **text, not pixels, on purpose** — a PNG hash would
absorb the local Chrome build, font hinting and antialiasing, so a browser upgrade would
demote every approval at once and the queue would stop meaning "the renderer changed".
`GOLDEN_PX_PER_SP` is a **power of two** so sp→px adds no float noise. PNGs stay what
they always were: proposal engravings and a review aid (`harness/render/render-png.ts`),
never a golden and never hashed.
