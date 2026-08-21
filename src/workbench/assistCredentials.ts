// Where the user's OpenRouter key lives — the SHELL, by decision
// (core-assist-byok.md): localStorage on the workbench origin, never in
// elements/, so the embed face cannot carry a credential onto a host page.
// Two ways in (PKCE, paste), one way out (forget). The PKCE verifier and the
// route to return to ride sessionStorage: they must survive the redirect and
// die with the tab.
import {
  exchangePkceCode,
  newPkceVerifier,
  pkceAuthorizeUrl,
  pkceChallenge
} from '../assist/openrouter.ts';

const KEY_KEY = 'mnx-lab.openrouter-key';
const VERIFIER_KEY = 'mnx-lab.pkce-verifier';
const RETURN_KEY = 'mnx-lab.pkce-return';

export function storedApiKey(): string | null {
  return localStorage.getItem(KEY_KEY);
}

export function storeApiKey(key: string) {
  localStorage.setItem(KEY_KEY, key);
  window.dispatchEvent(new CustomEvent('assist-credentials-change'));
}

export function forgetApiKey() {
  localStorage.removeItem(KEY_KEY);
  window.dispatchEvent(new CustomEvent('assist-credentials-change'));
}

/** The callback is the page's origin + path, hash stripped — derived at
 *  runtime so whatever port Vite picked (5173 today, 5174 when that was
 *  taken) and the production origin are the same code path. */
function callbackUrl(): string {
  return `${location.origin}${location.pathname}`;
}

/** Leave for OpenRouter. Returns only if navigation could not start. */
export async function beginPkce(): Promise<void> {
  const verifier = newPkceVerifier();
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(RETURN_KEY, location.hash);
  location.href = pkceAuthorizeUrl(callbackUrl(), await pkceChallenge(verifier));
}

export type PkceLanding =
  | { kind: 'none' }
  | { kind: 'connected'; returnHash: string }
  | { kind: 'failed'; reason: string; returnHash: string };

/** Called once at boot: if this load is the PKCE callback (`?code=` in the
 *  search), exchange it, store the key, clean the URL and report where to
 *  go. A code with no verifier (another tab, a stale bookmark) is refused —
 *  the exchange would fail anyway, and silently swallowing it would hide a
 *  half-finished connect. */
export async function completePkceLanding(): Promise<PkceLanding> {
  const params = new URLSearchParams(location.search);
  const code = params.get('code');
  if (!code) return { kind: 'none' };
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  const returnHash = sessionStorage.getItem(RETURN_KEY) ?? '';
  sessionStorage.removeItem(VERIFIER_KEY);
  sessionStorage.removeItem(RETURN_KEY);
  // Clean the code out of the URL before anything else — a stale code in the
  // address bar is a restart hazard once the ten-minute window closes.
  history.replaceState(null, '', `${location.pathname}${returnHash}`);
  if (!verifier) return { kind: 'failed', reason: 'no verifier in this tab — start the connect again', returnHash };
  try {
    storeApiKey(await exchangePkceCode(code, verifier));
    return { kind: 'connected', returnHash };
  } catch (e) {
    return { kind: 'failed', reason: e instanceof Error ? e.message : String(e), returnHash };
  }
}

/** The boot-time landing verdict, parked for the assist tab to read once —
 *  the page that exchanged the code is not the one that shows the result. */
let parkedLanding: PkceLanding = { kind: 'none' };
export function parkLanding(l: PkceLanding) {
  parkedLanding = l;
}
export function takeLanding(): PkceLanding {
  const l = parkedLanding;
  parkedLanding = { kind: 'none' };
  return l;
}
