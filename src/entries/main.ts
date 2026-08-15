// Build face: the workbench (index.html → this entry). Registers the shell and
// bundles the one face the design tokens reference — no font CDN.
//
// ONE webfont, deliberately (roadmap/proposed/core-modernist-type.md). Archivo
// is the whole interface voice: the design system is "set entirely in Archivo",
// so the serif is gone and `--mono` is a considered SYSTEM stack rather than a
// second download. This app already ships Bravura, which is not optional and
// not small; a second UI face is a cost the mono voice does not repay when all
// it carries is ids, hashes and coordinates.
// Latin subset only. The unsuffixed entrypoints also pull latin-ext and
// Vietnamese — nine woff2 files where three will do. Browsers fetch by
// unicode-range so the others would rarely download, but they are still build
// output we would be shipping and serving for no reader we have.
//
// 700 is the SCORE's weight, not the chrome's: fret digits ask for it by name
// and everything the engine emits as `bold` resolves to it. Without the face,
// both got a synthesized bold smeared out of 600 — worst on the one text the
// reader of a tab actually reads. Four files, still latin-only.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';

import './workbench.css';
import '../workbench/WorkbenchApp.ts';
