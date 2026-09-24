# Browser smokes

`harness/verify/*-smoke.mjs` drive a real headless Chrome over the built site
through the DevTools protocol. They exist because the UI has no unit tests, by
rule: `elements/`, `workbench/` and `apps/studio/` are shells, the conformance
suite may not import them (`harness-not-into-shells`), and the claims worth
making about them — that a box is drawn where the reader is looking, that a
press lands on the beat it named — are claims about a finished SVG in a laid
out page. Only a browser can answer those.

They are selected by the behavior a change affects, not run as a blanket gate.
Run the relevant ones before landing a shell or element change. Check a baseline before
editing only when existing behavior or harness health is uncertain. For a bug fix,
prove the new regression assertion fails on old code with the smallest applicable test.

## Running one or several

`npm run smoke -- selection inspector` builds the site once and runs both smokes.
Individual commands such as `npm run smoke:selection` still build for you.
The runner builds each requested face at most once (site, embed, or library) — the
bundle only (`build:site` is `vite build`, a few seconds): the gate build's validators,
boundaries and type checks are the gate's business, not the browser's. Then it runs the
smokes **four at a time** (`--jobs N` to change it, `--jobs 1` for one after another):
each owns its ports, Chrome profile and library, so nothing is shared. Output is held
per smoke and printed whole as each finishes; after the first failure nothing new
starts, and the summary names what failed and what never ran. The ESM and IIFE embed
checks are two independent jobs; a review page and the smoke that reads it
(`player`, `unrolled`) stay one ordered job. Use `npm run smoke -- --help` for names,
including smokes without individual npm scripts.

On 2026-09-24 the full set took ~205 s one at a time and ~67 s four at once, all green,
before any smoke was sped up; eight at once was faster still but slowed each smoke by
up to 2× on a 6-core machine, which is where timing flakes live.

After a successful gate build, run `npm run smoke -- --built selection inspector`.
`--built` skips builds explicitly: the artifacts must match the current sources and
configuration. Rebuild after relevant edits or rebases. For embed/lib, build those
faces first or let the runner do it. Direct `node harness/verify/<name>-smoke.mjs`
invocations also reuse the current build. The audio smoke uses its own Vite server
and needs no production build.

Browser smokes need `google-chrome` on PATH, or `CHROME_BIN`. Their file headers
describe additional requirements.

Those using the library start their own with `startLocalLibrary()`
(`harness/verify/localLibrary.mjs`): wrangler's dev server run **in-process** — the same
`wrangler.jsonc`, `dist/client` assets, `_headers` and Worker as `wrangler dev` — on a
free port, over a throwaway D1/R2 seeded with the migrations and the local user, trusting
a key made for that run. It is up in about a second and needs no `dev:login`, no
`.secrets/`, and no server started by hand; no fixed port can collide and no worktree's
database is written. `close()` belongs in the smoke's `finally`. A smoke killed before it
gets there (SIGKILL, a tool timeout) is covered by `harness/verify/reaper.mjs`, a
detached watcher that SIGKILLs the dead smoke's Chrome and workerd; the next start sweeps
its temp state.

## The traps

Every one of these has cost someone a debugging session. They are properties of
the harness, of SMuFL, and of CDP — not of the code under test.

### Never throw from `finally`

A teardown that throws **replaces the failure the smoke was reporting**,
assertion message and all, and leaves you staring at an unrelated stack. The
specific offender is the profile directory: Chrome goes on flushing its cache
after it reports exit, so `fs.rmSync(profile)` races and sometimes loses with
`ENOTEMPTY`. A temp directory left behind is litter, not a failure — wrap it.

The litter itself is the runner's job, not the smoke's. Most smokes never removed
their profile and the rest lost that race, Chrome leaves `com.google.Chrome.*` and
`scoped_dir*` behind, and Miniflare its storage: on 2026-09-24 `/tmp` (a tmpfs with a
per-user quota) held 6.3 GB of it and SQLite writes in the library tests failed with
`EDQUOT`. So `run-smokes.mjs` gives every job `TMPDIR=<a directory of its own>` and,
when the job ends, SIGKILLs whatever still names that directory and removes it;
`npm test` does the same per run (`harness/helpers/tempScope.ts`), and either sweeps a
killed run's directory next time (`harness/verify/tempDirs.mjs`). A smoke makes its
profile with ``mkdtemp(`${os.tmpdir()}/…`)`` — never a literal `/tmp` — so it lands
inside. A smoke run directly with `node` has no scope and still litters `/tmp`.

### Shadow roots move

An element the smoke reaches by `page.shadowRoot.querySelector(...)` may have
moved inside another component, or become conditional. `unrolled-smoke` died
for a year's worth of releases on `settings.open = true` — not because the
settings pad was gone but because it now lives inside `<mnx-score-frame>` and
is rendered only while its pad is open, so the query returned null and the
smoke never reached what it was testing. Query through the owning component and
assert each hop, so the message names the hop that broke.

### A glyph's box is its whole em square

`getBoundingClientRect()` on a SMuFL `<text>` glyph returns the font's full
ascent and descent. One quarter rest measures **160px tall** at ordinary zoom —
several staves. Aim at such a glyph by its rect's centre and the press lands on
the system *below*, where that x is a different bar; filter a list of them by
"is it on screen" and everything fails the test.

Use the glyph's own baseline instead, which is what
`scoreGeometry.inkBox` does in production:

```js
const ctm = svg.getScreenCTM(), pt = svg.createSVGPoint();
pt.x = el.x.baseVal.getItem(0).value;
pt.y = el.y.baseVal.getItem(0).value;
const aim = pt.matrixTransform(ctm);           // now press here
```

Noteheads and fret digits are ordinary ink and need none of this.

### Navigating to the same `#fragment` does not reload

Every workbench and studio URL carries a route fragment. `Page.navigate` to a
URL the page is already on is a *same-document* navigation: nothing reloads, no
`localStorage` preference set just beforehand is re-read, and the page keeps
whatever cursor, scroll and selection the previous act left it. Assertions then
measure the last act's leftovers.

Hop through `about:blank` first:

```js
await cdp.send('Page.navigate', { url: 'about:blank' });
await new Promise(r => setTimeout(r, 300));
await cdp.send('Page.navigate', { url });
```

The profile is reused across acts within one smoke, so `localStorage` *does*
carry over — which is how the staff-scale and view preferences are set.

### Scrolling re-engraves, and a held node is then detached

The viewer repaints on scroll and on resize — and on every edit-cursor move,
which now includes a press that places the cursor and a pause that parks it on
the playhead (core-single-cursor.md). A node captured before any of those is no
longer in the tree afterwards: it reports a zero rect and **swallows a synthetic
press in silence** rather than erroring (it may still fire `note-selected`,
which no longer seeks when an editor is bound). Re-query the SVG and the element
after anything that can repaint, and assert the rect is non-zero before aiming
at it.

### The page-side code is inside a template literal

Everything passed to `cdp.evaluate` is a JavaScript template literal in the
smoke file. A **backtick anywhere inside it — including in a comment — ends the
string**, and the file dies with `SyntaxError: missing ) after argument list`
pointing at the opening line rather than at the offending one. `${` is
interpolated by the smoke rather than the page for the same reason. Write inner
comments in plain prose, and run `node --check` after editing one.

### Ready alone is not ready under load

The runner puts four smokes on the machine at once, and other agents' gates share it
too. A readiness check that only held because the page was quick then races. Wait for
the thing the next assertion reads, not a neighbour of it: `unrolled-smoke` waited for
the player's performance and then looked for the painted score, which under load was
not painted yet (it now waits for `SCORE_READY` and `settle`). A chain evaluated right
after `Page.navigate` can reach a shell that has not mounted: a wait loop should treat
that throw as "not yet" until its deadline and report the last error if it never
clears, as `studio-smoke`'s `wait` does.

### The default headless window is 800×600

Unless the smoke sets `--window-size` or `Emulation.setDeviceMetricsOverride`,
very little of a score is on screen. A filter like "top > 60 and bottom <
innerHeight − 60" matches almost nothing, and a debug harness run at a
comfortable size will not reproduce it. A synthetic press does not need its
target visible — it carries its own coordinates and the hit test reads the
engraving — so prefer not to filter at all.

## Writing an assertion

Press with a real `PointerEvent`; the viewer places the cursor on `pointerdown`,
not `click`, because selecting a note can re-engrave the score and leave the
press and release on different nodes:

```js
el.dispatchEvent(new PointerEvent('pointerdown', {
  clientX: x, clientY: y, button: 0, isPrimary: true,
  bubbles: true, composed: true, cancelable: true
}));
```

Rationals crossing `Runtime.evaluate` are BigInt and **`JSON.stringify` throws
on them** — send `String(r.num) + '/' + String(r.den)`, or compare in the page
(`a.num * b.den - b.num * a.den`).

**Wait for a condition, never a guessed time.** After an input, `await settle(cdp)`
(`browserHarness.mjs`): it returns once, for three frames running, nothing in the DOM or
any shadow root has changed, no Lit update is pending, no CSS transition is running and
no scroll has moved. That is what a fixed sleep was guessing at, and the guesses were
most of the suite's time — `inspector` spent 21 of its 25 s asleep. What `settle` cannot
see is a timer that fires *later* in quiet: the fret window, a refusal flash. Wait for
that timer's result by name with `waitFor` / the smoke's `until`, as
`selection-smoke` does for `pendingFret === null`. Keyframed animations (the focus
hint's 2.2 s fade) do not hold `settle` up; transitions do, because a geometry check can
read one mid-flight.

`settle` found two things the sleeps hid: a 180 ms enclosure tween still on the page
(the old sleep outlasted it by luck), and after the destruct sweep the scenario page's
render throws (`reading 'lyrics'` on the `{}` document). A throwing update counts as
finished — judging it is an assertion's job, not the wait's.

Prefer an invariant over a constant: "these two presses land in two different
places" survives a re-engraving, an edited fixture and a different window size,
where "this press lands on beat 3/4" does not.

For a bug regression, make the assertion **fail on old code before trusting it**.
Use the smallest applicable test; only a browser-only regression needs an old-code
build. Restore the changed sources and rebuild before the final smoke. This is not
a requirement to run every existing smoke twice for every UI change.

When one fails and the message is not enough, **instrument the smoke itself**
rather than cloning it into a scratch harness. A richer failure message is worth
keeping; the clone is thrown away, and it will differ from the real run in
window size, profile state and act order — every one of which has hidden a bug
at least once.
