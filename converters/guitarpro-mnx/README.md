# Guitar Pro ↔ MNX

The public library and CLI use the internal clean-room converters. AlphaTab is
a development-only differential-test oracle, not a runtime requirement.

## Format boundary

- Import: legacy binary GP3.00, GP4.00/4.06 and GP5.00/5.10; GP6 `.gpx`
  containers and GP7/8 `.gp` GPIF containers.
- Export: modern `.gp` (GPIF in ZIP). No GP3–5 binary or GP6 `.gpx` writer.
- GP1/2 `.gtp` is not supported. Container acceptance does not imply preservation
  of every application-specific feature; use `onWarning` to collect losses.

The legacy reader retains notation, tuning/capo, lyrics, ties and supported
techniques through the shared GPIF-to-MNX mapping. Unsupported musical effects
warn; RSE and page-layout data are not preserved. Chord names are retained,
but chord diagrams and dead-note styling are not. Navigation directions and
triplet feel also warn rather than being preserved; written durations remain
unchanged. The current coverage and
remaining edge cases are recorded in
[the binary-reader roadmap](../../roadmap/inprogress/core-guitarpro-binary-import.md).

```js
import { importGuitarPro, exportGuitarPro } from '@mnx-editor/guitarpro-mnx';

const document = importGuitarPro(bytes, { onWarning: console.warn });
const gpBytes = exportGuitarPro(document, { onWarning: console.warn });
```

CLI: `guitarpro-mnx --import score.gp5 --output score.mnx.json` or
`guitarpro-mnx --export score.mnx.json --output score.gp`.

## Migration from the AlphaTab-backed API

`importGuitarPro` and `exportGuitarPro` retain the byte↔MNX boundary, but generated
note IDs can change. Compare references by their resolved notes, not by literal
IDs. The AlphaTab-model helpers `scoreToMnx` and `buildScore` are no longer public
exports: consumers should use the byte-based API above. The clean-room parsed
GPIF/binary APIs remain available for inspection; they do not return AlphaTab
model instances.

## Verification

From the repository root:

```sh
npm run build --workspace @mnx-editor/guitarpro-mnx
npm test --workspace @mnx-editor/guitarpro-mnx
node converters/fixtures/tools/smoke-gp-package.mjs
```

The package smoke packs and installs into a fresh temporary directory with
`--omit=dev`, asserts AlphaTab is absent, and exercises import/export through
the installed public entry point. It requires npm dependency access and leaves
the temporary installation available for inspection. Differential tests import
the historical AlphaTab modules explicitly so they cannot accidentally compare
the clean-room implementation with itself.
