# Architecture guardrails

Status: complete, 2026-09-22. Implementation loop.

## Problem

The documented layer contract exceeds the dependency checker: internal destinations
outside src/ and worker/ escape layer rules, Studio escapes the alphaTab ban,
viewer/player transitive editor imports are not checked, and the normal build omits
listening-bench entry points.

## Work

Expand internal source coverage with explicit importer converter allowances. Protect
viewer/player dependency graphs from editing, include experiment sources while excluding
generated output and installed dependencies, and test real import graphs through the
checker. Preserve generated schema data and intentional converter oracle imports.

## Acceptance

Forbidden graphs fail with the named rule; valid graphs pass. Root tests and build pass.
No runtime behavior, rendering goldens, or verification records change.

## Implementation and evidence

The normal check now discovers converters and experiments, and layer rules cover every
application source root. Importers explicitly retain converter access, Studio retains
self imports, and generated schema data remains permitted. Viewer, player and playback
binding use a transitive editor restriction. The shell restriction includes converters
and experiments; alphaTab restrictions include Studio and experiments.

The graph regression runs the actual build command against temporary sources. The old
rules report no violations for the deliberately forbidden graph; the fixed rules reject
each named edge, including nested workspace alphaTab resolution and indirect editor
access. A second graph admits importer, editor-host, type-only editor, generated-schema
and converter-oracle seams. It also verifies generated experiment output and installed
packages are not scanned as entry points. `doNotFollow` retains package import edges;
excluding node_modules would hide those edges and is deliberately avoided.

Targeted regression and the expanded repository boundary check pass. After rebasing
over the renderer consolidation, regenerated primitives leave scenarios byte-identical.
Final gates passed: 143 test files, 2,590 tests passed and one skipped; production build
passed. Landed in main at `0b37daf6`; worktree and branch removed before this completion
record. No runtime changes required browser smokes.
