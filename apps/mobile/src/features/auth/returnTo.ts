import type { Href } from 'expo-router';
import { useLocalSearchParams } from 'expo-router';
import { RETURN_TO_PARAM, sanitizeReturnTo } from '@discordia/core';

export const LOGIN_ROUTE = '/(auth)/login';
export const REGISTER_ROUTE = '/(auth)/register';
export const HOME_ROUTE = '/(app)';

type AuthRoute = typeof LOGIN_ROUTE | typeof REGISTER_ROUTE;

/**
 * The auth screen that brings the user back to `destination` once the session is open. The
 * destination travels as a route param, so it survives moving between login and register.
 */
export const buildAuthHref = (route: AuthRoute, destination?: string | null): Href => {
  const safe = sanitizeReturnTo(destination);
  if (!safe || safe === '/') return route;
  return { pathname: route, params: { [RETURN_TO_PARAM]: safe } };
};

/** Where to go after authenticating: the pending destination from the route, or the home. */
export const useReturnTo = (): string | null => {
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const value = Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo;
  return sanitizeReturnTo(value);
};
