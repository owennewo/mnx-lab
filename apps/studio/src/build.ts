// What wrote a file or a recovery record: the package version and the commit it
// was built from. `__MNX_COMMIT__` is defined by vite.config.ts; a dev server
// without git says so rather than guessing.
import { version } from '../../../package.json';

declare const __MNX_COMMIT__: string | undefined;
export const BUILD = `${version}+${typeof __MNX_COMMIT__ === 'string' && __MNX_COMMIT__ ? __MNX_COMMIT__ : 'dev'}`;
