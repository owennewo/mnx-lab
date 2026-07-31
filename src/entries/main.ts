// Build face: the workbench (index.html → this entry). Registers the shell
// and bundles the IBM Plex faces the design tokens reference — no font CDN.
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';

import './workbench.css';
import '../ui/WorkbenchApp.ts';
