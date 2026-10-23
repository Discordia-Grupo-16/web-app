// Module variable instead of storage on purpose: React Native has no sessionStorage, and the process
// stays alive during the sign-out redirect, which is the only window this notice has to survive.
// If the app is killed before the login screen mounts the notice is lost, but the login still
// answers "Cuenta suspendida" through the 403 when the user tries to sign in again.
let pending: string | null = null;

export function setLoginNotice(message: string): void {
  pending = message;
}

/** Reads and deletes the notice, so it shows once. */
export function consumeLoginNotice(): string | null {
  const message = pending;
  pending = null;
  return message;
}
