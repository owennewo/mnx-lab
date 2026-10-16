// Build face: studio (studio/index.html → this entry, served at /studio/).
// Registers the shell and the elements it mounts. Studio consumes only the
// framework-neutral surfaces — elements/ and below, plus the typed library
// client — never src/workbench/ (dependency-cruiser makes that a red build).
//
// Same interface webfont as the workbench, same four latin-only files, for the
// same reason (src/entries/main.ts): one interface voice. The score's own
// lettering (fret digits, verses) follows below.
import '@fontsource/archivo/latin-400.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
// The score's lettering (elements/tokens.ts --score-font-*; src/entries/main.ts).
import '@fontsource/montserrat/latin-700.css';
import '@fontsource/lora/latin-400.css';

import '../studio.css';
import { applyTheme, readTheme } from './theme.ts';
import '../../../src/elements/DocumentViewer.ts';
import '../../../src/elements/Player.ts';
import '../../../src/elements/ScoreFrame.ts';
import './StudioApp.ts';

// The remembered theme, before the first paint: a pinned scheme must not
// flash the machine's.
applyTheme(readTheme());
