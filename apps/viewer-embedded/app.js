// The host page's own code — plain JS, no build step, no framework.
// (roadmap/proposed/core-viewer-embedded-app.md)
//
// It does exactly what a stranger's site would: load the artifact from a URL,
// fetch its OWN score files, and set them on the element. Everything else —
// fonts, SMuFL metadata, layout, shadow DOM — is the component's problem. That
// asymmetry is the test: if this file ever grows a workaround, the embed
// contract has a hole in it.

/**
 * Where the embed artifact lives. A real host hard-codes its CDN URL here;
 * this repo has nowhere to point yet (the deploy ships `dist/client`, not
 * `dist/embed` — deploying the artifact is an open decision in the proposal),
 * so ARTIFACT_BASE stays null and the page demands `?base=`.
 *
 * Deliberately NOT defaulted to a relative path: a wrong default 404s with a
 * cryptic module error and invites someone to "fix" it by serving the
 * artifact same-origin — which is the exact convenience that hid the asset
 * bug this app was built to catch. `npm run dev:embed-app` prints the right
 * URL; `npm run smoke:embed` asserts the same topology.
 */
const ARTIFACT_BASE = null;

const params = new URLSearchParams(location.search);
const base = (params.get('base') ?? ARTIFACT_BASE)?.replace(/\/+$/, '');

/** The scores THIS host serves — its own files, not the lab's corpus. */
const SCORES = [
  { id: 'blues', label: 'Twelve-bar blues', file: 'scores/twelve-bar-blues.mnx.json' },
  { id: 'chord', label: 'Open strings (tab)', file: 'scores/open-strings-chord.mnx.json' },
  { id: 'lyrics', label: 'Song with lyrics', file: 'scores/lyrics.mnx.json' }
];

const viewer = document.getElementById('viewer');
const nav = document.getElementById('scores');
const status = document.getElementById('status');

function setStatus(text, ok = true) {
  status.textContent = text;
  status.dataset.state = ok ? 'ok' : 'error';
}

async function show(score) {
  for (const button of nav.children) {
    button.setAttribute('aria-current', String(button.dataset.id === score.id));
  }
  try {
    const response = await fetch(score.file);
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const mnxJson = await response.json();
    // The element's document property — the host supplies the score, the
    // component owns everything about drawing it.
    viewer.mnxDoc = { id: score.id, name: score.label, lastUpdated: 0, mnxJson };
    viewer.hasTab = JSON.stringify(mnxJson).includes('"strings"');
    viewer.viewMode = viewer.hasTab ? 'both' : 'notation';
    setStatus(`${score.label} — rendered by the embed artifact at ${base}`);
  } catch (error) {
    setStatus(`could not load ${score.file}: ${error.message}`, false);
  }
}

for (const score of SCORES) {
  const button = document.createElement('button');
  button.textContent = score.label;
  button.dataset.id = score.id;
  button.addEventListener('click', () => show(score));
  nav.append(button);
}

// The two theme axes, deliberately independent: page light/dark × score
// light/dark are four combinations that all have to look right, and a host
// whose own scheme is locked to the component's could never show three of
// them. The page moves via `color-scheme` (the standard declaration, and the
// very signal the component reads when its theme is `auto`); the score moves
// via the element's `theme` attribute.
function wireThemeButtons(attribute, apply) {
  const buttons = [...document.querySelectorAll(`.themes button[data-${attribute}]`)];
  for (const button of buttons) {
    button.addEventListener('click', () => {
      const value = button.dataset[attribute];
      apply(value);
      for (const other of buttons) {
        other.setAttribute('aria-current', String(other === button));
      }
    });
  }
}

wireThemeButtons('page', value => {
  if (value === 'auto') delete document.documentElement.dataset.pageTheme;
  else document.documentElement.dataset.pageTheme = value;
});

wireThemeButtons('score', value => {
  // `auto` is the element's default: it follows the page, because
  // color-scheme is inherited. Setting it explicitly is how a host overrides
  // that — e.g. a dark site that still wants the score on white paper.
  viewer.setAttribute('theme', value);
});

// Load the artifact, then the first score. `whenDefined` is the honest wait:
// the element is usable only once the custom element registry has it.
if (!base) {
  setStatus(
    'no artifact base configured — open with ?base=<url of dist/embed>, or run npm run dev:embed-app, which prints the URL.',
    false
  );
} else {
  setStatus('loading the embed artifact…');
  import(/* @vite-ignore */ `${base}/mnx-lab.esm.js`)
    .then(() => customElements.whenDefined('mnx-score-viewer'))
    .then(() => show(SCORES[0]))
    .catch(error => setStatus(`could not load the embed artifact: ${error.message}`, false));
}
