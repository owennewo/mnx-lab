// Import Web Awesome styles
import '@awesome.me/webawesome/dist/styles/themes/default.css';

// IBM Plex (bundled — no font CDN): Sans for UI, Mono for ids/JSON/numbers,
// Serif for scenario titles and the dashboard headline (see DIRECTION.md).
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/ibm-plex-serif/400.css';
import '@fontsource/ibm-plex-serif/500.css';
import '@fontsource/ibm-plex-serif/500-italic.css';

import './index.css';

// Import Web Awesome custom elements
import '@awesome.me/webawesome/dist/components/button/button.js';
import '@awesome.me/webawesome/dist/components/split-panel/split-panel.js';
import '@awesome.me/webawesome/dist/components/slider/slider.js';
import '@awesome.me/webawesome/dist/components/dropdown/dropdown.js';
import '@awesome.me/webawesome/dist/components/icon/icon.js';
import '@awesome.me/webawesome/dist/components/input/input.js';
import '@awesome.me/webawesome/dist/components/spinner/spinner.js';
import '@awesome.me/webawesome/dist/components/divider/divider.js';

// Register Bootstrap Icons as the default library resolver for wa-icon
import { registerIconLibrary } from '@awesome.me/webawesome/dist/webawesome.js';
registerIconLibrary('default', {
  resolver: name => `https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/icons/${name}.svg`
});

// Load SMuFL metadata before the editor renders any music
import { loadSmufl } from './smufl/smufl.ts';
loadSmufl();

// Register main editor app element
import './components/MnxEditorApp.ts';
