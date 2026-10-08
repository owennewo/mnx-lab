// Node entry of the headless library: compiled assets loaded from the package
// itself, and renderOffline bound to them.
import {hostAssets} from './node-assets.js';
import {renderOffline} from './offline.js';
import {INSTRUMENTS} from './instruments/index.js';
export {hostAssets};
export const render=options=>renderOffline({instruments:INSTRUMENTS,assets:hostAssets(),...options});
