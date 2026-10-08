import type {HostAssets, renderOffline} from './index.js';
export function hostAssets(): HostAssets;
/** renderOffline with this package's compiled assets and instruments. */
export function render(options: Omit<Parameters<typeof renderOffline>[0], 'instruments' | 'assets'>): ReturnType<typeof renderOffline>;
