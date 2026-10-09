// Whether a newer studio has been deployed than the one running. Installed as
// an app, studio has no browser chrome — no reload button — and Android
// resumes it from memory, so one page can run one build for days with nothing
// to say so. The build writes /studio/version.json (vite.config.ts) and this
// reads it whenever the app comes back to the foreground, and now and then
// while it stays there. It only reports: reloading is the person's call, made
// with the Update button the shell and the piece page show.
import { COMMIT } from './build.ts';

export const VERSION_URL = '/studio/version.json';
const EVERY_MS = 15 * 60_000;

/** The commit the site serves now, or null when it cannot say (offline, signed out, a dev server). */
async function deployedCommit(): Promise<string | null> {
  try {
    const response = await fetch(VERSION_URL, { cache: 'no-store' });
    if (!response.ok) return null;
    const { commit } = (await response.json()) as { commit?: unknown };
    return typeof commit === 'string' && commit ? commit : null;
  } catch {
    return null;
  }
}

/**
 * Calls `onNewer` with the deployed commit once it differs from this page's.
 * Returns the stop. A dev server, or a build git could not stamp, has nothing
 * to compare and never asks.
 */
export function watchDeploy(onNewer: (commit: string) => void): () => void {
  if (import.meta.env.DEV || !COMMIT) return () => {};
  let stopped = false;
  const check = async () => {
    if (stopped || document.visibilityState !== 'visible') return;
    const commit = await deployedCommit();
    if (!stopped && commit && commit !== COMMIT) onNewer(commit);
  };
  const onVisible = () => void check();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('pageshow', onVisible);
  const timer = setInterval(onVisible, EVERY_MS);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('pageshow', onVisible);
    clearInterval(timer);
  };
}
