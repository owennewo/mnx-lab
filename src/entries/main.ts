// Build face: the workbench (workbench/index.html → this entry, served at /workbench/). Registers the shell and
// bundles the faces the tokens reference — no font CDN.
//
// ONE INTERFACE webfont, deliberately (roadmap/complete/core-modernist-type.md). Archivo
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
// 700 is the SCORE's weight, not the chrome's: everything the engine emits as
// `bold` (section labels, rehearsal marks) resolves to it. Without the face it
// got a synthesized bold smeared out of 600. Four files, still latin-only.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
// The SCORE's lettering, not the interface's (elements/tokens.ts
// --score-font-*): fret digits in Montserrat Bold, verses in Lora. One weight
// each, latin only — two more files, and the reason the tab reads full.
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/lora/latin-400.css';

import './workbench.css';
import '../workbench/WorkbenchApp.ts';
