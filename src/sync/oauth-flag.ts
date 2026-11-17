/**
 * Set while Google sign-in is open in the in-app browser on a phone. The link
 * back into the app is then finished by the sign-in call itself, so the
 * router must not open the callback screen for it as well.
 */
let pending = false;

export const googleSignInPending = (): boolean => pending;
export const setGoogleSignInPending = (on: boolean): void => {
  pending = on;
};
