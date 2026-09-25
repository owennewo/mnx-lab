# Research loop: first real-audio experiment complete

[002 — Winner with sync interpolation](002-winner-sync-proxy.html) now records the
completed development loop: fixed evidence, initial spectral follower, one focused
revision and a stopping decision. Neither candidate passes. Stay at Winner's first
four bars; positive Dust and longer excerpts have not been advanced.

The user directed us to use `sync.json` with interpolation as good enough for initial
development. [The development amendment](../contracts/sync-proxy-development-1.md)
records that direction. Manual beat annotation is not a prerequisite for this loop.
The approved contract 1 and its later formal retention/microphone requirements remain
preserved; neither retention nor qualification is claimed.

## What the instrument checkpoint established

Before experiment 002, a separate v2 instrument was implemented and checked for
independently bounded real-audio labels. It supports position uncertainty, acoustic
alternatives, unknown regions, causal paired comparison and conservative selection.
The [v2 contract](../contracts/instrument-v2.md), [hand-worked oracle](../bench/oracle-v2/README.md)
and [recorded checkpoint](../bench/oracle-v2/recorded/checkpoint.json) remain unchanged.
They prove measuring-apparatus behavior, not a listening result.

Experiment 002 instead uses the explicitly declared `sync-proxy-evaluator@1` with
unmeasured interpolation precision and unchanged numerical development targets.
It keeps approximation visible rather than pretending it has independently bounded
beat labels. The frozen v1 instrument and experiment 001 also remain unchanged.

## What the 31.25% calculation meant

The [anchor sensitivity calculation](../evidence/bar-anchor-precision-1.json) asked
how much interior precision could be guaranteed if cached endpoints were exact and
continuous local speed could vary anywhere within 80–120% of nominal tempo. Under
those assumptions, bar anchors guaranteed the specified uncertainty envelope for
31.25% of each clip, below the original 80% independently bounded-label requirement.

**That was not a measurement of sync.json accuracy.** It did not show that the real
anchors or interpolated positions were wrong. Applying it as a blocker to the first
approximate development loop was unnecessarily restrictive; the user's direction
resolves that. Keep sync unchanged and investigate early/late differences as evidence,
without automatically blaming either the musician or the reference.

## Private playback and optional precision review

The private directory is `/home/williao/dev/mnx-listening-data/real-evidence-01/`.
`002-winner-sync-proxy.html` embeds Winner's WAV and the three recorded timing traces.
`listen.html` embeds both reviewed four-bar clips. `beat-review.html` remains available
if independent timing bounds become useful for stronger claims; it is optional for
this development stage. Its blank observation fields do not mean the proxy run is blocked.

Playback over localhost was previously verified in Chrome at 9.506958 and 5.079896
seconds. The offline pages embed those exact WAVs; exporters check identities and
script syntax is checked separately. Browser automation blocks `file://` navigation,
so the offline UI has not been interactively verified through that tool.

Rebuild the private pages from the repository root:

```sh
node experiments/performance-listening/reports/export-private-sync-proxy.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-private-listening.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
node experiments/performance-listening/reports/export-beat-review.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
```

For an ordinary browser over HTTP, start the local-only server and stop it with Ctrl+C:

```sh
node experiments/performance-listening/reports/serve-private-review.mjs /home/williao/dev/mnx-listening-data/real-evidence-01
```

No audio, scores or per-frame private references are committed. Full results, consumed
budget and the next diagnostic question are in experiment 002. The first research
cycle is closed with a failed hypothesis; the useful microphone-following milestone
is still in development.
