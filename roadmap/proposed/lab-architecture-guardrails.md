# Architecture guardrails

Status: proposed, 2026-09-22. Implementation loop.

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
