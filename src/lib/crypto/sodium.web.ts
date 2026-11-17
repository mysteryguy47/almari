/** libsodium in the browser: the official WebAssembly build. */
import sodium from 'libsodium-wrappers';

import type { Sodium } from './sodium-type';

export default sodium as unknown as Sodium;
