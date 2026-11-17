/**
 * libsodium on Android: the C library itself, called through JSI
 * (react-native-libsodium). Same functions and the same bytes as the web
 * build, so a box locked on a phone opens in a browser and back.
 */
import sodium from 'react-native-libsodium';

import type { Sodium } from './sodium-type';

export default sodium as unknown as Sodium;
