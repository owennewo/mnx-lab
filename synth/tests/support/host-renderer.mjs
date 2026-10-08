// Conformance renderer backed by the Node host (renderOffline + Node assets), in this
// thread or in a worker pool (results are identical; renders are deterministic).
import {renderOffline} from '../../web/host/offline.js';
import {hostAssets} from '../../web/host/node-assets.js';
import {INSTRUMENTS} from '../../web/host/instruments/index.js';
import {workerPool} from './workers.mjs';
export const hostRender=args=>renderOffline({...args,instruments:INSTRUMENTS,assets:hostAssets()});
// → an async renderer for runFixture, and close() to stop its workers.
export function pooledHostRender(options){const pool=workerPool(import.meta.url,'hostRender',options);return {render:pool.run,close:pool.close};}
