// Path Google redirects to after the account picker: `com.discordia.mobile:/oauthredirect?code=…`.
const GOOGLE_REDIRECT = /^com\.discordia\.mobile:\/+oauthredirect/;

/**
 * Filters the links expo-router receives. The Google redirect is consumed by `expo-auth-session`,
 * which listens to the same event: routing it too would land on "Pantalla no encontrada" and drop
 * the screen that is waiting for the answer. An empty path makes the router ignore a link; when the
 * link is the one that opened the app there is nothing waiting, so it starts at the root.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }): string {
  if (!GOOGLE_REDIRECT.test(path)) return path;
  return initial ? '/' : '';
}
