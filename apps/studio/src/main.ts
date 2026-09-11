// Build face: studio (studio/index.html → this entry, served at /studio/).
// Registers the shell and the elements it mounts. Studio consumes only the
// framework-neutral surfaces — elements/ and below, plus the typed library
// client — never src/workbench/ (dependency-cruiser makes that a red build).
//
// Same single webfont as the workbench, same four latin-only files, for the
// same reason (src/entries/main.ts): one interface voice, and 700 is the
// score's weight, not the chrome's.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';

import '../studio.css';
import '../../../src/elements/DocumentViewer.ts';
import '../../../src/elements/Player.ts';
import './StudioApp.ts';
