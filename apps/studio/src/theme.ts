// The studio theme — the same three-value vocabulary as the workbench's
// (`mnx-lab.theme`) and `<mnx-document-viewer>.theme`, deliberately: one idea,
// one set of names. `auto` follows the machine and is a real answer, so the
// toggle walks all three (auto → light → dark → auto) rather than flipping
// two; a two-state switch would be the one control that cannot get back to
// following the system.
//
// The mechanism is `color-scheme` on the document root: an inherited property
// that crosses shadow boundaries, so every `light-dark()` pair in the shell,
// the frame, the pads, the player and the notation re-resolves in one stroke,
// and native widgets and scrollbars follow. studio.css declares `light dark`
// there; an explicit choice pins one half inline. Stored per browser beside
// the other `mnx-studio.*` preferences (scorePreferences.ts).
import { svg } from 'lit';
import { read, write } from './scorePreferences.ts';

export type ThemeSetting = 'auto' | 'light' | 'dark';

export const THEME_KEY = 'mnx-studio.theme';
const ORDER: readonly ThemeSetting[] = ['auto', 'light', 'dark'];

export function readTheme(): ThemeSetting {
  const value = read(THEME_KEY);
  return value === 'light' || value === 'dark' ? value : 'auto';
}

export function resolvedTheme(theme: ThemeSetting): 'light' | 'dark' {
  if (theme !== 'auto') return theme;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function nextTheme(theme: ThemeSetting): ThemeSetting {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
}

export function applyTheme(theme: ThemeSetting) {
  document.documentElement.style.colorScheme = theme === 'auto' ? '' : theme;
}

export function setTheme(theme: ThemeSetting) {
  write(THEME_KEY, theme === 'auto' ? null : theme);
  applyTheme(theme);
}

/** The toggle's mark — the lit `svg` tag, not `html`, so the fragment lands in
 *  the SVG namespace. A ring: empty for light, filled for dark, half for auto. */
export function themeGlyph(theme: ThemeSetting) {
  const inner = theme === 'auto'
    ? svg`<path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"></path>`
    : theme === 'dark' ? svg`<circle cx="12" cy="12" r="8" fill="currentColor"></circle>` : svg``;
  return svg`<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"></circle>${inner}</svg>`;
}
