# Preparing and validating releases

The release workflow is local and private. It never deploys, publishes an npm
package, tags git or changes a remote. A prepared candidate is not a passed release.

## Prepare

Requirements: Node 22+, git and the checked-in compiled assets. No FAUST or npm
dependency install is required to prepare a consumer bundle.

```bash
npm run release:prepare
```

This builds the app/library twice in fresh temporary directories, verifies exact
inventories/hashes, compares deterministic compressed archive bytes, checks FAUST
metadata pins, and extracts the actual library tarball into an isolated consumer.
The consumer resolves bare package exports, renders the multi-part fixture,
passes its measured expectations and matches the checkout's output hash.

Outputs are immutable `dist/releases/VERSION-candidate-CANDIDATEHASH/` directories:
library `.tgz` (npm-compatible `package/` root), deployable app `.tar.gz`,
SHA256SUMS, candidate manifest, source/runtime/toolchain provenance and notes.
No existing candidate is overwritten. Source changes during preparation fail.
An identical rerun reuses the identical candidate. A changed commit, dirty state
or environment changes provenance and creates a different immutable candidate;
archive reproducibility is checked independently of provenance identity.

```bash
cd dist/releases/VERSION-candidate-CANDIDATEHASH
sha256sum -c SHA256SUMS
```

Checksums detect corruption, not malicious replacement; obtain them through a
trusted channel. Provenance records dirty trees explicitly. Before promotion,
commit the reviewed changes and prepare/test a candidate from that clean commit.

## Automated gate

```bash
npm run release:verify -- dist/releases/VERSION-candidate-CANDIDATEHASH
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs CHROME_PATH=/path/to/chrome \
  npm run release:check -- dist/releases/VERSION-candidate-CANDIDATEHASH
```

`release:verify` independently checks checksums, archive inventories, rebuilds
both archives and reruns the actual packaged consumer against the current sources.
It rejects stale candidates. `release:check` additionally requires the real-browser
dependency, runs the full tests, tests the extracted library worklet,
and serves the extracted app on an isolated port for UI tests. Host protocol tests
use a separate source-tree test harness (not shipped in the app). Browser failure
or any required skipped test fails the gate. Logs, screenshot outputs and a report
bound to the candidate manifest hash are retained under build/release-checks.

## Required acceptance before promotion

1. `npm test` passes with no unexpected skips; deliberate sound changes carry before/after audio and the lead's sign-off (chain campaign C3).
2. Actual packaged library and manifest/reproduction checks pass.
3. Serve the **extracted app** on an isolated localhost port; run `test:app` with
   STUDIO_URL pointing there and `test:host-browser` with real Chrome. Run library
   smoke with PLAYWRIGHT_MODULE so its AudioWorklet case is not skipped. Missing
   browser setup or skipped required checks means no release pass.
4. Inspect desktop/narrow screenshots; test previews, Stop/restart/loop, all kinds,
   live edits, exact saved/reloaded values, files and storage failure/recovery.
5. Audition the examples listed in LISTENING.md (Session → Examples) and record the
   user's verdict. Automated waveform checks cannot substitute for it.
6. Resolve notices/licence and obtain explicit approval for any external sharing.

Passing the automated gate is required, but manual UI review, listening and
distribution review remain separate. See LISTENING.md for the fixed set.

## Install, serve and roll back

For a local headless consumer, install the chosen tarball with
`npm install --ignore-scripts /absolute/path/mnx-lab-synth-VERSION.tgz`.
Keep its candidate manifest/checksums with your dependency record. Do not use a
floating local dist/lib path as a release dependency.

Extract the app archive into a **new directory**, serve its top-level app folder
on localhost for validation, then use HTTPS for any approved deployment. Do not
overlay an older app: stale modules can invalidate its manifest. Keep each whole
version directory intact; promotion switches the served directory atomically.

Rollback selects the preceding verified app directory or reinstalls the preceding
library tarball. Stop playback/reload after switching. Export sessions before
promotion; browser data belongs to its origin and rollback does not undo stored
data. 0.2.0 reads no saved data from earlier versions (chain campaign C2), and
downgrades must be tested before claiming saved-data compatibility.

Standalone `build:app`/`build:lib` retain prior outputs as `.previous-UUID` siblings.
Changed or undeclared output files block replacement. Older bundles whose manifest
omits files must be moved aside explicitly; they are not silently deleted. Failed
staging directories can be inspected, then removed by their exact path after
confirming they contain only generated output.
